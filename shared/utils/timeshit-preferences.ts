import { Ajv } from 'ajv'
import schema from '../../docs/timeshit-preferences.schema.json'
import type { TimeshitPreferences } from '../types/timeshit-preferences'

const validate = new Ajv().compile<TimeshitPreferences>(schema)
export function parseTimeshitPreferences(value: unknown): TimeshitPreferences {
  if (!validate(value)) throw new Error('Enter a branch name of 1–255 characters without whitespace.')
  return value
}
