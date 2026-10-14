import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTimeshitHistoryStore } from '../../app/stores/timeshit-history'
import { useTimeshitRepositoriesStore } from '../../app/stores/timeshit-repositories'
import { useTimeshitStore } from '../../app/stores/timeshit'
import connectionExamples from '../../docs/timeshit-connection.examples.json'

const api = vi.hoisted(() => ({ getTimeshitBranches: vi.fn(), getTimeshitCommits: vi.fn(), getTimeshitCommitDetail: vi.fn(), getTimeshitPreferences: vi.fn(), saveTimeshitPreferences: vi.fn() }))
vi.mock('../../app/utils/timeshit-client', () => api)

const repository = { id: 7, owner: 'example', name: 'demo', description: null, private: true, archived: false, defaultBranch: 'main', access: 'readable', checkedAt: null }
const branch = { name: 'main', headSha: 'a'.repeat(40), protected: true }
const commitsPage = { schemaVersion: '1.0', generation: 'generation', repositoryId: 7, branch: 'main', headSha: branch.headSha, page: 1, hasNext: true, commits: [] }
beforeEach(() => {
  setActivePinia(createPinia())
  api.getTimeshitPreferences.mockReset().mockResolvedValue({ schemaVersion: '1.0', historyDefaultBranch: 'development' })
  api.saveTimeshitPreferences.mockReset().mockImplementation(async name => ({ schemaVersion: '1.0', historyDefaultBranch: name }))
  api.getTimeshitBranches.mockReset().mockResolvedValue({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 1, hasNext: false, branches: [branch] })
  api.getTimeshitCommits.mockReset().mockResolvedValue(commitsPage)
  api.getTimeshitCommitDetail.mockReset().mockResolvedValue({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, sha: 'b'.repeat(40), htmlUrl: 'https://github.com/example/demo/commit/sha', message: 'Example', authorLogin: 'example-user', authorName: 'Example', authoredAt: '2026-10-12T00:00:00Z', committerName: 'Example', committedAt: '2026-10-12T00:00:00Z', stats: { additions: 1, deletions: 0, total: 1 }, filePage: 1, hasNextFiles: false, filesTruncatedAtGitHubLimit: false, files: [] })
})

