import { createError, readBody, setResponseHeader } from 'h3'
import { isAdminAuthConfigured, parseAdminCredentials, verifyAdminCredentials } from '../../utils/admin-auth'
import { consumeLoginAttempt } from '../../utils/login-rate-limit'

// Single administrator, single Node process. No trust in client-supplied forwarding headers.
const attempts = { count: 0, resetAt: 0 }

export default defineEventHandler(async (event) => {
  const retryAfter = consumeLoginAttempt(attempts)
  if (retryAfter) {
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-in attempts. Try again in one minute.' })
  }
  const config = useRuntimeConfig(event)
  const { adminEmail, adminPassword } = config.auth
  const sessionSecret = config.session.password

  if (!isAdminAuthConfigured(adminEmail, adminPassword, sessionSecret)) {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in is not configured.' })
  }

  const credentials = parseAdminCredentials(await readBody(event))
  if (!credentials || !verifyAdminCredentials(credentials, adminEmail, adminPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'Email address or password is incorrect.' })
  }

  await setUserSession(event, { user: { email: adminEmail.trim().toLowerCase() } })
  return { ok: true }
})
