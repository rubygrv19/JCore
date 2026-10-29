import { createError, setResponseHeader } from 'h3'
import { isAdminAuthConfigured, parseAdminCredentials, verifyAdminCredentials } from '../../utils/admin-auth'
import { createLoginRateLimiter, loginClientKey } from '../../utils/login-rate-limit'
import { readLoginRequest } from '../../utils/login-request'

const consumeLoginAttempt = createLoginRateLimiter()

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const retryAfter = consumeLoginAttempt(loginClientKey(event, config.auth.trustedProxyIps))
  if (retryAfter) {
    setResponseHeader(event, 'Retry-After', retryAfter)
    if (!event.web?.request) setResponseHeader(event, 'Connection', 'close')
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-in attempts. Try again in one minute.' })
  }
  const { adminEmail, adminPassword } = config.auth
  const sessionSecret = config.session.password

  if (!isAdminAuthConfigured(adminEmail, adminPassword, sessionSecret)) {
    throw createError({ statusCode: 503, statusMessage: 'Sign-in is not configured.' })
  }

  const credentials = parseAdminCredentials(await readLoginRequest(event, config.auth.trustedOrigin))
  if (!credentials || !verifyAdminCredentials(credentials, adminEmail, adminPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'Email address or password is incorrect.' })
  }

  await setUserSession(event, { user: { email: adminEmail.trim().toLowerCase() } })
  return { ok: true }
})
