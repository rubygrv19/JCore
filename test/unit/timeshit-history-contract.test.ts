import { describe, expect, it } from 'vitest'
import examples from '../../docs/timeshit-history.examples.json'
import { parseTimeshitBranches, parseTimeshitCommitDetail, parseTimeshitCommits } from '../../shared/utils/timeshit-history-contract'

describe('Timeshit history response contract', () => {
  it('accepts all documented synthetic response examples', () => {
    expect(parseTimeshitBranches(examples.branches)).toEqual(examples.branches)
    expect(parseTimeshitCommits(examples.commits)).toEqual(examples.commits)
    expect(parseTimeshitCommitDetail(examples.commitDetail)).toEqual(examples.commitDetail)
  })

  it('rejects invalid SHAs, oversized pages and unknown response properties', () => {
    expect(() => parseTimeshitBranches({ ...examples.branches, branches: [{ name: 'main', headSha: 'bad', protected: true }] })).toThrow()
    expect(() => parseTimeshitCommits({ ...examples.commits, extra: true })).toThrow()
    expect(() => parseTimeshitCommitDetail({ ...examples.commitDetail, filePage: 31 })).toThrow()
  })

  it('rejects another valid history envelope at each endpoint boundary', () => {
    expect(() => parseTimeshitBranches(examples.commits)).toThrow()
    expect(() => parseTimeshitCommits(examples.commitDetail)).toThrow()
    expect(() => parseTimeshitCommitDetail(examples.branches)).toThrow()
  })
})
