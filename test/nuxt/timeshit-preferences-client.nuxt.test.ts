import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTimeshitPreferences, saveTimeshitPreferences } from '../../app/utils/timeshit-client'
import examples from '../../docs/timeshit-preferences.examples.json'

const fetcher = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ $fetch: fetcher }))
beforeEach(() => fetcher.mockReset())
describe('Timeshit preference client', () => {
  it('uses private same-origin requests and a versioned PUT body', async () => {
    fetcher.mockResolvedValueOnce(examples.default).mockResolvedValueOnce(examples.custom)
    expect(await getTimeshitPreferences()).toEqual(examples.default)
    expect(await saveTimeshitPreferences('release/stable')).toEqual(examples.custom)
    expect(fetcher.mock.calls).toEqual([
      ['/api/timeshit/preferences', { credentials: 'same-origin', retry: 0 }],
      ['/api/timeshit/preferences', { method: 'PUT', body: examples.custom, credentials: 'same-origin', retry: 0 }]
    ])
  })
  it('rejects invalid response envelopes', async () => {
    fetcher.mockResolvedValueOnce({ ...examples.default, token: 'unexpected' })
    await expect(getTimeshitPreferences()).rejects.toThrow()
  })
})
