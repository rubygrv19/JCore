import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openTimeshitDatabase, replaceTimeshitConnection } from '../../server/utils/timeshit-storage'
import { repositoryContext, updateTrackedRepository } from '../../server/utils/timeshit-repositories'
import type { TimeshitActivityStartInput } from '../../shared/types/timeshit-activity'

const upstream = vi.hoisted(() => vi.fn())
const graphql = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/timeshit-activity-github', () => ({ activityGithubGet: upstream, activityGithubGraphql: graphql }))
const session = vi.fn()
let directory: string
let path: string
let key: Buffer
let input: TimeshitActivityStartInput
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'jcore-activity-routes-'))
  path = join(directory, 'private.sqlite')
  key = randomBytes(32)
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('requireUserSession', session.mockReset().mockResolvedValue({ user: { email: 'example@test.invalid' } }))
  vi.stubGlobal('useRuntimeConfig', () => ({ timeshit: { encryptionKey: key.toString('base64'), databasePath: path, trustedOrigin: 'http://localhost' } }))
  const db = openTimeshitDatabase(path)
  replaceTimeshitConnection(db, key, { account: { id: 7, login: 'verified-user' }, token: 'test-token-never-real', discovery: 'available', expectedGeneration: null })
  let context = repositoryContext(db, key)
  updateTrackedRepository(db, key, { expectedGeneration: context.generation, expectedSelectionRevision: context.selectionRevision, repositoryId: 123, action: 'track', page: 1 }, { id: 123, owner: 'example', name: 'project', description: null, private: true, archived: false, defaultBranch: 'main', access: 'not-checked', checkedAt: null })
  context = repositoryContext(db, key)
  input = { expectedGeneration: context.generation, expectedSelectionRevision: context.selectionRevision, range: { startDate: '2026-10-13', endDate: '2026-10-13', timeZone: 'Asia/Jakarta' } }
  db.close()
  upstream.mockReset().mockResolvedValue({ id: 7, node_id: 'MDQ6VXNlcjc=', login: 'verified-user' })
  graphql.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(directory, { recursive: true, force: true })
  vi.resetModules()
})
async function call(operation: 'start' | 'resume', body: unknown, headers: Record<string, string> = {}, query = '') {
  const start = (await import('../../server/api/timeshit/activity.post')).default
  const resume = (await import('../../server/api/timeshit/activity/continue.post')).default
  const router = createRouter().post('/api/timeshit/activity', start).post('/api/timeshit/activity/continue', resume)
  return toWebHandler(createApp({ debug: false }).use(router.handler))(new Request(`http://localhost/api/timeshit/activity${operation === 'resume' ? '/continue' : ''}${query}`, { method: 'POST', headers: { 'Origin': 'http://localhost', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }))
}
describe('Timeshit activity API boundaries', () => {
  it('requires a session on both operations and marks every response private', async () => {
    session.mockRejectedValue(createError({ statusCode: 401 }))
    for (const operation of ['start', 'resume'] as const) {
      const response = await call(operation, input)
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
    expect(upstream).not.toHaveBeenCalled()
  })
  it('rejects untrusted origins, content types, URL capabilities and unapproved scope fields', async () => {
    expect((await call('start', input, { Origin: 'https://evil.invalid' })).status).toBe(403)
    expect((await call('start', input, { 'Content-Type': 'text/plain' })).status).toBe(400)
    expect((await call('start', input, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(400)
    expect((await call('start', input, {}, '?continuation=secret')).status).toBe(400)
    expect((await call('start', { ...input, author: 'other' })).status).toBe(400)
    expect((await call('start', { padding: 'x'.repeat(5000) })).status).toBe(413)
    expect((await call('start', { ...input, range: { ...input.range, endDate: '2026-10-32' } })).status).toBe(400)
    expect((await call('resume', { continuation: 'bad', expectedRevision: 1 })).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('checks scope before GitHub reads and rejects lost process state', async () => {
    expect((await call('start', { ...input, expectedSelectionRevision: input.expectedGeneration })).status).toBe(409)
    expect((await call('resume', { continuation: 'a'.repeat(64), expectedRevision: 1 })).status).toBe(410)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('returns unverified repositories as failed coverage without returning PAT or encryption data', async () => {
    const response = await call('start', input)
    expect(response.status).toBe(200)
    const text = await response.text()
    const result = JSON.parse(text)
    expect(result).toMatchObject({ status: 'partial', continuation: null, partialReasons: ['repository-unavailable'], coverage: [{ repositoryId: 123, failure: 'not-verified' }] })
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(text).not.toContain('test-token-never-real')
    expect(text).not.toContain(key.toString('base64'))
  })
})
