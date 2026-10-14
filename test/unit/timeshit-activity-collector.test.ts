import { describe, expect, it, vi } from 'vitest'
import { createTimeshitActivityCollector, type ActivityScope } from '../../server/utils/timeshit-activity'
import { timeshitError } from '../../server/utils/timeshit-errors'
import { parseTimeshitActivitySnapshot } from '../../shared/utils/timeshit-activity-contract'

const generation = '11111111-1111-4111-8111-111111111111'
const revision = '22222222-2222-4222-8222-222222222222'
const range = { startDate: '2026-10-13', endDate: '2026-10-13', timeZone: 'Asia/Jakarta' as const }
const input = { expectedGeneration: generation, expectedSelectionRevision: revision, range }
const nodeId = 'MDQ6VXNlcjE='
const metadata = { id: 7, owner: { login: 'example' }, name: 'repo', description: null, private: true, archived: false, default_branch: 'main' }
const sha = (n: number) => n.toString(16).padStart(40, '0')
const branch = (n: number) => ({ name: `branch-${n}`, commit: { sha: sha(n) }, protected: false })
const commit = (n: number, date = '2026-10-13T00:00:00Z', message = `Message ${n}\n\nOriginal body`) => ({
  oid: sha(n), url: `https://github.com/example/repo/commit/${sha(n)}`, message, authoredDate: date,
  committedDate: '2026-10-13T01:00:00Z', author: { name: 'User', user: { login: 'renamed-user' } }, committer: { name: 'User' }
})
const page = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) => ({
  repository: { h0: { history: { nodes, pageInfo: { hasNextPage, endCursor } } } }
})
function setup() {
  let clock = Date.parse('2026-10-13T00:00:00Z')
  const scope: ActivityScope = { generation, selectionRevision: revision, accountId: 1, accountLogin: 'old-user', token: 'test-only-secret', repositories: [{ id: 7, owner: 'example', name: 'repo', description: null, private: true, archived: false, defaultBranch: 'main', access: 'readable', checkedAt: '2026-10-13T00:00:00Z' }] }
  const starts: number[] = []
  const get = vi.fn(async (path: string): Promise<unknown> => {
    starts.push(clock)
    if (path === '/user') return { id: 1, node_id: nodeId, login: 'renamed-user' }
    if (path.endsWith('/branches')) return [branch(1)]
    return metadata
  })
  const graphql = vi.fn(async (_token: string, _query: string, variables: Record<string, unknown>) => page([commit(Number.parseInt(String(variables.sha0), 16))]))
  const collector = createTimeshitActivityCollector({ get, graphql, now: () => clock, sleep: async (ms) => {
    clock += ms
  }, gate: async action => action() })
  return { collector, get, graphql, scope, read: () => scope, starts, advance: (ms: number) => {
    clock += ms
  } }
}
async function finish(s: ReturnType<typeof setup>) {
  let result = await s.collector.start(input, s.read)
  while (result.continuation) result = await s.collector.resume({ continuation: result.continuation, expectedRevision: result.revision }, s.read)
  return result
}

