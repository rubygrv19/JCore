import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectVpsDashboard } from '../../server/utils/vps-dashboard'
import { parseVpsDashboardResponse } from '../../shared/utils/vps-response'

const transport = vi.hoisted(() => ({ missingCpu: false, age: 0, up: 1, alerts: [] as unknown[] }))
const epoch = Date.parse('2026-10-10T00:00:00Z') / 1000

vi.mock('../../server/utils/vps-systemd', async original => ({
  ...await original<typeof import('../../server/utils/vps-systemd')>(),
  collectSystemdUnits: vi.fn().mockResolvedValue({ units: [], available: true })
}))
vi.mock('ofetch', () => ({
  $fetch: vi.fn(async (url: string, options: { query?: { query: string } }) => {
    if (url.endsWith('/alerts')) return { status: 'success', data: { alerts: transport.alerts } }
    if (url.endsWith('/query_range')) return { status: 'success', data: { resultType: 'matrix', result: [] } }
    const query = options.query?.query ?? ''
    const metric = { device: 'eth0', mountpoint: '/', fstype: 'ext4', instance: '127.0.0.1:9100', nodename: 'test-host' }
    let value = 1
    if (query.startsWith('up{')) value = transport.up
    if (query.startsWith('min(timestamp')) value = epoch - transport.age
    if (query === 'node_boot_time_seconds') value = epoch - 3600
    if (query === 'node_memory_MemTotal_bytes') value = 8192
    if (query === 'node_memory_MemAvailable_bytes') value = 4096
    if (query.startsWith('node_filesystem_size')) value = 10000
    if (query.startsWith('node_filesystem_avail')) value = 5000
    if (query.startsWith('node_systemd') || (transport.missingCpu && query === 'vps:cpu_usage_percent')) return { status: 'success', data: { resultType: 'vector', result: [] } }
    return { status: 'success', data: { resultType: 'vector', result: [{ metric, value: [epoch, String(value)] }] } }
  })
}))

beforeEach(() => Object.assign(transport, { missingCpu: false, age: 0, up: 1, alerts: [] }))

describe('Prometheus to dashboard contract', () => {
  it('returns a validated snapshot with the exporter sample timestamp', async () => {
    const result = await collectVpsDashboard('http://127.0.0.1:9090', new Date(epoch * 1000))
    expect(parseVpsDashboardResponse(result)).toEqual(result)
    expect(result.source.status).toBe('complete')
    expect(result.source.sampledAt).toBe(new Date(epoch * 1000).toISOString())
  })

  it('does not call partial or old data healthy', async () => {
    transport.missingCpu = true
    const partial = await collectVpsDashboard('http://127.0.0.1:9090', new Date(epoch * 1000))
    expect(partial.health.status).toBe('unknown')
    expect(partial.source.missingMetrics).toContain('cpu')
    expect(parseVpsDashboardResponse(partial)).toEqual(partial)
    transport.missingCpu = false
    transport.age = 90
    const stale = await collectVpsDashboard('http://127.0.0.1:9090', new Date(epoch * 1000))
    expect(stale.source.status).toBe('stale')
    expect(stale.health.status).toBe('unknown')
  })

  it('marks exporter failure even when Prometheus still returns historical values', async () => {
    transport.up = 0
    const result = await collectVpsDashboard('http://127.0.0.1:9090', new Date(epoch * 1000))
    expect(result.source.status).toBe('unavailable')
    expect(result.health.status).toBe('critical')
  })
})
