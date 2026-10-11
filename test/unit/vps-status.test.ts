import { describe, expect, it } from 'vitest'
import { formatBytes, formatProcessPercent, formatProcessStartedAt, formatServicePorts, formatUptime, percent, sortProcessesByCpu, VPS_STATUS_META } from '../../app/utils/vps-status'

describe('VPS dashboard formatting and state labels', () => {
  it('uses consistent monochrome colors and distinct labels for each health state', () => {
    expect(VPS_STATUS_META.healthy).toMatchObject({ label: 'Healthy', color: 'neutral' })
    expect(VPS_STATUS_META.warning).toMatchObject({ label: 'Warning', color: 'neutral' })
    expect(VPS_STATUS_META.critical).toMatchObject({ label: 'Critical', color: 'neutral' })
    expect(VPS_STATUS_META.unknown).toMatchObject({ label: 'Unknown', color: 'neutral' })
  })

  it('formats unavailable and binary resource values safely', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GiB')
    expect(percent(null)).toBe('—')
    expect(percent(84.4)).toBe('84%')
    expect(formatUptime(null)).toBe('—')
    expect(formatUptime(604800)).toBe('7 days 0 hours')
  })

  it('formats the service ports shown in the systemd detail accordion', () => {
    expect(formatServicePorts([{ port: 80, protocol: 'tcp' }, { port: 53, protocol: 'udp' }])).toBe('TCP 80, UDP 53')
    expect(formatServicePorts([])).toBe('No ports detected')
    expect(formatServicePorts(null)).toBe('Unknown')
  })

  it('formats process percentages and start times from the snapshot timestamp', () => {
    expect(formatProcessPercent(0.9)).toBe('0.9%')
    expect(formatProcessPercent(null)).toBe('—')
    expect(formatProcessStartedAt('2026-09-20T12:00:00.000Z', '2026-09-27T16:00:00.000Z')).toContain('7 days ago')
    expect(formatProcessStartedAt(null, '2026-09-27T16:00:00.000Z')).toBe('—')
  })

  it('sorts processes by CPU use with unavailable values last without mutating the input', () => {
    const processes = [{ name: 'low', cpuPercentOfHost: 0.1 }, { name: 'unknown', cpuPercentOfHost: null }, { name: 'high', cpuPercentOfHost: 2.1 }]

    expect(sortProcessesByCpu(processes).map(process => process.name)).toEqual(['high', 'low', 'unknown'])
    expect(processes.map(process => process.name)).toEqual(['low', 'unknown', 'high'])
  })
})
