import { parseVpsDashboardResponse } from '~/utils/vps-response'

// Mock response uses the agreed contract; replace this function when the VPS API contract is implemented.
export function useVpsDashboard() {
  return useAsyncData('vps-dashboard', async () => {
    const response: unknown = await $fetch('/mock/vps-dashboard.json')
    return parseVpsDashboardResponse(response)
  }, { server: false })
}
