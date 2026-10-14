import { afterEach, describe, expect, it } from 'vitest'
import { randomBytes, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openTimeshitDatabase, replaceTimeshitConnection } from '../../server/utils/timeshit-storage'
import { trackedTimeshitRepositories, updateTrackedRepository, validateRepositoryMutation, repositoryGithubOperation } from '../../server/utils/timeshit-repositories'
import { parseTimeshitRepositories } from '../../shared/utils/timeshit-repositories-contract'
import examples from '../../docs/timeshit-repositories.examples.json'
import connectionExamples from '../../docs/timeshit-connection.examples.json'
import { encryptTimeshitToken } from '../../server/utils/timeshit-crypto'
import type { TimeshitRepository } from '../../shared/types/timeshit'

const dirs: string[] = []
afterEach(() => {
  dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true }))
})
function database() {
  const dir = mkdtempSync(join(tmpdir(), 'jcore-repos-'))
  dirs.push(dir)
  return join(dir, 'private.sqlite')
}
const account = { id: 7, login: 'example' }
const repo: TimeshitRepository = { id: 123, owner: 'example', name: 'project', description: 'Example project', private: true, archived: false, defaultBranch: 'main', access: 'readable', checkedAt: new Date().toISOString() }
const key = randomBytes(32)
const connection = { account, token: 'mock-pat-only-never-real', discovery: 'available' as const, expectedGeneration: null }

describe('Timeshit repository persistence and contract', () => {
  it('migrates the reserved v1 tables without losing the encrypted connection', () => {
    const path = database()
    const old = new DatabaseSync(path)
    old.exec('CREATE TABLE connection (id INTEGER PRIMARY KEY, metadata TEXT NOT NULL, envelope TEXT NOT NULL, generation TEXT NOT NULL); CREATE TABLE tracked_repository (repository_id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL); PRAGMA user_version=1;')
    const metadata = JSON.stringify(connectionExamples.connected)
    old.prepare('INSERT INTO connection VALUES (1, ?, ?, ?)').run(metadata, encryptTimeshitToken(connection.token, key, metadata), connectionExamples.connected.generation)
    old.close()
    const db = openTimeshitDatabase(path)
    try {
      expect(db.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 3 })
      expect(trackedTimeshitRepositories(db, key).generation).toBe(connectionExamples.connected.generation)
      expect(parseTimeshitRepositories(trackedTimeshitRepositories(db, key)).repositories).toEqual([])
    } finally { db.close() }
  })
  it('persists stable IDs, rejects concurrent updates and invalidates access after same-account PAT replacement', () => {
    const path = database()
    let db = openTimeshitDatabase(path)
    const connected = replaceTimeshitConnection(db, key, connection)
    const empty = trackedTimeshitRepositories(db, key)
    const input = { repositoryId: repo.id, expectedGeneration: empty.generation, expectedSelectionRevision: empty.selectionRevision, action: 'track' as const, page: 1 }
    const saved = updateTrackedRepository(db, key, input, repo)
    expect(parseTimeshitRepositories(saved).repositories).toEqual([repo])
    expect(() => updateTrackedRepository(db, key, input, repo)).toThrow(/changed/)
    db.close()
    db = openTimeshitDatabase(path)
    try {
      expect(trackedTimeshitRepositories(db, key)).toEqual(saved)
      const replaced = replaceTimeshitConnection(db, key, { ...connection, expectedGeneration: connected.generation })
      expect(trackedTimeshitRepositories(db, key).repositories[0]?.access).toBe('not-checked')
      expect(() => updateTrackedRepository(db, key, { ...input, expectedSelectionRevision: saved.selectionRevision }, repo)).toThrow(/changed/)
      replaceTimeshitConnection(db, key, { ...connection, account: { id: 8, login: 'other' }, expectedGeneration: replaced.generation })
      expect(trackedTimeshitRepositories(db, key).repositories).toEqual([])
    } finally { db.close() }
  })
  it('updates renamed metadata by ID and supports removal without upstream access', () => {
    const db = openTimeshitDatabase(database())
    try {
      replaceTimeshitConnection(db, key, connection)
      const empty = trackedTimeshitRepositories(db, key)
      const mutation = { repositoryId: repo.id, expectedGeneration: empty.generation, expectedSelectionRevision: empty.selectionRevision, action: 'track' as const, page: 1 }
      const first = updateTrackedRepository(db, key, mutation, repo)
      const renamed = updateTrackedRepository(db, key, { ...mutation, expectedSelectionRevision: first.selectionRevision }, { ...repo, name: 'renamed' })
      expect(renamed.repositories).toHaveLength(1)
      expect(renamed.repositories[0]?.name).toBe('renamed')
      const removed = updateTrackedRepository(db, key, { ...mutation, expectedSelectionRevision: renamed.selectionRevision, action: 'remove' })
      expect(removed.repositories).toEqual([])
    } finally { db.close() }
  })
  it('rejects malformed mutations and response secrets', () => {
    const input = { expectedGeneration: randomUUID(), expectedSelectionRevision: randomUUID(), repositoryId: 1, action: 'track', page: 1 }
    expect(validateRepositoryMutation(input)).toEqual(input)
    for (const change of [{ token: 'secret' }, { page: -1 }, { action: 'delete' }, { repositoryId: 0 }, { expectedGeneration: null }]) expect(() => validateRepositoryMutation({ ...input, ...change })).toThrow()
    const response = { schemaVersion: '1.0', generation: randomUUID(), selectionRevision: randomUUID(), repositories: [repo], page: 1, hasNext: false }
    Object.values(examples).forEach(value => expect(parseTimeshitRepositories(value)).toEqual(value))
    expect(parseTimeshitRepositories(response)).toEqual(response)
    expect(() => parseTimeshitRepositories({ ...response, token: 'secret' })).toThrow()
  })
})

describe('Timeshit repository request budgets', () => {
  it('rejects overlapping upstream operations without starting another request', async () => {
    let finish!: () => void
    const pending = repositoryGithubOperation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    await expect(repositoryGithubOperation(async () => 'unexpected')).rejects.toMatchObject({ statusCode: 429 })
    finish()
    await pending
    expect(await repositoryGithubOperation(async () => 'ready')).toBe('ready')
  })
  it('bounds selection at 200 without blocking removal', () => {
    const db = openTimeshitDatabase(database())
    try {
      replaceTimeshitConnection(db, key, connection)
      const context = trackedTimeshitRepositories(db, key)
      const insert = db.prepare('INSERT INTO tracked_repository (repository_id, account_id, owner, name, metadata, verified_generation) VALUES (?, ?, ?, ?, ?, ?)')
      for (let id = 1; id <= 200; id++) insert.run(id, account.id, repo.owner, repo.name, JSON.stringify({ ...repo, id }), context.generation)
      const mutation = { repositoryId: 999, expectedGeneration: context.generation, expectedSelectionRevision: context.selectionRevision, action: 'track' as const, page: 1 }
      expect(() => updateTrackedRepository(db, key, mutation, { ...repo, id: 999 })).toThrow(/limit is 200/)
      expect(updateTrackedRepository(db, key, { ...mutation, repositoryId: 1, action: 'remove' }).repositories).toHaveLength(199)
    } finally { db.close() }
  })
})
