import { readdir, readFile, readlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { VpsProcess } from '~/types/vps-processes'

const execFileAsync = promisify(execFile)
const previousCpuTicks = new Map<number, { ticks: number, startTicks: number }>()
let previousHostTicks: number | undefined
let ticksPerSecondPromise: Promise<number | null> | undefined

interface ProcStat {
  state: string
  userTicks: number
  systemTicks: number
  startTicks: number
  residentPages: number
}

export function parseProcStat(input: string): ProcStat | null {
  const close = input.lastIndexOf(')')
  if (close < 0) return null
  const fields = input.slice(close + 1).trim().split(/\s+/)
  const state = fields[0]
  const userTicks = Number(fields[11])
  const systemTicks = Number(fields[12])
  const startTicks = Number(fields[19])
  const residentPages = Number(fields[21])
  if (!state || ![userTicks, systemTicks, startTicks, residentPages].every(Number.isFinite)) return null
  return { state, userTicks, systemTicks, startTicks, residentPages }
}

export function mapProcState(state: string): VpsProcess['state'] {
  if (state === 'R') return 'running'
  if (state === 'S' || state === 'D' || state === 'I') return 'sleeping'
  if (state === 'T' || state === 't') return 'stopped'
  if (state === 'Z') return 'zombie'
  return 'unknown'
}

export function calculateHostCpuPercent(processDelta: number | null, hostDelta: number | null): number | null {
  if (processDelta === null || hostDelta === null || hostDelta <= 0 || processDelta < 0) return null
  return Math.min(100, Math.max(0, processDelta / hostDelta * 100))
}

export function redactCommandLine(commandLine: string): string | null {
  const normalized = commandLine.replace(/\0/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized
    .replace(/(--?(?:password|passwd|token|secret|api[-_]?key|authorization|credential|client[-_]?secret)(?:\s+|=))([^\s]+)/gi, '$1[REDACTED]')
    .replace(/\b(password|passwd|token|secret|api[-_]?key|authorization|credential|client[-_]?secret)=([^\s]+)/gi, '$1=[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
}

function readProcessUser(status: string, users: Map<string, string>): string | null {
  const uid = status.match(/^Uid:\s+(\d+)/m)?.[1]
  return uid ? users.get(uid) ?? uid : null
}

async function getTicksPerSecond(): Promise<number | null> {
  ticksPerSecondPromise ??= execFileAsync('getconf', ['CLK_TCK'])
    .then(({ stdout }) => Number.parseInt(stdout.trim(), 10))
    .then(value => Number.isFinite(value) && value > 0 ? value : null)
    .catch(() => null)
  return ticksPerSecondPromise
}

async function readUserMap(): Promise<Map<string, string>> {
  const users = new Map<string, string>()
  try {
    const passwd = await readFile('/etc/passwd', 'utf8')
    for (const line of passwd.split('\n')) {
      const [name, , uid] = line.split(':')
      if (name && uid) users.set(uid, name)
    }
  } catch {
    // UID remains available as a numeric identifier when passwd is unreadable.
  }
  return users
}

async function readHostCpuTicks(): Promise<number | null> {
  try {
    const stat = await readFile('/proc/stat', 'utf8')
    const line = stat.split('\n').find(value => value.startsWith('cpu '))
    if (!line) return null
    // Linux guest/guest_nice are already included in user/nice; sum the first 8 fields only.
    const ticks = line.trim().split(/\s+/).slice(1, 9).map(Number)
    const total = ticks.reduce((sum, tick) => sum + tick, 0)
    return Number.isFinite(total) ? total : null
  } catch {
    return null
  }
}

function parseMemoryTotalBytes(meminfo: string): number | null {
  const kib = Number(meminfo.match(/^MemTotal:\s+(\d+)\s+kB/m)?.[1])
  return Number.isFinite(kib) && kib > 0 ? kib * 1024 : null
}

async function readStartedAt(startTicks: number, ticksPerSecond: number | null): Promise<string | null> {
  if (!ticksPerSecond) return null
  try {
    const [bootLine, uptimeLine] = await Promise.all([
      readFile('/proc/stat', 'utf8').then(text => text.match(/^btime\s+(\d+)/m)?.[1]),
      readFile('/proc/uptime', 'utf8').then(text => text.trim().split(/\s+/)[0])
    ])
    const bootTime = Number(bootLine)
    const uptimeSeconds = Number(uptimeLine)
    if (![bootTime, uptimeSeconds].every(Number.isFinite)) return null
    const elapsedAtStart = uptimeSeconds - startTicks / ticksPerSecond
    return new Date((bootTime + elapsedAtStart) * 1000).toISOString()
  } catch {
    return null
  }
}

export async function collectLinuxProcesses(): Promise<VpsProcess[]> {
  const [entries, meminfo, users, hostTicks, ticksPerSecond] = await Promise.all([
    readdir('/proc', { withFileTypes: true }),
    readFile('/proc/meminfo', 'utf8'),
    readUserMap(),
    readHostCpuTicks(),
    getTicksPerSecond()
  ])
  const memoryTotalBytes = parseMemoryTotalBytes(meminfo)
  const hostDelta = hostTicks !== null && previousHostTicks !== undefined ? hostTicks - previousHostTicks : null
  const nextPreviousCpuTicks = new Map<number, { ticks: number, startTicks: number }>()
  const processes = await Promise.all(entries
    .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map(async (entry): Promise<VpsProcess | null> => {
      const pid = Number(entry.name)
      try {
        const [statText, status, cmdline] = await Promise.all([
          readFile(`/proc/${entry.name}/stat`, 'utf8'),
          readFile(`/proc/${entry.name}/status`, 'utf8'),
          readFile(`/proc/${entry.name}/cmdline`)
        ])
        const stat = parseProcStat(statText)
        if (!stat) return null
        const cpuTicks = stat.userTicks + stat.systemTicks
        const previous = previousCpuTicks.get(pid)
        nextPreviousCpuTicks.set(pid, { ticks: cpuTicks, startTicks: stat.startTicks })
        const cpuDelta = previous?.startTicks === stat.startTicks ? cpuTicks - previous.ticks : null
        const cpuPercentOfHost = calculateHostCpuPercent(cpuDelta, hostDelta)
        const residentKib = Number(status.match(/^VmRSS:\s+(\d+)\s+kB/m)?.[1])
        const rssBytes = Number.isFinite(residentKib) ? residentKib * 1024 : null
        let location: string | null = null
        try {
          location = await readlink(`/proc/${entry.name}/exe`)
        } catch {
          // Process may exit or be restricted.
        }
        return {
          name: statText.slice(statText.indexOf('(') + 1, statText.lastIndexOf(')')) || entry.name,
          pid,
          state: mapProcState(stat.state),
          user: readProcessUser(status, users),
          cpuPercentOfHost,
          memoryPercent: rssBytes !== null && memoryTotalBytes ? Math.min(100, rssBytes / memoryTotalBytes * 100) : null,
          description: null,
          location,
          startedAt: await readStartedAt(stat.startTicks, ticksPerSecond),
          commandLine: redactCommandLine(cmdline.toString('utf8'))
        }
      } catch {
        // A process can exit or become inaccessible while /proc is being read.
        return null
      }
    }))
  previousCpuTicks.clear()
  for (const [pid, sample] of nextPreviousCpuTicks) previousCpuTicks.set(pid, sample)
  previousHostTicks = hostTicks ?? undefined
  return processes.filter((process): process is VpsProcess => process !== null)
}
