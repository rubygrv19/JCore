import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, createRouter, defineEventHandler, setHeader, toWebHandler } from 'h3'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TimeshitRepository } from '../../shared/types/timeshit'
import { openTimeshitDatabase, replaceTimeshitConnection } from '../../server/utils/timeshit-storage'
import { repositoryContext, updateTrackedRepository } from '../../server/utils/timeshit-repositories'
import { timeshitError } from '../../server/utils/timeshit-errors'

const github = vi.hoisted(() => ({ verifyTimeshitRepositoryIdentity: vi.fn(), listTimeshitBranches: vi.fn(), listTimeshitCommits: vi.fn(), getTimeshitCommit: vi.fn() }))
vi.mock('../../server/utils/timeshit-github', () => github)

let directory: string
let path: string
let key: Buffer
let repository: TimeshitRepository
const session = vi.fn()

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'jcore-history-routes-'))
  path = join(directory, 'private.sqlite')
  key = randomBytes(32)
  repository = { id: 123, owner: 'example', name: 'project', description: null, private: true, archived: false, defaultBranch: 'main', access: 'readable', checkedAt: '2026-10-13T00:00:00Z' }
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setHeader', setHeader)
  vi.stubGlobal('requireUserSession', session.mockResolvedValue({ user: { email: 'example@test.invalid' } }))
  vi.stubGlobal('useRuntimeConfig', () => ({ timeshit: { encryptionKey: key.toString('base64'), databasePath: path, trustedOrigin: 'http://localhost' } }))
  const db = openTimeshitDatabase(path)
  replaceTimeshitConnection(db, key, { account: { id: 7, login: 'verified-user' }, token: 'test-token-never-real', discovery: 'available', expectedGeneration: null })
  const context = repositoryContext(db, key)
  updateTrackedRepository(db, key, {
    expectedGeneration: context.generation, expectedSelectionRevision: context.selectionRevision, repositoryId: repository.id, action: 'track', page: 1
  }, repository)
  db.close()
  github.verifyTimeshitRepositoryIdentity.mockReset().mockResolvedValue(repository)
  github.listTimeshitBranches.mockReset().mockResolvedValue({ schemaVersion: '1.0', generation: '', repositoryId: 123, page: 1, hasNext: false, branches: [] })
  github.listTimeshitCommits.mockReset().mockResolvedValue({ schemaVersion: '1.0', generation: '', repositoryId: 123, branch: 'main', headSha: 'a'.repeat(40), page: 1, hasNext: false, commits: [] })
  github.getTimeshitCommit.mockReset().mockResolvedValue({ schemaVersion: '1.0', generation: '', repositoryId: 123, sha: 'b'.repeat(40), files: [] })
})
afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(directory, { recursive: true, force: true })
  vi.resetModules()
})

async function call(route: 'branches' | 'commits' | 'detail', repoPath = 'example/project', method = 'GET') {
  const router = createRouter()
  const branches = (await import('../../server/api/timeshit/repositories/[owner]/[repo]/branches.get')).default
  const commits = (await import('../../server/api/timeshit/repositories/[owner]/[repo]/commits.get')).default
  const detail = (await import('../../server/api/timeshit/repositories/[owner]/[repo]/commits/[sha].get')).default
  router.get('/api/timeshit/repositories/:owner/:repo/branches', branches)
  router.get('/api/timeshit/repositories/:owner/:repo/commits', commits)
  router.get('/api/timeshit/repositories/:owner/:repo/commits/:sha', detail)
  const app = createApp({ debug: false }).use(router.handler)
  const suffix = route === 'branches' ? '/branches' : route === 'commits' ? `/commits?branch=main&headSha=${'a'.repeat(40)}` : `/commits/${'b'.repeat(40)}`
  return toWebHandler(app)(new Request(`http://localhost/api/timeshit/repositories/${repoPath}${suffix}`, { method }))
}

describe('Timeshit history API boundaries', () => {
  it('rejects repository path reuse before any branch, commit or file read', async () => {
    github.verifyTimeshitRepositoryIdentity.mockRejectedValue(timeshitError('INVALID_UPSTREAM', 502, 'Repository identity changed. Refresh discovery before tracking it.'))
    for (const route of ['branches', 'commits', 'detail'] as const) expect((await call(route)).status).toBe(502)
    expect(github.listTimeshitBranches).not.toHaveBeenCalled()
    expect(github.listTimeshitCommits).not.toHaveBeenCalled()
    expect(github.getTimeshitCommit).not.toHaveBeenCalled()
  })
  it('requires a JCore session on every history endpoint', async () => {
    session.mockRejectedValue(createError({ statusCode: 401 }))
    for (const route of ['branches', 'commits', 'detail'] as const) {
      const response = await call(route)
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
    expect(github.listTimeshitBranches).not.toHaveBeenCalled()
    expect(github.listTimeshitCommits).not.toHaveBeenCalled()
    expect(github.getTimeshitCommit).not.toHaveBeenCalled()
  })

  it('limits history to tracked, verified repositories and the server-resolved author', async () => {
    expect((await call('branches')).status).toBe(200)
    const commits = await call('commits')
    expect(commits.status).toBe(200)
    expect(github.listTimeshitCommits).toHaveBeenCalledWith(expect.any(String), repository, { branch: 'main', headSha: 'a'.repeat(40), author: 'verified-user', page: 1 })
    const unavailable = await call('branches', 'untracked/private')
    expect(unavailable.status).toBe(404)
    expect(github.listTimeshitBranches).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid refs and pagination before an upstream call', async () => {
    const router = createRouter().get('/api/timeshit/repositories/:owner/:repo/commits', (await import('../../server/api/timeshit/repositories/[owner]/[repo]/commits.get')).default)
    const app = createApp({ debug: false }).use(router.handler)
    const response = await toWebHandler(app)(new Request('http://localhost/api/timeshit/repositories/example/project/commits?branch=main&headSha=wrong&page=0'))
    expect(response.status).toBe(400)
    expect(github.listTimeshitCommits).not.toHaveBeenCalled()
  })

  it('rejects a file page beyond the documented GitHub JSON ceiling', async () => {
    const router = createRouter().get('/api/timeshit/repositories/:owner/:repo/commits/:sha', (await import('../../server/api/timeshit/repositories/[owner]/[repo]/commits/[sha].get')).default)
    const app = createApp({ debug: false }).use(router.handler)
    const response = await toWebHandler(app)(new Request(`http://localhost/api/timeshit/repositories/example/project/commits/${'b'.repeat(40)}?page=31`))
    expect(response.status).toBe(400)
    expect(github.getTimeshitCommit).not.toHaveBeenCalled()
  })
})
