import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, toNodeListener, toWebHandler, type H3Event } from 'h3'
import { Agent, createServer, request as httpRequest } from 'node:http'
import { PassThrough } from 'node:stream'
import { readLimitedBody } from '../../server/utils/limited-body'
import { MAX_LOGIN_BODY_BYTES, readLoginRequest } from '../../server/utils/login-request'
import { readTimeshitJson } from '../../server/utils/timeshit-http'

const origin = 'http://localhost'
const credentials = { email: 'admin@example.test', password: 'synthetic-password-long-enough' }
const session = vi.fn()
let trustedOrigin: string

beforeEach(() => {
  trustedOrigin = origin
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('setUserSession', session.mockReset().mockResolvedValue(undefined))
  vi.stubGlobal('useRuntimeConfig', () => ({
    auth: { adminEmail: credentials.email, adminPassword: credentials.password, trustedOrigin },
    session: { password: 's'.repeat(48) }
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function login(body = JSON.stringify(credentials), extraHeaders: Record<string, string> = {}, omitOrigin = false) {
  const handler = (await import('../../server/api/auth/login.post')).default
  const app = createApp({ debug: false }).use(handler)
  return toWebHandler(app)(new Request(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { ...(!omitOrigin && { origin }), 'content-type': 'application/json', ...extraHeaders },
    body
  }))
}

describe('login request boundary', () => {
  it('accepts normal same-origin JSON and creates a session', async () => {
    const response = await login(undefined, { 'content-type': 'application/json; charset=utf-8' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(session).toHaveBeenCalledOnce()
  })

  it.each(['', '{invalid'])('rejects malformed or empty JSON without a session: %s', async (body) => {
    expect((await login(body)).status).toBe(400)
    expect(session).not.toHaveBeenCalled()
  })

  it.each(['null', '[]', '{}', JSON.stringify({ ...credentials, password: 42 })])('rejects invalid credential shapes: %s', async (body) => {
    expect((await login(body)).status).toBe(401)
    expect(session).not.toHaveBeenCalled()
  })

  it('rejects a wrong password with the existing generic error', async () => {
    const response = await login(JSON.stringify({ ...credentials, password: 'wrong' }))
    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).not.toContain(credentials.password)
    expect(session).not.toHaveBeenCalled()
  })

  it.each(['https://rejected.invalid', 'null', 'http://localhost:9999', 'http://localhost/'])('rejects an untrusted origin: %s', async (value) => {
    expect((await login(undefined, { origin: value })).status).toBe(403)
    expect(session).not.toHaveBeenCalled()
  })

  it('requires Origin even when forwarding headers claim the trusted host', async () => {
    expect((await login(undefined, { 'x-forwarded-host': 'localhost', 'x-forwarded-proto': 'http' }, true)).status).toBe(403)
    expect(session).not.toHaveBeenCalled()
  })

  it('rejects cross-site fetch metadata', async () => {
    expect((await login(undefined, { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
  })

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'])('requires JSON Content-Type: %s', async (value) => {
    expect((await login(undefined, { 'content-type': value })).status).toBe(415)
    expect(session).not.toHaveBeenCalled()
  })

  it('rejects compressed bodies', async () => {
    expect((await login(undefined, { 'content-encoding': 'gzip' })).status).toBe(415)
  })

  it.each(['', 'not a URL', 'https://example.test/', 'https://user:secret@example.test', 'ftp://example.test'])('fails closed on invalid trusted configuration: %s', async (value) => {
    trustedOrigin = value
    expect((await login()).status).toBe(503)
    expect(session).not.toHaveBeenCalled()
  })

  it('rejects an oversized declared body and returns no submitted secrets', async () => {
    const body = JSON.stringify({ ...credentials, padding: 'x'.repeat(MAX_LOGIN_BODY_BYTES) })
    const response = await login(body, { 'content-length': String(Buffer.byteLength(body)) })
    expect(response.status).toBe(413)
    expect(await response.text()).not.toContain(credentials.password)
    expect(session).not.toHaveBeenCalled()
  })

  it('enforces the byte limit even without Content-Length', async () => {
    const response = await login(JSON.stringify({ padding: 'é'.repeat(MAX_LOGIN_BODY_BYTES / 2) }))
    expect(response.status).toBe(413)
    expect(session).not.toHaveBeenCalled()
  })
})

function nodeBody(headers: Record<string, string> = {}) {
  const request = Object.assign(new PassThrough(), { headers })
  const setHeader = vi.fn()
  const event = { node: { req: request, res: { setHeader } } } as unknown as H3Event
  return { request, event, setHeader }
}
const failure = (statusCode: 400 | 413) => createError({ statusCode })

describe('bounded body reader', () => {
  it('closes an early oversized HTTP response and accepts the next request', async () => {
    const app = createApp({ debug: false }).use(defineEventHandler(async event => ({ body: await readLimitedBody(event, 8, failure) })))
    const server = createServer(toNodeListener(app))
    const agent = new Agent({ keepAlive: true, maxSockets: 1 })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
    const url = `http://127.0.0.1:${address.port}`
    async function send(length: number, body?: string) {
      return new Promise<{ status: number | undefined, connection: string | undefined }>((resolve, reject) => {
        const request = httpRequest(url, { method: 'POST', agent, headers: { 'content-length': length } }, (response) => {
          response.resume()
          response.on('end', () => {
            resolve({ status: response.statusCode, connection: response.headers.connection })
            if (body === undefined) request.destroy()
          })
        })
        request.on('error', reject)
        request.setTimeout(2000, () => request.destroy(new Error('Bounded request timed out')))
        if (body === undefined) request.flushHeaders()
        else request.end(body)
      })
    }
    try {
      expect(await send(9)).toEqual({ status: 413, connection: 'close' })
      expect((await send(2, '{}')).status).toBe(200)
    } finally {
      agent.destroy()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })

  it('accepts a body exactly at the byte limit', async () => {
    const { event, request } = nodeBody()
    const result = readLimitedBody(event, 8, failure)
    request.end(Buffer.from('12345678'))
    await expect(result).resolves.toBe('12345678')
    expect(request.listenerCount('data')).toBe(0)
  })

  it('rejects declared length before attaching a buffering listener', async () => {
    const { event, request, setHeader } = nodeBody({ 'content-length': '9' })
    await expect(readLimitedBody(event, 8, failure)).rejects.toMatchObject({ statusCode: 413 })
    expect(setHeader).toHaveBeenCalledWith('Connection', 'close')
    expect(request.listenerCount('data')).toBe(0)
    request.destroy()
  })

  it.each(['-1', 'invalid', '9007199254740992'])('rejects invalid declared length: %s', async (length) => {
    const { event, request } = nodeBody({ 'content-length': length })
    await expect(readLimitedBody(event, 8, failure)).rejects.toMatchObject({ statusCode: 400 })
    request.destroy()
  })

  it('stops retaining chunks on overflow, including understated lengths', async () => {
    const { event, request } = nodeBody({ 'content-length': '1' })
    const result = readLimitedBody(event, 8, failure)
    const check = expect(result).rejects.toMatchObject({ statusCode: 413 })
    request.write(Buffer.from('1234'))
    request.end(Buffer.from('56789'))
    await check
    expect(request.listenerCount('data')).toBe(0)
  })

  it('rejects an interrupted Node stream and cleans up listeners', async () => {
    const { event, request } = nodeBody()
    const result = readLimitedBody(event, 8, failure)
    request.emit('aborted')
    await expect(result).rejects.toMatchObject({ statusCode: 400 })
    expect(request.listenerCount('data')).toBe(0)
    request.destroy()
  })

  it('cancels a Web stream as soon as its byte limit is exceeded', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_LOGIN_BODY_BYTES))
        controller.enqueue(new Uint8Array(1))
      },
      cancel
    })
    const { event, request } = nodeBody({ origin, 'content-type': 'application/json' })
    event.web = { request: { body: stream } as Request, url: new URL(origin) }
    await expect(readLoginRequest(event, origin)).rejects.toMatchObject({ statusCode: 413 })
    expect(cancel).toHaveBeenCalledOnce()
    expect(stream.locked).toBe(false)
    request.destroy()
  })

  it('returns a safe error for an interrupted Web stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('private transport detail'))
      }
    })
    const { event, request } = nodeBody({ origin, 'content-type': 'application/json' })
    event.web = { request: { body: stream } as Request, url: new URL(origin) }
    await expect(readLoginRequest(event, origin)).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Invalid sign-in request body.' })
    expect(stream.locked).toBe(false)
    request.destroy()
  })

  it('preserves Timeshit\'s 4 KiB bound and service error code', async () => {
    const app = createApp({ debug: false }).use(defineEventHandler(event => readTimeshitJson(event, origin)))
    const response = await toWebHandler(app)(new Request(origin, {
      method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(4096) })
    }))
    expect(response.status).toBe(413)
    expect((await response.json()).data.code).toBe('INVALID_INPUT')
  })
})
