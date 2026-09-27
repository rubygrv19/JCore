import { $fetch } from 'ofetch'
import { SERVICE_KEYS, type ServiceKey } from '../types/services'

export type ServiceClient = ReturnType<typeof $fetch.create>
export type ServiceClients = Record<ServiceKey, ServiceClient | null>

export function normalizeBaseUrl(value: string): string {
  const input = value.trim()
  if (!input) return ''

  const url = new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL harus menggunakan HTTP atau HTTPS.')
  }

  return url.href.replace(/\/+$/, '')
}

export function createServiceClients(baseUrls: Record<ServiceKey, string>): ServiceClients {
  return Object.fromEntries(SERVICE_KEYS.map((key) => {
    const baseURL = normalizeBaseUrl(baseUrls[key])
    return [key, baseURL ? $fetch.create({ baseURL }) : null]
  })) as ServiceClients
}
