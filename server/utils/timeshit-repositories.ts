import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { TimeshitRepositories, TimeshitRepository, TimeshitRepositoryMutation } from '../../shared/types/timeshit'
import { decryptTimeshitToken } from './timeshit-crypto'
import { readStoredTimeshit, readTimeshitConnection } from './timeshit-storage'
import { parseTimeshitRepositories } from '../../shared/utils/timeshit-repositories-contract'
import { timeshitError } from './timeshit-errors'

export function repositoryContext(db: DatabaseSync, key: Buffer) {
  const connection = readTimeshitConnection(db, key)
  const row = readStoredTimeshit(db)
  if (!row || connection.state !== 'connected' || !connection.account || !connection.generation) throw timeshitError('NOT_CONFIGURED', 409, 'Connect GitHub in Settings before managing repositories.')
  const selection = db.prepare('SELECT revision FROM repository_selection WHERE id = 1').get() as { revision: string }
  return { generation: connection.generation, accountId: connection.account.id, accountLogin: connection.account.login, selectionRevision: selection.revision, token: decryptTimeshitToken(row.envelope, key, row.metadata) }
}

export function readableTrackedRepository(db: DatabaseSync, key: Buffer, owner: string, name: string) {
  const context = repositoryContext(db, key)
  const rows = db.prepare('SELECT metadata, verified_generation FROM tracked_repository WHERE account_id = ?').all(context.accountId) as { metadata: string | null, verified_generation: string | null }[]
  const row = rows.find((item) => {
    if (!item.metadata) return false
    const candidate = JSON.parse(item.metadata) as TimeshitRepository
    return candidate.owner.toLowerCase() === owner.toLowerCase() && candidate.name.toLowerCase() === name.toLowerCase()
  })
  if (!row?.metadata || row.verified_generation !== context.generation) throw timeshitError('REPOSITORY_NOT_TRACKED', 404, 'Track and verify repository access before browsing its history.')
  const repository = JSON.parse(row.metadata) as TimeshitRepository
  if (repository.access !== 'readable') throw timeshitError('REPOSITORY_NOT_TRACKED', 409, 'Recheck repository access before browsing its history.')
  return { ...context, repository }
}

export function trackedTimeshitRepositories(db: DatabaseSync, key: Buffer): TimeshitRepositories {
  const context = repositoryContext(db, key)
  const rows = db.prepare('SELECT metadata, verified_generation FROM tracked_repository WHERE account_id = ? ORDER BY owner COLLATE NOCASE, name COLLATE NOCASE').all(context.accountId) as { metadata: string | null, verified_generation: string | null }[]
  const repositories = rows.flatMap((row) => {
    if (!row.metadata) return []
    const repo = JSON.parse(row.metadata) as TimeshitRepository
    return [{ ...repo, access: row.verified_generation === context.generation ? repo.access : 'not-checked' as const }]
  })
  return parseTimeshitRepositories({ schemaVersion: '1.0', generation: context.generation, selectionRevision: context.selectionRevision, repositories, page: 1, hasNext: false })
}

export function validateRepositoryMutation(value: unknown): TimeshitRepositoryMutation {
  const input = value as TimeshitRepositoryMutation | null
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['expectedGeneration', 'expectedSelectionRevision', 'repositoryId', 'action', 'page'].includes(key))
    || typeof input.expectedGeneration !== 'string' || !uuid.test(input.expectedGeneration)
    || typeof input.expectedSelectionRevision !== 'string' || !uuid.test(input.expectedSelectionRevision)
    || !Number.isSafeInteger(input.repositoryId) || input.repositoryId <= 0
    || !['track', 'remove', 'check'].includes(input.action) || !Number.isSafeInteger(input.page) || input.page < 1 || input.page > 10000) throw timeshitError('INVALID_INPUT', 400, 'Invalid repository request. Refresh the repository list.')
  return input
}

export function updateTrackedRepository(db: DatabaseSync, key: Buffer, input: TimeshitRepositoryMutation, repo?: TimeshitRepository) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const context = repositoryContext(db, key)
    if (context.generation !== input.expectedGeneration || context.selectionRevision !== input.expectedSelectionRevision) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection or repository selection changed. Refresh before trying again.')
    if (input.action === 'remove') db.prepare('DELETE FROM tracked_repository WHERE repository_id = ? AND account_id = ?').run(input.repositoryId, context.accountId)
    else {
      if (!repo || repo.id !== input.repositoryId) throw timeshitError('INVALID_INPUT', 400, 'Repository identity does not match.')
      const count = db.prepare('SELECT COUNT(*) AS count FROM tracked_repository').get() as { count: number }
      const existing = db.prepare('SELECT repository_id FROM tracked_repository WHERE repository_id = ?').get(repo.id)
      if (!existing && count.count >= 200) throw timeshitError('INVALID_INPUT', 409, 'The selection limit is 200 repositories. Untrack one before adding another.')
      db.prepare('INSERT OR REPLACE INTO tracked_repository (repository_id, account_id, owner, name, metadata, verified_generation) VALUES (?, ?, ?, ?, ?, ?)').run(repo.id, context.accountId, repo.owner, repo.name, JSON.stringify(repo), context.generation)
    }
    db.prepare('UPDATE repository_selection SET revision = ? WHERE id = 1').run(randomUUID())
    db.exec('COMMIT')
    return trackedTimeshitRepositories(db, key)
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  }
}

let busy = false
let blockedUntil = 0
export async function repositoryGithubOperation<T>(action: () => Promise<T>): Promise<T> {
  if (busy || Date.now() < blockedUntil) throw timeshitError('GITHUB_RATE_LIMITED', 429, 'Wait before another GitHub repository request.', Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000)))
  busy = true
  try {
    return await action()
  } catch (error) {
    const seconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (seconds) blockedUntil = Date.now() + seconds * 1000
    throw error
  } finally { busy = false }
}
