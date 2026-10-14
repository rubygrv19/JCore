import type { TimeshitActivitySnapshot } from '../types/timeshit-activity'
import { selectTimeshitActivity } from './timeshit-activity'

export function timeshitDigestGroups(snapshot: TimeshitActivitySnapshot, day: string) {
  if (day < snapshot.range.startDate || day > snapshot.range.endDate) throw new Error('Choose a day within the collected range.')
  const items = selectTimeshitActivity(snapshot.items, { startDate: day, endDate: day, timeZone: 'Asia/Jakarta' })
  return snapshot.coverage.map(repo => ({ ...repo, commits: items.filter(item => item.repositoryId === repo.repositoryId).map(item => item.commit) }))
}

function markdownCode(value: string) {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g), match => match[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}\n${value}\n${fence}`
}

export function formatTimeshitDigest(snapshot: TimeshitActivitySnapshot, day: string, format: 'plain' | 'markdown', stale = false) {
  const groups = timeshitDigestGroups(snapshot, day)
  const count = groups.reduce((sum, repo) => sum + repo.commits.length, 0)
  const metadata = [
    `Daily digest: ${day} (Asia/Jakarta)`, `Account: ${snapshot.account.login}`,
    `Scope: all observed remote branches; ${groups.length} tracked repositories`,
    `Collection range: ${snapshot.range.startDate} to ${snapshot.range.endDate}`,
    `Collected: ${snapshot.startedAt} to ${snapshot.updatedAt}`,
    `Coverage: ${snapshot.status}; ${count} ${snapshot.status === 'complete' ? 'commits' : 'observed commits (total unknown)'}`,
    ...(snapshot.status !== 'complete' ? [`WARNING: Partial collection; missing activity is unknown. Reasons: ${snapshot.partialReasons.join(', ')}`] : []),
    ...(stale ? ['WARNING: Stale result; the latest collection request did not provide fresh data.'] : [])
  ].join('\n')
  const sections = groups.map((repo) => {
    const heading = `${repo.owner}/${repo.name} — ${repo.status}`
    const commits = repo.commits.map((commit) => {
      const details = `${commit.sha}\nAuthored: ${commit.authoredAt}\nCommitted: ${commit.committedAt}\n${commit.htmlUrl}`
      return format === 'plain' ? `${details}\n${commit.message}` : `${markdownCode(details)}\n\n${markdownCode(commit.message)}`
    })
    return `${format === 'markdown' ? markdownCode(heading) : heading}\n\n${commits.join('\n\n') || (snapshot.status === 'complete' ? 'No commits on this day.' : 'No commits observed on this day; total unknown.')}`
  })
  return [format === 'markdown' ? markdownCode(metadata) : metadata, ...sections].join('\n\n')
}
