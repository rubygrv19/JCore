import { createError, getHeader, type H3Event } from 'h3'
import { readLimitedBody } from './limited-body'

export const MAX_LOGIN_BODY_BYTES = 8192

export async function readLoginRequest(event: H3Event, trustedOrigin: string): Promise<unknown> {
  let trusted: URL
  try {
    trusted = new URL(trustedOrigin)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in origin is not configured.' })
  }
  if (!['http:', 'https:'].includes(trusted.protocol) || trusted.origin !== trustedOrigin || trusted.username || trusted.password) {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in origin is not configured.' })
  }
  if (getHeader(event, 'origin') !== trustedOrigin || getHeader(event, 'sec-fetch-site') === 'cross-site') {
    throw createError({ statusCode: 403, statusMessage: 'This sign-in request origin is not allowed.' })
  }
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
    || ![undefined, 'identity'].includes(getHeader(event, 'content-encoding'))) {
    throw createError({ statusCode: 415, statusMessage: 'Send an uncompressed JSON sign-in request.' })
  }
  const body = await readLimitedBody(event, MAX_LOGIN_BODY_BYTES, statusCode => createError({
    statusCode,
    statusMessage: statusCode === 413 ? 'Sign-in request is too large.' : 'Invalid sign-in request body.'
  }))
  try {
    return JSON.parse(body)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON sign-in request.' })
  }
}
