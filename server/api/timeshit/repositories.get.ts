import { getQuery } from 'h3'
import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { repositoryContext, repositoryGithubOperation } from '../../utils/timeshit-repositories'
import { discoverTimeshitRepositories } from '../../utils/timeshit-github'
import { timeshitError } from '../../utils/timeshit-errors'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const query = getQuery(event)
  const page = Number(query.page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || Object.keys(query).some(key => key !== 'page')) throw timeshitError('INVALID_INPUT', 400, 'Invalid repository page.')
  const config = timeshitConfig(event)
  const context = withTimeshitDatabase(config.path, db => repositoryContext(db, config.key))
  try {
    const result = await repositoryGithubOperation(() => discoverTimeshitRepositories(context.token, page))
    const latest = withTimeshitDatabase(config.path, db => repositoryContext(db, config.key))
    if (latest.generation !== context.generation) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection changed. Refresh repositories.')
    return { schemaVersion: '1.0', generation: latest.generation, selectionRevision: latest.selectionRevision, ...result, page }
  } catch (error) {
    const seconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (seconds) setHeader(event, 'Retry-After', seconds)
    throw error
  }
})
