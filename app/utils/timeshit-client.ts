import { $fetch } from 'ofetch'
import { parseTimeshitConnection } from '#shared/utils/timeshit-contract'
import type { TimeshitConnectionInput } from '#shared/types/timeshit'

export async function getTimeshitConnection() {
  return parseTimeshitConnection(await $fetch('/api/timeshit/connection', { credentials: 'same-origin', retry: 0 }))
}
export async function saveTimeshitConnection(input: TimeshitConnectionInput) {
  return parseTimeshitConnection(await $fetch('/api/timeshit/connection', { method: 'POST', body: input, credentials: 'same-origin', retry: 0 }))
}
export async function removeTimeshitConnection(expectedGeneration: string | null) {
  return parseTimeshitConnection(await $fetch('/api/timeshit/connection', { method: 'DELETE', body: { expectedGeneration }, credentials: 'same-origin', retry: 0 }))
}

export async function getTimeshitRepositories(page: number, tracked = false) {
  const { parseTimeshitRepositories } = await import('#shared/utils/timeshit-repositories-contract')
  return parseTimeshitRepositories(await $fetch(tracked ? '/api/timeshit/tracked-repositories' : '/api/timeshit/repositories', {
    query: tracked ? undefined : { page }, credentials: 'same-origin', retry: 0
  }))
}
export async function changeTimeshitRepository(input: import('#shared/types/timeshit').TimeshitRepositoryMutation) {
  const { parseTimeshitRepositories } = await import('#shared/utils/timeshit-repositories-contract')
  return parseTimeshitRepositories(await $fetch('/api/timeshit/tracked-repositories', { method: 'PUT', body: input, credentials: 'same-origin', retry: 0 }))
}

function historyPath(owner: string, name: string) {
  return `/api/timeshit/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
}

export async function getTimeshitBranches(repository: import('#shared/types/timeshit').TimeshitRepository, page = 1) {
  const { parseTimeshitBranches } = await import('#shared/utils/timeshit-history-contract')
  const response = await $fetch(`${historyPath(repository.owner, repository.name)}/branches`, { query: { page }, credentials: 'same-origin', retry: 0 })
  const result = parseTimeshitBranches(response)
  if (result.repositoryId !== repository.id || result.page !== page) throw new Error('Unexpected Timeshit branch scope.')
  return result
}

export async function getTimeshitCommits(repository: import('#shared/types/timeshit').TimeshitRepository, branch: string, headSha: string, page = 1) {
  const { parseTimeshitCommits } = await import('#shared/utils/timeshit-history-contract')
  const response = await $fetch(`${historyPath(repository.owner, repository.name)}/commits`, { query: { page, branch, headSha }, credentials: 'same-origin', retry: 0 })
  const result = parseTimeshitCommits(response)
  if (result.repositoryId !== repository.id || result.page !== page || result.branch !== branch || result.headSha.toLowerCase() !== headSha.toLowerCase()) throw new Error('Unexpected Timeshit commit scope.')
  return result
}

export async function getTimeshitCommitDetail(repository: import('#shared/types/timeshit').TimeshitRepository, sha: string, page = 1) {
  const { parseTimeshitCommitDetail } = await import('#shared/utils/timeshit-history-contract')
  const response = await $fetch(`${historyPath(repository.owner, repository.name)}/commits/${encodeURIComponent(sha)}`, { query: { page }, credentials: 'same-origin', retry: 0 })
  const result = parseTimeshitCommitDetail(response)
  if (result.repositoryId !== repository.id || result.filePage !== page || result.sha.toLowerCase() !== sha.toLowerCase()) throw new Error('Unexpected Timeshit file scope.')
  return result
}

export async function startTimeshitActivity(input: import('#shared/types/timeshit-activity').TimeshitActivityStartInput) {
  const { parseTimeshitActivitySnapshot } = await import('#shared/utils/timeshit-activity-contract')
  return parseTimeshitActivitySnapshot(await $fetch('/api/timeshit/activity', {
    method: 'POST', body: input, credentials: 'same-origin', retry: 0, timeout: 30000
  }))
}

export async function continueTimeshitActivity(input: import('#shared/types/timeshit-activity').TimeshitActivityContinueInput) {
  const { parseTimeshitActivitySnapshot } = await import('#shared/utils/timeshit-activity-contract')
  return parseTimeshitActivitySnapshot(await $fetch('/api/timeshit/activity/continue', {
    method: 'POST', body: input, credentials: 'same-origin', retry: 0, timeout: 30000
  }))
}

export async function getTimeshitPreferences() {
  const { parseTimeshitPreferences } = await import('#shared/utils/timeshit-preferences')
  return parseTimeshitPreferences(await $fetch('/api/timeshit/preferences', { credentials: 'same-origin', retry: 0 }))
}
export async function saveTimeshitPreferences(historyDefaultBranch: string) {
  const { parseTimeshitPreferences } = await import('#shared/utils/timeshit-preferences')
  return parseTimeshitPreferences(await $fetch('/api/timeshit/preferences', { method: 'PUT', body: { schemaVersion: '1.0', historyDefaultBranch }, credentials: 'same-origin', retry: 0 }))
}
