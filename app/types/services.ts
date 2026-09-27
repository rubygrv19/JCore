export const SERVICE_KEYS = ['vps', 'timeshit', 'code-review', 'quota-tracker'] as const

export type ServiceKey = typeof SERVICE_KEYS[number]
export type ServiceMode = '' | 'coming-soon' | 'maintenance' | 'shutdown'

export interface ServiceConfig {
  baseUrl: string
  mode: ServiceMode
}

export type ServiceConfigs = Record<ServiceKey, ServiceConfig>