describe('Timeshit history state', () => {
  it('deduplicates branch names that overlap while searching later pages', async () => {
    api.getTimeshitBranches.mockResolvedValueOnce({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 1, hasNext: true, branches: [branch] })
    api.getTimeshitBranches.mockResolvedValueOnce({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 2, hasNext: false, branches: [branch, { ...branch, name: 'development' }] })
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    expect(store.branches?.branches.map(item => item.name)).toEqual(['main', 'development'])
    expect(store.selectedBranchName).toBe('development')
  })

  it('clears private history when a paging request loses its session or repository access', async () => {
    const store = useTimeshitHistoryStore()
    for (const cause of [{ response: { status: 401 } }, { data: { data: { code: 'REPOSITORY_NOT_TRACKED' } } }]) {
      await store.selectRepository(repository as never)
      expect(store.commits).not.toBeNull()
      api.getTimeshitCommits.mockRejectedValueOnce(cause)
      await store.loadMoreCommits()
      expect(store.repository).toBeNull()
      expect(store.commits).toBeNull()
      expect(store.error).toContain('Unable')
    }
  })
  it('prefers development and supports a saved configurable branch', async () => {
    const development = { ...branch, name: 'development' }
    api.getTimeshitBranches.mockResolvedValue({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 1, hasNext: false, branches: [branch, development] })
    const store = useTimeshitHistoryStore()
    await store.loadPreferences()
    await store.selectRepository(repository as never)
    expect(store.selectedBranchName).toBe('development')
    await store.savePreference('main')
    await store.selectRepository(repository as never)
    expect(store.selectedBranchName).toBe('main')
    expect(api.saveTimeshitPreferences).toHaveBeenCalledWith('main')
  })
  it('finds the preferred branch on a later page before selecting a fallback', async () => {
    api.getTimeshitBranches.mockResolvedValueOnce({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 1, hasNext: true, branches: [branch] })
    api.getTimeshitBranches.mockResolvedValueOnce({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 2, hasNext: false, branches: [{ ...branch, name: 'development' }] })
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    expect(store.selectedBranchName).toBe('development')
    expect(api.getTimeshitBranches).toHaveBeenLastCalledWith(repository, 2)
    expect(store.branchNotice).toBe('')
  })
  it('labels fallback and caps initial preference discovery at ten pages', async () => {
    api.getTimeshitBranches.mockImplementation(async (_repo, page = 1) => ({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page, hasNext: true, branches: [branch] }))
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    expect(api.getTimeshitBranches).toHaveBeenCalledTimes(10)
    expect(store.selectedBranchName).toBe('main')
    expect(store.branchNotice).toContain('first 10 branch pages')
    expect(store.branches?.hasNext).toBe(true)
    await store.selectBranch('main')
    expect(store.branchNotice).toBe('')
  })
  it('preserves the saved preference when saving or loading fails', async () => {
    const store = useTimeshitHistoryStore()
    api.saveTimeshitPreferences.mockRejectedValueOnce(new Error('private upstream data'))
    await store.savePreference('main')
    expect(store.preferredBranch).toBe('development')
    expect(store.preferenceError).not.toContain('private upstream')
    api.getTimeshitPreferences.mockRejectedValueOnce(new Error())
    await store.loadPreferences()
    expect(store.preferenceError).toContain('Unable to load')
  })

  it('loads the default branch from its captured SHA and appends later commit pages', async () => {
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    expect(api.getTimeshitCommits).toHaveBeenCalledWith(repository, 'main', branch.headSha, 1)
    api.getTimeshitCommits.mockResolvedValueOnce({ ...commitsPage, page: 2, hasNext: false })
    await store.loadMoreCommits()
    expect(api.getTimeshitCommits).toHaveBeenLastCalledWith(repository, 'main', branch.headSha, 2)
    expect(store.commits?.page).toBe(2)
  })

  it('ignores results that finish after selecting another repository or resetting', async () => {
    let finish!: (value: unknown) => void
    api.getTimeshitBranches.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve
    }))
    const store = useTimeshitHistoryStore()
    const pending = store.selectRepository(repository as never)
    store.reset()
    finish({ schemaVersion: '1.0', generation: 'generation', repositoryId: 7, page: 1, hasNext: false, branches: [branch] })
    await pending
    expect(store.repository).toBeNull()
    expect(store.branches).toBeNull()
  })

  it('clears commit detail when switching branches and only loads detail for a selected repository', async () => {
    const store = useTimeshitHistoryStore()
    await store.selectCommit('b'.repeat(40))
    expect(api.getTimeshitCommitDetail).not.toHaveBeenCalled()
    await store.selectRepository(repository as never)
    expect(store.selectedBranchName).toBe('main')
    expect(store.detail).toBeNull()
  })

  it('clears in-flight detail loading when a branch change invalidates its request', async () => {
    let finish!: (value: unknown) => void
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    api.getTimeshitCommitDetail.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve
    }))
    const pending = store.selectCommit('b'.repeat(40))
    expect(store.detailLoading).toBe(true)
    await store.selectBranch('main')
    expect(store.detailLoading).toBe(false)
    finish({ sha: 'b'.repeat(40) })
    await pending
    expect(store.detail).toBeNull()
  })

  it('clears private history when the tracked selection changes', async () => {
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    useTimeshitRepositoriesStore().tracked = {
      schemaVersion: '1.0', generation: 'generation', selectionRevision: 'changed',
      repositories: [], page: 1, hasNext: false
    }
    expect(store.repository).toBeNull()
    expect(store.commits).toBeNull()
    expect(store.branchesLoading).toBe(false)
  })

  it('clears loading and ignores a late commit page after disconnect', async () => {
    const connection = useTimeshitStore()
    connection.connection = { ...connectionExamples.connected, generation: 'generation' } as never
    const store = useTimeshitHistoryStore()
    let finish!: (value: unknown) => void
    api.getTimeshitCommits.mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve
    }))
    const pending = store.selectRepository(repository as never)
    await vi.waitFor(() => expect(store.commitsLoading).toBe(true))
    connection.reset()
    expect(store.commitsLoading).toBe(false)
    finish(commitsPage)
    await pending
    expect(store.commits).toBeNull()
    expect(store.repository).toBeNull()
  })

  it('rejects a new connection generation instead of appending it to an old commit list', async () => {
    const store = useTimeshitHistoryStore()
    await store.selectRepository(repository as never)
    api.getTimeshitCommits.mockResolvedValueOnce({ ...commitsPage, generation: 'new-generation', page: 2 })
    await store.loadMoreCommits()
    expect(store.commits).toBeNull()
    expect(store.repository).toBeNull()
    expect(store.error).toContain('Connection changed')
  })
})
