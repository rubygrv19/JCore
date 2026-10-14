import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { readTimeshitJson } from '../../utils/timeshit-http'
import { writeTimeshitPreferences } from '../../utils/timeshit-preferences'
import { parseTimeshitPreferences } from '../../../shared/utils/timeshit-preferences'
import { timeshitError } from '../../utils/timeshit-errors'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  const body = await readTimeshitJson(event, config.trustedOrigin)
  let input
  try {
    input = parseTimeshitPreferences(body)
  } catch {
    throw timeshitError('INVALID_INPUT', 400, 'Enter a branch name of 1–255 characters without whitespace.')
  }
  return withTimeshitDatabase(config.path, db => writeTimeshitPreferences(db, input))
})
