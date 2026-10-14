import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startTimeshitActivity, continueTimeshitActivity } from '../../app/utils/timeshit-client'
import examples from '../../docs/timeshit-activity.examples.json'

const fetcher = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ $fetch: fetcher }))
beforeEach(() => fetcher.mockReset())
describe('Timeshit activity client', () => {
  it('uses same-origin JSON POST bodies, bounded timeout, and no automatic retries', async () => {
    fetcher.mockResolvedValueOnce(examples.snapshots.partial).mockResolvedValueOnce(examples.snapshots.complete)
    expect(await startTimeshitActivity(examples.start as never)).toEqual(examples.snapshots.partial)
    expect(await continueTimeshitActivity(examples.resume)).toEqual(examples.snapshots.complete)
    expect(fetcher.mock.calls).toEqual([
      ['/api/timeshit/activity', { method: 'POST', body: examples.start, credentials: 'same-origin', retry: 0, timeout: 30000 }],
      ['/api/timeshit/activity/continue', { method: 'POST', body: examples.resume, credentials: 'same-origin', retry: 0, timeout: 30000 }]
    ])
    expect(fetcher.mock.calls.every(call => !call[0].includes('?'))).toBe(true)
  })
  it('rejects malformed and contradictory snapshots before state can use them', async () => {
    fetcher.mockResolvedValueOnce({ ...examples.snapshots.partial, status: 'complete' })
    await expect(startTimeshitActivity(examples.start as never)).rejects.toThrow()
    fetcher.mockResolvedValueOnce({ ...examples.snapshots.complete, items: [{ repositoryId: 99, commit: {} }] })
    await expect(continueTimeshitActivity(examples.resume)).rejects.toThrow()
  })
})
