import type { VpsDashboardResponse } from '#shared/types/vps'

export type VpsProcess = VpsDashboardResponse['current']['processes']['items'][number]

export interface VpsProcessesResponse {
  source: 'linux-procfs'
  collectedAt: string
  items: VpsProcess[]
}
