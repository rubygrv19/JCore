import { githubTimeshitHeaders, normalizeTimeshitGithubError, readTimeshitGithubBody, timeshitGithubRetrySeconds } from './timeshit-github'
import { timeshitError } from './timeshit-errors'
import { parseTimeshitCommitItem } from '../../shared/utils/timeshit-history-contract'

interface GraphqlActivityActor { name?: unknown, user?: { login?: unknown } | null }
interface GraphqlActivityCommit { oid?: unknown, url?: unknown, message?: unknown, authoredDate?: unknown, committedDate?: unknown, author?: GraphqlActivityActor | null, committer?: { name?: unknown } | null }

// Bound the stream because a page limit does not bound commit-message bytes.
export async function activityGithubGet(path: string, token: string, query?: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`https://api.github.com${path}`)
  if (url.origin !== 'https://api.github.com' || !path.startsWith('/') || path.startsWith('//')) throw timeshitError('INVALID_INPUT', 400, 'Invalid GitHub resource.')
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value))
  try {
    const response = await fetch(url, { headers: githubTimeshitHeaders(token), redirect: 'error', signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      await response.body?.cancel()
      throw normalizeTimeshitGithubError({ response })
    }
    return await readTimeshitGithubBody(response.body)
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code) throw error
    throw normalizeTimeshitGithubError(error)
  }
}

export async function activityGithubGraphql(token: string, query: string, variables: Record<string, unknown>): Promise<unknown> {
  const endpoint = 'https://api.github.com/graphql'
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...githubTimeshitHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw normalizeTimeshitGithubError({ response })
    }
    const payload = await readTimeshitGithubBody(response.body)
    const envelope = payload as { data?: unknown, errors?: Array<{ type?: unknown, extensions?: { type?: unknown } }> } | null
    if (!envelope || (!Array.isArray(envelope.errors) && !envelope.data)) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid GraphQL response.')
    if (Array.isArray(envelope.errors) && envelope.errors.length) {
      const kinds = envelope.errors.flatMap(error => [error?.type, error?.extensions?.type])
      if (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after') || kinds.includes('RATE_LIMITED') || kinds.includes('RATE_LIMIT')) {
        throw timeshitError('GITHUB_RATE_LIMITED', 429, 'GitHub rate limit reached. Wait before trying again.', timeshitGithubRetrySeconds(response))
      }
      if (kinds.includes('FORBIDDEN') || kinds.includes('NOT_FOUND')) {
        throw timeshitError('GITHUB_RESTRICTED', 422, 'GitHub could not grant access. Check token permissions and repository access.')
      }
      throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned a GraphQL error.')
    }
    if (!envelope.data) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an empty GraphQL response.')
    return envelope.data
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code) throw error
    throw normalizeTimeshitGithubError(error)
  }
}

export function parseGithubActivityPage(value: unknown) {
  const response = value as { repository?: { object?: { history?: { nodes?: unknown, pageInfo?: { hasNextPage?: unknown, endCursor?: unknown } } | null } | null } | null } | null
  const history = response?.repository?.object?.history
  const nodes = history?.nodes
  const pageInfo = history?.pageInfo
  if (!Array.isArray(nodes) || nodes.length > 100 || typeof pageInfo?.hasNextPage !== 'boolean'
    || !(pageInfo.endCursor === null || (typeof pageInfo.endCursor === 'string' && pageInfo.endCursor.length <= 2048))
    || (pageInfo.hasNextPage && !pageInfo.endCursor)) {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid activity history page.')
  }
  const commits = nodes.map((value) => {
    const item = value as GraphqlActivityCommit | null
    let url: URL | null = null
    if (typeof item?.url === 'string') {
      try {
        url = new URL(item.url)
      } catch {
        url = null
      }
    }
    const authorIsValid = item?.author === null || Boolean(item?.author
      && (item.author.name === null || typeof item.author.name === 'string')
      && (item.author.user === null || (item.author.user && typeof item.author.user.login === 'string')))
    const committerIsValid = item?.committer === null || Boolean(item?.committer
      && (item.committer.name === null || typeof item.committer.name === 'string'))
    const urlIsValid = Boolean(url && url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password)
    if (!item || typeof item.oid !== 'string' || !/^[a-f\d]{40}$/i.test(item.oid) || !urlIsValid
      || typeof item.message !== 'string' || typeof item.authoredDate !== 'string' || !Number.isFinite(Date.parse(item.authoredDate))
      || typeof item.committedDate !== 'string' || !Number.isFinite(Date.parse(item.committedDate))
      || !authorIsValid || !committerIsValid) {
      throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid activity commit.')
    }
    const [title = '', ...bodyLines] = item.message.split('\n')
    try {
      return parseTimeshitCommitItem({
        sha: item.oid.toLowerCase(), htmlUrl: item.url, message: item.message, title,
        body: bodyLines.join('\n').trim() || null,
        authorLogin: item.author?.user?.login ?? null,
        authorName: item.author?.name ?? null,
        authoredAt: item.authoredDate,
        committerName: item.committer?.name ?? null,
        committedAt: item.committedDate
      })
    } catch {
      throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid activity commit.')
    }
  })
  return { commits, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor }
}
