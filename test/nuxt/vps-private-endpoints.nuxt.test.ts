import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, toWebHandler } from 'h3'
import examples from '../../docs/vps-response-examples.json'

const collectors = vi.hoisted(() => ({ dashboard: vi.fn(), processes: vi.fn() }))
vi.mock('../../server/utils/vps-dashboard', () => ({ collectVpsDashboard: collectors.dashboard }))
vi.mock('../../server/utils/vps-processes', () => ({ collectLinuxProcesses: collectors.processes }))

const session = vi.fn()
const runtimeConfig = { vpsPrometheusUrl: 'http://127.0.0.1:9090', vpsExpectedServices: {} }
let originalPlatform: PropertyDescriptor | undefined

beforeEach(() => {
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('requireUserSession', session.mockReset().mockResolvedValue({ user: { email: 'admin@example.invalid' } }))
  vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)
  collectors.dashboard.mockReset().mockResolvedValue(examples.partial)
  collectors.processes.mockReset().mockResolvedValue({ source: 'linux-procfs', collectedAt: '2026-10-15T00:00:00.000Z', items: [] })
})

afterEach(() => {
  if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
  originalPlatform = undefined
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function call(kind: 'dashboard' | 'processes', platform: NodeJS.Platform = 'linux') {
  originalPlatform ??= Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { ...originalPlatform, value: platform })
  const handler = kind === 'dashboard'
    ? (await import('../../server/api/vps/dashboard.get')).default
    : (await import('../../server/api/vps/processes.get')).default
  const app = createApp({ debug: false }).use(handler)
  try {
    return await toWebHandler(app)(new Request(`http://localhost/api/vps/${kind}`))
  } finally {
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform)
  }
}

describe('private VPS endpoint cache policy', () => {
  it('marks successful dashboard and process responses private and non-cacheable', async () => {
    for (const kind of ['dashboard', 'processes'] as const) {
      const response = await call(kind)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  it('sets the cache policy before rejecting unauthenticated requests', async () => {
    session.mockRejectedValue(createError({ statusCode: 401, statusMessage: 'Unauthorized' }))
    for (const kind of ['dashboard', 'processes'] as const) {
      const response = await call(kind)
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
    expect(collectors.dashboard).not.toHaveBeenCalled()
    expect(collectors.processes).not.toHaveBeenCalled()
  })

  it('keeps the cache policy on unsupported-platform responses', async () => {
    for (const kind of ['dashboard', 'processes'] as const) {
      const response = await call(kind, 'darwin')
      expect(response.status).toBe(501)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
    expect(collectors.dashboard).not.toHaveBeenCalled()
    expect(collectors.processes).not.toHaveBeenCalled()
  })

  it('keeps the cache policy on unavailable-source errors', async () => {
    collectors.dashboard.mockRejectedValueOnce(new Error('synthetic source failure'))
    const dashboard = await call('dashboard')
    expect(dashboard.status).toBe(503)
    expect(dashboard.headers.get('cache-control')).toBe('private, no-store')

    collectors.processes.mockRejectedValueOnce(new Error('synthetic procfs failure'))
    const processes = await call('processes')
    expect(processes.status).toBe(500)
    expect(processes.headers.get('cache-control')).toBe('private, no-store')
  })
})
