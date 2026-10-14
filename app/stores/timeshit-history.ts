import { defineStore } from 'pinia'
import type { TimeshitBranch, TimeshitBranches, TimeshitCommitDetail, TimeshitCommits, TimeshitRepository } from '#shared/types/timeshit'
import { getTimeshitBranches, getTimeshitCommitDetail, getTimeshitCommits, getTimeshitPreferences, saveTimeshitPreferences } from '~/utils/timeshit-client'
import { useTimeshitStore } from './timeshit'
import { useTimeshitRepositoriesStore } from './timeshit-repositories'

export const useTimeshitHistoryStore = defineStore('timeshit-history', () => {
  const connection = useTimeshitStore()
  const repositories = useTimeshitRepositoriesStore()
  const repository = ref<TimeshitRepository | null>(null)
  const branches = ref<TimeshitBranches | null>(null)
  const commits = ref<TimeshitCommits | null>(null)
  const detail = ref<TimeshitCommitDetail | null>(null)
  const requestedCommitSha = ref('')
  const selectedBranchName = ref('')
  const branchesLoading = ref(false)
  const commitsLoading = ref(false)
  const detailLoading = ref(false)
  const error = ref('')
  const preferredBranch = ref('development')
  const preferenceLoading = ref(false)
  const preferenceError = ref('')
  const branchNotice = ref('')
  async function loadPreferences() {
    preferenceLoading.value = true
    preferenceError.value = ''
    try {
      preferredBranch.value = (await getTimeshitPreferences()).historyDefaultBranch
    } catch {
      preferenceError.value = 'Unable to load the saved history preference. Retry before browsing.'
    } finally { preferenceLoading.value = false }
  }
  async function savePreference(value: string) {
    preferenceLoading.value = true
    preferenceError.value = ''
    try {
      preferredBranch.value = (await saveTimeshitPreferences(value)).historyDefaultBranch
    } catch {
      preferenceError.value = 'Unable to save the branch preference. Enter a name without whitespace and retry.'
    } finally { preferenceLoading.value = false }
  }
  let branchRevision = 0
  let commitRevision = 0
  let detailRevision = 0

  function message(cause: unknown) {
    const failure = cause as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number, statusMessage?: string, data?: { code?: string, retryAfterSeconds?: number } } }
    const data = failure.data
    if ((failure.statusCode ?? failure.response?.status ?? data?.statusCode) === 401 || ['CONNECTION_CHANGED', 'GITHUB_AUTH_FAILED', 'REPOSITORY_NOT_TRACKED'].includes(data?.data?.code ?? '')) reset()
    const delay = data?.data?.retryAfterSeconds
    return `${data?.statusMessage || 'Unable to load GitHub history. Try again.'}${delay ? ` Retry after ${delay} seconds.` : ''}`
  }

  function appendBranches(current: TimeshitBranches, next: TimeshitBranches) {
    const names = new Set(current.branches.map(branch => branch.name))
    return { ...next, branches: [...current.branches, ...next.branches.filter(branch => !names.has(branch.name))] }
  }

  function acceptsGeneration(generation: string, expected: string | null | undefined) {
    if (!expected || generation === expected) return true
    reset()
    error.value = 'Connection changed. Refresh repositories before browsing history.'
    return false
  }

  function clearHistory() {
    branches.value = null
    commits.value = null
    detail.value = null
    requestedCommitSha.value = ''
    selectedBranchName.value = ''
    branchNotice.value = ''
    commitsLoading.value = false
    detailLoading.value = false
    commitRevision++
    detailRevision++
  }

  async function selectRepository(value: TimeshitRepository) {
    const request = ++branchRevision
    const desiredBranch = preferredBranch.value
    const generation = connection.connection?.generation ?? repositories.tracked?.generation
    repository.value = value
    clearHistory()
    branchesLoading.value = true
    error.value = ''
    try {
      const response = await getTimeshitBranches(value)
      if (request !== branchRevision) return
      if (!acceptsGeneration(response.generation, generation)) return
      branches.value = response
      // Bound initial branch discovery; remaining pages stay available through Load more branches.
      while (!branches.value.branches.some(branch => branch.name === desiredBranch) && branches.value.hasNext && branches.value.page < 10) {
        const next = await getTimeshitBranches(value, branches.value.page + 1)
        if (request !== branchRevision) return
        if (!acceptsGeneration(next.generation, generation)) return
        branches.value = appendBranches(branches.value, next)
      }
      const preferred = branches.value.branches.find(branch => branch.name === desiredBranch)
      const defaultBranch = value.defaultBranch && branches.value.branches.find(branch => branch.name === value.defaultBranch)
      const branch = preferred ?? defaultBranch ?? branches.value.branches[0]
      if (!preferred) branchNotice.value = branches.value.hasNext
        ? `Preferred branch "${desiredBranch}" was not found in the first 10 branch pages. ${branch ? `Using "${branch.name}". ` : ''}Load more branches to continue searching.`
        : `Preferred branch "${desiredBranch}" is unavailable. ${branch ? `Using "${branch.name}".` : 'This repository has no available branches.'}`
      if (branch) {
        selectedBranchName.value = branch.name
        await loadCommits(1, branch)
      }
    } catch (cause) {
      if (request === branchRevision) error.value = message(cause)
    } finally {
      if (request === branchRevision) branchesLoading.value = false
    }
  }

  async function loadCommits(page = 1, selected?: TimeshitBranch, append = false) {
    const currentRepository = repository.value
    const branch = selected ?? branches.value?.branches.find(item => item.name === selectedBranchName.value)
    if (!currentRepository || !branch) return
    const generation = branches.value?.generation ?? connection.connection?.generation
    const request = ++commitRevision
    detailRevision++
    detail.value = null
    requestedCommitSha.value = ''
    detailLoading.value = false
    commitsLoading.value = true
    error.value = ''
    if (!append) commits.value = null
    try {
      const response = await getTimeshitCommits(currentRepository, branch.name, branch.headSha, page)
      if (request !== commitRevision) return
      if (!acceptsGeneration(response.generation, generation)) return
      commits.value = append && commits.value
        ? { ...response, commits: [...commits.value.commits, ...response.commits] }
        : response
    } catch (cause) {
      if (request === commitRevision) error.value = message(cause)
    } finally {
      if (request === commitRevision) commitsLoading.value = false
    }
  }

  async function selectBranch(name: string) {
    branchNotice.value = ''
    selectedBranchName.value = name
    await loadCommits()
  }

  async function loadMoreBranches() {
    const currentRepository = repository.value
    const current = branches.value
    if (!currentRepository || !current?.hasNext || branchesLoading.value) return
    const request = ++branchRevision
    branchesLoading.value = true
    error.value = ''
    try {
      const response = await getTimeshitBranches(currentRepository, current.page + 1)
      if (request === branchRevision && repository.value?.id === currentRepository.id && branches.value) {
        if (!acceptsGeneration(response.generation, current.generation)) return
        branches.value = appendBranches(branches.value, response)
      }
    } catch (cause) {
      if (request === branchRevision) error.value = message(cause)
    } finally {
      if (request === branchRevision) branchesLoading.value = false
    }
  }

  async function loadMoreCommits() {
    if (commits.value?.hasNext && !commitsLoading.value) await loadCommits(commits.value.page + 1, undefined, true)
  }

  async function selectCommit(sha: string) {
    const currentRepository = repository.value
    if (!currentRepository) return
    const generation = commits.value?.generation ?? branches.value?.generation ?? connection.connection?.generation
    const request = ++detailRevision
    detail.value = null
    requestedCommitSha.value = sha
    detailLoading.value = true
    error.value = ''
    try {
      const response = await getTimeshitCommitDetail(currentRepository, sha)
      if (request === detailRevision && acceptsGeneration(response.generation, generation)) detail.value = response
    } catch (cause) {
      if (request === detailRevision) error.value = message(cause)
    } finally {
      if (request === detailRevision) {
        detailLoading.value = false
        requestedCommitSha.value = ''
      }
    }
  }

  async function loadMoreFiles() {
    if (!detail.value?.hasNextFiles || detailLoading.value || !repository.value) return
    const request = ++detailRevision
    const current = detail.value
    detailLoading.value = true
    error.value = ''
    try {
      const response = await getTimeshitCommitDetail(repository.value, current.sha, current.filePage + 1)
      if (request === detailRevision && detail.value?.sha === current.sha && acceptsGeneration(response.generation, current.generation)) {
        detail.value = { ...response, files: [...current.files, ...response.files] }
      }
    } catch (cause) {
      if (request === detailRevision) error.value = message(cause)
    } finally {
      if (request === detailRevision) detailLoading.value = false
    }
  }

  function reset() {
    branchRevision++
    repository.value = null
    clearHistory()
    branchesLoading.value = false
    commitsLoading.value = false
    detailLoading.value = false
    error.value = ''
  }

  watch([
    () => connection.connection?.generation,
    () => repositories.tracked?.selectionRevision
  ], reset, { flush: 'sync' })

  return { repository, branches, commits, detail, requestedCommitSha, selectedBranchName, preferredBranch, preferenceLoading, preferenceError, branchNotice, loadPreferences, savePreference, branchesLoading, commitsLoading, detailLoading, error,
    selectRepository, selectBranch, loadMoreBranches, loadMoreCommits, selectCommit, loadMoreFiles, reset }
})
