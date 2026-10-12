import { readFile } from 'node:fs/promises'
import { $fetch } from 'ofetch'
import type { VpsDashboardResponse, VpsStatus } from '~/types/vps'
import { collectSystemdUnits, parseServiceExpectations } from './vps-systemd'

interface PromSeries {
  metric: Record<string, string>
  value?: [number, string]
  values?: Array<[number, string]>
}

interface PromResponse {
  status: 'success' | 'error'
  data?: { resultType?: string, result?: PromSeries[], alerts?: PromAlert[] }
  error?: string
}

interface PromAlert {
  labels: Record<string, string>
  annotations: Record<string, string>
  state: string
  activeAt: string
  value: string
}

const filesystemFilter = '{fstype!~"autofs|binfmt_misc|bpf|cgroup.*|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|mqueue|nsfs|overlay|proc|pstore|rpc_pipefs|securityfs|squashfs|sysfs|tmpfs|tracefs",mountpoint!~"^/(proc|sys|dev|run)(/.*)?$"}'
const networkFilter = '{device!~"lo|docker.*|veth.*|br.*"}'

const currentQueries = {
  sampledAt: 'min(timestamp({__name__=~"node_cpu_seconds_total|node_memory_MemTotal_bytes|node_memory_MemAvailable_bytes|node_filesystem_size_bytes|node_network_receive_bytes_total",job="node-exporter"}))',
  up: 'up{job="node-exporter"}',
  uname: 'node_uname_info',
  boot: 'node_boot_time_seconds',
  cores: 'count(count by (cpu) (node_cpu_seconds_total))',
  cpu: 'vps:cpu_usage_percent',
  load1: 'node_load1',
  load5: 'node_load5',
  load15: 'node_load15',
  memoryTotal: 'node_memory_MemTotal_bytes',
  memoryAvailable: 'node_memory_MemAvailable_bytes',
  swapTotal: 'node_memory_SwapTotal_bytes',
  swapFree: 'node_memory_SwapFree_bytes',
  filesystemSize: `node_filesystem_size_bytes${filesystemFilter}`,
  filesystemAvailable: `node_filesystem_avail_bytes${filesystemFilter}`,
  filesystemFiles: `node_filesystem_files${filesystemFilter}`,
  filesystemFilesFree: `node_filesystem_files_free${filesystemFilter}`,
  diskRead: 'sum(rate(node_disk_read_bytes_total{device!~"loop.*|ram.*"}[5m]))',
  diskWrite: 'sum(rate(node_disk_written_bytes_total{device!~"loop.*|ram.*"}[5m]))',
  networkRx: `rate(node_network_receive_bytes_total${networkFilter}[5m])`,
  networkTx: `rate(node_network_transmit_bytes_total${networkFilter}[5m])`,
  networkRxErrors: `rate(node_network_receive_errs_total${networkFilter}[5m])`,
  networkTxErrors: `rate(node_network_transmit_errs_total${networkFilter}[5m])`,
  networkRxDrops: `rate(node_network_receive_drop_total${networkFilter}[5m])`,
  networkTxDrops: `rate(node_network_transmit_drop_total${networkFilter}[5m])`,
  units: 'node_systemd_unit_state{type="service",state=~"active|inactive|failed|activating|deactivating"} == 1'
} satisfies Record<string, string>

const historyQueries = {
  cpuUsagePercent: 'vps:cpu_usage_percent',
  memoryAvailablePercent: 'vps:memory_available_percent',
  swapUsedPercent: '100 * (node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes) / node_memory_SwapTotal_bytes',
  diskReadBytesPerSecond: 'sum(rate(node_disk_read_bytes_total{device!~"loop.*|ram.*"}[5m]))',
  diskWriteBytesPerSecond: 'sum(rate(node_disk_written_bytes_total{device!~"loop.*|ram.*"}[5m]))',
  networkRxBytesPerSecond: `sum(rate(node_network_receive_bytes_total${networkFilter}[5m]))`,
  networkTxBytesPerSecond: `sum(rate(node_network_transmit_bytes_total${networkFilter}[5m]))`
} satisfies Record<string, string>

