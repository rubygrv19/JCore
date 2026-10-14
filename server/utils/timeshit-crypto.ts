import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { timeshitError } from './timeshit-errors'

interface Envelope { version: 1, iv: string, ciphertext: string, tag: string }

export function parseTimeshitKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw timeshitError('NOT_CONFIGURED', 503, 'Timeshit requires a valid server encryption key.')
  }
  return key
}

export function encryptTimeshitToken(token: string, key: Buffer, context: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(context))
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return JSON.stringify({ version: 1, iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') } satisfies Envelope)
}

export function decryptTimeshitToken(value: string, key: Buffer, context: string): string {
  try {
    const envelope = JSON.parse(value) as Envelope
    if (envelope.version !== 1 || typeof envelope.iv !== 'string' || typeof envelope.tag !== 'string' || typeof envelope.ciphertext !== 'string') throw new Error()
    const iv = Buffer.from(envelope.iv, 'base64')
    const tag = Buffer.from(envelope.tag, 'base64')
    if (iv.length !== 12 || tag.length !== 16) throw new Error()
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(Buffer.from(context))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    throw timeshitError('STORAGE_LOCKED', 503, 'The saved connection cannot be decrypted. Restore its key or disconnect before reconnecting.')
  }
}
