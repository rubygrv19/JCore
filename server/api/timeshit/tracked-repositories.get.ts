import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { trackedTimeshitRepositories } from '../../utils/timeshit-repositories'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  return withTimeshitDatabase(config.path, db => trackedTimeshitRepositories(db, config.key))
})
