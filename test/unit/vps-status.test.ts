import { describe, expect, it } from 'vitest'
import { formatBytes, formatServicePorts, formatUptime, percent, VPS_STATUS_META } from '../../app/utils/vps-status'

describe('VPS dashboard formatting and state labels', () => {
  it('uses consistent semantic colors and labels for each health state', () => {
    expect(VPS_STATUS_META.healthy).toMatchObject({ label: 'Sehat', color: 'success' })
    expect(VPS_STATUS_META.warning).toMatchObject({ label: 'Perhatian', color: 'warning' })
    expect(VPS_STATUS_META.critical).toMatchObject({ label: 'Kritis', color: 'error' })
    expect(VPS_STATUS_META.unknown).toMatchObject({ label: 'Belum diketahui', color: 'neutral' })
  })

  it('formats unavailable and binary resource values safely', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GiB')
    expect(percent(null)).toBe('—')
    expect(percent(84.4)).toBe('84%')
    expect(formatUptime(null)).toBe('—')
    expect(formatUptime(604800)).toBe('7 hari 0 jam')
  })

  it('formats the service ports shown in the systemd detail accordion', () => {
    expect(formatServicePorts([{ port: 80, protocol: 'tcp' }, { port: 53, protocol: 'udp' }])).toBe('TCP 80, UDP 53')
    expect(formatServicePorts([])).toBe('Tidak ada port terdeteksi')
  })
})
