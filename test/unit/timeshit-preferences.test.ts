import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, setHeader, toWebHandler } from 'h3'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openTimeshitDatabase } from '../../server/utils/timeshit-storage'
import { parseTimeshitPreferences } from '../../shared/utils/timeshit-preferences'
import { readTimeshitPreferences, writeTimeshitPreferences } from '../../server/utils/timeshit-preferences'
import examples from '../../docs/timeshit-preferences.examples.json'

let directory: string
const session = vi.fn()
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'jcore-preferences-'))
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setHeader', setHeader)
  vi.stubGlobal('requireUserSession', session.mockResolvedValue({ user: { email: 'test@example.invalid' } }))
  vi.stubGlobal('useRuntimeConfig', () => ({ timeshit: { encryptionKey: randomBytes(32).toString('base64'), databasePath: join(directory, 'test.sqlite'), trustedOrigin: 'http://localhost' } }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(directory, { recursive: true, force: true })
})
async function call(method: 'GET' | 'PUT', body?: unknown, origin = 'http://localhost') {
  const handler = method === 'GET' ? (await import('../../server/api/timeshit/preferences.get')).default : (await import('../../server/api/timeshit/preferences.put')).default
  const app = createApp({ debug: false })
  app.use(handler)
  return toWebHandler(app)(new Request('http://localhost/api/timeshit/preferences', { method, ...(method === 'GET' ? {} : { headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }) }))
}
describe('Timeshit persisted history preference', () => {
  it('defaults to development and survives reopening the private database', () => {
    const path = join(directory, 'test.sqlite')
    let db = openTimeshitDatabase(path)
    expect(readTimeshitPreferences(db)).toEqual(examples.default)
    writeTimeshitPreferences(db, examples.custom)
    db.close()
    db = openTimeshitDatabase(path)
    expect(readTimeshitPreferences(db)).toEqual(examples.custom)
    expect(db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 3 })
    db.close()
  })
  it('migrates an existing v2 database without changing repository selection', () => {
    const path = join(directory, 'test.sqlite')
    let db = openTimeshitDatabase(path)
    const before = db.prepare('SELECT revision FROM repository_selection WHERE id = 1').get()
    db.exec('DROP TABLE timeshit_preferences; PRAGMA user_version = 2;')
    db.close()
    db = openTimeshitDatabase(path)
    expect(readTimeshitPreferences(db)).toEqual(examples.default)
    expect(db.prepare('SELECT revision FROM repository_selection WHERE id = 1').get()).toEqual(before)
    db.close()
  })
  it('validates examples and rejects unknown properties, empty, whitespace and oversized names', () => {
    expect(parseTimeshitPreferences(examples.custom)).toEqual(examples.custom)
    for (const name of ['', ' ', 'two branches', '\nmain', 'x'.repeat(256)]) expect(() => parseTimeshitPreferences({ ...examples.default, historyDefaultBranch: name })).toThrow()
    expect(() => parseTimeshitPreferences({ ...examples.default, token: 'not-allowed' })).toThrow()
  })
  it('guards both endpoints and marks private responses non-cacheable', async () => {
    session.mockRejectedValue(createError({ statusCode: 401 }))
    for (const method of ['GET', 'PUT'] as const) {
      const response = await call(method, examples.custom)
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
  })
  it('persists through the API and rejects invalid or cross-origin mutations', async () => {
    expect(await (await call('GET')).json()).toEqual(examples.default)
    expect((await call('PUT', examples.custom, 'https://evil.example')).status).toBe(403)
    expect((await call('PUT', { ...examples.default, historyDefaultBranch: '' })).status).toBe(400)
    expect(await (await call('PUT', examples.custom)).json()).toEqual(examples.custom)
    expect(await (await call('GET')).json()).toEqual(examples.custom)
  })
})
