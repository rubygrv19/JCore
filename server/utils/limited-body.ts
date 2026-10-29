import { getHeader, setResponseHeader, type H3Event } from 'h3'

export async function readLimitedBody(event: H3Event, maxBytes: number, failure: (status: 400 | 413) => Error): Promise<string> {
  function tooLarge() {
    if (!event.web?.request) setResponseHeader(event, 'Connection', 'close')
    return failure(413)
  }
  const length = getHeader(event, 'content-length')
  if (length !== undefined) {
    if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) throw failure(400)
    if (Number(length) > maxBytes) throw tooLarge()
  }
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
        if (size > maxBytes) {
          await reader.cancel().catch(() => {})
          throw tooLarge()
        }
        chunks.push(next.value)
      }
      return Buffer.concat(chunks).toString('utf8')
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 413) throw error
      throw failure(400)
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
      if (size > maxBytes) {
        cleanup()
        request.resume()
        reject(tooLarge())
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
      reject(failure(400))
    }
    request.on('data', onData)
    request.once('end', onEnd)
    request.once('error', onError)
    request.once('aborted', onError)
  })
}
