import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { useUserSession } from '#imports'
import { useTimeshitActivityStore } from '../../app/stores/timeshit-activity'
import { useTimeshitStore } from '../../app/stores/timeshit'
import { useTimeshitRepositoriesStore } from '../../app/stores/timeshit-repositories'
import examples from '../../docs/timeshit-activity.examples.json'
import connectionExamples from '../../docs/timeshit-connection.examples.json'
import type { TimeshitActivitySnapshot } from '../../shared/types/timeshit-activity'

const api = vi.hoisted(() => ({ startTimeshitActivity: vi.fn(), continueTimeshitActivity: vi.fn(), getTimeshitRepositories: vi.fn() }))
vi.mock('../../app/utils/timeshit-client', () => api)
let pinia: Pinia
const partial = () => structuredClone(examples.snapshots.partial) as TimeshitActivitySnapshot
const complete = (revision = 2) => ({ ...structuredClone(examples.snapshots.complete), revision }) as TimeshitActivitySnapshot
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(examples.snapshots.partial.startedAt))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  pinia = createPinia()
  setActivePinia(pinia)
  useUserSession().session.value = { id: 'synthetic-session', user: { email: 'test@example.invalid' } }
  useTimeshitStore().connection = { ...connectionExamples.connected, generation: examples.start.expectedGeneration, account: partial().account } as never
  useTimeshitRepositoriesStore().tracked = { schemaVersion: '1.0', generation: examples.start.expectedGeneration, selectionRevision: examples.start.expectedSelectionRevision,
    repositories: partial().coverage.map(repo => ({ id: repo.repositoryId, owner: repo.owner, name: repo.name, description: null, private: true, archived: false, defaultBranch: 'main', access: 'readable', checkedAt: null })), page: 1, hasNext: false }
  api.startTimeshitActivity.mockReset().mockResolvedValue(partial())
  api.continueTimeshitActivity.mockReset().mockResolvedValue(complete())
})
afterEach(() => {
  disposePinia(pinia)
  vi.restoreAllMocks()
  vi.useRealTimers()
})
function ready() {
  const store = useTimeshitActivityStore()
  store.attachView()
  return store
}
function deferred() {
  let resolve!: (snapshot: TimeshitActivitySnapshot) => void
  const promise = new Promise<TimeshitActivitySnapshot>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}
