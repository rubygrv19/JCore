import { describe, expect, it } from 'vitest'
import { createServiceClients, normalizeBaseUrl } from '../../app/utils/service-clients'
import { SERVICE_KEYS, type ServiceKey } from '../../app/types/services'

describe('service API clients', () => {
  it('normalizes HTTP base URLs and rejects unsupported protocols', () => {
    expect(normalizeBaseUrl(' https://vps.example.test/api/ ')).toBe('https://vps.example.test/api')
    expect(() => normalizeBaseUrl('ftp://vps.example.test')).toThrow('Base URL harus menggunakan HTTP atau HTTPS.')
    expect(() => normalizeBaseUrl('not a URL')).toThrow()
  })

  it('rejects credentials and query strings in browser-visible base URLs', () => {
    expect(() => normalizeBaseUrl('https://user:secret@vps.example.test/api')).toThrow('Base URL tidak boleh memuat kredensial.')
    expect(() => normalizeBaseUrl('https://vps.example.test/api?token=secret')).toThrow('Base URL tidak boleh memuat query atau fragment.')
  })

  it('sends each service request to its own configured base URL', async () => {
    const baseUrls: Record<ServiceKey, string> = {
      'vps': 'https://vps.example.test/api',
      'timeshit': 'https://timeshit.example.test/v1',
      'code-review': '',
      'quota-tracker': ''
    }
    const requestedUrls: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input))
      return new Response('{}', { headers: { 'content-type': 'application/json' } })
    }

    try {
      const clients = createServiceClients(baseUrls)
      expect(Object.keys(clients)).toEqual([...SERVICE_KEYS])
      await clients.vps?.('/health')
      await clients.timeshit?.('/health')

      expect(requestedUrls).toEqual([
        'https://vps.example.test/api/health',
        'https://timeshit.example.test/v1/health'
      ])
      expect(clients['code-review']).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
