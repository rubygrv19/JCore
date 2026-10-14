export type TimeshitDiscovery = 'not-checked' | 'available' | 'restricted' | 'rate-limited' | 'unavailable'

export interface TimeshitConnection {
  schemaVersion: '1.0'
  backend: 'nuxt'
  state: 'unconfigured' | 'disconnected' | 'connected' | 'locked'
  generation: string | null
  account: { id: number, login: string } | null
  checkedAt: string | null
  checks: { identity: 'not-checked' | 'verified', discovery: TimeshitDiscovery, contents: 'not-checked' }
}

export interface TimeshitConnectionInput {
  token: string
  expectedGeneration: string | null
}

export interface TimeshitRepository {
  id: number
  owner: string
  name: string
  description: string | null
  private: boolean
  archived: boolean
  defaultBranch: string | null
  access: 'not-checked' | 'readable' | 'unavailable'
  checkedAt: string | null
}
export interface TimeshitRepositories {
  schemaVersion: '1.0'
  generation: string
  selectionRevision: string
  repositories: TimeshitRepository[]
  page: number
  hasNext: boolean
}
export interface TimeshitRepositoryMutation {
  expectedGeneration: string
  expectedSelectionRevision: string
  repositoryId: number
  action: 'track' | 'remove' | 'check'
  page: number
}

export interface TimeshitBranch {
  name: string
  headSha: string
  protected: boolean
}

export interface TimeshitBranches {
  schemaVersion: '1.0'
  generation: string
  repositoryId: number
  page: number
  hasNext: boolean
  branches: TimeshitBranch[]
}

export interface TimeshitCommits {
  schemaVersion: '1.0'
  generation: string
  repositoryId: number
  branch: string
  headSha: string
  page: number
  hasNext: boolean
  commits: Array<{
    sha: string
    htmlUrl: string
    message: string
    title: string
    body: string | null
    authorLogin: string | null
    authorName: string | null
    authoredAt: string
    committerName: string | null
    committedAt: string
  }>
}

export interface TimeshitCommitDetail {
  schemaVersion: '1.0'
  generation: string
  repositoryId: number
  sha: string
  htmlUrl: string
  message: string
  authorLogin: string | null
  authorName: string | null
  authoredAt: string
  committerName: string | null
  committedAt: string
  stats: { additions: number, deletions: number, total: number }
  filePage: number
  hasNextFiles: boolean
  filesTruncatedAtGitHubLimit: boolean
  files: Array<{
    filename: string
    previousFilename: string | null
    status: string
    additions: number
    deletions: number
    changes: number
    patch: string | null
    patchTruncated: boolean
    blobUrl: string | null
  }>
}