function assertPromResponse(value: unknown, resultType: 'vector' | 'matrix'): PromSeries[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid Prometheus response.')
  const response = value as PromResponse
  if (response.status !== 'success' || response.data?.resultType !== resultType || !Array.isArray(response.data.result)) {
    throw new Error('Invalid Prometheus response.')
  }
  return response.data.result
}

function numericSample(sample: [number, string] | undefined): number | null {
  if (!sample) return null
  const value = Number(sample[1])
  return Number.isFinite(value) ? value : null
}

function seriesValue(series: PromSeries | undefined): number | null {
  return numericSample(series?.value)
}

export function statusForAlert(alerts: VpsDashboardResponse['alerts'], resource: VpsDashboardResponse['alerts'][number]['resource'], target: string | null, hasValue: boolean): VpsStatus {
  const matches = alerts.filter(alert => alert.state === 'firing' && alert.resource === resource && (target === null || alert.target === target))
  if (matches.some(alert => alert.severity === 'critical')) return 'critical'
  if (matches.some(alert => alert.severity === 'warning')) return 'warning'
  return hasValue ? 'healthy' : 'unknown'
}

function seriesKey(labels: Record<string, string>): string {
  return [labels.instance, labels.mountpoint, labels.fstype, labels.device].join('|')
}

export function statusForHealth(alerts: VpsDashboardResponse['alerts'], hasMetrics: boolean, collectorDown: boolean): VpsStatus {
  if (collectorDown) return 'critical'
  if (alerts.some(alert => alert.state === 'firing' && alert.severity === 'critical')) return 'critical'
  if (alerts.some(alert => alert.state === 'firing' && alert.severity === 'warning')) return 'warning'
  return hasMetrics ? 'healthy' : 'unknown'
}

export function normalizePrometheusAlerts(value: unknown): VpsDashboardResponse['alerts'] {
  if (!value || typeof value !== 'object') throw new Error('Invalid Prometheus alert response.')
  const response = value as PromResponse
  if (response.status !== 'success' || !Array.isArray(response.data?.alerts)) throw new Error('Invalid Prometheus alert response.')

  return response.data.alerts.flatMap((alert) => {
    const name = alert.labels?.alertname
    const resource = alert.labels?.resource
    const severity = alert.labels?.severity
    const activeAt = alert.activeAt
    if (!name?.startsWith('Vps') || !resource || !severity || !['host', 'cpu', 'memory', 'storage', 'services'].includes(resource) || !['warning', 'critical'].includes(severity) || !['pending', 'firing'].includes(alert.state) || !Number.isFinite(Date.parse(activeAt))) return []
    const valueNumber = Number(alert.value)
    return [{
      name,
      resource: resource as VpsDashboardResponse['alerts'][number]['resource'],
      severity: severity as 'warning' | 'critical',
      state: alert.state as 'pending' | 'firing',
      summary: alert.annotations?.summary || name,
      description: alert.annotations?.description || alert.annotations?.summary || name,
      activeAt,
      value: Number.isFinite(valueNumber) && valueNumber >= 0 ? valueNumber : null,
      target: alert.labels?.mountpoint || alert.labels?.name || null
    }]
  })
}

async function getOsName(): Promise<string | null> {
  try {
    const release = await readFile('/etc/os-release', 'utf8')
    const value = release.match(/^PRETTY_NAME=(?:"([^"]+)"|(.+))$/m)
    return value?.[1] ?? value?.[2] ?? null
  } catch {
    return null
  }
}

