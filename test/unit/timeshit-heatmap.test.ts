import { describe, expect, it } from 'vitest'
import examples from '../../docs/timeshit-activity.examples.json'
import type { TimeshitActivitySnapshot } from '../../shared/types/timeshit-activity'
import { timeshitHeatmapDays, timeshitHeatmapDayLabel } from '../../shared/utils/timeshit-heatmap'

const fixture = () => structuredClone(examples.snapshots.complete) as TimeshitActivitySnapshot

describe('Timeshit heatmap author-day presentation', () => {
  it('aligns Sunday through Saturday across a month and year boundary', () => {
    const snapshot = fixture()
    snapshot.range = { startDate: '2025-12-31', endDate: '2026-01-05', timeZone: 'Asia/Jakarta' }
    snapshot.items = []
    const days = timeshitHeatmapDays(snapshot)
    expect(days.map(day => [day.date, day.x, day.y])).toEqual([
      ['2025-12-31', 0, 3], ['2026-01-01', 0, 4], ['2026-01-02', 0, 5],
      ['2026-01-03', 0, 6], ['2026-01-04', 1, 0], ['2026-01-05', 1, 1]
    ])
    expect(days.every(day => day.count === 0 && day.level === 0)).toBe(true)
  })
  it('uses the Jakarta author day and deduplicates commits across branches', () => {
    const snapshot = fixture()
    snapshot.range = { startDate: '2026-10-12', endDate: '2026-10-13', timeZone: 'Asia/Jakarta' }
    const item = snapshot.items[0]!
    snapshot.items = [item, structuredClone(item), { ...item, commit: { ...item.commit, sha: 'f'.repeat(40), authoredAt: '2026-10-12T17:00:00Z' } }]
    expect(timeshitHeatmapDays(snapshot).map(day => day.count)).toEqual([1, 1])
  })
  it('keeps provisional zeros unknown and exposes accessible exact count text', () => {
    const snapshot = fixture()
    snapshot.status = 'partial'
    snapshot.items = []
    const day = timeshitHeatmapDays(snapshot)[0]!
    expect(day).toMatchObject({ observedCount: 0, count: null, level: 0 })
    expect(timeshitHeatmapDayLabel(day)).toContain('0 observed commits; total unknown')
    snapshot.status = 'complete'
    expect(timeshitHeatmapDayLabel(timeshitHeatmapDays(snapshot)[0]!)).toContain('0 commits')
  })
  it.each([[0, 0], [1, 1], [2, 2], [4, 2], [5, 3], [9, 3], [10, 4], [50, 4]])('uses stable intensity for %i commits', (count, level) => {
    const snapshot = fixture()
    const item = snapshot.items[0]!
    snapshot.items = Array.from({ length: count }, (_, index) => ({ ...item, commit: { ...item.commit, sha: index.toString(16).padStart(40, '0') } }))
    expect(timeshitHeatmapDays(snapshot)[0]).toMatchObject({ observedCount: count, count, level })
  })
  it('supports leap day and the full 366-day range without missing days', () => {
    const snapshot = fixture()
    snapshot.range = { startDate: '2024-01-01', endDate: '2024-12-31', timeZone: 'Asia/Jakarta' }
    snapshot.items = []
    const days = timeshitHeatmapDays(snapshot)
    expect(days).toHaveLength(366)
    expect(days.some(day => day.date === '2024-02-29')).toBe(true)
    expect(new Set(days.map(day => `${day.x}:${day.y}`)).size).toBe(366)
    expect(days.at(-1)?.x).toBe(52)
  })
})
