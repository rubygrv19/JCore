import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toNodeListener, type H3Event } from 'h3'
import { createServer, request as httpRequest } from 'node:http'
import {
  createLoginRateLimiter, loginClientKey, LOGIN_CLIENT_LIMIT,
  LOGIN_GLOBAL_LIMIT, LOGIN_MAX_CLIENTS, LOGIN_WINDOW_MS
} from '../../server/utils/login-rate-limit'

describe('bounded login budgets', () => {
  it('limits each client independently and expires its fixed window', () => {
    const consume = createLoginRateLimiter()
    for (let i = 0; i < LOGIN_CLIENT_LIMIT; i++) expect(consume('a', 0)).toBe(0)
    expect(consume('a', 1)).toBe(60)
    expect(consume('b', 1)).toBe(0)
    expect(consume('a', LOGIN_WINDOW_MS - 1)).toBe(1)
    expect(consume('a', LOGIN_WINDOW_MS)).toBe(0)
  })

  it('does not charge denied client attempts to the global budget or prolong their window', () => {
    const consume = createLoginRateLimiter()
    for (let i = 0; i < LOGIN_CLIENT_LIMIT; i++) consume('a', 0)
    for (let i = 0; i < 200; i++) expect(consume('a', 1000)).toBe(59)
    for (let i = LOGIN_CLIENT_LIMIT; i < LOGIN_GLOBAL_LIMIT; i++) expect(consume(`client-${i}`, 1000)).toBe(0)
    expect(consume('new-client', 1000)).toBe(59)
    expect(consume('a', LOGIN_WINDOW_MS)).toBe(0)
  })

  it('enforces the global safeguard across distinct clients and resets it', () => {
    const consume = createLoginRateLimiter()
    for (let i = 0; i < LOGIN_GLOBAL_LIMIT; i++) expect(consume(`client-${i}`, 0)).toBe(0)
    expect(consume('another', 500)).toBe(60)
    expect(consume('another', LOGIN_WINDOW_MS)).toBe(0)
  })

  it('returns the longer cooldown when both budgets are exhausted', () => {
    const consume = createLoginRateLimiter()
    consume('first', 0)
    for (let i = 0; i < LOGIN_CLIENT_LIMIT; i++) consume('a', 1000)
    for (let i = 0; i < LOGIN_GLOBAL_LIMIT - LOGIN_CLIENT_LIMIT - 1; i++) consume(`other-${i}`, 1000)
    expect(consume('a', 1000)).toBe(60)
  })

  it('bounds client storage without evicting live budgets and reclaims expired entries', () => {
    const consume = createLoginRateLimiter()
    consume('first', 0)
    for (let i = 1; i < LOGIN_GLOBAL_LIMIT; i++) consume(`old-${i}`, 59_000)
    for (let i = 0; i < LOGIN_MAX_CLIENTS - (LOGIN_GLOBAL_LIMIT - 1); i++) expect(consume(`new-${i}`, 60_000)).toBe(0)
    expect(consume('overflow', 60_000)).toBe(59)
    for (let i = 1; i < LOGIN_CLIENT_LIMIT; i++) expect(consume('old-1', 60_000)).toBe(0)
    expect(consume('old-1', 60_000)).toBe(59)
    expect(consume('overflow', 119_000)).toBe(0)
  })

  it('keeps separately constructed process-local limiter instances independent', () => {
    const first = createLoginRateLimiter()
    const second = createLoginRateLimiter()
    for (let i = 0; i < LOGIN_CLIENT_LIMIT; i++) first('a', 0)
    expect(first('a', 0)).toBe(60)
    expect(second('a', 0)).toBe(0)
  })
})

function peerEvent(peer?: string, headers: Record<string, string | string[]> = {}): H3Event {
  return { node: { req: { socket: { remoteAddress: peer }, headers } }, context: { clientAddress: '203.0.113.200' } } as unknown as H3Event
}

