import { describe, expect, it } from 'vitest'
import fixture from '../../public/mock/vps-dashboard.json'
import { parseVpsDashboardResponse } from '../../app/utils/vps-response'
import { getActiveProcesses, paginateItems } from '../../app/utils/vps-status'

describe('VPS backend reference fixture', () => {
  it('matches the published response schema', () => {
    expect(parseVpsDashboardResponse(fixture)).toEqual(fixture)
    expect(() => parseVpsDashboardResponse({ ...fixture, current: null })).toThrow('VPS response does not match the data contract.')
  })

  it('keeps process CPU values within host capacity and omits unused alerts', () => {
    expect(fixture.schemaVersion).toBe('1.2')
    expect(fixture.dataMode).toBe('mock')
    expect(fixture).not.toHaveProperty('alerts')
    for (const process of fixture.current.processes.items) {
      expect(process.cpuPercentOfHost).toBeGreaterThanOrEqual(0)
      expect(process.cpuPercentOfHost).toBeLessThanOrEqual(100)
    }
  })

  it('keeps process and service times consistent with host uptime', () => {
    const collected = Date.parse(fixture.collectedAt)
    const boot = collected - fixture.host.uptimeSeconds * 1000

    for (const unit of fixture.current.services.units) {
      if (unit.since === null || unit.uptimeSeconds === null) continue
      expect(Date.parse(unit.since)).toBeGreaterThanOrEqual(boot)
      expect(collected - Date.parse(unit.since)).toBe(unit.uptimeSeconds * 1000)
    }
    for (const process of fixture.current.processes.items) {
      if (process.startedAt === null) continue
      expect(Date.parse(process.startedAt)).toBeGreaterThanOrEqual(boot)
    }
  })

  it('aligns the latest history sample with the current snapshot', () => {
    const sample = fixture.history.samples.at(-1)
    expect(sample?.timestamp).toBe(fixture.collectedAt)
    expect(sample?.cpuUsagePercent).toBe(fixture.current.cpu.usagePercent)
    expect(sample?.diskReadBytesPerSecond).toBe(fixture.current.storage.io.readBytesPerSecond)
    expect(sample?.networkRxBytesPerSecond).toBe(fixture.current.network.interfaces[0]?.rxBytesPerSecond)
  })
})

describe('VPS process list behavior', () => {
  const records = [
    { name: 'low', state: 'sleeping', cpuPercentOfHost: 0.1 },
    { name: 'high', state: 'running', cpuPercentOfHost: 2 },
    { name: 'unknown', state: 'unknown', cpuPercentOfHost: null },
    { name: 'stopped', state: 'stopped', cpuPercentOfHost: 1 },
    { name: 'zombie', state: 'zombie', cpuPercentOfHost: 3 }
  ]

  it('keeps active and unknown states, excludes stopped and zombie, and sorts by CPU', () => {
    expect(getActiveProcesses(records).map(item => item.name)).toEqual(['high', 'low', 'unknown'])
  })

  it('returns only rows for the requested page', () => {
    expect(paginateItems(['a', 'b', 'c'], 2, 2)).toEqual(['c'])
  })
})
