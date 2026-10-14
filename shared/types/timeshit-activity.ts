import type { TimeshitCommits } from './timeshit'

export interface TimeshitActivityRange {
  startDate: string
  endDate: string
  timeZone: 'Asia/Jakarta'
}

export interface TimeshitActivityItem {
  repositoryId: number
  commit: TimeshitCommits['commits'][number]
}

export type TimeshitActivityPartialReason = 'work-budget' | 'rate-limited' | 'upstream-error' | 'repository-unavailable' | 'capacity-limit'

export interface TimeshitActivityRepositoryCoverage {
  repositoryId: number
  owner: string
  name: string
  status: 'pending' | 'scanning' | 'complete' | 'failed'
  branchDiscoveryComplete: boolean
  branchesDiscovered: number
  branchesCompleted: number
  commitsScanned: number
  failure: 'not-verified' | 'restricted' | 'conflict' | 'unavailable' | 'invalid-upstream' | null
}

export interface TimeshitActivitySnapshot {
  schemaVersion: '1.0'
  collectionId: string
  revision: number
  generation: string
  selectionRevision: string
  account: { id: number, login: string }
  range: TimeshitActivityRange
  status: 'partial' | 'complete'
  startedAt: string
  updatedAt: string
  expiresAt: string
  continuation: string | null
  retryAfterSeconds: number | null
  partialReasons: TimeshitActivityPartialReason[]
  coverage: TimeshitActivityRepositoryCoverage[]
  items: TimeshitActivityItem[]
}

export interface TimeshitActivityStartInput {
  expectedGeneration: string
  expectedSelectionRevision: string
  range: TimeshitActivityRange
}

export interface TimeshitActivityContinueInput {
  continuation: string
  expectedRevision: number
}
