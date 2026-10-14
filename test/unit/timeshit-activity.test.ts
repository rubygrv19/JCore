import { describe, expect, it } from 'vitest'
import examples from '../../docs/timeshit-activity.examples.json'
import type { TimeshitActivityItem, TimeshitActivityRange } from '../../shared/types/timeshit-activity'
import { selectTimeshitActivity, timeshitActivityDays, timeshitActivityWindow, timeshitAuthoredDay } from '../../shared/utils/timeshit-activity'
import { parseTimeshitActivityContinue, parseTimeshitActivitySnapshot, parseTimeshitActivityStart } from '../../shared/utils/timeshit-activity-contract'

const range: TimeshitActivityRange = { startDate: '2026-10-12', endDate: '2026-10-12', timeZone: 'Asia/Jakarta' }
const item = examples.snapshots.partial.items[0]! as TimeshitActivityItem

describe('Timeshit authored-date activity foundation', () => {
  it('uses Jakarta midnight boundaries regardless of the committer date', () => {
    const { from, to } = timeshitActivityWindow(range)
    expect(new Date(from).toISOString()).toBe('2026-10-11T17:00:00.000Z')
    expect(new Date(to).toISOString()).toBe('2026-10-12T17:00:00.000Z')
    const at = (authoredAt: string) => ({ ...item, commit: { ...item.commit, authoredAt, committedAt: '2025-01-01T00:00:00Z' } })
    expect(selectTimeshitActivity([at('2026-10-11T16:59:59Z')], range)).toHaveLength(0)
    expect(selectTimeshitActivity([at('2026-10-11T17:00:00Z')], range)).toHaveLength(1)
    expect(selectTimeshitActivity([at('2026-10-12T16:59:59Z')], range)).toHaveLength(1)
    expect(selectTimeshitActivity([at('2026-10-12T17:00:00Z')], range)).toHaveLength(0)
    expect(timeshitAuthoredDay('2026-10-12T23:00:00+07:00')).toBe('2026-10-12')
  })

  it('deduplicates a SHA across branches within a repository and keeps distinct repositories and SHAs', () => {
    const otherRepo = { ...item, repositoryId: item.repositoryId + 1 }
    const otherSha = { ...item, commit: { ...item.commit, sha: 'f'.repeat(40) } }
    expect(selectTimeshitActivity([item, structuredClone(item), otherRepo, otherSha], range)).toHaveLength(3)
  })

  it('keeps partial counts unknown and exposes observed commits separately', () => {
    expect(timeshitActivityDays([item, item], range, false)).toEqual([{ date: '2026-10-12', observedCount: 1, count: null }])
    expect(timeshitActivityDays([], range, false)[0]?.count).toBeNull()
    expect(timeshitActivityDays([], range, true)[0]?.count).toBe(0)
  })

  it('validates calendar dates, leap years, ordered ranges and the 366-day ceiling', () => {
    for (const invalid of ['2026-02-29', '2026-02-30', '2026-13-01', '1969-12-31', '2100-01-01']) {
      expect(() => timeshitActivityWindow({ ...range, startDate: invalid })).toThrow()
    }
    const leap: TimeshitActivityRange = { ...range, startDate: '2024-02-28', endDate: '2024-03-01' }
    expect(timeshitActivityDays([], leap, true).map(day => day.date)).toEqual(['2024-02-28', '2024-02-29', '2024-03-01'])
    const year: TimeshitActivityRange = { ...range, startDate: '2024-01-01', endDate: '2024-12-31' }
    expect(timeshitActivityDays([], year, true)).toHaveLength(366)
    expect(() => timeshitActivityWindow({ ...year, endDate: '2025-01-01' })).toThrow()
    expect(() => timeshitActivityWindow({ ...range, endDate: '2026-10-11' })).toThrow()
    expect(timeshitActivityDays([], { ...range, startDate: '2026-12-31', endDate: '2027-01-01' }, true).map(day => day.date))
      .toEqual(['2026-12-31', '2027-01-01'])
  })
})

describe('Timeshit activity contract foundation', () => {
  it('accepts synthetic start/resume and complete/partial/error coverage examples', () => {
    expect(parseTimeshitActivityStart(examples.start)).toEqual(examples.start)
    expect(parseTimeshitActivityContinue(examples.resume)).toEqual(examples.resume)
    for (const snapshot of Object.values(examples.snapshots)) expect(parseTimeshitActivitySnapshot(snapshot)).toEqual(snapshot)
  })

  it('rejects mixed response shapes, duplicate/out-of-range commits and unknown repositories', () => {
    expect(() => parseTimeshitActivityStart(examples.resume)).toThrow()
    expect(() => parseTimeshitActivityContinue(examples.start)).toThrow()
    const snapshot = examples.snapshots.complete
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, items: [item, item] })).toThrow()
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, items: [{ ...item, repositoryId: 999 }] })).toThrow()
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, range: { ...range, startDate: '2026-10-13', endDate: '2026-10-13' } })).toThrow()
  })

  it('rejects false completion, stale timestamp order and impossible coverage', () => {
    const snapshot = examples.snapshots.partial
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, status: 'complete' })).toThrow()
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, updatedAt: '2026-10-12T00:00:00Z' })).toThrow()
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, coverage: [{ ...snapshot.coverage[0], branchesCompleted: 3 }] })).toThrow()
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, continuation: null })).toThrow()
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, retryAfterSeconds: 60 })).toThrow()
  })

  it('rejects another linked account and oversized source content without silently shortening it', () => {
    const snapshot = examples.snapshots.complete
    expect(() => parseTimeshitActivitySnapshot({
      ...snapshot, items: [{ ...item, commit: { ...item.commit, authorLogin: 'other-user' } }]
    })).toThrow()
    const large = { ...item, commit: { ...item.commit, message: 'x'.repeat(5 * 1024 * 1024) } }
    expect(() => parseTimeshitActivitySnapshot({ ...snapshot, items: [large] })).toThrow()
  })
})
