import { getQuery, getRouterParam } from 'h3'
import { timeshitConfig } from '../../../../../utils/timeshit-config'
import { listTimeshitBranches } from '../../../../../utils/timeshit-github'
import { historyRepository, positivePage, runHistoryGithubOperation, validHistoryQuery, verifyHistoryGeneration } from '../../../../../utils/timeshit-history'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)
  const query = getQuery(event)
  validHistoryQuery(query, ['page'])
  const page = positivePage(query.page)
  const config = timeshitConfig(event)
  const context = historyRepository(config, getRouterParam(event, 'owner'), getRouterParam(event, 'repo'))
  const result = await runHistoryGithubOperation(event, context, () => listTimeshitBranches(context.token, context.repository, page))
  const latest = verifyHistoryGeneration(config, context.generation, context.repository.owner, context.repository.name)
  return { ...result, generation: latest.generation }
})
