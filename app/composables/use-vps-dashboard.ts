import { parseVpsDashboardResponse } from '#shared/utils/vps-response'

// Non-Linux development hosts use the validated fixture until the Linux collector is available.
export function useVpsDashboard() {
  return useAsyncData('vps-dashboard', async (_app, { signal }) => {
    try {
      const response: unknown = await $fetch('/api/vps/dashboard', { signal, timeout: 20_000, retry: 0 })
      return parseVpsDashboardResponse(response)
    } catch (error) {
      const statusCode = (error as { statusCode?: number, status?: number }).statusCode ?? (error as { status?: number }).status
      if (statusCode !== 501) throw error
      const fixture: unknown = await $fetch('/mock/vps-dashboard.json', { signal })
      return parseVpsDashboardResponse(fixture)
    }
  }, { server: false })
}
