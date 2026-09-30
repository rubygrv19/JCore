import type { VpsDashboardResponse } from '~/types/vps'

export type VpsProcess = VpsDashboardResponse['current']['processes']['items'][number]

export interface VpsProcessesResponse {
  source: 'linux-procfs'
  collectedAt: string
  items: VpsProcess[]
}
