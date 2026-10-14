import { randomBytes, randomUUID } from 'node:crypto'
import type { TimeshitRepository } from '../../shared/types/timeshit'
import type { TimeshitActivityContinueInput, TimeshitActivityRange, TimeshitActivitySnapshot, TimeshitActivityStartInput } from '../../shared/types/timeshit-activity'
import { parseTimeshitActivitySnapshot } from '../../shared/utils/timeshit-activity-contract'
import { selectTimeshitActivity } from '../../shared/utils/timeshit-activity'
import { activityGithubGet, activityGithubGraphql, parseGithubActivityPage } from './timeshit-activity-github'
import { parseGithubBranches, parseGithubRepository } from './timeshit-github'
import { repositoryGithubOperation } from './timeshit-repositories'
import { timeshitError } from './timeshit-errors'

export interface ActivityScope {
  generation: string
  selectionRevision: string
  accountId: number
  accountLogin: string
  token: string
  repositories: TimeshitRepository[]
}

type ScopeReader = () => ActivityScope
interface RepositoryWork {
  repository: Pick<TimeshitRepository, 'id' | 'owner' | 'name'>
  metadataChecked: boolean
  branchPage: number
  branches: { name: string, headSha: string }[]
  heads: { sha: string, cursor: string | null, complete: boolean }[]
  historyBatchSize: number
}
interface Job {
  snapshot: TimeshitActivitySnapshot
  capability: string
  identityChecked: boolean
  authorNodeId: string | null
  requests: number
  work: RepositoryWork[]
  capacity: boolean
}