describe('Timeshit date-filtered activity collector', () => {
  it('batches at most four heads and advances each cursor independently without rereading complete heads', async () => {
    const s = setup()
    s.get.mockImplementation(async path => path === '/user'
      ? { id: 1, node_id: nodeId, login: 'renamed-user' }
      : path.endsWith('/branches') ? Array.from({ length: 9 }, (_, i) => branch(i + 1)) : metadata)
    s.graphql.mockImplementation(async (_token, query, variables) => {
      const keys = Object.keys(variables).filter(key => /^sha\d+$/.test(key))
      expect(keys.length).toBeLessThanOrEqual(4)
      expect(query).not.toContain(String(variables.sha0))
      return { repository: Object.fromEntries(keys.map((key, i) => {
        const id = Number.parseInt(String(variables[key]), 16)
        const more = id % 2 === 0 && variables[`after${i}`] === null
        return [`h${i}`, page([commit(id)], more, more ? `cursor-${id}` : null).repository.h0]
      })) }
    })
    const result = await finish(s)
    expect(result.status).toBe('complete')
    expect(result.coverage[0]).toMatchObject({ branchesCompleted: 9, commitsScanned: 13 })
    expect(result.items).toHaveLength(9)
    const reads = s.graphql.mock.calls.flatMap(call => Object.entries(call[2]).filter(([key]) => /^sha\d+$/.test(key)).map(([, value]) => value))
    expect(reads.filter(value => value === sha(1))).toHaveLength(1)
    expect(reads.filter(value => value === sha(2))).toHaveLength(2)
    expect(s.graphql.mock.calls.some(call => Object.values(call[2]).includes('cursor-2'))).toBe(true)
  })

  it('retries all batched cursors unchanged after rate limiting', async () => {
    const s = setup()
    s.get.mockImplementation(async path => path === '/user'
      ? { id: 1, node_id: nodeId, login: 'renamed-user' }
      : path.endsWith('/branches') ? [branch(1), branch(2)] : metadata)
    s.graphql.mockRejectedValueOnce(timeshitError('GITHUB_RATE_LIMITED', 429, 'Wait.', 120))
      .mockResolvedValueOnce({ repository: { h0: page([commit(1)]).repository.h0, h1: page([commit(2)]).repository.h0 } })
    const first = await s.collector.start(input, s.read)
    expect(first).toMatchObject({ partialReasons: ['rate-limited'], retryAfterSeconds: 120, items: [] })
    expect((await s.collector.resume({ continuation: first.continuation!, expectedRevision: first.revision }, s.read)).status).toBe('complete')
    expect(s.graphql.mock.calls[0]?.[2]).toEqual(s.graphql.mock.calls[1]?.[2])
  })

  it('falls back to single-head reads without accepting partial or malformed alias results', async () => {
    const s = setup()
    s.get.mockImplementation(async path => path === '/user'
      ? { id: 1, node_id: nodeId, login: 'renamed-user' }
      : path.endsWith('/branches') ? [branch(1), branch(2)] : metadata)
    s.graphql.mockResolvedValueOnce({ repository: { h0: page([commit(99)]).repository.h0, h1: null } })
      .mockResolvedValueOnce(page([commit(1)]))
      .mockResolvedValueOnce(page([commit(2)]))
    const result = await finish(s)
    expect(result.status).toBe('complete')
    expect(result.items.map(item => item.commit.sha)).toEqual([sha(1), sha(2)])
    expect(result.coverage[0]?.commitsScanned).toBe(2)
    expect(s.graphql.mock.calls[1]?.[2]).not.toHaveProperty('sha1')
    expect(s.graphql.mock.calls[2]?.[2]).toMatchObject({ sha0: sha(2), after0: null })
  })

  it('enforces the global raw-entry ceiling even when each request contains four history pages', async () => {
    const s = setup()
    s.get.mockImplementation(async path => path === '/user'
      ? { id: 1, node_id: nodeId, login: 'renamed-user' }
      : path.endsWith('/branches') ? [branch(1), branch(2), branch(3), branch(4)] : metadata)
    s.graphql.mockImplementation(async (_token, _query, variables) => ({ repository: Object.fromEntries(
      Object.keys(variables).filter(key => /^sha\d+$/.test(key)).map((_, i) => {
        const count = Number(variables[`after${i}`] ?? 0)
        return [`h${i}`, page(Array.from({ length: 100 }, (_, n) => commit(n, '2020-01-01T00:00:00Z')), true, String(count + 1)).repository.h0]
      })
    ) }))
    const result = await finish(s)
    expect(result).toMatchObject({ status: 'partial', continuation: null, partialReasons: ['capacity-limit'], items: [] })
    expect(result.coverage[0]?.commitsScanned).toBe(100000)
    expect(s.graphql.mock.calls.length).toBeLessThan(1000)
  })

  it('checks each captured branch head with the authenticated GitHub author and Jakarta date window', async () => {
    const s = setup()
    s.get.mockImplementation(async path => path === '/user'
      ? { id: 1, node_id: nodeId, login: 'renamed-user' }
      : path.endsWith('/branches') ? [branch(1), { ...branch(2), commit: { sha: sha(1) } }, branch(3)] : metadata)
    s.graphql.mockImplementation(async (_token, query, variables) => {
      expect(query).toContain('history(first: 100')
      expect(query).toContain('author: { id: $authorId }')
      expect(query).not.toMatch(/\bsince:|\buntil:/)
      expect(variables).toMatchObject({ authorId: nodeId })
      expect(variables).not.toHaveProperty('since')
      expect(variables).not.toHaveProperty('until')
      return { repository: {
        h0: page([commit(10), commit(11, '2026-10-12T16:59:59Z'), commit(12, '2026-10-12T17:00:00Z'), commit(13, '2026-10-13T17:00:00Z')]).repository.h0,
        h1: page([commit(10), commit(14)]).repository.h0
      } }
    })
    const result = await finish(s)
    expect(result.status).toBe('complete')
    expect(result.items.map(item => item.commit.sha)).toEqual([sha(10), sha(14), sha(12)])
    expect(result.items[0]?.commit.message).toBe('Message 10\n\nOriginal body')
    expect(result.coverage[0]).toMatchObject({ branchesDiscovered: 3, branchesCompleted: 3, commitsScanned: 6 })
    expect(s.graphql).toHaveBeenCalledTimes(1)
    expect(s.graphql.mock.calls[0]?.[2]).toMatchObject({ sha0: sha(1), sha1: sha(3), after0: null, after1: null })
    expect(JSON.stringify(result)).not.toContain(s.scope.token)
  })

  it('continues GraphQL cursors within the batch budget and replays revisions safely', async () => {
    const s = setup()
    s.graphql.mockImplementation(async (_token, _query, variables) => {
      const pageNumber = Number(String(variables.after0 ?? '').replace('c', '') || 0)
      return page([commit(pageNumber + 1)], pageNumber < 5, pageNumber < 5 ? `c${pageNumber + 1}` : null)
    })
    const first = await s.collector.start(input, s.read)
    expect(first).toMatchObject({ revision: 1, status: 'partial', partialReasons: ['work-budget'] })
    expect(s.get).toHaveBeenCalledTimes(3)
    expect(s.graphql).toHaveBeenCalledTimes(2)
    expect(s.graphql.mock.calls[1]?.[2]).toMatchObject({ after0: 'c1' })
    const second = await s.collector.resume({ continuation: first.continuation!, expectedRevision: 1 }, s.read)
    expect(second.revision).toBe(2)
    expect(await s.collector.resume({ continuation: first.continuation!, expectedRevision: 1 }, s.read)).toEqual(second)
    expect(s.graphql).toHaveBeenCalledTimes(6)
    const third = await s.collector.resume({ continuation: first.continuation!, expectedRevision: 2 }, s.read)
    expect(third).toEqual(second)
    await expect(s.collector.resume({ continuation: first.continuation!, expectedRevision: 0 }, s.read)).rejects.toMatchObject({ data: { code: 'ACTIVITY_REVISION_CHANGED' } })
  })

  it('retries a rate-limited cursor without advancing it', async () => {
    const s = setup()
    s.graphql.mockRejectedValueOnce(timeshitError('GITHUB_RATE_LIMITED', 429, 'Wait.', 120))
    const first = await s.collector.start(input, s.read)
    expect(first).toMatchObject({ partialReasons: ['rate-limited'], retryAfterSeconds: 120 })
    expect(s.graphql.mock.calls[0]?.[2]).toMatchObject({ after0: null })
    expect((await s.collector.resume({ continuation: first.continuation!, expectedRevision: 1 }, s.read)).status).toBe('complete')
    expect(s.graphql.mock.calls[1]?.[2]).toMatchObject({ after0: null })
  })

  it('preserves failed/unverified repositories in coverage', async () => {
    const s = setup()
    s.scope.repositories.push({ ...s.scope.repositories[0]!, id: 8, name: 'unchecked', access: 'not-checked' })
    s.get.mockImplementationOnce(async () => ({ id: 1, node_id: nodeId, login: 'renamed-user' }))
      .mockImplementationOnce(async () => metadata).mockRejectedValueOnce(timeshitError('GITHUB_CONFLICT', 409, 'Conflict.'))
    const result = await finish(s)
    expect(result).toMatchObject({ status: 'partial', continuation: null, partialReasons: ['repository-unavailable', 'upstream-error'] })
    expect(result.coverage.map(repo => repo.failure)).toEqual(['conflict', 'not-verified'])
    expect(result.items).toEqual([])
  })

  it('rejects scope changes, expiry, replacement and concurrent operations', async () => {
    const s = setup()
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    s.get.mockImplementationOnce(async () => {
      await pending
      return { id: 1, node_id: nodeId, login: 'renamed-user' }
    })
    const running = s.collector.start(input, s.read)
    await expect(s.collector.start(input, s.read)).rejects.toMatchObject({ data: { code: 'ACTIVITY_BUSY' } })
    s.scope.selectionRevision = generation
    release()
    await expect(running).rejects.toMatchObject({ data: { code: 'CONNECTION_CHANGED' } })
    s.scope.selectionRevision = revision
    const first = await s.collector.start(input, s.read)
    const next = await s.collector.start(input, s.read)
    await expect(s.collector.resume({ continuation: first.continuation!, expectedRevision: 1 }, s.read)).rejects.toMatchObject({ data: { code: 'ACTIVITY_EXPIRED' } })
    s.advance(30 * 60 * 1000)
    await expect(s.collector.resume({ continuation: next.continuation!, expectedRevision: 1 }, s.read)).rejects.toMatchObject({ data: { code: 'ACTIVITY_EXPIRED' } })
  })

  it('enforces request spacing and reserves time before starting a GraphQL read', async () => {
    const s = setup()
    s.get.mockImplementation(async (path) => {
      s.starts.push(Date.parse('2026-10-13T00:00:00Z') + s.starts.length * 8000)
      s.advance(8000)
      return path === '/user' ? { id: 1, node_id: nodeId, login: 'renamed-user' } : metadata
    })
    const result = await s.collector.start(input, s.read)
    expect(s.get).toHaveBeenCalledTimes(2)
    expect(s.graphql).not.toHaveBeenCalled()
    expect(result.partialReasons).toEqual(['work-budget'])
  })

  it('stops before overflowing matching-item capacity', async () => {
    const s = setup()
    let pageNumber = 0
    s.graphql.mockImplementation(async () => {
      pageNumber++
      return page(Array.from({ length: 100 }, (_, i) => commit(pageNumber * 100 + i)), pageNumber < 100, pageNumber < 100 ? `c${pageNumber}` : null)
    })
    const result = await finish(s)
    expect(result).toMatchObject({ status: 'partial', continuation: null, partialReasons: ['capacity-limit'] })
    expect(result.items).toHaveLength(5000)
    expect(parseTimeshitActivitySnapshot(result)).toBe(result)
  })

  it('caps snapshot bytes without truncating a source message', async () => {
    const s = setup()
    s.graphql.mockResolvedValueOnce(page([commit(1, undefined, 'x'.repeat(6 * 1024 * 1024))]))
    const result = await finish(s)
    expect(result.partialReasons).toEqual(['capacity-limit'])
    expect(result.items).toEqual([])
    expect(result.coverage[0]?.commitsScanned).toBe(0)
  })

  it('rejects invalid identity, repository reuse, malformed GraphQL commits and foreign author links', async () => {
    const identity = setup()
    identity.get.mockResolvedValueOnce({ id: 1, node_id: '', login: 'renamed-user' })
    await expect(identity.collector.start(input, identity.read)).rejects.toMatchObject({ data: { code: 'GITHUB_AUTH_FAILED' } })
    const repo = setup()
    repo.get.mockImplementationOnce(async () => ({ id: 1, node_id: nodeId, login: 'renamed-user' })).mockImplementationOnce(async () => ({ ...metadata, id: 9 }))
    expect((await finish(repo)).coverage[0]?.failure).toBe('invalid-upstream')
    const foreign = setup()
    foreign.graphql.mockResolvedValueOnce(page([{ ...commit(1), author: { name: 'Other', user: { login: 'other' } } }]))
    expect((await finish(foreign)).coverage[0]?.failure).toBe('invalid-upstream')
  })

  it('keeps transient failures resumable and rejects invalid credentials', async () => {
    const s = setup()
    s.get.mockRejectedValueOnce(timeshitError('GITHUB_UNAVAILABLE', 502, 'Unavailable.'))
    const first = await s.collector.start(input, s.read)
    expect(first.partialReasons).toEqual(['upstream-error', 'work-budget'])
    expect((await s.collector.resume({ continuation: first.continuation!, expectedRevision: 1 }, s.read)).status).toBe('complete')
    s.get.mockRejectedValueOnce(timeshitError('GITHUB_AUTH_FAILED', 422, 'Rejected.'))
    await expect(s.collector.start(input, s.read)).rejects.toMatchObject({ data: { code: 'GITHUB_AUTH_FAILED' } })
    await expect(s.collector.resume({ continuation: first.continuation!, expectedRevision: 1 }, s.read)).rejects.toMatchObject({ data: { code: 'ACTIVITY_EXPIRED' } })
  })

  it('enforces request and branch limits, while date filtering keeps returned counts scoped', async () => {
    const s = setup()
    s.graphql.mockImplementation(async (_token, _query, variables) => {
      const count = Number(String(variables.after0 ?? '').replace('c', '') || 0)
      return page(Array.from({ length: 100 }, (_, i) => commit(count * 100 + i, '2020-01-01T00:00:00Z')), true, `c${count + 1}`)
    })
    const result = await finish(s)
    expect(result.partialReasons).toContain('capacity-limit')
    expect(result.items).toEqual([])
    const t = setup()
    t.get.mockImplementation(async (path, _token, query) => path === '/user'
      ? { id: 1, node_id: nodeId, login: 'renamed-user' }
      : path.endsWith('/branches') ? Array.from({ length: 100 }, (_, i) => branch(Number(query?.page) * 100 + i)) : metadata)
    const branches = await finish(t)
    expect(branches.coverage[0]?.branchesDiscovered).toBe(2000)
    expect(branches.partialReasons).toEqual(['capacity-limit'])
    expect(t.graphql).not.toHaveBeenCalled()
  })

  it('deduplicates branch names that overlap between paginated responses', async () => {
    const s = setup()
    s.get.mockImplementation(async (path, _token, query) => {
      if (path === '/user') return { id: 1, node_id: nodeId, login: 'renamed-user' }
      if (!path.endsWith('/branches')) return metadata
      const sharedHead = sha(1)
      const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...branch(1), name: `branch-${index}`, commit: { sha: sharedHead } }))
      const secondPage = [
        { ...branch(1), name: 'branch-99', commit: { sha: sharedHead } },
        ...Array.from({ length: 61 }, (_, index) => ({ ...branch(1), name: `branch-${index + 100}`, commit: { sha: sharedHead } }))
      ]
      return Number(query?.page) === 1 ? firstPage : secondPage
    })

    const result = await finish(s)

    expect(result.status).toBe('complete')
    expect(result.coverage[0]).toMatchObject({ branchesDiscovered: 161, branchesCompleted: 161 })
    expect(result.coverage[0]?.failure).toBeNull()
    expect(s.graphql).toHaveBeenCalledTimes(1)
  })

  it('fails branch pagination when a full page makes no new branch progress', async () => {
    const s = setup()
    s.get.mockImplementation(async (path, _token, _query) => {
      if (path === '/user') return { id: 1, node_id: nodeId, login: 'renamed-user' }
      if (!path.endsWith('/branches')) return metadata
      return Array.from({ length: 100 }, (_, index) => ({ ...branch(1), name: `branch-${index}`, commit: { sha: sha(1) } }))
    })

    const result = await finish(s)

    expect(result.status).toBe('partial')
    expect(result.coverage[0]).toMatchObject({ status: 'failed', failure: 'invalid-upstream', branchesDiscovered: 100 })
    expect(s.graphql).not.toHaveBeenCalled()
  })

  it('continues filtered history pages until GitHub reports exhaustion', async () => {
    const s = setup()
    s.graphql.mockImplementationOnce(async () => page(Array.from({ length: 100 }, (_, i) => commit(i, '2020-01-01T00:00:00Z')), true, 'next'))
      .mockImplementationOnce(async () => page([commit(101)]))
    const result = await finish(s)
    expect(result.status).toBe('complete')
    expect(result.items.map(item => item.commit.sha)).toEqual([sha(101)])
    expect(s.graphql.mock.calls[1]?.[2]).toMatchObject({ after0: 'next' })
  })

  it('rechecks the deadline after a delayed timer before starting the next read', async () => {
    let clock = Date.parse('2026-10-13T00:00:00Z')
    const s = setup()
    const collector = createTimeshitActivityCollector({ get: s.get, graphql: s.graphql, now: () => clock, sleep: async () => {
      clock += 15000
    }, gate: async action => action() })
    const result = await collector.start(input, s.read)
    expect(s.get).toHaveBeenCalledTimes(1)
    expect(s.graphql).not.toHaveBeenCalled()
    expect(result.partialReasons).toEqual(['work-budget'])
  })
})
