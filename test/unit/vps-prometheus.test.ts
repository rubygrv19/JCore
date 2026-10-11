import { describe, expect, it } from 'vitest'
import { collectVpsDashboard, normalizePrometheusAlerts, statusForAlert, statusForHealth } from '../../server/utils/vps-dashboard'

describe('VPS Prometheus integration', () => {
  it('accepts current pending and firing alerts and ignores unrelated or malformed alerts', () => {
    const alerts = normalizePrometheusAlerts({
      status: 'success',
      data: {
        alerts: [
          {
            labels: { alertname: 'VpsFilesystemWarning', resource: 'storage', severity: 'warning', mountpoint: '/' },
            annotations: { summary: 'Root filesystem filling', description: 'Root filesystem is above the threshold.' },
            state: 'pending',
            activeAt: '2026-10-06T00:00:00Z',
            value: '85'
          },
          {
            labels: { alertname: 'VpsSystemdUnitFailed', resource: 'services', severity: 'critical', name: 'example.service' },
            annotations: { summary: 'Unit failed' },
            state: 'firing',
            activeAt: '2026-10-06T00:00:00Z',
            value: '1'
          },
          {
            labels: { alertname: 'UnrelatedAlert', resource: 'memory', severity: 'warning' },
            annotations: {},
            state: 'firing',
            activeAt: '2026-10-06T00:00:00Z',
            value: '1'
          }
        ]
      }
    })

    expect(alerts).toEqual([
      {
        name: 'VpsFilesystemWarning', resource: 'storage', severity: 'warning', state: 'pending',
        summary: 'Root filesystem filling', description: 'Root filesystem is above the threshold.',
        activeAt: '2026-10-06T00:00:00Z', value: 85, target: '/'
      },
      {
        name: 'VpsSystemdUnitFailed', resource: 'services', severity: 'critical', state: 'firing',
        summary: 'Unit failed', description: 'Unit failed', activeAt: '2026-10-06T00:00:00Z', value: 1,
        target: 'example.service'
      }
    ])
  })

  it('maps alerts to resource and mount status without converting unknown data to healthy', () => {
    const alerts = normalizePrometheusAlerts({ status: 'success', data: { alerts: [{
      labels: { alertname: 'VpsFilesystemCritical', resource: 'storage', severity: 'critical', mountpoint: '/' },
      annotations: { summary: 'Filesystem critical' },
      state: 'firing',
      activeAt: '2026-10-06T00:00:00Z',
      value: '92'
    }] } })

    expect(statusForAlert(alerts, 'storage', '/', true)).toBe('critical')
    expect(statusForAlert(alerts, 'storage', '/boot', true)).toBe('healthy')
    expect(statusForAlert([], 'cpu', null, false)).toBe('unknown')
    const pending = alerts.map(alert => ({ ...alert, state: 'pending' as const }))
    expect(statusForAlert(pending, 'storage', '/', true)).toBe('healthy')
    expect(statusForHealth(pending, true, false)).toBe('healthy')
    expect(statusForHealth([], false, false)).toBe('unknown')
    expect(statusForHealth([], true, true)).toBe('critical')
  })

  it('rejects non-loopback Prometheus URLs before making a request', async () => {
    await expect(collectVpsDashboard('https://prometheus.example.com')).rejects.toThrow('Prometheus must use a credential-free loopback URL.')
  })
})
