import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = mkdtempSync(join(tmpdir(), 'jcore-timeshit-acceptance-'))
const preload = fileURLToPath(new URL('./timeshit-github-preload.mjs', import.meta.url))
const child = spawn(process.execPath, ['--import', preload, resolve('.output/server/index.mjs')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '',
    NODE_ENV: 'production',
    NITRO_HOST: '127.0.0.1',
    NITRO_PORT: '3001',
    JCORE_TIMESHIT_ACCEPTANCE: 'synthetic',
    NUXT_AUTH_ADMIN_EMAIL: 'acceptance@example.invalid',
    NUXT_AUTH_ADMIN_PASSWORD: 'synthetic-acceptance-password',
    NUXT_AUTH_TRUSTED_ORIGIN: 'http://127.0.0.1:3001',
    NUXT_AUTH_TRUSTED_PROXY_IPS: '',
    NUXT_SESSION_PASSWORD: randomBytes(48).toString('base64'),
    NUXT_SESSION_NAME: 'jcore-acceptance',
    NUXT_SESSION_COOKIE_SECURE: 'false',
    NUXT_TIMESHIT_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    NUXT_TIMESHIT_DATABASE_PATH: join(directory, 'connection.sqlite'),
    NUXT_TIMESHIT_TRUSTED_ORIGIN: 'http://127.0.0.1:3001'
  }
})
console.info('Synthetic acceptance only: http://127.0.0.1:3001; temporary database; no real GitHub calls.')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => {
  rmSync(directory, { recursive: true, force: true })
  process.exitCode = code ?? 0
})
