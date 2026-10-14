import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTimeshitBranches, getTimeshitCommits, getTimeshitCommitDetail } from '../../app/utils/timeshit-client'
import examples from '../../docs/timeshit-history.examples.json'

const fetcher = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ $fetch: fetcher }))
beforeEach(() => fetcher.mockReset())
const repository = { id: examples.branches.repositoryId, owner: 'example', name: 'demo' } as Parameters<typeof getTimeshitBranches>[0]

describe('Timeshit history request scope', () => {
  it('accepts only the requested repository and branch page', async () => {
    fetcher.mockResolvedValueOnce(examples.branches)
    expect(await getTimeshitBranches(repository)).toEqual(examples.branches)
    fetcher.mockResolvedValueOnce({ ...examples.branches, repositoryId: repository.id + 1 })
    await expect(getTimeshitBranches(repository)).rejects.toThrow('scope')
    fetcher.mockResolvedValueOnce({ ...examples.branches, page: 2 })
    await expect(getTimeshitBranches(repository)).rejects.toThrow('scope')
  })

  it('rejects valid commit envelopes from another branch, head or page', async () => {
    const input = examples.commits
    for (const changed of [{ branch: 'different' }, { headSha: 'f'.repeat(40) }, { page: 2 }, { repositoryId: repository.id + 1 }]) {
      fetcher.mockResolvedValueOnce({ ...input, ...changed })
      await expect(getTimeshitCommits(repository, input.branch, input.headSha)).rejects.toThrow('scope')
    }
    fetcher.mockResolvedValueOnce(input)
    expect(await getTimeshitCommits(repository, input.branch, input.headSha)).toEqual(input)
  })

  it('rejects changed files for another commit, repository or file page', async () => {
    const input = examples.commitDetail
    for (const changed of [{ sha: 'f'.repeat(40) }, { filePage: 2 }, { repositoryId: repository.id + 1 }]) {
      fetcher.mockResolvedValueOnce({ ...input, ...changed })
      await expect(getTimeshitCommitDetail(repository, input.sha)).rejects.toThrow('scope')
    }
    fetcher.mockResolvedValueOnce(input)
    expect(await getTimeshitCommitDetail(repository, input.sha)).toEqual(input)
  })
})
