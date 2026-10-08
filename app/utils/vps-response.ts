import Ajv2020, { type AnySchema } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import schema from '../../docs/vps-dashboard.schema.json'
import type { VpsDashboardResponse } from '~/types/vps'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile<VpsDashboardResponse>(schema as AnySchema)

export function parseVpsDashboardResponse(value: unknown): VpsDashboardResponse {
  if (!validate(value)) {
    throw new Error('VPS response does not match the data contract.')
  }

  return value as VpsDashboardResponse
}
