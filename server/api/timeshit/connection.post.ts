import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { readTimeshitMutation } from '../../utils/timeshit-http'
import { verifyTimeshitIdentity } from '../../utils/timeshit-github'
import { readStoredTimeshit, replaceTimeshitConnection } from '../../utils/timeshit-storage'
import { timeshitError } from '../../utils/timeshit-errors'

let nextAttemptAt = 0
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  const input = await readTimeshitMutation(event, config.trustedOrigin, true)
  if (Date.now() < nextAttemptAt) {
    const seconds = Math.ceil((nextAttemptAt - Date.now()) / 1000)
    setHeader(event, 'Retry-After', seconds)
    throw timeshitError('GITHUB_RATE_LIMITED', 429, 'Wait before checking another connection.', seconds)
  }
  nextAttemptAt = Date.now() + 12000
  const generation = withTimeshitDatabase(config.path, db => readStoredTimeshit(db)?.generation ?? null)
  if (generation !== input.expectedGeneration) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection changed. Reload its status before trying again.')
  try {
    const verified = await verifyTimeshitIdentity(input.token)
    if (verified.retryAfterSeconds) nextAttemptAt = Math.max(nextAttemptAt, Date.now() + verified.retryAfterSeconds * 1000)
    return withTimeshitDatabase(config.path, db => replaceTimeshitConnection(db, config.key, { ...input, ...verified }))
  } catch (error) {
    const seconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (seconds) {
      nextAttemptAt = Math.max(nextAttemptAt, Date.now() + seconds * 1000)
      setHeader(event, 'Retry-After', seconds)
    }
    throw error
  }
})
