import { getQuery, getRouterParam } from 'h3'
import { timeshitConfig } from '../../../../../utils/timeshit-config'
import { listTimeshitCommits } from '../../../../../utils/timeshit-github'
import { historyRepository, positivePage, runHistoryGithubOperation, validHistoryQuery, verifyHistoryGeneration } from '../../../../../utils/timeshit-history'
import { timeshitError } from '../../../../../utils/timeshit-errors'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const query = getQuery(event)
  validHistoryQuery(query, ['page', 'branch', 'headSha'])
  if (typeof query.branch !== 'string' || query.branch.length < 1 || query.branch.length > 255
    || typeof query.headSha !== 'string' || !/^[a-f\d]{40}$/i.test(query.headSha)) throw timeshitError('INVALID_INPUT', 400, 'Select a valid branch before loading commits.')
  const page = positivePage(query.page)
  const config = timeshitConfig(event)
  const context = historyRepository(config, getRouterParam(event, 'owner'), getRouterParam(event, 'repo'))
  const result = await runHistoryGithubOperation(event, context, () => listTimeshitCommits(context.token, context.repository, {
    branch: query.branch as string, headSha: query.headSha as string, author: context.accountLogin, page
  }))
  const latest = verifyHistoryGeneration(config, context.generation, context.repository.owner, context.repository.name)
  return { ...result, generation: latest.generation }
})
