import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseEnv } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'

if (!process.argv.includes('--live')) throw new Error('Use --live only with approval to verify the saved PAT against GitHub in an isolated local database.')
const config = parseEnv(readFileSync('.env', 'utf8'))
const source = resolve(config.NUXT_TIMESHIT_DATABASE_PATH || '.data/timeshit.sqlite')
const digest = () => createHash('sha256').update(readFileSync(source)).digest('hex')
const originalDigest = digest()
const db = new DatabaseSync(source, { readOnly: true })
const row = db.prepare('SELECT metadata, envelope FROM connection WHERE id = 1').get()
const representative = db.prepare('SELECT repository_id FROM tracked_repository ORDER BY repository_id LIMIT 1').get()
db.close()
assert(row, 'Saved connection is required')
const envelope = JSON.parse(row.envelope)
const decipher = createDecipheriv('aes-256-gcm', Buffer.from(config.NUXT_TIMESHIT_ENCRYPTION_KEY, 'base64'), Buffer.from(envelope.iv, 'base64'))
decipher.setAAD(Buffer.from(row.metadata))
decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
const token = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8')
if (process.argv.includes('--ssh-target')) {
  const argument = name => process.argv[process.argv.indexOf(name) + 1]
  const target = argument('--ssh-target')
  const remoteDirectory = argument('--remote-dir')
  const remoteNode = argument('--remote-node')
  assert(/^[a-z\d._-]+@[a-z\d._-]+$/i.test(target))
  assert(/^\/home\/[a-z\d_-]+\/jcore-acceptance\.[a-z\d]+$/i.test(remoteDirectory))
  assert(/^\/[a-z\d/._-]+\/node$/i.test(remoteNode))
  assert(representative, 'Track a representative repository before host acceptance')
  const sourceHashes = {}
  function hashDirectory(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) hashDirectory(child)
      else if (entry.isFile()) sourceHashes[child] = createHash('sha256').update(readFileSync(child)).digest('hex')
    }
  }
  for (const path of ['app', 'server', 'shared', 'public']) hashDirectory(path)
  for (const path of ['package.json', 'pnpm-lock.yaml', 'nuxt.config.ts']) sourceHashes[path] = createHash('sha256').update(readFileSync(path)).digest('hex')
  const remote = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=5', target, `cd ${remoteDirectory}\n${remoteNode} test/fixtures/check-timeshit-ubuntu.mjs --live`], { stdio: ['pipe', 'pipe', 'inherit'] })
  remote.stdin.end(JSON.stringify({ token, repositoryId: representative.repository_id, sourceHashes, range: { startDate: '2026-10-01', endDate: '2026-10-13', timeZone: 'Asia/Jakarta' } }))
  remote.stdout.pipe(process.stdout)
  const code = await new Promise(resolve => remote.once('exit', resolve))
  assert.equal(digest(), originalDigest, 'Main database must remain unchanged')
  process.exit(code ?? 1)
}
const directory = mkdtempSync(join(tmpdir(), 'jcore-timeshit-live-'))
const password = randomBytes(32).toString('hex')
const base = 'http://127.0.0.1:3002'
const env = { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production', NITRO_HOST: '127.0.0.1', NITRO_PORT: '3002', NUXT_AUTH_ADMIN_EMAIL: 'acceptance@example.invalid', NUXT_AUTH_ADMIN_PASSWORD: password, NUXT_AUTH_TRUSTED_PROXY_IPS: '', NUXT_AUTH_TRUSTED_ORIGIN: base, NUXT_SESSION_PASSWORD: randomBytes(48).toString('base64'), NUXT_SESSION_NAME: 'jcore-live-acceptance', NUXT_SESSION_COOKIE_SECURE: 'false', NUXT_TIMESHIT_ENCRYPTION_KEY: randomBytes(32).toString('base64'), NUXT_TIMESHIT_DATABASE_PATH: join(directory, 'connection.sqlite'), NUXT_TIMESHIT_TRUSTED_ORIGIN: base }
let child
let cookie = ''
async function start() {
  child = spawn(process.execPath, [resolve('.output/server/index.mjs')], { env, stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Acceptance server did not become ready')), 10000)
      child.once('error', reject)
      child.once('exit', () => reject(new Error('Acceptance server exited before readiness')))
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes(`Listening on ${base}`)) {
          clearTimeout(timer)
          resolve()
        }
      })
    })
  } catch (error) {
    await stop()
    throw error
  }
}
async function stop() {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  await exited
}
async function call(method, body) {
  const response = await fetch(`${base}/api/timeshit/connection`, { method, headers: { cookie, 'origin': base, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const text = await response.text()
  assert(!text.includes(token), 'Response must not contain the PAT')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  return { status: response.status, body: JSON.parse(text) }
}
try {
  await start()
  assert.equal((await call('GET')).status, 401)
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'origin': base, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'acceptance@example.invalid', password }) })
  assert.equal(login.status, 200)
  cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const connected = await call('POST', { token, expectedGeneration: null })
  assert.equal(connected.status, 200)
  assert.equal(connected.body.state, 'connected')
  await stop()
  await start()
  assert.equal((await call('GET')).body.generation, connected.body.generation)
  const replaced = await call('POST', { token, expectedGeneration: connected.body.generation })
  assert.equal(replaced.status, 200)
  assert.notEqual(replaced.body.generation, connected.body.generation)
  assert.equal(replaced.body.account.id, connected.body.account.id)
  assert.equal((await call('DELETE', { expectedGeneration: connected.body.generation })).status, 409)
  await delay(12100)
  const rejected = await call('POST', { token: 'test_only_synthetic_invalid_token', expectedGeneration: replaced.body.generation })
  assert.equal(rejected.status, 422)
  assert.equal((await call('GET')).body.generation, replaced.body.generation)
  assert.equal((await call('DELETE', { expectedGeneration: replaced.body.generation })).body.state, 'disconnected')
  await delay(12100)
  const reconnected = await call('POST', { token, expectedGeneration: null })
  assert.equal(reconnected.status, 200)
  assert.equal(reconnected.body.account.id, connected.body.account.id)
  const privateDb = new DatabaseSync(env.NUXT_TIMESHIT_DATABASE_PATH, { readOnly: true })
  const stored = privateDb.prepare('SELECT metadata, envelope FROM connection WHERE id=1').get()
  privateDb.close()
  assert(!JSON.stringify(stored).includes(token), 'Stored connection must be encrypted')
  assert.equal(digest(), originalDigest, 'Main database must remain unchanged')
  console.info(JSON.stringify({ liveGithubLifecycle: 'passed', connect: true, sameAccountReplace: true, rejectedReplacePreservesConnection: true, staleDeleteRejected: true, disconnect: true, reconnect: true, restartPersistence: true, unauthenticatedRejected: true, responseSecretsAbsent: true, encryptedStorage: true, mainDatabaseUnchanged: true, differentRealAccount: 'not tested' }))
} finally {
  if (child) await stop()
  rmSync(directory, { recursive: true, force: true })
}
