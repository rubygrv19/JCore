import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { useUserSession } from '#imports'
import { useTimeshitPageLifecycle } from '../../app/composables/use-timeshit-page-lifecycle'
import { useTimeshitActivityStore } from '../../app/stores/timeshit-activity'
import { useTimeshitHistoryStore } from '../../app/stores/timeshit-history'
import { useTimeshitRepositoriesStore } from '../../app/stores/timeshit-repositories'
import { useTimeshitStore } from '../../app/stores/timeshit'
import connectionExamples from '../../docs/timeshit-connection.examples.json'
import type { TimeshitRepositories } from '../../shared/types/timeshit'

const api = vi.hoisted(() => ({ getTimeshitConnection: vi.fn(), getTimeshitRepositories: vi.fn(), getTimeshitPreferences: vi.fn() }))
vi.mock('../../app/utils/timeshit-client', () => api)

const tracked: TimeshitRepositories = { schemaVersion: '1.0', generation: 'generation', selectionRevision: 'selection', repositories: [], page: 1, hasNext: false }

beforeEach(() => {
  setActivePinia(createPinia())
  useUserSession().session.value = { id: 'synthetic-session', user: { email: 'test@example.invalid' } }
  api.getTimeshitConnection.mockReset().mockResolvedValue({ ...connectionExamples.connected, generation: 'generation' })
  api.getTimeshitRepositories.mockReset().mockResolvedValue(tracked)
  api.getTimeshitPreferences.mockReset().mockResolvedValue({ schemaVersion: '1.0', historyDefaultBranch: 'main' })
})

describe('Timeshit page lifecycle', () => {
  it('loads page data and preferences on mount, then detaches and resets view stores on unmount', async () => {
    const onMount = vi.fn()
    const onPreferredBranchLoaded = vi.fn()
    const wrapper = mount(defineComponent({
      setup() {
        useTimeshitPageLifecycle({ onMount, onPreferredBranchLoaded })
        return () => h('div')
      }
    }))

    await vi.waitFor(() => expect(api.getTimeshitPreferences).toHaveBeenCalledOnce())
    expect(onMount).toHaveBeenCalledOnce()
    expect(api.getTimeshitRepositories.mock.calls).toEqual([[1, true], [1]])
    expect(onPreferredBranchLoaded).toHaveBeenCalledWith('main')

    const activity = useTimeshitActivityStore()
    const repositories = useTimeshitRepositoriesStore()
    const history = useTimeshitHistoryStore()
    expect(activity.viewActive).toBe(true)
    expect(repositories.tracked).toEqual(tracked)
    repositories.discovery = tracked
    history.repository = { id: 7, owner: 'example', name: 'repo', description: null, private: true, archived: false, defaultBranch: 'main', access: 'readable', checkedAt: null }

    wrapper.unmount()

    expect(activity.viewActive).toBe(false)
    expect(repositories.tracked).toBeNull()
    expect(repositories.discovery).toBeNull()
    expect(history.repository).toBeNull()
    expect(useTimeshitStore().connection?.state).toBe('connected')
  })

  it('clears repositories when the connection is not active', async () => {
    api.getTimeshitConnection.mockResolvedValue({ ...connectionExamples.disconnected })
    const wrapper = mount(defineComponent({
      setup() {
        useTimeshitPageLifecycle({ onMount: vi.fn(), onPreferredBranchLoaded: vi.fn() })
        return () => h('div')
      }
    }))

    await vi.waitFor(() => expect(useTimeshitRepositoriesStore().loading).toBe(false))
    expect(api.getTimeshitRepositories).not.toHaveBeenCalled()
    expect(useTimeshitRepositoriesStore().tracked).toBeNull()
    wrapper.unmount()
  })
})
