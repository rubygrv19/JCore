import type { TimeshitActivitySnapshot } from '../types/timeshit-activity'
import { timeshitActivityDays } from './timeshit-activity'

export function timeshitHeatmapDays(snapshot: TimeshitActivitySnapshot) {
  const days = timeshitActivityDays(snapshot.items, snapshot.range, snapshot.status === 'complete')
  const offset = new Date(`${snapshot.range.startDate}T00:00:00Z`).getUTCDay()
  return days.map((day, index) => ({
    ...day,
    x: Math.floor((index + offset) / 7),
    y: (index + offset) % 7,
    level: day.observedCount === 0 ? 0 : day.observedCount === 1 ? 1 : day.observedCount <= 4 ? 2 : day.observedCount <= 9 ? 3 : 4
  }))
}

export type TimeshitHeatmapDay = ReturnType<typeof timeshitHeatmapDays>[number]

export function timeshitHeatmapDayLabel(day: TimeshitHeatmapDay) {
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))
  const count = new Intl.NumberFormat('en-US').format(day.observedCount)
  return `${date}: ${count} ${day.count === null ? 'observed commits; total unknown' : `commit${day.count === 1 ? '' : 's'}`}`
}
