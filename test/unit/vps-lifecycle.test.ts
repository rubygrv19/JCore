import { afterEach, describe, expect, it, vi } from 'vitest'
import { startPolling } from '../../app/utils/polling'
import { consumeLoginAttempt } from '../../server/utils/login-rate-limit'

afterEach(() => vi.useRealTimers())

describe('VPS polling lifecycle', () => {
  it('does not overlap requests and aborts on disposal without rescheduling', async () => {
    vi.useFakeTimers()
    let finish: (() => void) | undefined
    let signal: AbortSignal | undefined
    const task = vi.fn((value: AbortSignal) => {
      signal = value
      return new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const stop = startPolling(task)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(task).toHaveBeenCalledTimes(1)
    stop()
    expect(signal?.aborted).toBe(true)
    finish?.()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('retries after failures and stops future requests', async () => {
    vi.useFakeTimers()
    const task = vi.fn().mockRejectedValue(new Error('Collector unavailable'))
    const stop = startPolling(task)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(task).toHaveBeenCalledTimes(2)
    stop()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(task).toHaveBeenCalledTimes(2)
  })
})

describe('single administrator sign-in limit', () => {
  it('rejects the eleventh attempt and admits attempts after the window expires', () => {
    const bucket = { count: 0, resetAt: 0 }
    for (let count = 0; count < 10; count++) expect(consumeLoginAttempt(bucket, 1000)).toBe(0)
    expect(consumeLoginAttempt(bucket, 2000)).toBe(59)
    expect(consumeLoginAttempt(bucket, 61_000)).toBe(0)
  })
})