describe('trusted client address resolution', () => {
  it('uses the TCP peer and ignores forwarded headers and adapter context by default', () => {
    expect(loginClientKey(peerEvent('198.51.100.10', {
      'x-real-ip': '203.0.113.1', 'x-forwarded-for': '203.0.113.2', 'forwarded': 'for=203.0.113.3'
    }))).toBe('198.51.100.10')
  })

  it('ignores spoofed real IP from an untrusted peer', () => {
    expect(loginClientKey(peerEvent('198.51.100.10', { 'x-real-ip': '203.0.113.1' }), '127.0.0.1')).toBe('198.51.100.10')
  })

  it('uses only a single valid real IP from an explicitly trusted peer', () => {
    expect(loginClientKey(peerEvent('::ffff:127.0.0.1', {
      'x-real-ip': '203.0.113.1', 'x-forwarded-for': '192.0.2.100', 'forwarded': 'for=192.0.2.101'
    }), '127.0.0.1, ::1')).toBe('203.0.113.1')
  })

  it.each(['::ffff:192.0.2.1', '::ffff:c000:201'])('canonicalizes IPv4-mapped peer addresses: %s', (peer) => {
    expect(loginClientKey(peerEvent(peer))).toBe('192.0.2.1')
  })

  it('canonicalizes alternate IPv6 representations', () => {
    expect(loginClientKey(peerEvent('2001:0db8:0000:0000:0000:0000:0000:0001'))).toBe('2001:db8::1')
    expect(loginClientKey(peerEvent('127.0.0.1', { 'x-real-ip': '::ffff:c000:201' }), '127.0.0.1')).toBe('192.0.2.1')
  })

  it('shares an unknown bucket when the transport has no valid peer', () => {
    expect(loginClientKey(peerEvent(undefined, { 'x-real-ip': '203.0.113.1' }), '127.0.0.1')).toBe('unknown')
    expect(loginClientKey(peerEvent('invalid'))).toBe('unknown')
  })

  it('returns a safe configuration error for a non-string proxy setting', () => {
    expect(() => loginClientKey(peerEvent('127.0.0.1'), ['127.0.0.1'] as unknown as string)).toThrowError(expect.objectContaining({ statusCode: 503 }))
  })

  it.each(['*', '127.0.0.0/8', 'localhost', '127.0.0.1,', 'not-an-address'])('fails closed for invalid proxy configuration: %s', (value) => {
    expect(() => loginClientKey(peerEvent('127.0.0.1'), value)).toThrowError(expect.objectContaining({ statusCode: 503 }))
  })

  it.each([undefined, 'unknown', '198.51.100.1, 203.0.113.1', '192.0.2.1:80', '[::1]'])('requires a valid single proxy header: %s', (value) => {
    expect(() => loginClientKey(peerEvent('127.0.0.1', value ? { 'x-real-ip': value } : {}), '127.0.0.1')).toThrowError(expect.objectContaining({ statusCode: 503 }))
  })

  it('rejects duplicate real-IP headers rather than selecting a caller-controlled element', () => {
    expect(() => loginClientKey(peerEvent('127.0.0.1', { 'x-real-ip': ['192.0.2.1', '192.0.2.2'] }), '127.0.0.1')).toThrowError(expect.objectContaining({ statusCode: 503 }))
  })
})

const credentials = { email: 'rate-limit@example.invalid', password: 'synthetic-password-long-enough' }
let proxyIps = ''
const session = vi.fn()
beforeEach(() => {
  proxyIps = ''
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setUserSession', session.mockReset().mockResolvedValue(undefined))
  vi.stubGlobal('useRuntimeConfig', () => ({
    auth: { adminEmail: credentials.email, adminPassword: credentials.password, trustedOrigin: 'http://localhost', trustedProxyIps: proxyIps },
    session: { password: 's'.repeat(48) }
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function withLoginServer(run: (login: (headers?: Record<string, string>, password?: string) => Promise<{ status: number | undefined, retry: string | undefined, connection: string | undefined }>) => Promise<void>) {
  const handler = (await import('../../server/api/auth/login.post')).default
  const server = createServer(toNodeListener(createApp({ debug: false }).use(handler)))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  async function login(headers: Record<string, string> = {}, password = 'incorrect') {
    return new Promise<{ status: number | undefined, retry: string | undefined, connection: string | undefined }>((resolve, reject) => {
      const request = httpRequest(`http://127.0.0.1:${address.port}/api/auth/login`, {
        method: 'POST', agent: false, headers: { 'origin': 'http://localhost', 'content-type': 'application/json', ...headers }
      }, (response) => {
        response.resume()
        response.on('end', () => resolve({ status: response.statusCode, retry: response.headers['retry-after'], connection: response.headers.connection }))
      })
      request.on('error', reject)
      request.setTimeout(2000, () => request.destroy(new Error('Login probe timed out')))
      request.end(JSON.stringify({ ...credentials, password }))
    })
  }
  try {
    await run(login)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

describe('login route throttling over HTTP', () => {
  it('keeps spoofed headers in the direct peer budget and rejects before session creation', async () => {
    await withLoginServer(async (login) => {
      for (let i = 0; i < LOGIN_CLIENT_LIMIT; i++) expect((await login({ 'x-real-ip': `192.0.2.${i}`, 'x-forwarded-for': `203.0.113.${i}` })).status).toBe(401)
      const blocked = await login({ 'x-real-ip': '192.0.2.200' }, credentials.password)
      expect(blocked.status).toBe(429)
      expect(Number(blocked.retry)).toBeGreaterThan(0)
      expect(Number(blocked.retry)).toBeLessThanOrEqual(60)
      expect(blocked.connection).toBe('close')
      expect(session).not.toHaveBeenCalled()
    })
  })

  it('isolates clients behind the configured proxy and still permits another administrator attempt', async () => {
    proxyIps = '127.0.0.1'
    await withLoginServer(async (login) => {
      for (let i = 0; i < LOGIN_CLIENT_LIMIT; i++) expect((await login({ 'x-real-ip': '192.0.2.1' })).status).toBe(401)
      expect((await login({ 'x-real-ip': '192.0.2.1' })).status).toBe(429)
      expect((await login({ 'x-real-ip': '192.0.2.2' }, credentials.password)).status).toBe(200)
      expect(session).toHaveBeenCalledOnce()
      expect((await login({ 'x-forwarded-for': '192.0.2.3' })).status).toBe(503)
    })
  })
})
