import { beforeEach, describe, expect, it, vi } from 'vitest'
import { timeshitGithubGet, verifyTimeshitIdentity } from '../../server/utils/timeshit-github'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ $fetch: async (...args: unknown[]) => {
  const value = await fetchMock(...args)
  return value instanceof ReadableStream ? value : new Response(JSON.stringify(value)).body
} }))
beforeEach(() => fetchMock.mockReset())
const token = 'github_pat_mock_only_not_real'

describe('Timeshit GitHub verification', () => {
  it('bounds REST response bytes before parsing JSON', async () => {
    const cancel = vi.fn()
    fetchMock.mockResolvedValueOnce(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 1))
    }, cancel }))
    await expect(timeshitGithubGet('/user', token)).rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
    expect(cancel).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ responseType: 'stream' })
  })
  it('verifies identity separately from discovery without claiming Contents access', async () => {
    fetchMock.mockResolvedValueOnce({ id: 7, login: 'example-user' }).mockResolvedValueOnce([])
    expect(await verifyTimeshitIdentity(token)).toEqual({ account: { id: 7, login: 'example-user' }, discovery: 'available' })
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['https://api.github.com/user', 'https://api.github.com/user/repos'])
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ retry: 0, redirect: 'error', timeout: 8000 })
  })
  it('retains verified identity when discovery is restricted', async () => {
    fetchMock.mockResolvedValueOnce({ id: 7, login: 'example-user' }).mockRejectedValueOnce({ response: new Response(null, { status: 403 }) })
    expect((await verifyTimeshitIdentity(token)).discovery).toBe('restricted')
  })
  it('rejects malformed identity and removes upstream secret details from errors', async () => {
    fetchMock.mockResolvedValueOnce({ id: -1, login: 'invalid' })
    await expect(verifyTimeshitIdentity(token)).rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
    fetchMock.mockRejectedValueOnce({ message: token, response: new Response(null, { status: 401 }) })
    try {
      await timeshitGithubGet('/user', token)
      expect.fail('Expected failure')
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 422, data: { code: 'GITHUB_AUTH_FAILED' } })
      expect(JSON.stringify(error)).not.toContain(token)
    }
  })
  it('normalizes rate limits', async () => {
    fetchMock.mockRejectedValueOnce({ response: new Response(null, { status: 429, headers: { 'Retry-After': '120' } }) })
    await expect(timeshitGithubGet('/user', token)).rejects.toMatchObject({ statusCode: 429, data: { retryAfterSeconds: 120 } })
  })
  it('keeps a repository conflict distinct from an unavailable service or a complete empty result', async () => {
    fetchMock.mockRejectedValueOnce({ response: new Response(null, { status: 409 }) })
    await expect(timeshitGithubGet('/repos/example/empty/commits', token))
      .rejects.toMatchObject({ statusCode: 409, data: { code: 'GITHUB_CONFLICT' } })
  })
})

const repository = { id: 12, owner: { login: 'example' }, name: 'project', description: null, private: true, archived: false, default_branch: 'main' }
describe('Timeshit bounded repository discovery', () => {
  it('uses authenticated paginated discovery and checks Contents separately', async () => {
    const { discoverTimeshitRepositories, checkTimeshitRepository } = await import('../../server/utils/timeshit-github')
    fetchMock.mockResolvedValueOnce([repository]).mockResolvedValueOnce(repository).mockResolvedValueOnce([{ name: 'main' }])
    const page = await discoverTimeshitRepositories(token, 2)
    expect(page.hasNext).toBe(false)
    expect(fetchMock.mock.calls[0]?.[1].query).toMatchObject({ page: 2, per_page: 30, sort: 'full_name' })
    expect(page.repositories[0]?.access).toBe('not-checked')
    const checked = await checkTimeshitRepository(token, page.repositories[0]!)
    expect(checked.access).toBe('readable')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://api.github.com/repos/example/project/branches')
  })
  it('rejects malformed discovery, duplicates and mismatched repository IDs', async () => {
    const { discoverTimeshitRepositories, checkTimeshitRepository, parseGithubRepository } = await import('../../server/utils/timeshit-github')
    fetchMock.mockResolvedValueOnce({ message: 'bad' })
    await expect(discoverTimeshitRepositories(token, 1)).rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
    fetchMock.mockResolvedValueOnce([repository, repository])
    await expect(discoverTimeshitRepositories(token, 1)).rejects.toThrow(/duplicate/)
    fetchMock.mockResolvedValueOnce({ ...repository, id: 99 })
    await expect(checkTimeshitRepository(token, parseGithubRepository(repository))).rejects.toThrow(/identity/)
  })
  it('does not claim Contents access when GitHub rejects a branch request', async () => {
    const { checkTimeshitRepository, parseGithubRepository } = await import('../../server/utils/timeshit-github')
    fetchMock.mockResolvedValueOnce(repository).mockRejectedValueOnce({ response: new Response(null, { status: 404 }) })
    await expect(checkTimeshitRepository(token, parseGithubRepository(repository))).rejects.toMatchObject({ data: { code: 'GITHUB_RESTRICTED' } })
  })
})
