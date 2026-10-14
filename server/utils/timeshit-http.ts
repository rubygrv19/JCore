import { getHeader, type H3Event } from 'h3'
import { timeshitError } from './timeshit-errors'

export function validateTimeshitOrigin(origin: string | undefined, configured: string) {
  let trusted: URL
  try {
    trusted = new URL(configured)
  } catch { throw timeshitError('NOT_CONFIGURED', 503, 'Configure the Timeshit trusted application origin on the server.') }
  if (!['http:', 'https:'].includes(trusted.protocol) || trusted.origin !== configured || trusted.username || trusted.password) throw timeshitError('NOT_CONFIGURED', 503, 'Timeshit trusted origin must be an exact HTTP(S) origin.')
  if (origin !== trusted.origin) throw timeshitError('ORIGIN_REJECTED', 403, 'This request origin is not allowed.')
}

export function validateTimeshitInput(value: unknown, withToken: boolean) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw timeshitError('INVALID_INPUT', 400, 'Invalid connection request.')
  const input = value as Record<string, unknown>
  const allowed = withToken ? ['token', 'expectedGeneration'] : ['expectedGeneration']
  if (Object.keys(input).some(key => !allowed.includes(key)) || !(input.expectedGeneration === null || (typeof input.expectedGeneration === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(input.expectedGeneration)))) throw timeshitError('INVALID_INPUT', 400, 'Reload connection status before submitting changes.')
  if (withToken && (typeof input.token !== 'string' || !/^[\x21-\x7e]{20,1024}$/.test(input.token))) throw timeshitError('INVALID_INPUT', 400, 'Enter a valid personal access token without whitespace.')
  return { expectedGeneration: input.expectedGeneration as string | null, token: withToken ? input.token as string : '' }
}

export async function readTimeshitMutation(event: H3Event, trustedOrigin: string, withToken: boolean) {
  return validateTimeshitInput(await readTimeshitJson(event, trustedOrigin), withToken)
}

export async function readTimeshitJson(event: H3Event, trustedOrigin: string): Promise<unknown> {
  validateTimeshitOrigin(getHeader(event, 'origin'), trustedOrigin)
  if (getHeader(event, 'sec-fetch-site') === 'cross-site' || getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw timeshitError('INVALID_INPUT', 400, 'Send a same-origin JSON request.')
  const body = await readLimitedBody(event)
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch { throw timeshitError('INVALID_INPUT', 400, 'Invalid JSON request.') }
  return value
}

async function readLimitedBody(event: H3Event): Promise<string> {
  const webBody = event.web?.request?.body
  if (webBody) {
    const reader = webBody.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const next = await reader.read()
        if (next.done) break
        size += next.value.byteLength
        if (size > 4096) {
          await reader.cancel()
          throw timeshitError('INVALID_INPUT', 413, 'Connection request is too large.')
        }
        chunks.push(next.value)
      }
      return Buffer.concat(chunks).toString('utf8')
    } finally { reader.releaseLock() }
  }
  return new Promise((resolve, reject) => {
    const request = event.node.req
    const chunks: Buffer[] = []
    let size = 0
    function cleanup() {
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('error', onError)
      request.off('aborted', onError)
    }
    function onData(chunk: Buffer) {
      size += chunk.length
      if (size > 4096) {
        cleanup()
        request.resume()
        reject(timeshitError('INVALID_INPUT', 413, 'Connection request is too large.'))
        return
      }
      chunks.push(chunk)
    }
    function onEnd() {
      cleanup()
      resolve(Buffer.concat(chunks).toString('utf8'))
    }
    function onError() {
      cleanup()
      reject(timeshitError('INVALID_INPUT', 400, 'Connection request was interrupted.'))
    }
    request.on('data', onData)
    request.once('end', onEnd)
    request.once('error', onError)
    request.once('aborted', onError)
  })
}
