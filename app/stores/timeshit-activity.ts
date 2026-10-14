import { defineStore } from 'pinia'
import type { TimeshitActivityRange, TimeshitActivitySnapshot } from '#shared/types/timeshit-activity'
import { timeshitActivityWindow } from '#shared/utils/timeshit-activity'
import { startTimeshitActivity, continueTimeshitActivity } from '~/utils/timeshit-client'
import { useTimeshitStore } from './timeshit'
import { useTimeshitRepositoriesStore } from './timeshit-repositories'

type Phase = 'idle' | 'collecting' | 'waiting' | 'paused' | 'complete' | 'partial' | 'error' | 'expired'

export const useTimeshitActivityStore = defineStore('timeshit-activity', () => {
  const connection = useTimeshitStore()
  const repositories = useTimeshitRepositoriesStore()
  const { loggedIn } = useUserSession()
  const snapshot = shallowRef<TimeshitActivitySnapshot | null>(null)
  const phase = ref<Phase>('idle')
  const loading = ref(false)
  const stale = ref(false)
  const error = ref('')
  const retryAt = ref<number | null>(null)
  const viewActive = ref(false)
  let revision = 0
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  const canContinue = ref(false)

  const coverage = computed(() => {
    const rows = snapshot.value?.coverage ?? []
    return { total: rows.length, complete: rows.filter(repo => repo.status === 'complete').length,
      failed: rows.filter(repo => repo.status === 'failed').length,
      branchesDiscovered: rows.reduce((sum, repo) => sum + repo.branchesDiscovered, 0),
      branchesCompleted: rows.reduce((sum, repo) => sum + repo.branchesCompleted, 0),
      commitsScanned: rows.reduce((sum, repo) => sum + repo.commitsScanned, 0) }
  })
  const resumable = computed(() => canContinue.value && !!snapshot.value?.continuation && !['expired', 'complete', 'partial'].includes(phase.value))

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function reset() {
    revision++
    running = false
    canContinue.value = false
    clearTimer()
    clearTimeout(expiryTimer)
    snapshot.value = null
    phase.value = 'idle'
    loading.value = false
    stale.value = false
    error.value = ''
    retryAt.value = null
  }

  function pause() {
    running = false
    clearTimer()
    if (['collecting', 'waiting'].includes(phase.value)) phase.value = 'paused'
  }

  function expire() {
    pause()
    canContinue.value = false
    phase.value = 'expired'
    stale.value = !!snapshot.value
    retryAt.value = null
    error.value = 'Collection expired. Start a new collection.'
  }

  function visible() {
    return viewActive.value && loggedIn.value && import.meta.client && document.visibilityState === 'visible'
  }

  function visibilityChanged() {
    if (document.visibilityState !== 'visible') pause()
  }

  function attachView() {
    viewActive.value = true
    if (import.meta.client) document.addEventListener('visibilitychange', visibilityChanged)
  }

  function detachView() {
    viewActive.value = false
    pause()
    if (import.meta.client) document.removeEventListener('visibilitychange', visibilityChanged)
  }

  function currentScope() {
    const account = connection.connection
    const tracked = repositories.tracked
    if (!loggedIn.value || account?.state !== 'connected' || !account.account || !account.generation || !tracked?.repositories.length || tracked.generation !== account.generation) throw new Error('Track repositories for the current connection before collecting activity.')
    return { generation: account.generation, selectionRevision: tracked.selectionRevision, accountId: account.account.id,
      ids: tracked.repositories.map(repo => repo.id).sort((a, b) => a - b) }
  }

  function sameRange(left: TimeshitActivityRange, right: TimeshitActivityRange) {
    return left.startDate === right.startDate && left.endDate === right.endDate && left.timeZone === right.timeZone
  }

  function matchesScope(result: TimeshitActivitySnapshot, scope: ReturnType<typeof currentScope>) {
    return result.generation === scope.generation && result.selectionRevision === scope.selectionRevision && result.account.id === scope.accountId
      && JSON.stringify(result.coverage.map(repo => repo.repositoryId).sort((a, b) => a - b)) === JSON.stringify(scope.ids)
  }

  function schedule(delay = 1000) {
    clearTimer()
    if (!running || !visible() || !canContinue.value || !snapshot.value?.continuation) return
    phase.value = 'waiting'
    const untilExpiry = Math.max(1, Date.parse(snapshot.value.expiresAt) - Date.now())
    timer = setTimeout(() => {
      void nextBatch()
    }, Math.min(delay, untilExpiry, 2147483647))
  }

  function accept(result: TimeshitActivitySnapshot) {
    snapshot.value = result
    canContinue.value = !!result.continuation
    stale.value = false
    error.value = ''
    retryAt.value = result.retryAfterSeconds ? Date.now() + result.retryAfterSeconds * 1000 : null
    clearTimeout(expiryTimer)
    const remaining = Date.parse(result.expiresAt) - Date.now()
    if (remaining <= 0) {
      expire()
      return
    }
    expiryTimer = setTimeout(expire, remaining)
    if (!result.continuation) {
      running = false
      phase.value = result.status === 'complete' ? 'complete' : 'partial'
    } else if (running && visible()) schedule(Math.max(1000, (retryAt.value ?? 0) - Date.now()))
    else phase.value = 'paused'
  }

  function failed(cause: unknown) {
    const failure = (cause ?? {}) as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number, data?: { code?: string, retryAfterSeconds?: number } } }
    const code = failure.data?.data?.code
    const status = failure.statusCode ?? failure.response?.status ?? failure.data?.statusCode
    if (status === 401 || code === 'CONNECTION_CHANGED' || code === 'GITHUB_AUTH_FAILED') {
      reset()
      phase.value = 'error'
      error.value = status === 401 ? 'Sign in again before collecting activity.' : 'Connection changed or GitHub credentials were rejected. Refresh the connection and repositories.'
      return
    }
    stale.value = !!snapshot.value
    if (code === 'ACTIVITY_EXPIRED') {
      expire()
      return
    }
    error.value = snapshot.value
      ? 'Unable to collect activity. The last snapshot has been retained. Retry or start a new collection.'
      : 'Unable to collect activity. Try starting a new collection.'
    if (code === 'ACTIVITY_REVISION_CHANGED') canContinue.value = false
    const delay = failure.data?.data?.retryAfterSeconds
    if (['GITHUB_RATE_LIMITED', 'ACTIVITY_BUSY'].includes(code ?? '') && Number.isSafeInteger(delay) && Number(delay) > 0) {
      retryAt.value = Date.now() + Number(delay) * 1000
      error.value = 'Collection is temporarily limited. Wait before continuing.'
      if (running && visible() && canContinue.value) {
        schedule(Number(delay) * 1000)
        return
      }
    }
    pause()
    phase.value = 'error'
  }

  async function start(range: TimeshitActivityRange) {
    if (loading.value || !visible()) return
    if (retryAt.value && retryAt.value > Date.now()) {
      error.value = 'Collection is temporarily limited. Wait before starting another collection.'
      return
    }
    let scope: ReturnType<typeof currentScope>
    try {
      timeshitActivityWindow(range)
      scope = currentScope()
    } catch {
      error.value = 'Use a valid date range of at most 366 days and track repositories for the current connection.'
      return
    }
    const request = ++revision
    clearTimer()
    clearTimeout(expiryTimer)
    running = true
    canContinue.value = false
    loading.value = true
    stale.value = !!snapshot.value
    phase.value = 'collecting'
    error.value = ''
    retryAt.value = null
    const requestedRange = { ...range }
    try {
      const result = await startTimeshitActivity({ expectedGeneration: scope.generation, expectedSelectionRevision: scope.selectionRevision, range: requestedRange })
      if (request !== revision) return
      if (!matchesScope(result, scope) || !sameRange(result.range, requestedRange) || result.revision !== 1) throw new Error('Unexpected collection scope.')
      accept(result)
    } catch (cause) {
      if (request === revision) failed(cause)
    } finally {
      if (request === revision) loading.value = false
    }
  }

  async function nextBatch() {
    const previous = snapshot.value
    if (loading.value || !running || !visible() || !canContinue.value || !previous?.continuation) return
    if (Date.now() >= Date.parse(previous.expiresAt)) {
      expire()
      return
    }
    if (retryAt.value && retryAt.value > Date.now()) {
      schedule(retryAt.value - Date.now())
      return
    }
    const request = revision
    loading.value = true
    phase.value = 'collecting'
    try {
      const scope = currentScope()
      const result = await continueTimeshitActivity({ continuation: previous.continuation, expectedRevision: previous.revision })
      if (request !== revision) return
      if (!matchesScope(result, scope) || result.collectionId !== previous.collectionId || result.revision !== previous.revision + 1
        || !sameRange(result.range, previous.range) || result.startedAt !== previous.startedAt || result.expiresAt !== previous.expiresAt) {
        canContinue.value = false
        throw new Error('Unexpected collection revision.')
      }
      accept(result)
    } catch (cause) {
      if (request === revision) failed(cause)
    } finally {
      if (request === revision) loading.value = false
    }
  }

  async function resume() {
    if (loading.value || !visible() || !canContinue.value || !snapshot.value?.continuation) return
    clearTimer()
    running = true
    error.value = ''
    await nextBatch()
  }

  watch([() => connection.connection?.generation, () => connection.connection?.account?.id, () => connection.connection?.state,
    () => repositories.tracked?.generation, () => repositories.tracked?.selectionRevision, loggedIn], reset, { flush: 'sync' })
  onScopeDispose(() => {
    detachView()
    reset()
  })

  return { snapshot, phase, loading, stale, error, retryAt, viewActive, canContinue, coverage, resumable, start, resume, pause, reset, attachView, detachView }
})
