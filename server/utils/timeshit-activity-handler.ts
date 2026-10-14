import { getQuery, setHeader, type H3Event } from 'h3'
import { parseTimeshitActivityContinue, parseTimeshitActivityStart } from '../../shared/utils/timeshit-activity-contract'
import { timeshitConfig, withTimeshitDatabase } from './timeshit-config'
import { readTimeshitJson } from './timeshit-http'
import { repositoryContext, trackedTimeshitRepositories } from './timeshit-repositories'
import { timeshitActivityCollector } from './timeshit-activity'
import { timeshitError } from './timeshit-errors'

export async function handleTimeshitActivity(event: H3Event, operation: 'start' | 'resume') {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  if (Object.keys(getQuery(event)).length) throw timeshitError('INVALID_INPUT', 400, 'Activity requests do not accept query parameters.')
  const value = await readTimeshitJson(event, config.trustedOrigin)
  const readScope = () => withTimeshitDatabase(config.path, (db) => {
    const context = repositoryContext(db, config.key)
    const { repositories } = trackedTimeshitRepositories(db, config.key)
    return { ...context, repositories }
  })
  let input
  try {
    input = operation === 'start' ? parseTimeshitActivityStart(value) : parseTimeshitActivityContinue(value)
  } catch {
    throw timeshitError('INVALID_INPUT', 400, 'Invalid activity request. Check the date range and collection revision.')
  }
  try {
    const snapshot = 'range' in input
      ? await timeshitActivityCollector.start(input, readScope)
      : await timeshitActivityCollector.resume(input, readScope)
    if (snapshot.retryAfterSeconds) setHeader(event, 'Retry-After', snapshot.retryAfterSeconds)
    return snapshot
  } catch (error) {
    const seconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (seconds) setHeader(event, 'Retry-After', seconds)
    throw error
  }
}
