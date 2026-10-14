import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

if (!process.argv.includes('--live')) throw new Error('Explicit --live acceptance mode required; input uses private SSH stdin only.')
let raw = ''
for await (const chunk of process.stdin) {
  raw += chunk
  if (raw.length > 100000) throw new Error('Acceptance input too large')
}
const input = JSON.parse(raw)
assert(typeof input.token === 'string' && input.token.length >= 20)
let stage = 'source-integrity'
const directory = mkdtempSync(join(tmpdir(), 'jcore-ubuntu-acceptance-'))
const base = 'http://127.0.0.1:3002'
const origin = 'https://jcore.rubygrv.cloud'
const password = randomBytes(32).toString('hex')
const env = { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production', NITRO_HOST: '127.0.0.1', NITRO_PORT: '3002', NUXT_AUTH_ADMIN_EMAIL: 'acceptance@example.invalid', NUXT_AUTH_ADMIN_PASSWORD: password, NUXT_SESSION_PASSWORD: randomBytes(48).toString('base64'), NUXT_TIMESHIT_ENCRYPTION_KEY: randomBytes(32).toString('base64'), NUXT_TIMESHIT_DATABASE_PATH: join(directory, 'connection.sqlite'), NUXT_TIMESHIT_TRUSTED_ORIGIN: origin }
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
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM')
  await exited
}
async function call(path, method = 'GET', body, requestOrigin = origin) {
  const response = await fetch(`${base}${path}`, { method, headers: { cookie, 'origin': requestOrigin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
  const text = await response.text()
  assert(!text.includes(input.token), 'Response must not contain PAT')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  return { status: response.status, body: JSON.parse(text) }
}
try {
  for (const [path, expected] of Object.entries(input.sourceHashes)) {
    assert(!path.startsWith('/') && !path.split('/').includes('..'))
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected, 'Runtime source mismatch')
  }
  stage = 'authentication'
  await start()
  for (const path of ['/api/timeshit/connection', '/api/timeshit/repositories', '/api/timeshit/tracked-repositories']) assert.equal((await call(path)).status, 401)
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'acceptance@example.invalid', password }) })
  assert.equal(login.status, 200)
  const sealed = login.headers.getSetCookie()
  assert(sealed.some(value => value.startsWith('__Host-jcore-session=') && /; Secure/i.test(value) && /; HttpOnly/i.test(value) && /; SameSite=Lax/i.test(value) && /; Path=\//i.test(value)))
  cookie = sealed.map(value => value.split(';')[0]).join('; ')
  assert.equal((await call('/api/timeshit/connection', 'POST', { token: input.token, expectedGeneration: null }, 'https://rejected.invalid')).status, 403)
  stage = 'live-connection'
  const connection = await call('/api/timeshit/connection', 'POST', { token: input.token, expectedGeneration: null })
  assert.equal(connection.status, 200)
  assert.equal(connection.body.state, 'connected')
  stage = 'repository-access'
  let discovery
  let selectedPage = 0
  for (let page = 1; page <= 20; page++) {
    discovery = await call(`/api/timeshit/repositories?page=${page}`)
    assert.equal(discovery.status, 200)
    if (discovery.body.repositories.some(repo => repo.id === input.repositoryId)) {
      selectedPage = page
      break
    }
    if (!discovery.body.hasNext) break
  }
  assert(selectedPage > 0, 'Representative repository not found within acceptance discovery limit')
  const empty = await call('/api/timeshit/tracked-repositories')
  const tracked = await call('/api/timeshit/tracked-repositories', 'PUT', { expectedGeneration: empty.body.generation, expectedSelectionRevision: empty.body.selectionRevision, repositoryId: input.repositoryId, action: 'track', page: selectedPage })
  assert.equal(tracked.status, 200)
  assert.equal(tracked.body.repositories[0].access, 'readable')
  stage = 'restart-persistence'
  await stop()
  await start()
  assert.equal((await call('/api/timeshit/connection')).body.generation, connection.body.generation)
  const restored = await call('/api/timeshit/tracked-repositories')
  assert.equal(restored.body.selectionRevision, tracked.body.selectionRevision)
  assert.equal(restored.body.repositories[0].access, 'readable')
  stage = 'live-collection'
  const started = Date.now()
  let collected = await call('/api/timeshit/activity', 'POST', { expectedGeneration: restored.body.generation, expectedSelectionRevision: restored.body.selectionRevision, range: input.range })
  let batches = 1
  while (collected.status === 200 && collected.body.continuation) {
    await delay(Math.max(1000, (collected.body.retryAfterSeconds ?? 0) * 1000))
    collected = await call('/api/timeshit/activity/continue', 'POST', { continuation: collected.body.continuation, expectedRevision: collected.body.revision })
    batches++
    if (batches % 5 === 0) console.info(JSON.stringify({ hostAcceptance: 'collecting', batches, branchesCompleted: collected.body.coverage?.reduce((total, repo) => total + repo.branchesCompleted, 0) }))
  }
  assert.equal(collected.status, 200)
  assert.equal(collected.body.status, 'complete')
  assert(collected.body.coverage.every(repo => repo.status === 'complete' && repo.failure === null && repo.branchesCompleted === repo.branchesDiscovered))
  assert(!readFileSync(env.NUXT_TIMESHIT_DATABASE_PATH).includes(Buffer.from(input.token)), 'Database must not contain plaintext PAT')
  console.info(JSON.stringify({ hostAcceptance: 'passed', sourceFilesVerified: Object.keys(input.sourceHashes).length, node: process.version, platform: process.platform, architecture: process.arch, authenticated: true, privateNoStore: true, trustedOriginEnforced: true, secureCookieAttributes: true, encryptedStorage: true, restartPersistence: true, liveGithubConnection: true, collection: { status: collected.body.status, batches, elapsedMs: Date.now() - started, branchesDiscovered: collected.body.coverage.reduce((sum, repo) => sum + repo.branchesDiscovered, 0), branchesCompleted: collected.body.coverage.reduce((sum, repo) => sum + repo.branchesCompleted, 0), matchingCommits: collected.body.items.length }, publicHttpsBrowser: 'not tested; loopback API acceptance only' }))
} catch (error) {
  console.error(JSON.stringify({ hostAcceptance: 'failed', stage, failureType: error.code ?? error.name }))
  process.exitCode = 1
} finally {
  await stop()
  rmSync(directory, { recursive: true, force: true })
}
