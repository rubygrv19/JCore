import { execFile } from 'node:child_process'
import { readFile, readlink } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { VpsDashboardResponse, VpsStatus } from '#shared/types/vps'
import { redactCommandLine } from './vps-processes'

const execute = promisify(execFile)
type Unit = VpsDashboardResponse['current']['services']['units'][number]
type Expectations = Record<string, 'active' | 'inactive'>
const validUnit = /^[a-zA-Z0-9_@.\\:-]+\.service$/

export function parseServiceExpectations(value: unknown): Expectations {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.entries(parsed).some(([name, state]) => !validUnit.test(name) || !['active', 'inactive'].includes(String(state)))) {
    throw new Error('Expected service states must map systemd service names to active or inactive.')
  }
  return parsed as Expectations
}

export function serviceStatus(actual: string, expected: Unit['expectedState']): VpsStatus {
  if (actual === 'failed') return 'critical'
  if (expected === 'unknown' || actual === 'unknown') return 'unknown'
  return actual === expected ? 'healthy' : 'critical'
}

export function parseSystemdProperties(output: string): Array<Record<string, string>> {
  return output.trim().split(/\n\s*\n/).filter(Boolean).map(block => Object.fromEntries(block.split('\n').flatMap((line) => {
    const index = line.indexOf('=')
    return index > 0 ? [[line.slice(0, index), line.slice(index + 1)]] : []
  })))
}

export function portsForPid(output: string, pid: number): Unit['ports'] {
  const ports = new Map<string, { port: number, protocol: 'tcp' | 'udp' }>()
  for (const line of output.split('\n')) {
    if (![...line.matchAll(/pid=(\d+),/g)].some(match => Number(match[1]) === pid)) continue
    const fields = line.trim().split(/\s+/)
    const protocol = fields[0]
    const port = Number(fields[4]?.match(/:(\d+)$/)?.[1])
    if ((protocol === 'tcp' || protocol === 'udp') && port > 0 && port <= 65535) ports.set(`${protocol}:${port}`, { port, protocol })
  }
  // ss may omit ownership without permission. Absence is not proof that no ports exist.
  return ports.size ? [...ports.values()] : null
}

export async function collectSystemdUnits(fallback: Unit[], expected: Expectations, now: Date): Promise<{ units: Unit[], available: boolean }> {
  const command = (args: string[]) => execute('systemctl', args, { timeout: 5000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } })
  try {
    const { stdout: listing } = await command(['list-units', '--all', '--type=service', '--plain', '--no-legend', '--no-pager'])
    const names = [...new Set([...listing.split('\n').map(line => line.trim().split(/\s+/)[0] ?? '').filter(name => validUnit.test(name)), ...Object.keys(expected)])]
    const [sockets, uptime] = await Promise.all([
      execute('ss', ['-H', '-l', '-t', '-u', '-n', '-p'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }).then(result => result.stdout).catch(() => ''),
      readFile('/proc/uptime', 'utf8').then(text => Number(text.split(' ')[0]))
    ])
    const units: Unit[] = []
    for (let index = 0; index < names.length; index += 25) {
      const batch = names.slice(index, index + 25)
      const { stdout } = await command(['show', '--no-pager', '--property=Id,Description,LoadState,ActiveState,MainPID,ActiveEnterTimestampMonotonic', '--', ...batch])
      const properties = parseSystemdProperties(stdout)
      units.push(...await Promise.all(batch.map(async (name): Promise<Unit> => {
        const item = properties.find(record => record.Id === name)
        const actualState = item?.LoadState === 'loaded' ? item.ActiveState || 'unknown' : 'unknown'
        const pidValue = Number(item?.MainPID)
        const pid = Number.isSafeInteger(pidValue) && pidValue > 0 ? pidValue : null
        const entered = Number(item?.ActiveEnterTimestampMonotonic)
        const uptimeSeconds = actualState === 'active' && entered > 0 && Number.isFinite(uptime) ? Math.max(0, uptime - entered / 1_000_000) : null
        const [path, rawCommand] = pid
          ? await Promise.all([
              readlink(`/proc/${pid}/exe`).catch(() => null),
              readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => null)
            ])
          : [null, null]
        const expectedState = expected[name] ?? 'unknown'
        return {
          name, actualState, expectedState,
          since: uptimeSeconds === null ? null : new Date(now.getTime() - uptimeSeconds * 1000).toISOString(),
          status: serviceStatus(actualState, expectedState),
          description: item?.Description || null,
          ports: pid ? portsForPid(sockets, pid) : null,
          pid, uptimeSeconds, path,
          commandLine: rawCommand ? redactCommandLine(rawCommand) : null
        }
      })))
    }
    return { units: units.sort((a, b) => a.name.localeCompare(b.name)), available: true }
  } catch {
    const units = fallback.map(unit => ({ ...unit, expectedState: expected[unit.name] ?? 'unknown' as const }))
    for (const name of Object.keys(expected)) {
      if (!units.some(unit => unit.name === name)) units.push({ name, actualState: 'unknown', expectedState: expected[name]!, since: null, status: 'unknown', description: null, ports: null, pid: null, uptimeSeconds: null, path: null, commandLine: null })
    }
    return { units: units.map(unit => ({ ...unit, status: serviceStatus(unit.actualState, unit.expectedState) })), available: false }
  }
}