describe('Timeshit activity collection state', () => {
  it('retains the snapshot and verified tracked scope while repository pages refresh', async () => {
    const store = ready()
    const repositories = useTimeshitRepositoriesStore()
    await store.start(examples.start.range as never)
    const tracked = repositories.tracked!
    api.getTimeshitRepositories.mockResolvedValueOnce(tracked).mockResolvedValueOnce({ ...tracked, page: 2 })

    await repositories.load(2)

    expect(repositories.tracked).toEqual(tracked)
    expect(repositories.discovery?.page).toBe(2)
    expect(store.snapshot).toEqual(partial())
    expect(store.phase).toBe('waiting')
    expect(store.resumable).toBe(true)
  })

  it('keeps the activity snapshot and tracked scope when a non-auth refresh fails', async () => {
    const store = ready()
    const repositories = useTimeshitRepositoriesStore()
    await store.start(examples.start.range as never)
    const tracked = repositories.tracked!
    api.getTimeshitRepositories.mockResolvedValueOnce(tracked).mockRejectedValueOnce(new Error('temporary network error'))

    await repositories.load(2)

    expect(repositories.tracked).toEqual(tracked)
    expect(repositories.discovery).toBeNull()
    expect(repositories.error).toContain('Unable to load repositories')
    expect(store.snapshot).toEqual(partial())
    expect(store.resumable).toBe(true)
  })

  it('invalidates activity when refresh confirms a changed tracked selection', async () => {
    const store = ready()
    const repositories = useTimeshitRepositoriesStore()
    await store.start(examples.start.range as never)
    const changed = { ...repositories.tracked!, selectionRevision: 'new-selection' }
    api.getTimeshitRepositories.mockResolvedValueOnce(changed).mockResolvedValueOnce({ ...changed, page: 2 })

    await repositories.load(2)

    expect(repositories.tracked?.selectionRevision).toBe('new-selection')
    expect(store.snapshot).toBeNull()
    expect(store.phase).toBe('idle')
  })

  it('requires an explicitly active visible view and validates dates before starting', async () => {
    const store = useTimeshitActivityStore()
    await store.start(examples.start.range as never)
    expect(api.startTimeshitActivity).not.toHaveBeenCalled()
    store.attachView()
    await store.start({ ...examples.start.range, endDate: 'invalid' } as never)
    expect(api.startTimeshitActivity).not.toHaveBeenCalled()
    expect(store.error).toContain('valid date range')
    store.detachView()
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })

  it('replaces cumulative snapshots, sends exact revisions, exposes coverage and stops when complete', async () => {
    const store = ready()
    await store.start(examples.start.range as never)
    expect(api.startTimeshitActivity).toHaveBeenCalledWith(examples.start)
    expect(store.phase).toBe('waiting')
    expect(store.snapshot?.revision).toBe(1)
    expect(store.coverage.total).toBe(partial().coverage.length)
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.continueTimeshitActivity).toHaveBeenCalledWith(examples.resume)
    expect(store.snapshot).toEqual(complete())
    expect(store.snapshot?.items).toHaveLength(complete().items.length)
    expect(store.phase).toBe('complete')
    expect(store.resumable).toBe(false)
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.continueTimeshitActivity).toHaveBeenCalledTimes(1)
  })

  it('pauses future batches but checkpoints a response already in flight', async () => {
    const store = ready()
    const pending = deferred()
    api.startTimeshitActivity.mockReturnValueOnce(pending.promise)
    const starting = store.start(examples.start.range as never)
    store.pause()
    pending.resolve(partial())
    await starting
    expect(store.phase).toBe('paused')
    expect(store.loading).toBe(false)
    expect(store.resumable).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
    await store.resume()
    expect(store.phase).toBe('complete')
  })

  it('pauses on hidden tabs and navigation; visibility alone never restarts work', async () => {
    const store = ready()
    await store.start(examples.start.range as never)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(store.phase).toBe('paused')
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
    store.detachView()
    await store.resume()
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })

  it('honors snapshot cooldowns even when resume is requested manually', async () => {
    const store = ready()
    api.startTimeshitActivity.mockResolvedValueOnce(examples.snapshots.rateLimited)
    await store.start(examples.start.range as never)
    const delay = examples.snapshots.rateLimited.retryAfterSeconds! * 1000
    store.pause()
    await store.resume()
    await vi.advanceTimersByTimeAsync(delay - 1)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.continueTimeshitActivity).toHaveBeenCalledTimes(1)
  })

  it('retains a stale snapshot after network failure and retries the same revision', async () => {
    const store = ready()
    await store.start(examples.start.range as never)
    api.continueTimeshitActivity.mockRejectedValueOnce(new Error('secret upstream details'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.phase).toBe('error')
    expect(store.stale).toBe(true)
    expect(store.error).not.toContain('secret')
    expect(store.snapshot?.revision).toBe(1)
    await store.resume()
    expect(api.continueTimeshitActivity.mock.calls).toEqual([[examples.resume], [examples.resume]])
    expect(store.stale).toBe(false)
    expect(store.phase).toBe('complete')
  })

  it('never resumes a replaced old snapshot after a failed refresh', async () => {
    const store = ready()
    await store.start(examples.start.range as never)
    store.pause()
    api.startTimeshitActivity.mockRejectedValueOnce(new Error('Network'))
    await store.start(examples.start.range as never)
    expect(store.snapshot).toEqual(partial())
    expect(store.stale).toBe(true)
    expect(store.resumable).toBe(false)
    await store.resume()
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })

  it.each(['generation', 'selection', 'account', 'logout'] as const)('clears private state and ignores late responses after %s changes', async (change) => {
    const store = ready()
    const pending = deferred()
    api.startTimeshitActivity.mockReturnValueOnce(pending.promise)
    const starting = store.start(examples.start.range as never)
    if (change === 'generation') useTimeshitStore().connection!.generation = 'changed'
    if (change === 'selection') useTimeshitRepositoriesStore().tracked!.selectionRevision = 'changed'
    if (change === 'account') useTimeshitStore().connection!.account!.id = 99
    if (change === 'logout') useUserSession().session.value = { id: 'synthetic-session' }
    pending.resolve(partial())
    await starting
    expect(store.snapshot).toBeNull()
    expect(store.loading).toBe(false)
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })

  it('rejects mismatched account, repository scope and nonsequential revisions', async () => {
    const store = ready()
    api.startTimeshitActivity.mockResolvedValueOnce({ ...partial(), account: { id: 99, login: 'other' } })
    await store.start(examples.start.range as never)
    expect(store.snapshot).toBeNull()
    api.startTimeshitActivity.mockResolvedValueOnce({ ...partial(), coverage: [] })
    await store.start(examples.start.range as never)
    expect(store.snapshot).toBeNull()
    await store.start(examples.start.range as never)
    api.continueTimeshitActivity.mockResolvedValueOnce(complete(4))
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.snapshot?.revision).toBe(1)
    expect(store.resumable).toBe(false)
    expect(store.phase).toBe('error')
  })

  it('expires continuation locally and does not issue another batch', async () => {
    const store = ready()
    await store.start(examples.start.range as never)
    store.pause()
    await vi.advanceTimersByTimeAsync(Date.parse(partial().expiresAt) - Date.now())
    expect(store.phase).toBe('expired')
    expect(store.stale).toBe(true)
    expect(store.resumable).toBe(false)
    await store.resume()
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })

  it('keeps terminal partial coverage distinct from complete', async () => {
    const store = ready()
    api.startTimeshitActivity.mockResolvedValueOnce(examples.snapshots.failedRepository)
    await store.start(examples.start.range as never)
    expect(store.phase).toBe('partial')
    expect(store.resumable).toBe(false)
    expect(store.coverage.failed).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })
  it('honors HTTP cooldowns, including a failed start without a continuation', async () => {
    const store = ready()
    api.startTimeshitActivity.mockRejectedValueOnce({ data: { data: { code: 'ACTIVITY_BUSY', retryAfterSeconds: 5 } } })
    await store.start(examples.start.range as never)
    await store.start(examples.start.range as never)
    expect(api.startTimeshitActivity).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    await store.start(examples.start.range as never)
    api.continueTimeshitActivity.mockRejectedValueOnce({ data: { data: { code: 'GITHUB_RATE_LIMITED', retryAfterSeconds: 10 } } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.phase).toBe('waiting')
    expect(store.stale).toBe(true)
    await vi.advanceTimersByTimeAsync(9999)
    expect(api.continueTimeshitActivity).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(store.phase).toBe('complete')
    expect(api.continueTimeshitActivity.mock.calls).toEqual([[examples.resume], [examples.resume]])
  })

  it.each(['CONNECTION_CHANGED', 'GITHUB_AUTH_FAILED', 'UNAUTHENTICATED'])('clears private snapshots for %s responses', async (code) => {
    const store = ready()
    await store.start(examples.start.range as never)
    api.continueTimeshitActivity.mockRejectedValueOnce({ statusCode: code === 'UNAUTHENTICATED' ? 401 : 422, data: { data: { code } } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.snapshot).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.resumable).toBe(false)
    expect(store.phase).toBe('error')
  })

  it('requires a new collection for revision conflicts and expired server state', async () => {
    const store = ready()
    await store.start(examples.start.range as never)
    api.continueTimeshitActivity.mockRejectedValueOnce({ data: { data: { code: 'ACTIVITY_REVISION_CHANGED' } } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.resumable).toBe(false)
    await store.start(examples.start.range as never)
    api.continueTimeshitActivity.mockRejectedValueOnce({ data: { data: { code: 'ACTIVITY_EXPIRED' } } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.phase).toBe('expired')
    expect(store.resumable).toBe(false)
    expect(store.stale).toBe(true)
  })
  it('waits until expiry instead of overflowing a timer for an oversized cooldown', async () => {
    const store = ready()
    api.startTimeshitActivity.mockResolvedValueOnce({ ...partial(), partialReasons: ['rate-limited'], retryAfterSeconds: 2147483647 })
    await store.start(examples.start.range as never)
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(Date.parse(partial().expiresAt) - Date.now())
    expect(store.phase).toBe('expired')
    expect(api.continueTimeshitActivity).not.toHaveBeenCalled()
  })
})
