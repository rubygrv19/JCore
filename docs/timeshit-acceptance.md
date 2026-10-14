# Timeshit isolated acceptance

Use this runbook with the [verification report](timeshit-verification-report.md), [connection contract](timeshit-connection-contract.md), [activity contract](timeshit-activity-contract.md), and [security configuration](security-and-configuration.md). These are operator-invoked checks, not production startup scripts or a certification of security. They are outside the automatic unit suite and must never be loaded by the production service.

## Preconditions

- Obtain the owner's approval before using a saved real PAT or transferring source/credentials to a target host. Do not publish the test server, open firewall ports, change existing proxies or alter production credentials as part of these checks.
- Use the supported Node version and the pinned package manager/lockfile. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, then `pnpm build`. Build and Nuxt tests must finish sequentially.
- Build on the target OS/architecture. Nuxt Image bundles platform-specific sharp binaries; a macOS `.output` is not an Ubuntu release.
- Ports 3001 (synthetic UI) and 3002 (live API acceptance) must be free. All test listeners bind to `127.0.0.1`. Preserve the regular local server on port 3000 and its database.
- Helpers use temporary private SQLite directories, fresh encryption/session keys and disposable administrator credentials. Normal completion stops the child server and removes its temporary database. If the terminal or host is forcibly terminated, inspect and remove only the owned test process/directory before retrying; do not delete the main `.data` or an existing checkout.

## Synthetic browser lifecycle

After a successful local production build:

```sh
node test/fixtures/start-timeshit-acceptance.mjs
```

Open `http://127.0.0.1:3001/login`. The test-only administrator is `acceptance@example.invalid` with password `synthetic-acceptance-password`. This fixture starts a separate production build with explicit local HTTP cookie overrides; these overrides are not production deployment settings.

Settings → Timeshit accepts these deliberately synthetic PAT strings:

- `test_only_synthetic_connection_alpha`: synthetic account Alpha.
- `test_only_synthetic_connection_beta`: synthetic account Beta.
- `test_only_synthetic_invalid_token`: rejected by the fixture upstream.

`timeshit-github-preload.mjs` requires `JCORE_TIMESHIT_ACCEPTANCE=synthetic`. It intercepts only the fixed GitHub API origin and uses a small fixture repository. Unknown tokens/resources fail; it does not contact GitHub. Do not enter a real PAT in this test form.

Verify:

1. Connect Alpha; the draft clears and remains a password input.
2. Track the synthetic repository. Submit an invalid replacement; Alpha and the tracked selection remain intact.
3. Replace with Alpha again. The selection remains, access becomes Needs verification, and Browse history is disabled until rechecked.
4. Replace with Beta. The previous selection and private activity/history views disappear.
5. Explicitly confirm disconnect, verify disconnected UI, then reconnect Alpha.
6. Reload Settings and confirm persisted public metadata with an empty credential draft. Verify keyboard access and no unexpected console errors.

Connection POST attempts retain the real twelve-second process-local gate. Wait for the cooldown between attempts instead of disabling it. Stop the fixture with Ctrl+C after the checks; the main connection remains untouched.

## Real GitHub lifecycle on the local build

Requires an existing saved connection and its ignored local `.env`. The helper opens the main SQLite file read-only, decrypts the saved PAT only in process memory, and uses a fresh, independent acceptance database/server. It never prints the PAT, key, cookie, upstream body or repository contents.

```sh
node test/fixtures/check-timeshit-live-lifecycle.mjs --live
```

Assertions cover private no-store responses, unauthenticated rejection, real connect/same-account replace, stale disconnect rejection, invalid replacement preservation, disconnect/reconnect, encrypted persistence and persistence across a server restart with stable private keys. A before/after digest verifies the main database file was unchanged. The flag is explicit because these checks contact GitHub using the saved PAT. No GitHub writes or token revocation are performed.

This is a real API test, not proof of two-real-account switching or public browser HTTPS behavior. The synthetic browser run covers the UI workflow separately.

## Ubuntu source/build and live API acceptance

1. Connect through an already trusted SSH host/key. Keep strict host-key checking enabled. Do not transfer `.env`, `.data`, private keys, `.git`, `node_modules` or macOS build output. Copy current source into a new private directory named `~/jcore-acceptance.<unique>`; preserve the existing checkout. Include the `test/fixtures/` helpers.
2. Use the target's supported Node binary and pinned pnpm. Run frozen-lockfile installation, unit tests, typecheck, lint and production build there. On a constrained host, `pnpm test --maxWorkers=1` limits concurrent test workers. Record memory/build limitations rather than hiding them. The observed 2 GiB host required a build heap larger than the initial 768 MiB test cap; `NODE_OPTIONS=--max-old-space-size=1536 pnpm build` passed with existing swap. This is observed acceptance evidence, not a universal memory guarantee.
3. From the local checkout, run the following with the actual trusted SSH target, unique directory and absolute target Node path:

```sh
node test/fixtures/check-timeshit-live-lifecycle.mjs --live \
  --ssh-target ubuntu@YOUR_TRUSTED_HOST \
  --remote-dir /home/ubuntu/jcore-acceptance.UNIQUE \
  --remote-node /absolute/path/to/bin/node
```

The local helper verifies the main database remains unchanged and sends the saved PAT, one representative tracked repository ID and runtime-source hashes through SSH stdin. Credentials are never command arguments, repository files or tool output. The Ubuntu helper uses fresh temporary keys/database and only a loopback listener. It checks runtime source hashes, session guards, production cookie attributes, trusted Origin rejection, encrypted connection storage, repository access, restart persistence, and a complete all-observed-branch collection for October 1–13, 2026 in `Asia/Jakarta`. This fixed historical range is an acceptance workload; update it deliberately when a different representative range is needed.

Aggregate output includes counts, elapsed time and pass/fail stages only. The helper intentionally selects one representative tracked repository in its isolated database; it does not alter the main selection. It does not measure GitHub request counts or query points on Ubuntu. Those are measured separately in the local benchmark artifacts.

4. After completion, verify the test listener stopped. Remove the exact owned acceptance directory and source archive when no longer needed. Preserve dependency caches and the existing repository. No deployment or service-manager changes are required for these checks.

## Public release gate

Loopback Node API acceptance does not establish TLS, proxy forwarding, cache bypass, browser Secure-cookie behavior, daemon supervision or persistence across an OS reboot. Check the actual HTTPS deployment and existing [Ubuntu runbook](../ops/vps/VERIFY.md) before public release. Keep production `__Host-jcore-session` cookies Secure and HttpOnly; do not copy the synthetic HTTP overrides to the deployment. Two-real-account PAT switching requires an approved second test account; never substitute a fabricated live result.