export async function collectVpsDashboard(prometheusUrl: string, collectedAt = new Date(), expectedServices = '{}'): Promise<VpsDashboardResponse> {
  const expectations = parseServiceExpectations(expectedServices)
  const base = new URL(prometheusUrl)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
    throw new Error('Prometheus must use a credential-free loopback URL.')
  }
  const endpoint = (path: string) => new URL(`/api/v1/${path}`, base).toString()
  const instant = async (query: string) => {
    const response: unknown = await $fetch(endpoint('query'), { query: { query }, timeout: 5000 })
    return assertPromResponse(response, 'vector')
  }
  const range = async (query: string) => {
    const end = collectedAt.getTime() / 1000
    const response: unknown = await $fetch(endpoint('query_range'), {
      query: { query, start: end - 3600, end, step: 300 },
      timeout: 5000
    })
    return assertPromResponse(response, 'matrix')
  }

  const [currentResults, alertResult, historyResults, os] = await Promise.all([
    Promise.all(Object.entries(currentQueries).map(async ([key, query]) => [key, await instant(query)] as const)),
    $fetch<unknown>(endpoint('alerts'), { timeout: 5000 }),
    Promise.all(Object.entries(historyQueries).map(async ([key, query]) => [key, await range(query)] as const)),
    getOsName()
  ])
  const current = Object.fromEntries(currentResults) as Record<keyof typeof currentQueries, PromSeries[]>
  const alerts = normalizePrometheusAlerts(alertResult)
  const history = Object.fromEntries(historyResults) as Record<keyof typeof historyQueries, PromSeries[]>
  const getValue = (key: keyof typeof currentQueries) => seriesValue(current[key][0])
  const memoryTotalBytes = getValue('memoryTotal')
  const memoryAvailableBytes = getValue('memoryAvailable')
  const swapTotalBytes = getValue('swapTotal')
  const swapFreeBytes = getValue('swapFree')
  const filesystemIndexes = new Map<string, { labels: Record<string, string>, total: number | null, available: number | null, files: number | null, filesFree: number | null }>()

  for (const [key, target] of [
    ['filesystemSize', 'total'],
    ['filesystemAvailable', 'available'],
    ['filesystemFiles', 'files'],
    ['filesystemFilesFree', 'filesFree']
  ] as const) {
    for (const item of current[key]) {
      const id = seriesKey(item.metric)
      const record = filesystemIndexes.get(id) ?? { labels: item.metric, total: null, available: null, files: null, filesFree: null }
      record[target] = seriesValue(item)
      filesystemIndexes.set(id, record)
    }
  }

  const filesystems = [...filesystemIndexes.values()].map((item) => {
    const mountPoint = item.labels.mountpoint ?? 'unknown'
    const usedBytes = item.total !== null && item.available !== null ? Math.max(0, item.total - item.available) : null
    const inodeUsedPercent = item.files && item.filesFree !== null ? Math.min(100, Math.max(0, (item.files - item.filesFree) / item.files * 100)) : null
    return {
      mountPoint,
      fileSystem: item.labels.fstype ?? 'unknown',
      totalBytes: item.total,
      usedBytes,
      inodeUsedPercent,
      status: statusForAlert(alerts, 'storage', mountPoint, usedBytes !== null)
    }
  }).sort((a, b) => a.mountPoint.localeCompare(b.mountPoint))

  const networkIndexes = new Map<string, Record<string, number | null>>()
  for (const [queryKey, field] of [
    ['networkRx', 'rxBytesPerSecond'], ['networkTx', 'txBytesPerSecond'],
    ['networkRxErrors', 'rxErrorsPerSecond'], ['networkTxErrors', 'txErrorsPerSecond'],
    ['networkRxDrops', 'rxDropsPerSecond'], ['networkTxDrops', 'txDropsPerSecond']
  ] as const) {
    for (const item of current[queryKey]) {
      const name = item.metric.device
      if (!name) continue
      const record = networkIndexes.get(name) ?? {}
      record[field] = seriesValue(item)
      networkIndexes.set(name, record)
    }
  }
  const interfaces = [...networkIndexes.entries()].map(([name, values]) => ({
    name,
    rxBytesPerSecond: values.rxBytesPerSecond ?? null,
    txBytesPerSecond: values.txBytesPerSecond ?? null,
    rxErrorsPerSecond: values.rxErrorsPerSecond ?? null,
    txErrorsPerSecond: values.txErrorsPerSecond ?? null,
    rxDropsPerSecond: values.rxDropsPerSecond ?? null,
    txDropsPerSecond: values.txDropsPerSecond ?? null,
    capacityBitsPerSecond: null,
    status: 'unknown' as const
  })).sort((a, b) => a.name.localeCompare(b.name))

  const unitsByName = new Map<string, string>()
  for (const item of current.units) {
    const name = item.metric.name
    const state = item.metric.state
    if (name && state) unitsByName.set(name, state)
  }
  const fallbackUnits = [...unitsByName.entries()].map(([name, actualState]) => ({
    name,
    actualState,
    expectedState: 'unknown' as const,
    since: null,
    status: actualState === 'failed' ? 'critical' as const : 'unknown' as const,
    description: null,
    ports: null,
    pid: null,
    uptimeSeconds: null,
    path: null,
    commandLine: null
  })).sort((a, b) => a.name.localeCompare(b.name))
  const { units, available: systemdAvailable } = await collectSystemdUnits(fallbackUnits, expectations, collectedAt)
  const activeServices = units.filter(unit => unit.actualState === 'active').length
  const failedServices = units.filter(unit => unit.actualState === 'failed').length
  const load = (key: 'load1' | 'load5' | 'load15') => getValue(key)
  const bootTime = getValue('boot')

  const sampleIndex = new Map<number, Record<string, number | string | null>>()
  for (const [key, series] of Object.entries(history) as Array<[keyof typeof historyQueries, PromSeries[]]>) {
    const values = series[0]?.values ?? []
    for (const [timestamp, value] of values) {
      const point = sampleIndex.get(timestamp) ?? {}
      const numeric = Number(value)
      point[key] = Number.isFinite(numeric) ? numeric : null
      sampleIndex.set(timestamp, point)
    }
  }
  const samples = [...sampleIndex.entries()].sort(([a], [b]) => a - b).map(([timestamp, sample]) => ({
    timestamp: new Date(timestamp * 1000).toISOString(),
    cpuUsagePercent: (sample.cpuUsagePercent as number | null | undefined) ?? null,
    memoryAvailablePercent: (sample.memoryAvailablePercent as number | null | undefined) ?? null,
    swapUsedPercent: (sample.swapUsedPercent as number | null | undefined) ?? null,
    diskReadBytesPerSecond: (sample.diskReadBytesPerSecond as number | null | undefined) ?? null,
    diskWriteBytesPerSecond: (sample.diskWriteBytesPerSecond as number | null | undefined) ?? null,
    networkRxBytesPerSecond: (sample.networkRxBytesPerSecond as number | null | undefined) ?? null,
    networkTxBytesPerSecond: (sample.networkTxBytesPerSecond as number | null | undefined) ?? null
  }))

  const cpuUsagePercent = getValue('cpu')
  const collectorDown = getValue('up') === 0
  const memoryStatus = statusForAlert(alerts, 'memory', null, memoryAvailableBytes !== null && memoryTotalBytes !== null)
  const cpuStatus = statusForAlert(alerts, 'cpu', null, cpuUsagePercent !== null)
  const filesystemStatus = statusForAlert(alerts, 'storage', null, filesystems.some(filesystem => filesystem.usedBytes !== null))
  const serviceStatus = units.some(unit => unit.status === 'critical') ? 'critical' as const : units.length && units.every(unit => unit.status === 'healthy') ? 'healthy' as const : 'unknown' as const
  const missingMetrics = [
    ['exporter', getValue('up')], ['cpu', cpuUsagePercent], ['memoryTotal', memoryTotalBytes], ['memoryAvailable', memoryAvailableBytes],
    ['filesystem', filesystems.length && filesystems.every(item => item.usedBytes !== null) ? 1 : null],
    ['network', interfaces.length && interfaces.every(item => item.rxBytesPerSecond !== null && item.txBytesPerSecond !== null) ? 1 : null],
    ['systemd', systemdAvailable ? 1 : null]
  ].filter(([, value]) => value === null).map(([name]) => String(name))
  const sampleSeconds = getValue('sampledAt')
  const sampledAt = sampleSeconds !== null && sampleSeconds > 0 ? new Date(sampleSeconds * 1000).toISOString() : null
  const stale = sampleSeconds !== null && collectedAt.getTime() / 1000 - sampleSeconds >= 60
  if (!sampledAt) missingMetrics.push('sampleTimestamp')
  const sourceStatus = collectorDown ? 'unavailable' : stale ? 'stale' : missingMetrics.length ? 'partial' : 'complete'
  const healthStatus = serviceStatus === 'critical' ? 'critical' : statusForHealth(alerts, sourceStatus === 'complete', collectorDown)
  const healthReasons = alerts.filter(alert => alert.state === 'firing').map(alert => alert.description)
  if (missingMetrics.length) healthReasons.push(`Unavailable sources: ${missingMetrics.join(', ')}.`)
  if (stale) healthReasons.push('The latest exporter samples are at least 60 seconds old.')
  for (const unit of units.filter(unit => unit.status === 'critical')) {
    healthReasons.push(`${unit.name}: ${unit.actualState}; expected ${unit.expectedState}.`)
  }
  if (collectorDown && !healthReasons.includes('Prometheus cannot scrape the local Node Exporter.')) healthReasons.unshift('Prometheus cannot scrape the local Node Exporter.')
  if (healthStatus === 'unknown' && healthReasons.length === 0) healthReasons.push('Host metrics are not available from the configured collector.')

  const uname = current.uname[0]?.metric

  return {
    schemaVersion: '1.4',
    dataMode: 'live',
    collectedAt: collectedAt.toISOString(),
    source: { sampledAt, status: sourceStatus, missingMetrics, systemdDetailsAvailable: systemdAvailable },
    host: {
      hostname: uname?.nodename ?? null,
      os: os ?? (uname?.sysname && uname.release ? `${uname.sysname} ${uname.release}` : null),
      uptimeSeconds: bootTime === null ? null : Math.max(0, collectedAt.getTime() / 1000 - bootTime),
      cpuCores: getValue('cores')
    },
    health: {
      status: healthStatus,
      reasons: healthReasons
    },
    alerts,
    thresholds: {
      cpu: { warningPercent: 80, criticalPercent: 90, forSeconds: 300 },
      memoryAvailable: { warningBelowPercent: 20, criticalBelowPercent: 10, forSeconds: 300 },
      storageUsed: { warningPercent: 80, criticalPercent: 90, forSeconds: 300 }
    },
    current: {
      cpu: { usagePercent: cpuUsagePercent, loadAverage: { '1m': load('load1'), '5m': load('load5'), '15m': load('load15') }, status: cpuStatus },
      memory: { totalBytes: memoryTotalBytes, availableBytes: memoryAvailableBytes, swapTotalBytes, swapUsedBytes: swapTotalBytes !== null && swapFreeBytes !== null ? Math.max(0, swapTotalBytes - swapFreeBytes) : null, status: memoryStatus },
      storage: {
        filesystems,
        io: { readBytesPerSecond: getValue('diskRead'), writeBytesPerSecond: getValue('diskWrite') },
        status: filesystemStatus
      },
      network: { interfaces, status: 'unknown' },
      services: { active: activeServices, failed: failedServices, units, status: serviceStatus },
      processes: { items: [] }
    },
    history: { range: '60m', stepSeconds: 300, samples }
  }
}
