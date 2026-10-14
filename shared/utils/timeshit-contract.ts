import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../../docs/timeshit-connection.schema.json'
import type { TimeshitConnection } from '../types/timeshit'

const ajv = new Ajv({ strict: false })
addFormats(ajv)
const validate = ajv.compile<TimeshitConnection>(schema)
export function parseTimeshitConnection(value: unknown): TimeshitConnection {
  if (!validate(value)) throw new Error('Invalid Timeshit connection response.')
  return value
}
