import { disconnectedTimeshit, readStoredTimeshit, readTimeshitConnection } from '../../utils/timeshit-storage'
import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  let config: ReturnType<typeof timeshitConfig>
  try {
    config = timeshitConfig(event)
  } catch { return disconnectedTimeshit('unconfigured') }
  return withTimeshitDatabase(config.path, (db) => {
    try {
      return readTimeshitConnection(db, config.key)
    } catch (error) {
      if ((error as { data?: { code?: string } }).data?.code !== 'STORAGE_LOCKED') throw error
      return { ...disconnectedTimeshit('locked'), generation: readStoredTimeshit(db)?.generation ?? null }
    }
  })
})