export function createTimeshitActivityCollector(deps: {
  get?: typeof activityGithubGet
  graphql?: typeof activityGithubGraphql
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  gate?: typeof repositoryGithubOperation
} = {}) {
  const get = deps.get ?? activityGithubGet
  const graphql = deps.graphql ?? activityGithubGraphql
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const gate = deps.gate ?? repositoryGithubOperation
  let job: Job | null = null
  let busy = false
  let lastRequestAt = -Infinity

  function assertScope(current: Job, scope: ActivityScope) {
    if (current.snapshot.generation !== scope.generation || current.snapshot.selectionRevision !== scope.selectionRevision || current.snapshot.account.id !== scope.accountId) {
      job = null
      throw timeshitError('CONNECTION_CHANGED', 409, 'Connection or repository selection changed. Start a new collection.')
    }
    if (now() >= Date.parse(current.snapshot.expiresAt)) {
      job = null
      throw timeshitError('ACTIVITY_EXPIRED', 410, 'Activity collection expired. Start a new collection.')
    }
  }

  async function batch(current: Job, readScope: ScopeReader) {
    const scope = readScope()
    assertScope(current, scope)
    const deadline = now() + 20000
    let requests = 0
    let retryAfter: number | null = null
    let transientFailure = false
    const request = async (path: string, query?: Record<string, string | number>) => {
      const wait = Math.max(0, lastRequestAt + 1000 - now())
      if (requests >= 5 || now() + wait + 8000 > deadline) return { budget: true as const }
      if (current.requests >= 1000) {
        current.capacity = true
        return { budget: true as const }
      }
      if (wait) await sleep(wait)
      assertScope(current, readScope())
      if (now() + 8000 > deadline) return { budget: true as const }
      requests++
      current.requests++
      lastRequestAt = now()
      const value = await get(path, scope.token, query)
      assertScope(current, readScope())
      return { budget: false as const, value }
    }
    const requestGraphql = async (query: string, variables: Record<string, unknown>) => {
      const wait = Math.max(0, lastRequestAt + 1000 - now())
      if (requests >= 5 || now() + wait + 8000 > deadline) return { budget: true as const }
      if (current.requests >= 1000) {
        current.capacity = true
        return { budget: true as const }
      }
      if (wait) await sleep(wait)
      assertScope(current, readScope())
      if (now() + 8000 > deadline) return { budget: true as const }
      requests++
      current.requests++
      lastRequestAt = now()
      const value = await graphql(scope.token, query, variables)
      assertScope(current, readScope())
      return { budget: false as const, value }
    }
    try {
      await gate(async () => {
        if (!current.identityChecked) {
          const result = await request('/user')
          if (!result.budget) {
            const account = result.value as { id?: unknown, node_id?: unknown, login?: unknown } | null
            if (!account || !Number.isSafeInteger(account.id) || account.id !== scope.accountId || typeof account.node_id !== 'string' || !account.node_id || account.node_id.length > 256
              || typeof account.login !== 'string' || !/^[a-z\d][a-z\d-]{0,38}$/i.test(account.login)) {
              job = null
              throw timeshitError('GITHUB_AUTH_FAILED', 422, 'GitHub account changed. Reconnect in Settings.')
            }
            current.snapshot.account.login = account.login
            current.authorNodeId = account.node_id
            current.identityChecked = true
          }
        }
        if (current.identityChecked) for (const [index, work] of current.work.entries()) {
          const coverage = current.snapshot.coverage[index]!
          if (coverage.status === 'complete' || coverage.status === 'failed') continue
          coverage.status = 'scanning'
          const path = `/repos/${encodeURIComponent(work.repository.owner)}/${encodeURIComponent(work.repository.name)}`
          try {
            if (!work.metadataChecked) {
              const result = await request(path)
              if (result.budget) break
              const metadata = parseGithubRepository(result.value)
              if (metadata.id !== work.repository.id) throw timeshitError('INVALID_UPSTREAM', 502, 'Repository identity changed. Recheck repository access.')
              work.metadataChecked = true
            }
            while (!coverage.branchDiscoveryComplete) {
              const result = await request(`${path}/branches`, { per_page: 100, page: work.branchPage })
              if (result.budget) break
              const branches = parseGithubBranches(result.value)
              const newBranches = branches.filter(branch => !work.branches.some(existing => existing.name === branch.name))
              if (branches.length > 0 && newBranches.length === 0) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub branch pagination made no progress. Start a new collection.')
              if (current.snapshot.coverage.reduce((sum, item) => sum + item.branchesDiscovered, 0) + newBranches.length > 2000) {
                current.capacity = true
                break
              }
              work.branches.push(...newBranches.map(branch => ({ name: branch.name, headSha: branch.headSha.toLowerCase() })))
              for (const branch of newBranches) if (!work.heads.some(head => head.sha === branch.headSha.toLowerCase())) work.heads.push({ sha: branch.headSha.toLowerCase(), cursor: null, complete: false })
              coverage.branchesDiscovered = work.branches.length
              work.branchPage++
              coverage.branchDiscoveryComplete = branches.length < 100
            }
            if (!coverage.branchDiscoveryComplete || current.capacity) break
            while (work.heads.some(head => !head.complete)) {
              const heads = work.heads.filter(head => !head.complete).slice(0, work.historyBatchSize)
              const variables: Record<string, unknown> = { owner: work.repository.owner, name: work.repository.name, authorId: current.authorNodeId }
              const fields = heads.map((head, index) => {
                variables[`sha${index}`] = head.sha
                variables[`after${index}`] = head.cursor
                return `h${index}: object(expression: $sha${index}) {
                  ... on Commit {
                    history(first: 100, after: $after${index}, author: { id: $authorId }) {
                      nodes { oid url message authoredDate committedDate author { name user { login } } committer { name } }
                      pageInfo { hasNextPage endCursor }
                    }
                  }
                }`
              }).join('\n')
              const parameters = heads.map((_, index) => `$sha${index}: String!, $after${index}: String`).join(', ')
              const query = `query TimeshitActivity($owner: String!, $name: String!, $authorId: ID!, ${parameters}) {
              repository(owner: $owner, name: $name) {
                ${fields}
              }
            }`
              let pages: ReturnType<typeof parseGithubActivityPage>[]
              try {
                const result = await requestGraphql(query, variables)
                if (result.budget) break
                const repository = (result.value as { repository?: Record<string, unknown> } | null)?.repository
                pages = heads.map((head, index) => {
                  const page = parseGithubActivityPage({ repository: { object: repository?.[`h${index}`] } })
                  if (page.hasNextPage && page.endCursor === head.cursor) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub repeated an activity history cursor.')
                  if (page.commits.some(commit => commit.authorLogin !== null && commit.authorLogin.toLowerCase() !== current.snapshot.account.login.toLowerCase())) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned a commit attributed to a different account.')
                  return page
                })
              } catch (error) {
                const code = (error as { data?: { code?: string } }).data?.code
                if (heads.length > 1 && ['GITHUB_UNAVAILABLE', 'INVALID_UPSTREAM', 'GITHUB_RESTRICTED'].includes(code ?? '')) {
                  work.historyBatchSize = 1
                  continue
                }
                throw error
              }
              for (const [index, page] of pages.entries()) {
                const head = heads[index]!
                const commits = page.commits
                if (current.snapshot.coverage.reduce((sum, item) => sum + item.commitsScanned, 0) + commits.length > 100000) {
                  current.capacity = true
                  break
                }
                const items = selectTimeshitActivity([...current.snapshot.items, ...commits.map(commit => ({ repositoryId: work.repository.id, commit }))], current.snapshot.range)
                if (items.length > 5000 || Buffer.byteLength(JSON.stringify({ ...current.snapshot, items }), 'utf8') > 5 * 1024 * 1024 - 1024) {
                  current.capacity = true
                  break
                }
                current.snapshot.items = items
                coverage.commitsScanned += commits.length
                head.cursor = page.endCursor
                head.complete = !page.hasNextPage
                if (head.complete) coverage.branchesCompleted += work.branches.filter(branch => branch.headSha === head.sha).length
              }
              if (current.capacity) break
            }
            if (work.heads.every(head => head.complete)) coverage.status = 'complete'
            if (coverage.status !== 'complete' || current.capacity) break
          } catch (error) {
            const code = (error as { data?: { code?: string } }).data?.code
            if (['GITHUB_RESTRICTED', 'GITHUB_CONFLICT', 'INVALID_UPSTREAM'].includes(code ?? '')) {
              coverage.status = 'failed'
              coverage.failure = code === 'GITHUB_RESTRICTED' ? 'restricted' : code === 'GITHUB_CONFLICT' ? 'conflict' : 'invalid-upstream'
            } else throw error
          }
        }
      })
    } catch (error) {
      const data = (error as { data?: { code?: string, retryAfterSeconds?: number } }).data
      if (!current.snapshot.coverage.some(repo => repo.status === 'pending' || repo.status === 'scanning')) {
        job = null
        throw error
      }
      if (data?.code === 'GITHUB_RATE_LIMITED') retryAfter = data.retryAfterSeconds ?? 60
      else if (data?.code === 'GITHUB_UNAVAILABLE') transientFailure = true
      else {
        job = null
        throw error
      }
    }
    assertScope(current, readScope())
    const snapshot = current.snapshot
    const unfinished = snapshot.coverage.some(repo => repo.status === 'pending' || repo.status === 'scanning') || !current.identityChecked
    if ((current.requests >= 1000 || snapshot.revision >= 1000) && unfinished) current.capacity = true
    snapshot.status = !unfinished && snapshot.coverage.every(repo => repo.status === 'complete') ? 'complete' : 'partial'
    snapshot.continuation = unfinished && !current.capacity ? current.capability : null
    snapshot.retryAfterSeconds = snapshot.continuation ? retryAfter : null
    snapshot.partialReasons = []
    if (snapshot.coverage.some(repo => repo.failure === 'not-verified' || repo.failure === 'restricted')) snapshot.partialReasons.push('repository-unavailable')
    if (transientFailure || snapshot.coverage.some(repo => ['conflict', 'unavailable', 'invalid-upstream'].includes(repo.failure ?? ''))) snapshot.partialReasons.push('upstream-error')
    if (current.capacity) snapshot.partialReasons.push('capacity-limit')
    else if (snapshot.continuation) snapshot.partialReasons.push(retryAfter ? 'rate-limited' : 'work-budget')
    snapshot.updatedAt = new Date(now()).toISOString()
    snapshot.revision++
    return structuredClone(parseTimeshitActivitySnapshot(snapshot))
  }

  async function locked(action: () => Promise<TimeshitActivitySnapshot>) {
    if (busy) throw timeshitError('ACTIVITY_BUSY', 409, 'Activity collection is busy. Retry shortly.', 1)
    busy = true
    try {
      return await action()
    } finally {
      busy = false
    }
  }

  return {
    start(input: TimeshitActivityStartInput, readScope: ScopeReader) {
      return locked(async () => {
        const scope = readScope()
        if (scope.generation !== input.expectedGeneration || scope.selectionRevision !== input.expectedSelectionRevision) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection or selection changed. Refresh repositories.')
        if (!scope.repositories.length) throw timeshitError('INVALID_INPUT', 400, 'Track at least one repository before collecting activity.')
        const startedAt = now()
        const capability = randomBytes(32).toString('hex')
        const range: TimeshitActivityRange = { ...input.range }
        job = {
          capability, identityChecked: false, authorNodeId: null, requests: 0, capacity: false,
          work: scope.repositories.map(repository => ({ repository: { id: repository.id, owner: repository.owner, name: repository.name }, metadataChecked: false, branchPage: 1, branches: [], heads: [], historyBatchSize: 4 })),
          snapshot: {
            schemaVersion: '1.0', collectionId: randomUUID(), revision: 0,
            generation: scope.generation, selectionRevision: scope.selectionRevision,
            account: { id: scope.accountId, login: scope.accountLogin }, range, status: 'partial',
            startedAt: new Date(startedAt).toISOString(), updatedAt: new Date(startedAt).toISOString(), expiresAt: new Date(startedAt + 30 * 60 * 1000).toISOString(),
            continuation: capability, retryAfterSeconds: null, partialReasons: [], items: [],
            coverage: scope.repositories.map(repo => ({ repositoryId: repo.id, owner: repo.owner, name: repo.name, status: repo.access === 'readable' ? 'pending' : 'failed', failure: repo.access === 'readable' ? null : 'not-verified', branchDiscoveryComplete: false, branchesDiscovered: 0, branchesCompleted: 0, commitsScanned: 0 }))
          }
        }
        return batch(job, readScope)
      })
    },
    resume(input: TimeshitActivityContinueInput, readScope: ScopeReader) {
      return locked(async () => {
        if (!job || input.continuation !== job.capability) throw timeshitError('ACTIVITY_EXPIRED', 410, 'Activity collection is no longer available. Start a new collection.')
        assertScope(job, readScope())
        if (input.expectedRevision === job.snapshot.revision - 1 && input.expectedRevision >= 1) return structuredClone(job.snapshot)
        if (input.expectedRevision !== job.snapshot.revision) throw timeshitError('ACTIVITY_REVISION_CHANGED', 409, 'Activity revision changed. Use the latest collection snapshot.')
        if (!job.snapshot.continuation) return structuredClone(job.snapshot)
        return batch(job, readScope)
      })
    }
  }
}

// ponytail: one job for the single administrator; multiple instances need shared checkpoints.
export const timeshitActivityCollector = createTimeshitActivityCollector()
