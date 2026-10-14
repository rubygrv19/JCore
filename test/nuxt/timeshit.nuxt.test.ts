import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTimeshitStore } from '../../app/stores/timeshit'
import examples from '../../docs/timeshit-connection.examples.json'

const getConnection = vi.hoisted(() => vi.fn())
vi.mock('../../app/utils/timeshit-client', () => ({ getTimeshitConnection: getConnection }))
beforeEach(() => {
  setActivePinia(createPinia())
  getConnection.mockReset()
})
describe('Timeshit public connection state', () => {
  it('loads metadata and clears it on logout', async () => {
    getConnection.mockResolvedValue(examples.connected)
    const store = useTimeshitStore()
    await store.load()
    expect(store.connection).toEqual(examples.connected)
    expect(Object.keys(store.$state)).not.toContain('token')
    store.reset()
    expect(store.connection).toBeNull()
  })
  it('does not repopulate state from a request completed after logout', async () => {
    let finish!: (value: unknown) => void
    getConnection.mockReturnValue(new Promise((resolve) => {
      finish = resolve
    }))
    const store = useTimeshitStore()
    const loading = store.load()
    store.reset()
    finish(examples.connected)
    await loading
    expect(store.connection).toBeNull()
    expect(store.loading).toBe(false)
  })
  it('does not display stale identity after a failed reload', async () => {
    getConnection.mockRejectedValue(new Error('Unavailable'))
    const store = useTimeshitStore()
    await store.load()
    expect(store.connection).toBeNull()
    expect(store.error).toContain('Unable')
  })
})
