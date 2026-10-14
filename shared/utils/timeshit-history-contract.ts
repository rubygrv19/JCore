import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../../docs/timeshit-history.schema.json'
import type { TimeshitBranches, TimeshitCommitDetail, TimeshitCommits } from '../types/timeshit'

const ajv = new Ajv({ strict: false })
addFormats(ajv)
ajv.addSchema(schema)

function parser<T>(definition: string) {
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/${definition}` })
  return (value: unknown): T => {
    if (!validate(value)) throw new Error('Invalid Timeshit history response.')
    return value as T
  }
}

export const parseTimeshitCommitItem = parser<TimeshitCommits['commits'][number]>('commitItem')
export const parseTimeshitBranches = parser<TimeshitBranches>('branches')
export const parseTimeshitCommits = parser<TimeshitCommits>('commits')
export const parseTimeshitCommitDetail = parser<TimeshitCommitDetail>('commitDetail')
