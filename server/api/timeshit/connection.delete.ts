import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { readTimeshitMutation } from '../../utils/timeshit-http'
import { deleteTimeshitConnection, disconnectedTimeshit } from '../../utils/timeshit-storage'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  const input = await readTimeshitMutation(event, config.trustedOrigin, false)
  withTimeshitDatabase(config.path, db => deleteTimeshitConnection(db, input.expectedGeneration))
  return disconnectedTimeshit()
})
