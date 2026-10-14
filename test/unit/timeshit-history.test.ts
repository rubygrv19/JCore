import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTimeshitCommit, listTimeshitBranches, listTimeshitCommits } from '../../server/utils/timeshit-github'
import type { TimeshitRepository } from '../../shared/types/timeshit'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ $fetch: async (...args: unknown[]) => new Response(JSON.stringify(await fetchMock(...args))).body }))
beforeEach(() => fetchMock.mockReset())

const token = 'github_pat_synthetic_test_value'
const repository: TimeshitRepository = {
  id: 123, owner: 'Example', name: 'Demo', description: null, private: true, archived: false,
  defaultBranch: 'main', access: 'readable', checkedAt: '2026-10-12T00:00:00.000Z'
}
const commit = {
  sha: 'b'.repeat(40), html_url: `https://github.com/Example/Demo/commit/${'b'.repeat(40)}`,
  commit: {
    message: 'Fix branch history\n\nKeep the captured head stable.',
    author: { name: 'Example User', email: 'private@example.com', date: '2026-10-12T10:00:00Z' },
    committer: { name: 'Example User', date: '2026-10-12T10:03:00Z' }
  },
  author: { login: 'example-user', id: 44 }
}

describe('Timeshit GitHub history reads', () => {
  it('normalizes paginated branch pages with their captured head SHAs', async () => {
    fetchMock.mockResolvedValueOnce([{ name: 'main', commit: { sha: 'a'.repeat(40) }, protected: true }])
    const response = await listTimeshitBranches(token, repository, 2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/Example/Demo/branches')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ query: { per_page: 100, page: 2 }, retry: 0, timeout: 8000, redirect: 'error' })
    expect(response).toMatchObject({ repositoryId: 123, page: 2, hasNext: false, branches: [{ name: 'main', headSha: 'a'.repeat(40), protected: true }] })
  })

  it('filters commits by the server-supplied account and pins history to a branch head', async () => {
    fetchMock.mockResolvedValueOnce([commit])
    const response = await listTimeshitCommits(token, repository, {
      branch: 'feature/with/slash', headSha: 'a'.repeat(40), author: 'example-user', page: 1
    })
    expect(fetchMock.mock.calls[0]?.[1].query).toEqual({ sha: 'a'.repeat(40), author: 'example-user', per_page: 30, page: 1 })
    expect(response.commits[0]).toMatchObject({ title: 'Fix branch history', body: 'Keep the captured head stable.', authoredAt: '2026-10-12T10:00:00Z', committedAt: '2026-10-12T10:03:00Z' })
    expect(JSON.stringify(response)).not.toContain('private@example.com')
  })

  it('normalizes changed files, represents an omitted patch, and bounds GitHub detail pagination', async () => {
    fetchMock.mockResolvedValueOnce({
      ...commit,
      stats: { additions: 3, deletions: 1, total: 4 },
      files: Array.from({ length: 100 }, (_, index) => ({
        filename: `src/file-${index}.ts`, status: 'modified', additions: 3, deletions: 1, changes: 4,
        ...(index ? { patch: 'p'.repeat(20001) } : {}), blob_url: `https://github.com/Example/Demo/blob/${'b'.repeat(40)}/src/file-${index}.ts`
      }))
    })
    const response = await getTimeshitCommit(token, repository, 'b'.repeat(40), 30)
    expect(fetchMock.mock.calls[0]?.[1].query).toEqual({ per_page: 100, page: 30 })
    expect(response).toMatchObject({ filePage: 30, hasNextFiles: false, filesTruncatedAtGitHubLimit: true })
    expect(response.files[0]).toMatchObject({ filename: 'src/file-0.ts', patch: null, patchTruncated: false })
    expect(response.files[1]).toMatchObject({ patchTruncated: true })
    expect(response.files[1]?.patch).toHaveLength(20000)
  })

  it('rejects malformed upstream records and invalid user-controlled refs', async () => {
    await expect(getTimeshitCommit(token, repository, 'a'.repeat(40), 31))
      .rejects.toMatchObject({ data: { code: 'INVALID_INPUT' } })
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(listTimeshitCommits(token, repository, { branch: 'main', headSha: 'bad', author: 'example-user', page: 1 }))
      .rejects.toMatchObject({ data: { code: 'INVALID_INPUT' } })
    fetchMock.mockResolvedValueOnce([{ ...commit, sha: 'bad' }])
    await expect(listTimeshitCommits(token, repository, { branch: 'main', headSha: 'a'.repeat(40), author: 'example-user', page: 1 }))
      .rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
  })

  it('rejects a different linked author instead of displaying another account’s commits', async () => {
    fetchMock.mockResolvedValueOnce([{ ...commit, author: { login: 'different-user', id: 99 } }])
    await expect(listTimeshitCommits(token, repository, { branch: 'main', headSha: 'a'.repeat(40), author: 'example-user', page: 1 }))
      .rejects.toMatchObject({ data: { code: 'INVALID_UPSTREAM' } })
  })
})
