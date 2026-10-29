import { isIP } from 'node:net'
import { createError, getHeader, type H3Event } from 'h3'

export const LOGIN_WINDOW_MS = 60_000
export const LOGIN_CLIENT_LIMIT = 10
export const LOGIN_GLOBAL_LIMIT = 100
export const LOGIN_MAX_CLIENTS = 128

function normalizeIp(value: string | undefined): string | undefined {
  if (!value || !isIP(value)) return
  if (isIP(value) === 4) return value
  let normalized: string
  try {
    normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1)
  } catch { return }
  const mapped = normalized.match(/^::ffff:([a-f\d]+):([a-f\d]+)$/)
  if (!mapped) return normalized
  const high = Number.parseInt(mapped[1]!, 16)
  const low = Number.parseInt(mapped[2]!, 16)
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
}

export function loginClientKey(event: H3Event, trustedProxyIps = ''): string {
  if (typeof trustedProxyIps !== 'string') throw createError({ statusCode: 503, statusMessage: 'Sign-in proxy addresses are not configured correctly.' })
  const proxies = trustedProxyIps ? trustedProxyIps.split(',').map(value => normalizeIp(value.trim())) : []
  if (proxies.some(value => !value)) throw createError({ statusCode: 503, statusMessage: 'Sign-in proxy addresses are not configured correctly.' })
  const peer = normalizeIp(event.node.req.socket?.remoteAddress)
  if (!peer || !proxies.includes(peer)) return peer ?? 'unknown'
  const client = normalizeIp(getHeader(event, 'x-real-ip')?.trim())
  if (!client) throw createError({ statusCode: 503, statusMessage: 'The trusted proxy must provide a valid client address.' })
  return client
}

// ponytail: process-local budgets; use a shared store if multiple workers/replicas are introduced.
export function createLoginRateLimiter() {
  const clients = new Map<string, { count: number, resetAt: number }>()
  const global = { count: 0, resetAt: 0 }
  const retryAfter = (resetAt: number, now: number) => Math.max(1, Math.ceil((resetAt - now) / 1000))

  return function consumeLoginAttempt(client: string, now = performance.now()): number {
    if (now >= global.resetAt) {
      global.count = 0
      global.resetAt = now + LOGIN_WINDOW_MS
    }
    for (const [key, bucket] of clients) {
      if (now >= bucket.resetAt) clients.delete(key)
    }
    let bucket = clients.get(client)
    const wait = Math.max(
      bucket && bucket.count >= LOGIN_CLIENT_LIMIT ? retryAfter(bucket.resetAt, now) : 0,
      global.count >= LOGIN_GLOBAL_LIMIT ? retryAfter(global.resetAt, now) : 0
    )
    if (wait) return wait
    if (!bucket) {
      if (clients.size >= LOGIN_MAX_CLIENTS) return retryAfter(Math.min(...Array.from(clients.values(), entry => entry.resetAt)), now)
      bucket = { count: 0, resetAt: now + LOGIN_WINDOW_MS }
      clients.set(client, bucket)
    }
    bucket.count++
    global.count++
    return 0
  }
}
