import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from '../../docs/vps-processes.schema.json'
import type { VpsProcessesResponse } from '~/types/vps-processes'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile<VpsProcessesResponse>(schema)

export function parseVpsProcessesResponse(value: unknown): VpsProcessesResponse {
  if (!validate(value)) throw new Error('VPS process response does not match the data contract.')
  return value as VpsProcessesResponse
}

export async function fetchVpsProcesses(signal?: AbortSignal): Promise<VpsProcessesResponse> {
  const response: unknown = await $fetch('/api/vps/processes', { signal, timeout: 20_000, retry: 0 })
  return parseVpsProcessesResponse(response)
}
