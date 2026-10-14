import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, setHeader, toWebHandler } from 'h3'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openTimeshitDatabase } from '../../server/utils/timeshit-storage'
import { repositoryContext, trackedTimeshitRepositories, updateTrackedRepository } from '../../server/utils/timeshit-repositories'
import { timeshitError } from '../../server/utils/timeshit-errors'

const github = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/timeshit-github', () => ({ verifyTimeshitIdentity: github }))
let directory: string
let key: Buffer
const session = vi.fn()
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'jcore-routes-'))
  key = randomBytes(32)
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setHeader', setHeader)
  vi.stubGlobal('requireUserSession', session.mockReset().mockResolvedValue({ user: { email: 'example@test.invalid' } }))
  vi.stubGlobal('useRuntimeConfig', () => ({ timeshit: { encryptionKey: key.toString('base64'), databasePath: join(directory, 'connection.sqlite'), trustedOrigin: 'http://localhost' } }))
  github.mockReset().mockResolvedValue({ account: { id: 7, login: 'example' }, discovery: 'available' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  rmSync(directory, { recursive: true, force: true })
  vi.resetModules()
})
async function call(method: 'GET' | 'POST' | 'DELETE', body?: unknown, origin = 'http://localhost') {
  const handler = method === 'GET' ? (await import('../../server/api/timeshit/connection.get')).default : method === 'POST' ? (await import('../../server/api/timeshit/connection.post')).default : (await import('../../server/api/timeshit/connection.delete')).default
  const app = createApp({ debug: false })
  app.use(handler)
  return toWebHandler(app)(new Request('http://localhost/api/timeshit/connection', { method, ...(method === 'GET' ? {} : { headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }) }))
}
describe('Timeshit private endpoint boundaries', () => {
  it('preserves state on rejected replacements, invalidates verification on same-account replacement, and clears it on account switch/disconnect', async () => {
    let now = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const token = 'test_only_synthetic_connection_alpha'
    const first = await (await call('POST', { token, expectedGeneration: null })).json()
    expect(first.state).toBe('connected')
    const db = openTimeshitDatabase(join(directory, 'connection.sqlite'))
    const context = repositoryContext(db, key)
    updateTrackedRepository(db, key, { expectedGeneration: context.generation, expectedSelectionRevision: context.selectionRevision, repositoryId: 123, action: 'track', page: 1 }, { id: 123, owner: 'example', name: 'project', description: null, private: true, archived: false, defaultBranch: 'development', access: 'readable', checkedAt: new Date().toISOString() })
    db.close()
    const tracked = () => {
      const db = openTimeshitDatabase(join(directory, 'connection.sqlite'))
      try {
        return trackedTimeshitRepositories(db, key)
      } finally { db.close() }
    }
    now += 12001
    github.mockRejectedValueOnce(timeshitError('GITHUB_AUTH_FAILED', 422, 'Rejected.'))
    expect((await call('POST', { token: 'test_only_synthetic_invalid_token', expectedGeneration: first.generation })).status).toBe(422)
    expect((await (await call('GET')).json()).generation).toBe(first.generation)
    expect(tracked().repositories[0]?.access).toBe('readable')
    now += 12001
    const replacement = await (await call('POST', { token, expectedGeneration: first.generation })).json()
    expect(replacement.generation).not.toBe(first.generation)
    expect(tracked().repositories).toMatchObject([{ id: 123, access: 'not-checked' }])
    expect(tracked().selectionRevision).not.toBe(context.selectionRevision)
    expect((await call('DELETE', { expectedGeneration: first.generation })).status).toBe(409)
    now += 12001
    github.mockResolvedValueOnce({ account: { id: 8, login: 'other-example' }, discovery: 'available' })
    const other = await (await call('POST', { token: 'test_only_synthetic_connection_beta', expectedGeneration: replacement.generation })).json()
    expect(other.account.id).toBe(8)
    expect(tracked().repositories).toEqual([])
    expect((await (await call('DELETE', { expectedGeneration: other.generation })).json()).state).toBe('disconnected')
    expect((await (await call('GET')).json()).state).toBe('disconnected')
    now += 12001
    const reconnected = await (await call('POST', { token, expectedGeneration: null })).json()
    expect(reconnected.account.id).toBe(7)
    expect(reconnected.generation).not.toBe(first.generation)
    expect(tracked().repositories).toEqual([])
    expect(JSON.stringify([first, replacement, other, reconnected])).not.toContain(token)
  })

  it('guards every method before GitHub access', async () => {
    session.mockRejectedValue(createError({ statusCode: 401, statusMessage: 'Unauthorized' }))
    for (const method of ['GET', 'POST', 'DELETE'] as const) {
      const response = await call(method, {})
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
    expect(github).not.toHaveBeenCalled()
  })
  it('rejects cross-origin requests and oversized bodies before upstream access', async () => {
    expect((await call('POST', { token: 'x'.repeat(30), expectedGeneration: null }, 'https://evil.example')).status).toBe(403)
    expect((await call('DELETE', { expectedGeneration: null }, 'https://evil.example')).status).toBe(403)
    expect((await call('POST', { token: 'x'.repeat(5000), expectedGeneration: null })).status).toBe(413)
    expect(github).not.toHaveBeenCalled()
  })
  it('returns only public metadata after connect', async () => {
    const token = 'github_pat_mock_only_for_unit_tests'
    const response = await call('POST', { token, expectedGeneration: null })
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.account.login).toBe('example')
    expect(JSON.stringify(result)).not.toContain(token)
    expect(result.checks.contents).toBe('not-checked')
  })
})
