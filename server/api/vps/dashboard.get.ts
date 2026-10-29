import { createError, setHeader } from 'h3'
import { parseVpsDashboardResponse } from '#shared/utils/vps-response'
import { collectVpsDashboard } from '../../utils/vps-dashboard'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)

  if (process.platform !== 'linux') {
    throw createError({ statusCode: 501, statusMessage: 'Live VPS metrics require a Linux host.' })
  }

  try {
    const { vpsPrometheusUrl, vpsExpectedServices } = useRuntimeConfig()
    return parseVpsDashboardResponse(await collectVpsDashboard(vpsPrometheusUrl, new Date(), vpsExpectedServices))
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'The VPS metrics source is unavailable.' })
  }
})
