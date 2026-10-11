import { describe, expect, it } from 'vitest'
import { parseServiceExpectations, parseSystemdProperties, portsForPid, serviceStatus } from '../../server/utils/vps-systemd'

describe('systemd data interpretation', () => {
  it('requires explicit expectations and does not infer health from enabled units', () => {
    expect(parseServiceExpectations('{"jcore.service":"active"}')).toEqual({ 'jcore.service': 'active' })
    expect(() => parseServiceExpectations('{"--bad":"active"}')).toThrow()
    expect(() => parseServiceExpectations('{"jcore.service":"enabled"}')).toThrow()
    expect(serviceStatus('inactive', 'inactive')).toBe('healthy')
    expect(serviceStatus('inactive', 'active')).toBe('critical')
    expect(serviceStatus('failed', 'unknown')).toBe('critical')
    expect(serviceStatus('active', 'unknown')).toBe('unknown')
  })

  it('preserves property values containing equals signs', () => {
    expect(parseSystemdProperties('Id=web.service\nDescription=Proxy a=b\nMainPID=42\n\nId=db.service\nMainPID=50\n')[0]).toEqual({ Id: 'web.service', Description: 'Proxy a=b', MainPID: '42' })
  })

  it('attributes and deduplicates TCP/UDP listeners only when ownership is visible', () => {
    const output = 'tcp LISTEN 0 128 0.0.0.0:443 0.0.0.0:* users:(("web",pid=42,fd=3))\n'
      + 'tcp LISTEN 0 128 [::]:443 [::]:* users:(("web",pid=42,fd=4))\n'
      + 'udp UNCONN 0 0 0.0.0.0:53 0.0.0.0:* users:(("dns",pid=50,fd=3))'
    expect(portsForPid(output, 42)).toEqual([{ protocol: 'tcp', port: 443 }])
    expect(portsForPid(output, 50)).toEqual([{ protocol: 'udp', port: 53 }])
    expect(portsForPid(output, 99)).toBeNull()
    expect(portsForPid('tcp LISTEN 0 128 0.0.0.0:443 0.0.0.0:*', 42)).toBeNull()
  })
})
