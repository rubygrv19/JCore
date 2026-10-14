import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTimeshitRepositoriesStore } from '../../app/stores/timeshit-repositories'

const api = vi.hoisted(() => ({ getTimeshitRepositories: vi.fn(), changeTimeshitRepository: vi.fn() }))
vi.mock('../../app/utils/timeshit-client', () => api)
const page = { schemaVersion: '1.0', generation: 'first', selectionRevision: 'selection', repositories: [], page: 1, hasNext: false }
beforeEach(() => {
  setActivePinia(createPinia())
  api.getTimeshitRepositories.mockReset().mockResolvedValue(page)
  api.changeTimeshitRepository.mockReset().mockResolvedValue(page)
})
describe('Timeshit repository state isolation', () => {
  it('clears private selection and discovery when a mutation loses its session', async () => {
    const store = useTimeshitRepositoriesStore()
    await store.load()
    api.changeTimeshitRepository.mockRejectedValueOnce({ response: { status: 401 } })
    await store.change(123, 'check')
    expect(store.tracked).toBeNull()
    expect(store.discovery).toBeNull()
    expect(store.error).toContain('Unable')
    expect(api.getTimeshitRepositories).toHaveBeenCalledTimes(2)
  })
  it('loads persisted selection before discovery and submits server revisions', async () => {
    const store = useTimeshitRepositoriesStore()
    await store.load(2)
    expect(api.getTimeshitRepositories.mock.calls).toEqual([[1, true], [2]])
    await store.change(123, 'track')
    expect(api.changeTimeshitRepository).toHaveBeenCalledWith({ repositoryId: 123, action: 'track', page: 1, expectedGeneration: 'first', expectedSelectionRevision: 'selection' })
    store.reset()
    expect(store.discovery).toBeNull()
    expect(store.tracked).toBeNull()
  })
  it('cannot repopulate private repository state after logout or navigation reset', async () => {
    let finish!: (value: unknown) => void
    api.getTimeshitRepositories.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve
    }))
    const store = useTimeshitRepositoriesStore()
    const pending = store.load()
    store.reset()
    finish(page)
    await pending
    expect(store.tracked).toBeNull()
    expect(store.loading).toBe(false)
    expect(api.getTimeshitRepositories).toHaveBeenCalledTimes(1)
  })
  it('preserves removable tracked repositories when discovery is unavailable', async () => {
    api.getTimeshitRepositories.mockResolvedValueOnce(page).mockRejectedValueOnce({ data: { statusMessage: 'GitHub rate limit reached.', data: { retryAfterSeconds: 60 } } })
    const store = useTimeshitRepositoriesStore()
    await store.load()
    expect(store.tracked).toEqual(page)
    expect(store.discovery).toBeNull()
    expect(store.error).toContain('60 seconds')
  })
  it('discards old discovery on an account change detected during mutation', async () => {
    const store = useTimeshitRepositoriesStore()
    await store.load()
    api.changeTimeshitRepository.mockRejectedValueOnce(new Error('Conflict'))
    api.getTimeshitRepositories.mockResolvedValueOnce({ ...page, generation: 'other-account' })
    await store.change(123, 'check')
    expect(store.discovery).toBeNull()
    expect(store.tracked).toBeNull()
  })
})
