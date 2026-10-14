import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { readTimeshitPreferences } from '../../utils/timeshit-preferences'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  return withTimeshitDatabase(config.path, readTimeshitPreferences)
})
