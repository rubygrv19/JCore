import { createError, readBody } from 'h3'
import { isAdminAuthConfigured, parseAdminCredentials, verifyAdminCredentials } from '../../utils/admin-auth'

export default defineEventHandler(async (event) => {
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
