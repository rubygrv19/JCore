import { createError } from 'h3'

export type TimeshitErrorCode = 'INVALID_INPUT' | 'ORIGIN_REJECTED' | 'NOT_CONFIGURED' | 'STORAGE_LOCKED' | 'STORAGE_UNAVAILABLE' | 'CONNECTION_CHANGED' | 'REPOSITORY_NOT_TRACKED' | 'GITHUB_AUTH_FAILED' | 'GITHUB_RESTRICTED' | 'GITHUB_CONFLICT' | 'GITHUB_RATE_LIMITED' | 'GITHUB_UNAVAILABLE' | 'INVALID_UPSTREAM' | 'ACTIVITY_EXPIRED' | 'ACTIVITY_BUSY' | 'ACTIVITY_REVISION_CHANGED'

export function timeshitError(code: TimeshitErrorCode, statusCode: number, message: string, retryAfterSeconds?: number) {
  return createError({ statusCode, statusMessage: message, data: { code, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } })
}
