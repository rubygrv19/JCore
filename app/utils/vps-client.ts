import type { VpsDashboardResponse } from '~/types/vps'

// Mock response uses the agreed contract; replace this function when the VPS API contract is implemented.
export function useVpsDashboard() {
  return useFetch<VpsDashboardResponse>('/mock/vps-dashboard.json', { key: 'vps-dashboard', server: false })
}
