export type VpsStatus = 'healthy' | 'warning' | 'critical' | 'unknown'
export type VpsProcessState = 'running' | 'sleeping' | 'stopped' | 'zombie' | 'unknown'

export interface VpsDashboardResponse {
  schemaVersion: string
  dataMode: 'mock' | 'live'
  collectedAt: string | null
  host: {
    hostname: string | null
    os: string | null
    uptimeSeconds: number | null
    cpuCores: number | null
  }
  health: {
    status: VpsStatus
    reasons: string[]
  }
  thresholds: {
    cpu: { warningPercent: number | null, criticalPercent: number | null, forSeconds: number | null }
    memoryAvailable: { warningBelowPercent: number | null, criticalBelowPercent: number | null, forSeconds: number | null }
    storageUsed: { warningPercent: number | null, criticalPercent: number | null, forSeconds: number | null }
  }
  current: {
    cpu: { usagePercent: number | null, loadAverage: { '1m': number | null, '5m': number | null, '15m': number | null }, status: VpsStatus }
    memory: { totalBytes: number | null, availableBytes: number | null, swapTotalBytes: number | null, swapUsedBytes: number | null, status: VpsStatus }
    storage: {
      filesystems: Array<{ mountPoint: string, fileSystem: string, totalBytes: number | null, usedBytes: number | null, inodeUsedPercent: number | null, status: VpsStatus }>
      io: { readBytesPerSecond: number | null, writeBytesPerSecond: number | null }
      status: VpsStatus
    }
    network: {
      interfaces: Array<{ name: string, rxBytesPerSecond: number | null, txBytesPerSecond: number | null, rxErrorsPerSecond: number | null, txErrorsPerSecond: number | null, rxDropsPerSecond: number | null, txDropsPerSecond: number | null, capacityBitsPerSecond: number | null, status: VpsStatus }>
      status: VpsStatus
    }
    services: {
      active: number | null
      failed: number | null
      units: Array<{
        name: string
        actualState: string
        expectedState: 'active' | 'inactive'
        since: string | null
        status: VpsStatus
        description: string | null
        ports: Array<{ port: number, protocol: 'tcp' | 'udp' }>
        pid: number | null
        uptimeSeconds: number | null
        path: string | null
        commandLine: string | null
      }>
      status: VpsStatus
    }
    processes: {
      items: Array<{
        name: string
        pid: number | null
        state: VpsProcessState
        user: string | null
        cpuPercentOfHost: number | null
        memoryPercent: number | null
        description: string | null
        location: string | null
        startedAt: string | null
        commandLine: string | null
      }>
    }
  }
  history: {
    range: string
    stepSeconds: number
    samples: Array<{
      timestamp: string
      cpuUsagePercent: number | null
      memoryAvailablePercent: number | null
      swapUsedPercent: number | null
      diskReadBytesPerSecond: number | null
      diskWriteBytesPerSecond: number | null
      networkRxBytesPerSecond: number | null
      networkTxBytesPerSecond: number | null
    }>
  }
}
