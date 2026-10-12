import { describe, expect, it } from 'vitest'
import { calculateHostCpuPercent, mapProcState, parseProcStat, processStartedAt, redactCommandLine } from '../../server/utils/vps-processes'
import { parseVpsProcessesResponse } from '../../app/utils/vps-processes-client'

describe('Linux process collector parsers', () => {
  it('parses proc stat when the command name contains spaces and parentheses', () => {
    const fields = ['S', '1', '1', '1', '0', '-1', '0', '0', '0', '0', '0', '123', '45', '0', '0', '0', '0', '0', '0', '99', '0', '2048']
    const parsed = parseProcStat(`42 (worker (pool) 1) ${fields.join(' ')}`)

    expect(parsed).toEqual({ state: 'S', userTicks: 123, systemTicks: 45, startTicks: 99, residentPages: 2048 })
  })

  it('maps Linux process states and keeps unknown states unknown', () => {
    expect(['R', 'S', 'D', 'T', 't', 'Z', '?'].map(mapProcState)).toEqual([
      'running', 'sleeping', 'sleeping', 'stopped', 'stopped', 'zombie', 'unknown'
    ])
  })

  it('calculates host-normalized CPU and preserves unavailable samples', () => {
    expect(calculateHostCpuPercent(25, 1000)).toBe(2.5)
    expect(calculateHostCpuPercent(1250, 1000)).toBe(100)
    expect(calculateHostCpuPercent(null, 1000)).toBeNull()
    expect(calculateHostCpuPercent(1, 0)).toBeNull()
  })

  it('redacts common credential arguments and returns null for empty command lines', () => {
    expect(redactCommandLine('agent --api-key topsecret --password=hidden TOKEN=abc https://user:pass@example.com')).toBe(
      'agent [ARGUMENTS REDACTED]'
    )
    expect(redactCommandLine('\0\0')).toBeNull()
  })

  it('never exposes positional, header, spaced, database URL, or unknown option values', () => {
    for (const value of [
      'curl\0-H\0Authorization: Bearer PRIVATE_TOKEN\0https://example.test\0',
      'worker\0--password\0two word PRIVATE_PASSWORD\0',
      'worker\0--database-url=postgres://user:PRIVATE_PASSWORD@localhost/db\0',
      'worker\0-pPRIVATE_PASSWORD\0',
      'worker\0PRIVATE_PASSWORD\0'
    ]) expect(redactCommandLine(value)).not.toContain('PRIVATE_')
    expect(redactCommandLine('/usr/bin/worker\0')).toBe('/usr/bin/worker')
  })

  it('converts process start ticks to time since boot, not process age', () => {
    expect(processStartedAt(1_700_000_000, 60_000, 100)).toBe(new Date(1_700_000_600_000).toISOString())
    expect(processStartedAt(1_700_000_000, 60_000, null)).toBeNull()
  })
})

describe('VPS process snapshot contract', () => {
  it('accepts a documented Linux snapshot and rejects missing required fields', () => {
    const snapshot = {
      source: 'linux-procfs',
      collectedAt: '2026-09-30T00:00:00.000Z',
      items: [{
        name: 'worker', pid: 42, state: 'running', user: 'app', cpuPercentOfHost: null,
        memoryPercent: 1.2, description: null, location: '/usr/bin/worker',
        startedAt: null, commandLine: 'worker --password=[REDACTED]'
      }]
    }
    expect(parseVpsProcessesResponse(snapshot)).toEqual(snapshot)
    expect(() => parseVpsProcessesResponse({ ...snapshot, items: [{ name: 'missing-pid' }] })).toThrow(/does not match/)
  })
})
