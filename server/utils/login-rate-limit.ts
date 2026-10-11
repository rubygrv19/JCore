export function consumeLoginAttempt(bucket: { count: number, resetAt: number }, now = Date.now()): number {
  if (now >= bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = now + 60_000
  }
  if (bucket.count >= 10) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  bucket.count++
  return 0
}
