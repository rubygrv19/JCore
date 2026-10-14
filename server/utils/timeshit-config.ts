import { resolve } from 'node:path'
import { openTimeshitDatabase } from './timeshit-storage'
import { validateTimeshitOrigin } from './timeshit-http'
import { timeshitError } from './timeshit-errors'
import { parseTimeshitKey } from './timeshit-crypto'

export function timeshitConfig(event: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event).timeshit
  validateTimeshitOrigin(config.trustedOrigin, config.trustedOrigin)
  return { key: parseTimeshitKey(config.encryptionKey), path: config.databasePath || resolve(process.cwd(), '.data/timeshit.sqlite'), trustedOrigin: config.trustedOrigin }
}

export function withTimeshitDatabase<T>(path: string, action: (db: ReturnType<typeof openTimeshitDatabase>) => T): T {
  const db = openTimeshitDatabase(path)
  try {
    return action(db)
  } catch (error) {
    if ((error as { data?: { code?: string } }).data?.code) throw error
    throw timeshitError('STORAGE_UNAVAILABLE', 503, 'Timeshit storage is unavailable.')
  } finally { db.close() }
}
