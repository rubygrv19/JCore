import { timingSafeEqual } from 'node:crypto'

const MIN_ADMIN_PASSWORD_LENGTH = 15
const MAX_CREDENTIAL_LENGTH = 1024
const MIN_SESSION_SECRET_LENGTH = 32

export interface AdminCredentials {
  email: string
  password: string
}

export function isAdminAuthConfigured(email: string, password: string, sessionSecret: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && password.length >= MIN_ADMIN_PASSWORD_LENGTH
    && password.length <= MAX_CREDENTIAL_LENGTH
    && sessionSecret.length >= MIN_SESSION_SECRET_LENGTH
}

export function parseAdminCredentials(value: unknown): AdminCredentials | null {
  if (typeof value !== 'object' || value === null) return null

  const { email, password } = value as Record<string, unknown>
  if (typeof email !== 'string' || typeof password !== 'string') return null
  if (email.length > 254 || password.length > MAX_CREDENTIAL_LENGTH) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return null

  return { email: email.trim().toLowerCase(), password }
}

function timingSafeStringEquals(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(actual)
  const comparableBytes = Buffer.alloc(expectedBytes.length)
  actualBytes.copy(comparableBytes, 0, 0, expectedBytes.length)

  const equal = timingSafeEqual(expectedBytes, comparableBytes)
  return equal && expectedBytes.length === actualBytes.length
}

export function verifyAdminCredentials(
  credentials: AdminCredentials,
  expectedEmail: string,
  expectedPassword: string
): boolean {
  const emailMatches = timingSafeStringEquals(expectedEmail.trim().toLowerCase(), credentials.email)
  const passwordMatches = timingSafeStringEquals(expectedPassword, credentials.password)
  return emailMatches && passwordMatches
}
