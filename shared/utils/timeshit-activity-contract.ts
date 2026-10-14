import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../../docs/timeshit-activity.schema.json'
import historySchema from '../../docs/timeshit-history.schema.json'
import type { TimeshitActivityContinueInput, TimeshitActivitySnapshot, TimeshitActivityStartInput } from '../types/timeshit-activity'
import { selectTimeshitActivity, timeshitActivityWindow } from './timeshit-activity'

const ajv = new Ajv({ strict: false })
addFormats(ajv)
ajv.addSchema(historySchema)
ajv.addSchema(schema)

function parser<T>(definition: string) {
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/${definition}` })
  return (value: unknown): T => {
    if (!validate(value)) throw new Error('Invalid Timeshit activity contract.')
    return value as T
  }
}

const startShape = parser<TimeshitActivityStartInput>('start')
const snapshotShape = parser<TimeshitActivitySnapshot>('snapshot')
export const parseTimeshitActivityContinue = parser<TimeshitActivityContinueInput>('resume')

export function parseTimeshitActivityStart(value: unknown) {
  const input = startShape(value)
  timeshitActivityWindow(input.range)
  return input
}

export function parseTimeshitActivitySnapshot(value: unknown) {
  const snapshot = snapshotShape(value)
  const invalid = () => {
    throw new Error('Inconsistent Timeshit activity snapshot.')
  }
  const ids = new Set(snapshot.coverage.map(repo => repo.repositoryId))
  if (ids.size !== snapshot.coverage.length || [...ids].some(id => !Number.isSafeInteger(id))) invalid()
  if (selectTimeshitActivity(snapshot.items, snapshot.range).length !== snapshot.items.length) invalid()
  if (snapshot.items.some(item => !ids.has(item.repositoryId)
    || (item.commit.authorLogin !== null && item.commit.authorLogin.toLowerCase() !== snapshot.account.login.toLowerCase()))) invalid()
  for (const repo of snapshot.coverage) {
    if (repo.branchesCompleted > repo.branchesDiscovered) invalid()
    if ((repo.status === 'failed') !== (repo.failure !== null)) invalid()
    if (repo.status === 'complete' && (!repo.branchDiscoveryComplete || repo.branchesCompleted !== repo.branchesDiscovered)) invalid()
    if (repo.status === 'pending' && (repo.branchDiscoveryComplete || repo.branchesDiscovered !== 0 || repo.commitsScanned !== 0)) invalid()
    if (snapshot.items.filter(item => item.repositoryId === repo.repositoryId).length > repo.commitsScanned) invalid()
    if (repo.failure !== null && !snapshot.partialReasons.includes(
      repo.failure === 'not-verified' || repo.failure === 'restricted' ? 'repository-unavailable' : 'upstream-error'
    )) invalid()
  }
  if (snapshot.coverage.reduce((sum, repo) => sum + repo.branchesDiscovered, 0) > 2000
    || snapshot.coverage.reduce((sum, repo) => sum + repo.commitsScanned, 0) > 100000) invalid()
  const unfinished = snapshot.coverage.some(repo => repo.status === 'pending' || repo.status === 'scanning')
  if (snapshot.status === 'partial' && !unfinished && !snapshot.coverage.some(repo => repo.status === 'failed')) invalid()
  if (snapshot.continuation !== null && !unfinished) invalid()
  if (snapshot.status === 'partial' && snapshot.continuation === null && unfinished && !snapshot.partialReasons.includes('capacity-limit')) invalid()
  if (snapshot.partialReasons.includes('work-budget') && snapshot.continuation === null) invalid()
  if (snapshot.partialReasons.includes('rate-limited') !== (snapshot.retryAfterSeconds !== null)) invalid()
  if (snapshot.partialReasons.includes('rate-limited') && snapshot.continuation === null) invalid()
  if (snapshot.partialReasons.includes('capacity-limit') && snapshot.continuation !== null) invalid()
  const start = Date.parse(snapshot.startedAt)
  const updated = Date.parse(snapshot.updatedAt)
  const expiry = Date.parse(snapshot.expiresAt)
  if (updated < start || expiry < updated || expiry - start > 30 * 60 * 1000) invalid()
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 5 * 1024 * 1024) invalid()
  return snapshot
}
