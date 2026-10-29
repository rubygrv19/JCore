import { describe, expect, it } from 'vitest'
import { aggregateNetworkRates, formatBytes, formatProcessPercent, formatProcessStartedAt, formatServicePorts, formatUptime, percent, sortProcessesByCpu, VPS_STATUS_META } from '../../app/utils/vps-status'

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

  it('sums current network rates across monitored interfaces like the trend queries', () => {
    expect(aggregateNetworkRates([
      { rxBytesPerSecond: 100, txBytesPerSecond: 30, rxErrorsPerSecond: 1, txErrorsPerSecond: 2, rxDropsPerSecond: 3, txDropsPerSecond: 4 },
      { rxBytesPerSecond: 250, txBytesPerSecond: 70, rxErrorsPerSecond: 5, txErrorsPerSecond: 6, rxDropsPerSecond: 7, txDropsPerSecond: 8 }
    ])).toEqual({
      rxBytesPerSecond: 350,
      txBytesPerSecond: 100,
      rxErrorsPerSecond: 6,
      txErrorsPerSecond: 8,
      rxDropsPerSecond: 10,
      txDropsPerSecond: 12
    })
  })

  it('returns null for unavailable network totals and sums only reported series', () => {
    expect(aggregateNetworkRates([])).toEqual({
      rxBytesPerSecond: null,
      txBytesPerSecond: null,
      rxErrorsPerSecond: null,
      txErrorsPerSecond: null,
      rxDropsPerSecond: null,
      txDropsPerSecond: null
    })
    expect(aggregateNetworkRates([
      { rxBytesPerSecond: null, txBytesPerSecond: 40, rxErrorsPerSecond: null, txErrorsPerSecond: null, rxDropsPerSecond: null, txDropsPerSecond: null },
      { rxBytesPerSecond: 80, txBytesPerSecond: null, rxErrorsPerSecond: null, txErrorsPerSecond: 3, rxDropsPerSecond: 5, txDropsPerSecond: null }
    ])).toEqual({
      rxBytesPerSecond: 80,
      txBytesPerSecond: 40,
      rxErrorsPerSecond: null,
      txErrorsPerSecond: 3,
      rxDropsPerSecond: 5,
      txDropsPerSecond: null
    })
  })
})
