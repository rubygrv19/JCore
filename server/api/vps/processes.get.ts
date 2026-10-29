import { createError, setHeader } from 'h3'
import { collectLinuxProcesses } from '../../utils/vps-processes'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  await requireUserSession(event)

  if (process.platform !== 'linux') {
    throw createError({
      statusCode: 501,
      statusMessage: 'The local process collector requires Linux /proc.'
    })
  }

  return {
    source: 'linux-procfs' as const,
    collectedAt: new Date().toISOString(),
    items: await collectLinuxProcesses()
  }
})
