import { defineStore } from 'pinia'
import type { TimeshitRepositories, TimeshitRepositoryMutation } from '#shared/types/timeshit'
import { getTimeshitRepositories, changeTimeshitRepository } from '~/utils/timeshit-client'

export const useTimeshitRepositoriesStore = defineStore('timeshit-repositories', () => {
  const tracked = ref<TimeshitRepositories | null>(null)
  const discovery = ref<TimeshitRepositories | null>(null)
  const loading = ref(false)
  const busyId = ref<number | null>(null)
  const error = ref('')
  let revision = 0
  function message(error: unknown) {
    const failure = error as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number, statusMessage?: string, data?: { code?: string, retryAfterSeconds?: number } } }
    const data = failure.data
    if ((failure.statusCode ?? failure.response?.status ?? data?.statusCode) === 401 || ['CONNECTION_CHANGED', 'GITHUB_AUTH_FAILED'].includes(data?.data?.code ?? '')) reset()
    const delay = data?.data?.retryAfterSeconds
    return `${data?.statusMessage || 'Unable to load repositories. Try again.'}${delay ? ` Retry after ${delay} seconds.` : ''}`
  }
  async function load(page = 1) {
    const request = ++revision
    loading.value = true
    error.value = ''
    discovery.value = null
    tracked.value = null
    try {
      const saved = await getTimeshitRepositories(1, true)
      if (request !== revision) return
      tracked.value = saved
      const available = await getTimeshitRepositories(page)
      if (request !== revision) return
      if (available.generation !== saved.generation) {
        tracked.value = null
        throw new Error('Connection changed')
      }
      discovery.value = available
    } catch (cause) {
      if (request === revision) error.value = message(cause)
    } finally {
      if (request === revision) loading.value = false
    }
  }
  async function change(repositoryId: number, action: TimeshitRepositoryMutation['action']) {
    const current = tracked.value
    if (!current || busyId.value !== null || loading.value) return
    const request = revision
    busyId.value = repositoryId
    error.value = ''
    try {
      const result = await changeTimeshitRepository({ repositoryId, action, page: discovery.value?.page ?? 1,
        expectedGeneration: current.generation, expectedSelectionRevision: current.selectionRevision })
      if (request === revision) tracked.value = result
    } catch (cause) {
      if (request === revision) {
        error.value = message(cause)
        if (request !== revision) return
        try {
          const result = await getTimeshitRepositories(1, true)
          if (request === revision) {
            if (result.generation !== current.generation) {
              tracked.value = null
              discovery.value = null
            } else tracked.value = result
          }
        } catch { /* Keep the last-known selection visible until refresh. */ }
      }
    } finally { if (request === revision) busyId.value = null }
  }
  function reset() {
    revision++
    tracked.value = null
    discovery.value = null
    loading.value = false
    busyId.value = null
    error.value = ''
  }
  return { tracked, discovery, loading, busyId, error, load, change, reset }
})
