import { defineStore } from 'pinia'
import type { TimeshitConnection } from '#shared/types/timeshit'
import { getTimeshitConnection } from '~/utils/timeshit-client'

export const useTimeshitStore = defineStore('timeshit', () => {
  const connection = ref<TimeshitConnection | null>(null)
  const loading = ref(false)
  const error = ref('')
  let revision = 0
  async function load() {
    const request = ++revision
    loading.value = true
    error.value = ''
    try {
      const result = await getTimeshitConnection()
      if (request === revision) connection.value = result
    } catch {
      if (request === revision) {
        connection.value = null
        error.value = 'Unable to load connection status. Try again.'
      }
    } finally { if (request === revision) loading.value = false }
  }
  function reset() {
    revision++
    connection.value = null
    loading.value = false
    error.value = ''
  }
  return { connection, loading, error, load, reset }
})
