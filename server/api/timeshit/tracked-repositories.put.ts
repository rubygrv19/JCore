import { timeshitConfig, withTimeshitDatabase } from '../../utils/timeshit-config'
import { readTimeshitJson } from '../../utils/timeshit-http'
import { repositoryContext, trackedTimeshitRepositories, updateTrackedRepository, validateRepositoryMutation, repositoryGithubOperation } from '../../utils/timeshit-repositories'
import { checkTimeshitRepository, discoverTimeshitRepositories } from '../../utils/timeshit-github'
import { timeshitError } from '../../utils/timeshit-errors'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const config = timeshitConfig(event)
  const input = validateRepositoryMutation(await readTimeshitJson(event, config.trustedOrigin))
  const context = withTimeshitDatabase(config.path, db => repositoryContext(db, config.key))
  if (context.generation !== input.expectedGeneration || context.selectionRevision !== input.expectedSelectionRevision) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection or selection changed. Refresh repositories.')
  if (input.action === 'remove') return withTimeshitDatabase(config.path, db => updateTrackedRepository(db, config.key, input))
  try {
    return await repositoryGithubOperation(async () => {
      const candidates = input.action === 'track'
        ? (await discoverTimeshitRepositories(context.token, input.page)).repositories
        : withTimeshitDatabase(config.path, db => trackedTimeshitRepositories(db, config.key)).repositories
      const repo = candidates.find(item => item.id === input.repositoryId)
      if (!repo) throw timeshitError('INVALID_INPUT', 409, 'Repository is no longer on this page. Refresh discovery.')
      try {
        const checked = await checkTimeshitRepository(context.token, repo)
        return withTimeshitDatabase(config.path, db => updateTrackedRepository(db, config.key, input, checked))
      } catch (error) {
        if (input.action === 'check') withTimeshitDatabase(config.path, db => updateTrackedRepository(db, config.key, input, { ...repo, access: 'unavailable', checkedAt: new Date().toISOString() }))
        throw error
      }
    })
  } catch (error) {
    const seconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (seconds) setHeader(event, 'Retry-After', seconds)
    throw error
  }
})
