import { DatabaseSync } from 'node:sqlite'
import { chmodSync, lstatSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { TimeshitConnection, TimeshitDiscovery } from '../../shared/types/timeshit'
import { decryptTimeshitToken, encryptTimeshitToken } from './timeshit-crypto'
import { parseTimeshitConnection } from '../../shared/utils/timeshit-contract'
import { timeshitError } from './timeshit-errors'

interface StoredConnection {
  metadata: string
  envelope: string
  generation: string
}

export function disconnectedTimeshit(state: TimeshitConnection['state'] = 'disconnected'): TimeshitConnection {
  return { schemaVersion: '1.0', backend: 'nuxt', state, generation: null, account: null, checkedAt: null, checks: { identity: 'not-checked', discovery: 'not-checked', contents: 'not-checked' } }
}

export function openTimeshitDatabase(path: string): DatabaseSync {
  const forbidden = new Set(['public', '.nuxt', '.output', '.git', 'node_modules'])
  const allowed = (value: string) => !value.split(sep).some(part => forbidden.has(part))
  if (!isAbsolute(path) || !/\.(sqlite|db)$/.test(path) || !allowed(resolve(path))) {
    throw timeshitError('NOT_CONFIGURED', 503, 'Timeshit requires a private absolute SQLite file path.')
  }
  let db: DatabaseSync | undefined
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    if (!allowed(realpathSync(dirname(path)))) throw new Error()
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('Symlink storage rejected')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    db = new DatabaseSync(path, { timeout: 1000 })
    chmodSync(path, 0o600)
    db.exec('PRAGMA foreign_keys = ON')
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version > 3) throw new Error()
    if (version.user_version === 0) {
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE connection (id INTEGER PRIMARY KEY CHECK (id = 1), metadata TEXT NOT NULL, envelope TEXT NOT NULL, generation TEXT NOT NULL);
        CREATE TABLE tracked_repository (repository_id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL);
        PRAGMA user_version = 1;
        COMMIT;`)
    }
    if (version.user_version < 2) {
      db.exec(`BEGIN IMMEDIATE;
        ALTER TABLE tracked_repository ADD COLUMN metadata TEXT;
        ALTER TABLE tracked_repository ADD COLUMN verified_generation TEXT;
        CREATE TABLE repository_selection (id INTEGER PRIMARY KEY CHECK (id = 1), revision TEXT NOT NULL);
        PRAGMA user_version = 2;`)
      db.prepare('INSERT INTO repository_selection VALUES (1, ?)').run(randomUUID())
      db.exec('COMMIT')
    }
    if (version.user_version < 3) {
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE timeshit_preferences (id INTEGER PRIMARY KEY CHECK (id = 1), history_default_branch TEXT NOT NULL);
        INSERT INTO timeshit_preferences VALUES (1, 'development');
        PRAGMA user_version = 3;
        COMMIT;`)
    }
    return db
  } catch {
    db?.close()
    throw timeshitError('STORAGE_UNAVAILABLE', 503, 'Timeshit storage is unavailable. Check the private server configuration.')
  }
}

export function readStoredTimeshit(db: DatabaseSync): StoredConnection | null {
  return db.prepare('SELECT metadata, envelope, generation FROM connection WHERE id = 1').get() as StoredConnection | undefined ?? null
}

export function readTimeshitConnection(db: DatabaseSync, key: Buffer): TimeshitConnection {
  const row = readStoredTimeshit(db)
  if (!row) return disconnectedTimeshit()
  decryptTimeshitToken(row.envelope, key, row.metadata)
  const result = parseTimeshitConnection(JSON.parse(row.metadata))
  if (result.generation !== row.generation) throw timeshitError('STORAGE_LOCKED', 503, 'The saved connection metadata is inconsistent.')
  return result
}

export function replaceTimeshitConnection(db: DatabaseSync, key: Buffer, input: { account: { id: number, login: string }, discovery: TimeshitDiscovery, token: string, expectedGeneration: string | null }): TimeshitConnection {
  const result: TimeshitConnection = {
    ...disconnectedTimeshit('connected'),
    generation: randomUUID(), account: input.account, checkedAt: new Date().toISOString(),
    checks: { identity: 'verified', discovery: input.discovery, contents: 'not-checked' }
  }
  const metadata = JSON.stringify(result)
  const envelope = encryptTimeshitToken(input.token, key, metadata)
  db.exec('BEGIN IMMEDIATE')
  try {
    const current = readStoredTimeshit(db)
    if ((current?.generation ?? null) !== input.expectedGeneration) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection changed. Reload its status before trying again.')
    if (current) decryptTimeshitToken(current.envelope, key, current.metadata)
    const previous = current ? parseTimeshitConnection(JSON.parse(current.metadata)) : null
    if (previous?.account?.id !== input.account.id) db.exec('DELETE FROM tracked_repository')
    db.exec('UPDATE tracked_repository SET verified_generation = NULL')
    db.prepare('UPDATE repository_selection SET revision = ? WHERE id = 1').run(randomUUID())
    db.prepare('INSERT OR REPLACE INTO connection (id, metadata, envelope, generation) VALUES (1, ?, ?, ?)').run(metadata, envelope, result.generation)
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function deleteTimeshitConnection(db: DatabaseSync, expectedGeneration: string | null): void {
  db.exec('BEGIN IMMEDIATE')
  try {
    if ((readStoredTimeshit(db)?.generation ?? null) !== expectedGeneration) throw timeshitError('CONNECTION_CHANGED', 409, 'Connection changed. Reload its status before trying again.')
    db.exec('DELETE FROM tracked_repository; DELETE FROM connection;')
    db.prepare('UPDATE repository_selection SET revision = ? WHERE id = 1').run(randomUUID())
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
