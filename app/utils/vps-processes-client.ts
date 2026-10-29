import { parseVpsProcessesResponse } from '#shared/utils/vps-processes-response'
import type { VpsProcessesResponse } from '#shared/types/vps-processes'

export async function fetchVpsProcesses(signal?: AbortSignal): Promise<VpsProcessesResponse> {
  const response: unknown = await $fetch('/api/vps/processes', { signal, timeout: 20_000, retry: 0 })
  return parseVpsProcessesResponse(response)
}
