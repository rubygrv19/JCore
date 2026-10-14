import type { TimeshitActivityItem, TimeshitActivityRange } from '../types/timeshit-activity'

const dayMs = 86400000
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
})

function midnight(value: string) {
  if (!/^(19[7-9]\d|20\d\d)-\d{2}-\d{2}$/.test(value)) throw new Error('Use a valid date between 1970 and 2099.')
  const result = Date.parse(`${value}T00:00:00+07:00`)
  if (!Number.isFinite(result) || timeshitAuthoredDay(new Date(result).toISOString()) !== value) throw new Error('Use a valid calendar date.')
  return result
}

export function timeshitActivityWindow(range: TimeshitActivityRange) {
  if (range.timeZone !== 'Asia/Jakarta') throw new Error('Timeshit uses the Asia/Jakarta time zone.')
  const from = midnight(range.startDate)
  const to = midnight(range.endDate) + dayMs
  if (to <= from || to - from > 366 * dayMs) throw new Error('Select an ordered range of at most 366 days.')
  return { from, to }
}

export function timeshitAuthoredDay(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid commit author timestamp.')
  const parts = formatter.formatToParts(new Date(timestamp))
  const part = (name: string) => parts.find(item => item.type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function selectTimeshitActivity(items: TimeshitActivityItem[], range: TimeshitActivityRange) {
  const { from, to } = timeshitActivityWindow(range)
  const seen = new Set<string>()
  return items.filter((item) => {
    const date = Date.parse(item.commit.authoredAt)
    if (!Number.isFinite(date)) throw new Error('Invalid commit author timestamp.')
    if (date < from || date >= to) return false
    const key = `${item.repositoryId}:${item.commit.sha.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((left, right) => Date.parse(right.commit.authoredAt) - Date.parse(left.commit.authoredAt)
    || left.repositoryId - right.repositoryId || left.commit.sha.localeCompare(right.commit.sha))
}

export function timeshitActivityDays(items: TimeshitActivityItem[], range: TimeshitActivityRange, complete: boolean) {
  const { from, to } = timeshitActivityWindow(range)
  const counts = new Map<string, number>()
  for (const item of selectTimeshitActivity(items, range)) {
    const day = timeshitAuthoredDay(item.commit.authoredAt)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return Array.from({ length: (to - from) / dayMs }, (_, index) => {
    const date = timeshitAuthoredDay(new Date(from + index * dayMs).toISOString())
    const observedCount = counts.get(date) ?? 0
    return { date, observedCount, count: complete ? observedCount : null }
  })
}
