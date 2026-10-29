import type { VpsProcess } from '#shared/types/vps-processes'
import type { useVpsDashboard } from '~/composables/use-vps-dashboard'
import { fetchVpsProcesses } from '~/utils/vps-processes-client'
import { startPolling } from '~/utils/polling'

export function useVpsMonitoring(source: Awaited<ReturnType<typeof useVpsDashboard>>) {
  const { data, error, refresh, pending } = source
  const lastSnapshot = shallowRef(data.value)
  watch(data, (value) => {
    if (value) lastSnapshot.value = value
  })
  const dashboard = computed(() => data.value ?? lastSnapshot.value)
  const latest = computed(() => dashboard.value?.current)
  const points = computed(() => dashboard.value?.history.samples ?? [])
  const now = ref(Date.now())
  const liveProcesses = shallowRef<VpsProcess[] | null>(null)
  const processSnapshotAt = ref<string | null>(null)
  const processFetchFailed = ref(false)
  const processFailureReason = ref<'platform' | 'unavailable' | null>(null)
  const processSource = computed(() => liveProcesses.value
    ? processFetchFailed.value ? 'Stale snapshot · Linux /proc update failed' : 'Live · Linux /proc'
    : processFailureReason.value === 'platform' && dashboard.value?.dataMode === 'mock' ? 'Demo data · Linux required' : processFailureReason.value === 'unavailable' ? 'Process collector unavailable · retrying automatically' : 'Waiting for the process collector')
  const chartLabels = computed(() => points.value.map(point => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(point.timestamp))))
  const collectedAtDate = computed(() => dashboard.value?.source.sampledAt ? Date.parse(dashboard.value.source.sampledAt) : Number.NaN)
  const dataAgeSeconds = computed(() => Number.isFinite(collectedAtDate.value) ? Math.max(0, Math.floor((now.value - collectedAtDate.value) / 1000)) : null)
  const isDataStale = computed(() => dashboard.value?.dataMode === 'live' && (Boolean(error.value) || dashboard.value.source.status === 'stale' || (dataAgeSeconds.value !== null && dataAgeSeconds.value >= 60)))
  const collectedAtLabel = computed(() => dashboard.value?.collectedAt ? new Date(dashboard.value.collectedAt).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) : 'Time unavailable')
  const freshnessLabel = computed(() => {
    const age = dataAgeSeconds.value
    if (age === null) return 'Collection time unavailable'
    if (age < 60) return `Updated ${age} ${age === 1 ? 'second' : 'seconds'} ago`
    const minutes = Math.floor(age / 60)
    return `Updated ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  })

  let clockTimer: ReturnType<typeof setInterval> | undefined
  let stopDashboardPolling: (() => void) | undefined
  let stopProcessPolling: (() => void) | undefined

  async function refreshProcesses(signal: AbortSignal) {
    try {
      const response = await fetchVpsProcesses(signal)
      if (signal.aborted) return
      liveProcesses.value = response.items
      processSnapshotAt.value = response.collectedAt
      processFetchFailed.value = false
    } catch (cause) {
      if (signal.aborted) return
      // Keep labeled fixture data on macOS and on hosts where Linux /proc is unavailable.
      processFetchFailed.value = liveProcesses.value !== null
      const statusCode = (cause as { statusCode?: number, status?: number }).statusCode ?? (cause as { status?: number }).status
      processFailureReason.value = statusCode === 501 ? 'platform' : 'unavailable'
    }
  }

  onMounted(() => {
    clockTimer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
    stopDashboardPolling = startPolling(signal => refresh({ signal, dedupe: 'defer' }), 10_000, false)
    stopProcessPolling = startPolling(refreshProcesses)
  })

  onBeforeUnmount(() => {
    clearInterval(clockTimer)
    stopDashboardPolling?.()
    stopProcessPolling?.()
  })

  return {
    data,
    error,
    refresh,
    pending,
    dashboard,
    latest,
    points,
    liveProcesses,
    processSnapshotAt,
    processFetchFailed,
    processSource,
    chartLabels,
    isDataStale,
    collectedAtLabel,
    freshnessLabel
  }
}
