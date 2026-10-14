import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../../docs/timeshit-repositories.schema.json'
import type { TimeshitRepositories } from '../types/timeshit'

const ajv = new Ajv({ strict: false })
addFormats(ajv)
const validate = ajv.compile<TimeshitRepositories>(schema)
export function parseTimeshitRepositories(value: unknown): TimeshitRepositories {
  if (!validate(value)) throw new Error('Invalid Timeshit repository response.')
  return value
}
