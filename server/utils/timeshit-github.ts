import { $fetch } from 'ofetch'
import type { TimeshitBranches, TimeshitCommitDetail, TimeshitCommits, TimeshitDiscovery, TimeshitRepository } from '../../shared/types/timeshit'
import { parseTimeshitCommitItem } from '../../shared/utils/timeshit-history-contract'
import { timeshitError } from './timeshit-errors'

const origin = 'https://api.github.com'
const apiVersion = '2026-03-10'

export function githubTimeshitHeaders(token: string) {
  return { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`, 'X-GitHub-Api-Version': apiVersion, 'User-Agent': 'JCore-Timeshit' }
}

export async function timeshitGithubGet(path: string, token: string, query?: Record<string, string | number>): Promise<unknown> {
  try {
    const body = await $fetch<unknown, 'stream'>(`${origin}${path}`, {
      headers: githubTimeshitHeaders(token),
      query: query ?? (path === '/user/repos' ? { per_page: 1, page: 1 } : undefined),
      responseType: 'stream',
      signal: AbortSignal.timeout(8000),
      timeout: 8000, retry: 0, redirect: 'error'
    })
    return await readTimeshitGithubBody(body)
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code) throw error
    await (error as { response?: Response }).response?.body?.cancel().catch(() => {})
    throw normalizeTimeshitGithubError(error)
  }
}

// Bound bytes before JSON parsing; page sizes do not bound messages or patches.
export async function readTimeshitGithubBody(body: ReadableStream<Uint8Array> | null): Promise<unknown> {
  if (!body) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an empty response.')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 5 * 1024 * 1024) {
        await reader.cancel()
        throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub response exceeded the page limit.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned invalid JSON.')
  }
}

export function normalizeTimeshitGithubError(error: unknown) {
  const response = (error as { response?: Response }).response
  const status = response?.status
  const retryAfter = response?.headers.get('retry-after')
  const remaining = response?.headers.get('x-ratelimit-remaining')
  const retrySeconds = timeshitGithubRetrySeconds(response)
  if (status === 401) return timeshitError('GITHUB_AUTH_FAILED', 422, 'GitHub did not accept this token. Check or replace it.')
  if (status === 429 || (status === 403 && (retryAfter || remaining === '0'))) return timeshitError('GITHUB_RATE_LIMITED', 429, 'GitHub rate limit reached. Wait before trying again.', retrySeconds)
  if (status === 403 || status === 404) return timeshitError('GITHUB_RESTRICTED', 422, 'GitHub could not grant access. Check token permissions and repository access.')
  if (status === 409) return timeshitError('GITHUB_CONFLICT', 409, 'GitHub could not return repository history due to a conflict. The repository may be empty or its state may have changed.')
  return timeshitError('GITHUB_UNAVAILABLE', 502, 'GitHub is temporarily unavailable. Try again later.')
}

export function timeshitGithubRetrySeconds(response?: Response) {
  const retryAfter = response?.headers.get('retry-after')
  const remaining = response?.headers.get('x-ratelimit-remaining')
  const reset = Number(response?.headers.get('x-ratelimit-reset'))
  return retryAfter && /^\d+$/.test(retryAfter) ? Math.max(1, Number(retryAfter)) : remaining === '0' && reset > 0 && Number.isFinite(reset) ? Math.max(1, Math.ceil(reset - Date.now() / 1000)) : 60
}

const fullSha = /^[a-f\d]{40}$/i
const isoDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const githubUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password
  } catch { return false }
}

function githubRepositoryPath(repository: TimeshitRepository) {
  return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`
}

function resolveRepositoryPage(value: unknown, perPage: number) {
  if (!Array.isArray(value) || value.length > perPage) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid page.')
  return value
}

export async function listTimeshitBranches(token: string, repository: TimeshitRepository, page: number): Promise<TimeshitBranches> {
  const perPage = 100
  const response = resolveRepositoryPage(await timeshitGithubGet(`${githubRepositoryPath(repository)}/branches`, token, { per_page: perPage, page }), perPage)
  const branches = parseGithubBranches(response)
  return { schemaVersion: '1.0', generation: '', repositoryId: repository.id, page, hasNext: branches.length === perPage, branches }
}

export function parseGithubBranches(value: unknown) {
  const response = resolveRepositoryPage(value, 100)
  const branches = response.map((value: unknown) => {
    const item = value as { name?: unknown, commit?: { sha?: unknown }, protected?: unknown } | null
    if (!item || typeof item.name !== 'string' || !item.name || item.name.length > 255 || typeof item.commit?.sha !== 'string' || !fullSha.test(item.commit.sha) || typeof item.protected !== 'boolean') {
      throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid branch response.')
    }
    return { name: item.name, headSha: item.commit.sha, protected: item.protected }
  })
  if (new Set(branches.map(item => item.name)).size !== branches.length) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned duplicate branches.')
  return branches
}

export function parseGithubCommit(value: unknown) {
  const item = value as { sha?: unknown, html_url?: unknown, commit?: { message?: unknown, author?: { name?: unknown, date?: unknown } | null, committer?: { name?: unknown, date?: unknown } | null }, author?: { login?: unknown, id?: unknown } | null } | null
  const commit = item?.commit
  const author = commit?.author
  const committer = commit?.committer
  if (!item || typeof item.sha !== 'string' || !fullSha.test(item.sha) || !githubUrl(item.html_url) || typeof commit?.message !== 'string'
    || !isoDate(author?.date) || !isoDate(committer?.date)
    || !(item.author === null || (typeof item.author?.login === 'string' && typeof item.author?.id === 'number'))
    || !(author.name === null || typeof author.name === 'string')
    || !(committer.name === null || typeof committer.name === 'string')) {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid commit response.')
  }
  const message = commit.message as string
  const [title = '', ...bodyLines] = message.split('\n')
  const body = bodyLines.join('\n').trim() || null
  const normalized = {
    sha: item.sha as string, htmlUrl: item.html_url, message, title,
    body, authorLogin: typeof item.author?.login === 'string' ? item.author.login : null, authorName: typeof author?.name === 'string' ? author.name : null,
    authoredAt: author.date, committerName: committer.name ?? null, committedAt: committer.date
  }
  try {
    return parseTimeshitCommitItem(normalized)
  } catch {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid commit response.')
  }
}

export async function listTimeshitCommits(token: string, repository: TimeshitRepository, input: { branch: string, headSha: string, author: string, page: number }): Promise<TimeshitCommits> {
  if (!fullSha.test(input.headSha) || !input.branch || input.branch.length > 255 || !input.author) throw timeshitError('INVALID_INPUT', 400, 'Select a valid branch before loading commits.')
  const perPage = 30
  const response = resolveRepositoryPage(await timeshitGithubGet(`${githubRepositoryPath(repository)}/commits`, token, {
    sha: input.headSha, author: input.author, per_page: perPage, page: input.page
  }), perPage)
  const commits = response.map(parseGithubCommit)
  if (commits.some(commit => commit.authorLogin !== null && commit.authorLogin.toLowerCase() !== input.author.toLowerCase())) {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned a commit attributed to a different account.')
  }
  return {
    schemaVersion: '1.0', generation: '', repositoryId: repository.id, branch: input.branch,
    headSha: input.headSha, page: input.page, hasNext: response.length === perPage,
    commits
  }
}

export async function getTimeshitCommit(token: string, repository: TimeshitRepository, sha: string, page: number): Promise<TimeshitCommitDetail> {
  if (!fullSha.test(sha)) throw timeshitError('INVALID_INPUT', 400, 'Select a valid commit.')
  if (!Number.isSafeInteger(page) || page < 1 || page > 30) throw timeshitError('INVALID_INPUT', 400, 'File page must be between 1 and 30.')
  sha = sha.toLowerCase()
  const perPage = 100
  const value = await timeshitGithubGet(`${githubRepositoryPath(repository)}/commits/${sha}`, token, { per_page: perPage, page }) as {
    sha?: unknown
    stats?: {
      additions?: unknown
      deletions?: unknown
      total?: unknown
    }
    files?: unknown
  } | null
  if (value?.sha !== sha) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned a different commit than requested.')
  const commit = parseGithubCommit(value)
  const stats = value?.stats as {
    additions?: unknown
    deletions?: unknown
    total?: unknown
  } | undefined
  const files = value?.files
  if (!stats || ![stats.additions, stats.deletions, stats.total].every(item => Number.isSafeInteger(item) && Number(item) >= 0)
    || !Array.isArray(files) || files.length > perPage) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned invalid commit details.')
  const normalizedStats = { additions: Number(stats.additions), deletions: Number(stats.deletions), total: Number(stats.total) }
  const normalizedFiles = files.map((input: unknown) => {
    const file = input as { filename?: unknown, previous_filename?: unknown, status?: unknown, additions?: unknown, deletions?: unknown, changes?: unknown, patch?: unknown, blob_url?: unknown } | null
    if (!file || typeof file.filename !== 'string' || !file.filename || typeof file.status !== 'string'
      || ![file.additions, file.deletions, file.changes].every(item => Number.isSafeInteger(item) && Number(item) >= 0)
      || !(file.previous_filename === undefined || typeof file.previous_filename === 'string')
      || !(file.patch === undefined || typeof file.patch === 'string')
      || !(file.blob_url === undefined || githubUrl(file.blob_url))) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid changed-file response.')
    const patch = typeof file.patch === 'string' ? file.patch : null
    const maxPatchLength = 20000
    return {
      filename: file.filename, previousFilename: typeof file.previous_filename === 'string' ? file.previous_filename : null, status: file.status,
      additions: Number(file.additions), deletions: Number(file.deletions), changes: Number(file.changes),
      patch: patch === null ? null : patch.slice(0, maxPatchLength), patchTruncated: patch !== null && patch.length > maxPatchLength,
      blobUrl: typeof file.blob_url === 'string' ? file.blob_url : null
    }
  })
  return {
    schemaVersion: '1.0', generation: '', repositoryId: repository.id, sha,
    htmlUrl: commit.htmlUrl, message: commit.message, authorLogin: commit.authorLogin,
    authorName: commit.authorName, authoredAt: commit.authoredAt, committerName: commit.committerName,
    committedAt: commit.committedAt, stats: normalizedStats, filePage: page, hasNextFiles: normalizedFiles.length === perPage && page < 30,
    filesTruncatedAtGitHubLimit: normalizedFiles.length === perPage && page === 30, files: normalizedFiles
  }
}

export async function verifyTimeshitIdentity(token: string): Promise<{ account: { id: number, login: string }, discovery: TimeshitDiscovery, retryAfterSeconds?: number }> {
  const result = await timeshitGithubGet('/user', token)
  const user = result as { id?: unknown, login?: unknown } | null
  if (!user || !Number.isSafeInteger(user.id) || Number(user.id) <= 0 || typeof user.login !== 'string' || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user.login)) {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid account response.')
  }
  let discovery: TimeshitDiscovery
  let retryAfterSeconds: number | undefined
  try {
    const repositories = await timeshitGithubGet('/user/repos', token)
    if (!Array.isArray(repositories)) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid repository response.')
    discovery = 'available'
  } catch (error) {
    retryAfterSeconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    const code = (error as { data?: { code?: string } }).data?.code
    if (code === 'GITHUB_AUTH_FAILED') throw error
    discovery = code === 'GITHUB_RESTRICTED' ? 'restricted' : code === 'GITHUB_RATE_LIMITED' ? 'rate-limited' : 'unavailable'
  }
  return { account: { id: Number(user.id), login: user.login }, discovery, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }
}

