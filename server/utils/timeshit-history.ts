import { readableTrackedRepository, repositoryContext, repositoryGithubOperation } from './timeshit-repositories'
import { withTimeshitDatabase } from './timeshit-config'
import { timeshitError } from './timeshit-errors'
import type { H3Event } from 'h3'
import type { TimeshitRepository } from '../../shared/types/timeshit'
import { verifyTimeshitRepositoryIdentity } from './timeshit-github'

type TimeshitConfig = { key: Buffer, path: string }

export function positivePage(value: unknown, maximum = 10000) {
  const page = Number(value ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > maximum) throw timeshitError('INVALID_INPUT', 400, `Page must be between 1 and ${maximum}.`)
  return page
}

export function historyRepository(config: TimeshitConfig, owner: string | undefined, name: string | undefined) {
  if (!owner || !/^[\w.-]{1,100}$/.test(owner) || !name || !/^[\w.-]{1,100}$/.test(name)) throw timeshitError('INVALID_INPUT', 400, 'Invalid repository path.')
  return withTimeshitDatabase(config.path, db => readableTrackedRepository(db, config.key, owner, name))
}

export function verifyHistoryGeneration(config: TimeshitConfig, generation: string, owner: string, name: string) {
  const current = withTimeshitDatabase(config.path, db => repositoryContext(db, config.key))
  if (current.generation !== generation) throw timeshitError('CONNECTION_CHANGED', 409, 'GitHub connection changed. Reload repository history.')
  const repository = withTimeshitDatabase(config.path, db => readableTrackedRepository(db, config.key, owner, name))
  if (repository.generation !== generation) throw timeshitError('CONNECTION_CHANGED', 409, 'GitHub connection changed. Reload repository history.')
  return current
}

export async function runHistoryGithubOperation<T>(event: H3Event, context: { token: string, repository: TimeshitRepository }, action: () => Promise<T>): Promise<T> {
  try {
    return await repositoryGithubOperation(async () => {
      await verifyTimeshitRepositoryIdentity(context.token, context.repository)
      return action()
    })
  } catch (error) {
    const seconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (seconds) setHeader(event, 'Retry-After', seconds)
    throw error
  }
}

export function validHistoryQuery(query: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(query).some(key => !allowed.includes(key))) throw timeshitError('INVALID_INPUT', 400, 'Invalid history query.')
}
