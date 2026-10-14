import { describe, expect, it } from 'vitest'
import examples from '../../docs/timeshit-activity.examples.json'
import type { TimeshitActivitySnapshot } from '../../shared/types/timeshit-activity'
import { formatTimeshitDigest, timeshitDigestGroups } from '../../shared/utils/timeshit-digest'

const fixture = () => structuredClone(examples.snapshots.complete) as TimeshitActivitySnapshot

describe('Timeshit daily digest', () => {
  it('groups the author day by repository and deduplicates branch copies', () => {
    const snapshot = fixture()
    const item = snapshot.items[0]!
    snapshot.items.push(structuredClone(item), { ...item, commit: { ...item.commit, sha: 'f'.repeat(40), authoredAt: '2026-10-12T17:00:00Z' } })
    const groups = timeshitDigestGroups(snapshot, '2026-10-12')
    expect(groups.flatMap(group => group.commits)).toHaveLength(examples.snapshots.complete.items.length)
    expect(groups.find(group => group.repositoryId === item.repositoryId)?.commits.some(commit => commit.sha === item.commit.sha)).toBe(true)
  })
  it('preserves complete original messages and whitespace in plain exports', () => {
    const snapshot = fixture()
    const message = 'judul asli  \n\n  detail\t \nakhir\n'
    snapshot.items[0]!.commit.message = message
    const output = formatTimeshitDigest(snapshot, '2026-10-12', 'plain')
    expect(output).toContain(message)
    expect(output).toContain(snapshot.items[0]!.commit.sha)
    expect(output).toContain('Asia/Jakarta')
    expect(output).not.toContain(snapshot.generation)
    expect(output).not.toContain(snapshot.selectionRevision)
  })
  it('uses a longer Markdown fence so upstream markup cannot escape its literal block', () => {
    const snapshot = fixture()
    snapshot.items[0]!.commit.message = '# heading\n```\n<img src=x>\n`````\n[link](javascript:bad)'
    const output = formatTimeshitDigest(snapshot, '2026-10-12', 'markdown')
    expect(output).toContain('``````\n# heading\n```\n<img src=x>\n`````\n[link](javascript:bad)\n``````')
    expect(output).toBe(formatTimeshitDigest(snapshot, '2026-10-12', 'markdown'))
  })
  it('exports partial and stale warnings without claiming zero activity is complete', () => {
    const snapshot = structuredClone(examples.snapshots.partial) as TimeshitActivitySnapshot
    snapshot.items = []
    const output = formatTimeshitDigest(snapshot, '2026-10-12', 'plain', true)
    expect(output).toContain('WARNING: Partial')
    expect(output).toContain('WARNING: Stale')
    expect(output).toContain('0 observed commits (total unknown)')
    expect(output).toContain('No commits observed on this day; total unknown.')
    expect(output).not.toContain(snapshot.continuation!)
  })
  it('distinguishes complete empty days and rejects out-of-scope or invalid dates', () => {
    const snapshot = fixture()
    snapshot.items = []
    expect(formatTimeshitDigest(snapshot, '2026-10-12', 'plain')).toContain('No commits on this day.')
    expect(() => timeshitDigestGroups(snapshot, '2026-10-13')).toThrow('within the collected range')
    snapshot.range.endDate = '2026-12-31'
    expect(() => timeshitDigestGroups(snapshot, '2026-10-32')).toThrow('calendar date')
  })
  it('exports all commits independently of the UI page size', () => {
    const snapshot = fixture()
    const item = snapshot.items[0]!
    snapshot.items = Array.from({ length: 45 }, (_, index) => ({ ...item, commit: { ...item.commit, sha: index.toString(16).padStart(40, '0'), message: `Unique message ${index}` } }))
    const output = formatTimeshitDigest(snapshot, '2026-10-12', 'plain')
    expect(output).toContain('Unique message 44')
    expect(output).toContain('45 commits')
  })
})