export function parseGithubRepository(value: unknown): TimeshitRepository {
  const item = value as Record<string, unknown> | null
  const owner = item?.owner as { login?: unknown } | undefined
  if (!item || !Number.isSafeInteger(item.id) || Number(item.id) <= 0
    || typeof owner?.login !== 'string' || !/^[a-z\d][a-z\d-]{0,38}$/i.test(owner.login)
    || typeof item.name !== 'string' || !/^[\w.-]{1,100}$/.test(item.name)
    || typeof item.private !== 'boolean' || typeof item.archived !== 'boolean'
    || !(item.description === null || typeof item.description === 'string')
    || !(item.default_branch === null || typeof item.default_branch === 'string')) {
    throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid repository response.')
  }
  return { id: Number(item.id), owner: owner.login, name: item.name, description: item.description as string | null,
    private: item.private, archived: item.archived, defaultBranch: item.default_branch as string | null,
    access: 'not-checked', checkedAt: null }
}

export async function discoverTimeshitRepositories(token: string, page: number) {
  const result = await timeshitGithubGet('/user/repos', token, { per_page: 30, page, sort: 'full_name', direction: 'asc', visibility: 'all' })
  if (!Array.isArray(result) || result.length > 30) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid repository page.')
  const repositories = result.map(parseGithubRepository)
  if (new Set(repositories.map(repo => repo.id)).size !== repositories.length) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned duplicate repositories.')
  // A full page permits checking the next page, which can legitimately be empty.
  return { repositories, hasNext: repositories.length === 30 }
}

export async function verifyTimeshitRepositoryIdentity(token: string, repository: TimeshitRepository): Promise<TimeshitRepository> {
  const path = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}` as const
  const updated = parseGithubRepository(await timeshitGithubGet(path, token))
  if (updated.id !== repository.id) throw timeshitError('INVALID_UPSTREAM', 502, 'Repository identity changed. Refresh discovery before tracking it.')
  return updated
}

export async function checkTimeshitRepository(token: string, repository: TimeshitRepository): Promise<TimeshitRepository> {
  const updated = await verifyTimeshitRepositoryIdentity(token, repository)
  const path = `/repos/${encodeURIComponent(updated.owner)}/${encodeURIComponent(updated.name)}` as const
  const branches = await timeshitGithubGet(`${path}/branches`, token, { per_page: 1, page: 1 })
  if (!Array.isArray(branches)) throw timeshitError('INVALID_UPSTREAM', 502, 'GitHub returned an invalid branch response.')
  return { ...updated, access: 'readable', checkedAt: new Date().toISOString() }
}
