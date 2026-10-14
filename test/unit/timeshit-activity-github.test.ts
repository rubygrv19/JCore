import { afterEach, describe, expect, it, vi } from 'vitest'
import { activityGithubGet, activityGithubGraphql, parseGithubActivityPage } from '../../server/utils/timeshit-activity-github'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('Timeshit bounded upstream reader', () => {
  it('uses fixed GitHub origin, GET, no redirects, timeout and authenticated headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"id":7}'))
    vi.stubGlobal('fetch', fetcher)
    expect(await activityGithubGet('/user', 'test-token', { page: 1 })).toEqual({ id: 7 })
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://api.github.com/user?page=1')
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer test-token' }, signal: expect.any(AbortSignal) })
    await expect(activityGithubGet('//evil.invalid/user', 'test-token')).rejects.toMatchObject({ data: { code: 'INVALID_INPUT' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('cancels oversized bodies, rejects malformed JSON and normalizes HTTP errors', async () => {
    const cancel = vi.fn()
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 1))
    }, cancel })))
      .mockResolvedValueOnce(new Response('invalid'))
      .mockResolvedValueOnce(new Response('secret payload', { status: 429, headers: { 'Retry-After': '90' } }))
    vi.stubGlobal('fetch', fetcher)
    await expect(activityGithubGet('/user', 'test-token')).rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
    expect(cancel).toHaveBeenCalled()
    await expect(activityGithubGet('/user', 'test-token')).rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
    await expect(activityGithubGet('/user', 'test-token')).rejects.toMatchObject({ data: { code: 'GITHUB_RATE_LIMITED', retryAfterSeconds: 90 } })
  })

  it('posts GraphQL only to the fixed origin and extracts validated data', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: { login: 'rubygrv' } } })))
    vi.stubGlobal('fetch', fetcher)
    expect(await activityGithubGraphql('test-token', 'query { viewer { login } }', {})).toEqual({ viewer: { login: 'rubygrv' } })
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.github.com/graphql')
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST', redirect: 'error', signal: expect.any(AbortSignal),
      headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { viewer { login } }', variables: {} })
    })
  })

  it('normalizes GraphQL errors and parses the nested repository activity response', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ extensions: { type: 'RATE_LIMITED' } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ extensions: { type: 'FORBIDDEN' } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: null }, errors: [{ extensions: { type: 'UNKNOWN' } }] })))
    vi.stubGlobal('fetch', fetcher)
    await expect(activityGithubGraphql('test-token', 'query {}', {})).rejects.toMatchObject({ data: { code: 'GITHUB_RATE_LIMITED' } })
    await expect(activityGithubGraphql('test-token', 'query {}', {})).rejects.toMatchObject({ data: { code: 'GITHUB_RESTRICTED' } })
    await expect(activityGithubGraphql('test-token', 'query {}', {})).rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
    expect(parseGithubActivityPage({ repository: { object: { history: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } })).toEqual({ commits: [], hasNextPage: false, endCursor: null })
    expect(() => parseGithubActivityPage({ repository: { object: { history: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } } } })).toThrow()
    expect(() => parseGithubActivityPage({ object: { history: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } })).toThrow()
  })

  it('honors HTTP 200 GraphQL rate-limit headers and top-level error types', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000)
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ type: 'RATE_LIMITED' }] }), { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1600' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ type: 'RATE_LIMITED' }] }), { headers: { 'Retry-After': '125' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ type: 'FORBIDDEN' }] })))
    vi.stubGlobal('fetch', fetcher)
    await expect(activityGithubGraphql('test-token', 'query {}', {})).rejects.toMatchObject({ data: { code: 'GITHUB_RATE_LIMITED', retryAfterSeconds: 600 } })
    await expect(activityGithubGraphql('test-token', 'query {}', {})).rejects.toMatchObject({ data: { code: 'GITHUB_RATE_LIMITED', retryAfterSeconds: 125 } })
    await expect(activityGithubGraphql('test-token', 'query {}', {})).rejects.toMatchObject({ data: { code: 'GITHUB_RESTRICTED' } })
  })
})
