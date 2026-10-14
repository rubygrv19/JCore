import type { DatabaseSync } from 'node:sqlite'
import { parseTimeshitPreferences } from '../../shared/utils/timeshit-preferences'

export function readTimeshitPreferences(db: DatabaseSync) {
  const row = db.prepare('SELECT history_default_branch FROM timeshit_preferences WHERE id = 1').get() as { history_default_branch: string }
  return parseTimeshitPreferences({ schemaVersion: '1.0', historyDefaultBranch: row.history_default_branch })
}
export function writeTimeshitPreferences(db: DatabaseSync, value: unknown) {
  const preferences = parseTimeshitPreferences(value)
  db.prepare('UPDATE timeshit_preferences SET history_default_branch = ? WHERE id = 1').run(preferences.historyDefaultBranch)
  return readTimeshitPreferences(db)
}
