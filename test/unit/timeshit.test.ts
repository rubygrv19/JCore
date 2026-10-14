import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decryptTimeshitToken, encryptTimeshitToken, parseTimeshitKey } from '../../server/utils/timeshit-crypto'
import { deleteTimeshitConnection, openTimeshitDatabase, readTimeshitConnection, replaceTimeshitConnection } from '../../server/utils/timeshit-storage'
import { validateTimeshitInput, validateTimeshitOrigin } from '../../server/utils/timeshit-http'
import { parseTimeshitConnection } from '../../shared/utils/timeshit-contract'
import examples from '../../docs/timeshit-connection.examples.json'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
})
const token = 'github_pat_unit_test_secret_never_real'
const input = { account: { id: 123, login: 'example-user' }, discovery: 'available' as const, token, expectedGeneration: null }

describe('Timeshit encryption', () => {
  it('uses random authenticated encryption and rejects tampering, wrong keys and metadata', () => {
    const key = randomBytes(32)
    expect(parseTimeshitKey(key.toString('base64'))).toEqual(key)
    expect(() => parseTimeshitKey('invalid')).toThrow()
    const first = encryptTimeshitToken(token, key, 'account')
    expect(first).not.toContain(token)
    expect(encryptTimeshitToken(token, key, 'account')).not.toEqual(first)
    expect(decryptTimeshitToken(first, key, 'account')).toBe(token)
    expect(() => decryptTimeshitToken(first, randomBytes(32), 'account')).toThrow()
    expect(() => decryptTimeshitToken(first, key, 'changed')).toThrow()
    const modified = { ...JSON.parse(first), ciphertext: Buffer.from('tampered').toString('base64') }
    expect(() => decryptTimeshitToken(JSON.stringify(modified), key, 'account')).toThrow()
  })
})

describe('Timeshit persistent connection', () => {
  it('survives restart, excludes secrets, rejects stale writes, fails closed and permits disconnect recovery', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jcore-timeshit-'))
    directories.push(directory)
    const path = join(directory, 'connection.sqlite')
    const key = randomBytes(32)
    let db = openTimeshitDatabase(path)
    const connected = replaceTimeshitConnection(db, key, input)
    expect(parseTimeshitConnection(connected).account?.id).toBe(123)
    expect(JSON.stringify(connected)).not.toContain(token)
    expect(() => replaceTimeshitConnection(db, key, input)).toThrow(/changed/)
    db.close()
    expect(readFileSync(path).includes(Buffer.from(token))).toBe(false)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    db = openTimeshitDatabase(path)
    try {
      expect(readTimeshitConnection(db, key)).toEqual(connected)
      expect(() => readTimeshitConnection(db, randomBytes(32))).toThrow(/decrypt/)
      expect(() => replaceTimeshitConnection(db, randomBytes(32), { ...input, expectedGeneration: connected.generation })).toThrow(/decrypt/)
      expect(readTimeshitConnection(db, key)).toEqual(connected)
      expect(() => deleteTimeshitConnection(db, null)).toThrow(/changed/)
      deleteTimeshitConnection(db, connected.generation)
      expect(readTimeshitConnection(db, key).state).toBe('disconnected')
    } finally { db.close() }
  })
  it('rejects public paths', () => {
    expect(() => openTimeshitDatabase('/tmp/public/pat.sqlite')).toThrow()
    expect(() => openTimeshitDatabase('relative.sqlite')).toThrow()
  })
})

describe('Timeshit contract and mutation validation', () => {
  it('validates documented fixtures and rejects secrets or contradictory states', () => {
    Object.values(examples).forEach(value => expect(parseTimeshitConnection(value)).toEqual(value))
    expect(() => parseTimeshitConnection({ ...examples.connected, token })).toThrow()
    expect(() => parseTimeshitConnection({ ...examples.connected, account: null })).toThrow()
    expect(() => parseTimeshitConnection({ ...examples.disconnected, generation: examples.connected.generation })).toThrow()
  })
  it('requires a trusted exact origin and explicit revision, rejects unexpected input', () => {
    expect(() => validateTimeshitOrigin('http://127.0.0.1:3000', 'http://127.0.0.1:3000')).not.toThrow()
    for (const origin of [undefined, 'https://evil.example', 'null']) expect(() => validateTimeshitOrigin(origin, 'http://127.0.0.1:3000')).toThrow()
    expect(() => validateTimeshitOrigin('http://127.0.0.1:3000', '')).toThrow()
    expect(validateTimeshitInput({ token, expectedGeneration: null }, true).token).toBe(token)
    for (const value of [{ token }, { token, expectedGeneration: null, url: 'https://evil.example' }, { token: 'short', expectedGeneration: null }, { token: 'x'.repeat(1025), expectedGeneration: null }]) expect(() => validateTimeshitInput(value, true)).toThrow()
    expect(validateTimeshitInput({ expectedGeneration: examples.connected.generation }, false).token).toBe('')
  })
})
