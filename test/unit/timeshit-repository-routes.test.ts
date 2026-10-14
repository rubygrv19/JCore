import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, setHeader, toWebHandler } from 'h3'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openTimeshitDatabase, replaceTimeshitConnection } from '../../server/utils/timeshit-storage'
import { trackedTimeshitRepositories } from '../../server/utils/timeshit-repositories'

const github = vi.hoisted(() => ({ discoverTimeshitRepositories: vi.fn(), checkTimeshitRepository: vi.fn() }))
vi.mock('../../server/utils/timeshit-github', () => github)
const repo = { id: 123, owner: 'example', name: 'project', description: null, private: true, archived: false, defaultBranch: 'main', access: 'not-checked', checkedAt: null }
let directory: string
let path: string
let key: Buffer
const session = vi.fn()
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'jcore-repo-routes-'))
  path = join(directory, 'private.sqlite')
  key = randomBytes(32)
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setHeader', setHeader)
  vi.stubGlobal('requireUserSession', session.mockResolvedValue({ user: { email: 'example@test.invalid' } }))
  vi.stubGlobal('useRuntimeConfig', () => ({ timeshit: { encryptionKey: key.toString('base64'), databasePath: path, trustedOrigin: 'http://localhost' } }))
  github.discoverTimeshitRepositories.mockReset().mockResolvedValue({ repositories: [repo], hasNext: false })
  github.checkTimeshitRepository.mockReset().mockResolvedValue({ ...repo, access: 'readable', checkedAt: new Date().toISOString() })
  const db = openTimeshitDatabase(path)
  replaceTimeshitConnection(db, key, { account: { id: 7, login: 'example' }, token: 'test-token-never-real', discovery: 'available', expectedGeneration: null })
  db.close()
})
afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(directory, { recursive: true, force: true })
})
async function call(endpoint: 'repositories' | 'tracked-repositories', method = 'GET', body?: unknown, origin = 'http://localhost', query = '') {
  const handler = endpoint === 'repositories'
    ? (await import('../../server/api/timeshit/repositories.get')).default
    : method === 'GET' ? (await import('../../server/api/timeshit/tracked-repositories.get')).default : (await import('../../server/api/timeshit/tracked-repositories.put')).default
  const app = createApp({ debug: false }).use(handler)
  return toWebHandler(app)(new Request(`http://localhost/api/timeshit/${endpoint}${query}`, { method, ...(method === 'GET' ? {} : { headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }) }))
}
async function mutation(action = 'track', repositoryId = 123) {
  const state = await (await call('tracked-repositories')).json()
  return { action, repositoryId, page: 1, expectedGeneration: state.generation, expectedSelectionRevision: state.selectionRevision }
}
describe('Timeshit repository API boundaries', () => {
  it('requires authentication for all endpoints and same-origin bounded JSON for mutations', async () => {
    session.mockRejectedValue(createError({ statusCode: 401 }))
    for (const [endpoint, method] of [['repositories', 'GET'], ['tracked-repositories', 'GET'], ['tracked-repositories', 'PUT']] as const) {
      const result = await call(endpoint, method, {})
      expect(result.status).toBe(401)
      expect(result.headers.get('cache-control')).toBe('private, no-store')
    }
    session.mockResolvedValue({})
    expect((await call('tracked-repositories', 'PUT', {}, 'https://evil.example')).status).toBe(403)
    expect((await call('tracked-repositories', 'PUT', { value: 'x'.repeat(5000) })).status).toBe(413)
    expect(github.discoverTimeshitRepositories).not.toHaveBeenCalled()
  })
  it('revalidates membership and rejects forged IDs, stale writes and invalid pages', async () => {
    expect((await call('repositories', 'GET', undefined, undefined, '?page=-1')).status).toBe(400)
    expect((await call('tracked-repositories', 'PUT', await mutation('track', 999))).status).toBe(409)
    expect(github.checkTimeshitRepository).not.toHaveBeenCalled()
    const input = await mutation()
    const saved = await call('tracked-repositories', 'PUT', input)
    expect(saved.status).toBe(200)
    expect((await saved.json()).repositories[0].access).toBe('readable')
    expect((await call('tracked-repositories', 'PUT', input)).status).toBe(409)
  })
  it('marks failed rechecks unavailable and permits removal while GitHub is inaccessible', async () => {
    await call('tracked-repositories', 'PUT', await mutation())
    github.checkTimeshitRepository.mockRejectedValue(createError({ statusCode: 422, statusMessage: 'Access unavailable', data: { code: 'GITHUB_RESTRICTED' } }))
    expect((await call('tracked-repositories', 'PUT', await mutation('check'))).status).toBe(422)
    const db = openTimeshitDatabase(path)
    expect(trackedTimeshitRepositories(db, key).repositories[0]?.access).toBe('unavailable')
    db.close()
    github.discoverTimeshitRepositories.mockClear()
    expect((await call('tracked-repositories', 'PUT', await mutation('remove'))).status).toBe(200)
    expect(github.discoverTimeshitRepositories).not.toHaveBeenCalled()
  })
})
