import type { VpsStatus } from '~/types/vps'

export const VPS_STATUS_META: Record<VpsStatus, { label: string, color: 'neutral', icon: string }> = {
  healthy: { label: 'Healthy', color: 'neutral', icon: 'i-lucide-circle-check' },
  warning: { label: 'Warning', color: 'neutral', icon: 'i-lucide-triangle-alert' },
  critical: { label: 'Critical', color: 'neutral', icon: 'i-lucide-circle-x' },
  unknown: { label: 'Unknown', color: 'neutral', icon: 'i-lucide-circle-help' }
}

export function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0 B'

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const index = Math.min(Math.floor(Math.log(Math.abs(value)) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function percent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(0)}%`
}

export function formatProcessPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`
}

export function sortProcessesByCpu<T extends { cpuPercentOfHost: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.cpuPercentOfHost === null) return b.cpuPercentOfHost === null ? 0 : 1
    if (b.cpuPercentOfHost === null) return -1
    return b.cpuPercentOfHost - a.cpuPercentOfHost
  })
}

export function getActiveProcesses<T extends { state: string, cpuPercentOfHost: number | null }>(items: T[]): T[] {
  return sortProcessesByCpu(items.filter(item => ['running', 'sleeping', 'unknown'].includes(item.state)))
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function formatProcessStartedAt(startedAt: string | null, collectedAt: string | null): string {
  if (!startedAt) return '—'
  const started = new Date(startedAt)
  if (Number.isNaN(started.getTime())) return '—'

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(started)
  if (!collectedAt) return formattedDate

  const collected = new Date(collectedAt)
  if (Number.isNaN(collected.getTime())) return formattedDate

  const elapsedSeconds = Math.max(0, Math.floor((collected.getTime() - started.getTime()) / 1000))
  const units = [
    { unit: 'year' as const, seconds: 31_536_000 },
    { unit: 'month' as const, seconds: 2_592_000 },
    { unit: 'day' as const, seconds: 86_400 },
    { unit: 'hour' as const, seconds: 3_600 },
    { unit: 'minute' as const, seconds: 60 },
    { unit: 'second' as const, seconds: 1 }
  ]
  const { unit, seconds } = units.find(item => elapsedSeconds >= item.seconds) ?? units[units.length - 1]!
  const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(-Math.floor(elapsedSeconds / seconds), unit)

  return `${relative} · ${formattedDate}`
}

export function formatUptime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const dayLabel = days === 1 ? 'day' : 'days'
  const hourLabel = hours === 1 ? 'hour' : 'hours'
  return days ? `${days} ${dayLabel} ${hours} ${hourLabel}` : `${hours} ${hourLabel}`
}

export function formatServicePorts(ports: Array<{ port: number, protocol: 'tcp' | 'udp' }> | null): string {
  if (ports === null) return 'Unknown'
  if (!ports.length) return 'No ports detected'
  return ports.map(({ port, protocol }) => `${protocol.toUpperCase()} ${port}`).join(', ')
}
