import { parseVpsDashboardResponse } from '~/utils/vps-response'

// Non-Linux development hosts use the validated fixture until the Linux collector is available.
export function useVpsDashboard() {
  return useAsyncData('vps-dashboard', async () => {
    try {
      const response: unknown = await $fetch('/api/vps/dashboard')
      return parseVpsDashboardResponse(response)
    } catch (error) {
      const statusCode = (error as { statusCode?: number, status?: number }).statusCode ?? (error as { status?: number }).status
      if (statusCode !== 501) throw error
      const fixture: unknown = await $fetch('/mock/vps-dashboard.json')
      return parseVpsDashboardResponse(fixture)
    }
  }, { server: false })
}
