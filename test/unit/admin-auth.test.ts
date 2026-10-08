import { describe, expect, it } from 'vitest'
import { isAdminAuthConfigured, parseAdminCredentials, verifyAdminCredentials } from '../../server/utils/admin-auth'

describe('admin authentication helpers', () => {
  it('requires valid server credentials and a sufficiently long session secret', () => {
    expect(isAdminAuthConfigured('admin@example.test', 'a-unique-password-long-enough', 'a'.repeat(32))).toBe(true)
    expect(isAdminAuthConfigured('', 'a-unique-password-long-enough', 'a'.repeat(32))).toBe(false)
    expect(isAdminAuthConfigured('admin@example.test', 'short', 'a'.repeat(32))).toBe(false)
    expect(isAdminAuthConfigured('admin@example.test', 'a-unique-password-long-enough', 'short')).toBe(false)
  })

  it('validates the login body and normalizes only the email address', () => {
    expect(parseAdminCredentials({ email: ' Admin@Example.test ', password: '  exact password  ' })).toEqual({
      email: 'admin@example.test',
      password: '  exact password  '
    })
    expect(parseAdminCredentials({ email: 'not-an-email', password: 'secret' })).toBeNull()
    expect(parseAdminCredentials({ email: 'admin@example.test', password: 42 })).toBeNull()
    expect(parseAdminCredentials(null)).toBeNull()
  })

  it('checks email case-insensitively and password exactly', () => {
    const credentials = { email: 'admin@example.test', password: 'correct horse battery staple' }

    expect(verifyAdminCredentials(credentials, 'Admin@Example.test', 'correct horse battery staple')).toBe(true)
    expect(verifyAdminCredentials(credentials, 'admin@example.test', 'correct horse battery staple ')).toBe(false)
    expect(verifyAdminCredentials(credentials, 'other@example.test', 'correct horse battery staple')).toBe(false)
  })
})
