import type { VpsStatus } from '~/types/vps'

export const VPS_STATUS_META: Record<VpsStatus, { label: string, color: 'success' | 'warning' | 'error' | 'neutral', icon: string }> = {
  healthy: { label: 'Sehat', color: 'success', icon: 'i-lucide-circle-check' },
  warning: { label: 'Perhatian', color: 'warning', icon: 'i-lucide-triangle-alert' },
  critical: { label: 'Kritis', color: 'error', icon: 'i-lucide-circle-x' },
  unknown: { label: 'Belum diketahui', color: 'neutral', icon: 'i-lucide-circle-help' }
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

export function formatUptime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  return days ? `${days} hari ${hours} jam` : `${hours} jam`
}
