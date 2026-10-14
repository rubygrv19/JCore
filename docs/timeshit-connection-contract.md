# Timeshit connection: implementation and contract

The single-account GitHub connection in Settings, [repository management](timeshit-repositories-contract.md), [branch/commit/file browsing](timeshit-history-contract.md), and [activity collection, daily digest and heatmap](timeshit-activity-contract.md) are implemented. See the [approved plan](timeshit-implementation-plan.md) and current [verification report](timeshit-verification-report.md) for acceptance evidence and remaining release boundaries.

## Operator setup

Use the Node server, not static generation. Node 22.16+ (22.x) or Node 24+ is required by the built-in `node:sqlite` API used here. Local verification uses Node 22.23.2 / SQLite 3.51.3. Node 22 labels this API experimental; validate the target host before deploying. No ORM or native SQLite dependency is added.

Set private environment variables from `.env.example`:

- `NUXT_TIMESHIT_ENCRYPTION_KEY`: canonical base64 encoding of exactly 32 random bytes. Generate once with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` in a private terminal, save to the ignored environment file, and restrict its permissions. Never commit the value or paste it into an issue.
- `NUXT_TIMESHIT_TRUSTED_ORIGIN`: exact browser origin, e.g. `http://127.0.0.1:3000` locally. No trailing slash, path, query, credentials or fragment. Use the public HTTPS origin in deployment.
- `NUXT_TIMESHIT_DATABASE_PATH`: optional absolute `.sqlite` or `.db` path. Blank uses `.data/timeshit.sqlite` under the server's working directory. Keep it on persistent private storage. Paths inside public, build, Git and dependency directories, including symlink targets, are rejected.

The server creates a private directory (0700 for newly created directories) and restricts the database to 0600. Existing parent-directory ownership and access are the operator's responsibility. `.data` is ignored by Git. Do not put the database in deployment artifacts or static assets. A single Node process with local SQLite is the supported topology; distributed storage and multiple application replicas are not verified.

A fine-grained GitHub PAT is recommended with **Metadata: read** and **Contents: read**, granting only needed repositories. GitHub `/user` does not require repository permissions, so identity verification cannot prove Contents access or that a token is read-only. JCore only reads GitHub through REST GET and GraphQL POST queries. No live PAT is included in fixtures or automated tests.

The owner also approved **classic PAT** use. For private repositories, classic needs `repo`, which includes write capabilities and cannot be narrowed to Contents read-only. JCore still only reads GitHub through REST GET and GraphQL POST queries. Organization policy and SSO authorization can restrict access. Token type and read-only permissions are not inferred from a prefix or identity success.

## HTTP contract, version 1.0

All three methods use `/api/timeshit/connection`. Every handler calls `requireUserSession` before accessing storage or GitHub and sets `Cache-Control: private, no-store`.

| Method | Input | Behavior |
| --- | --- | --- |
| GET | None | Read public saved metadata, without contacting GitHub |
| POST | JSON `{ "token": "<entered PAT>", "expectedGeneration": null }` or the last returned generation | Verify `/user`, probe one page of `/user/repos`, then atomically save encrypted token and public metadata |
| DELETE | JSON `{ "expectedGeneration": "<last returned generation>" }` | Atomically remove connection and tracked selection; does not revoke the token on GitHub |

Mutation requests require `Origin` equal to configured trusted origin, JSON Content-Type and a body no larger than 4096 bytes. Explicit cross-site Fetch Metadata is rejected. Tokens accept 20–1024 printable ASCII characters without whitespace; shape validation does not prove fine-grained scope. Unknown body properties and omitted revisions are rejected. Connection generations are opaque UUIDs. Concurrent stale writes/deletes return 409, requiring a status reload. POST checks at most once per 12 seconds per Node process; retries are disabled. GitHub requests use the fixed origin `https://api.github.com` and `X-GitHub-Api-Version: 2026-03-10`. Each request has an 8-second timeout and refuses redirects. GitHub rate-limit delays also extend the local attempt gate, including when discovery is rate-limited after identity succeeds. These limits reset on restart and are not a distributed rate limiter.

Responses follow [JSON Schema](timeshit-connection.schema.json); [synthetic examples](timeshit-connection.examples.json) are contract fixtures, not real users. Both server reads and browser responses validate metadata. No response includes token, ciphertext, key or saved credential hints.

States:

- `unconfigured`: missing/invalid key or trusted origin. No GitHub request is attempted.
- `disconnected`: configured server, no saved connection.
- `connected`: identity verified at `checkedAt`; this is the last verification, not a continuous token-validity guarantee.
- `locked`: the saved credential cannot be authenticated/decrypted; metadata is withheld except the generation needed for an explicit disconnect.

`checks.identity` is verified only after a valid positive account ID/login response. Discovery `available` means the discovery request succeeded, including an empty result; it does not mean every private repository is accessible. Restricted, rate-limited and unavailable discovery may coexist with a verified account. `checks.contents` remains `not-checked` in the connection envelope: repository access results are separate, per-repository fields on the repository API. Never report a successful `/user` check as full repository authorization.

Errors use H3's JSON error envelope with safe `statusMessage` and `data.code`. Known codes: `INVALID_INPUT` (400/413), `ORIGIN_REJECTED` (403), `NOT_CONFIGURED`, `STORAGE_LOCKED`, `STORAGE_UNAVAILABLE` (503), `CONNECTION_CHANGED`, `GITHUB_CONFLICT` (409), `GITHUB_AUTH_FAILED`, `GITHUB_RESTRICTED` (422), `GITHUB_RATE_LIMITED` (429), `GITHUB_UNAVAILABLE`, `INVALID_UPSTREAM` (502). GitHub credential errors use 422, preserving the distinction from a JCore session's 401. Rate errors include `retryAfterSeconds`; mutation-level rate errors also set Retry-After. Upstream error bodies/requests are never forwarded to the client. Activity continuation errors are documented separately in the [activity contract](timeshit-activity-contract.md#http-operations).

## Persistence, replacement and recovery

SQLite schema is now `user_version=3`, migrated automatically from v1/v2. It has singleton `connection` (public JSON metadata, authenticated encrypted envelope, generation), tracked repository records and a selection revision. See the repository contract for migration and selection semantics. AES-256-GCM uses a fresh random 12-byte IV and 16-byte authentication tag. Metadata is authenticated as additional data, binding account identity to the token. SQLite transactions and generation checks protect atomic replacement/deletion. Failed verification or decryption leaves the old connection unchanged. A same-account replacement preserves candidate repository IDs but invalidates their access verification; they are excluded from future activity until rechecked. A different account clears selection.

Back up database and encryption key separately using private operator storage. Stop the application for a consistent file copy, or use SQLite's backup tooling. Losing/changing the key locks saved data; startup never creates a substitute key. Restore the original key and restart to recover. Alternatively configure a valid key, load locked status and explicitly disconnect, then connect again. Disconnect removes the active stored credential; it is not secure erasure of SQLite free pages or backups. Revoke the PAT on GitHub if compromise is suspected. Key rotation/re-encryption tooling is not implemented.

## Browser behavior

Settings uses Nuxt UI fields, alerts, buttons and the existing modal/accordion. PAT exists only in the component-local draft and request body, never Pinia/session/localStorage. Drafts clear on attempt completion, modal close and unmount. Busy mutations prevent modal dismissal. Connection actions persist immediately; the footer Save still applies only temporary Base URL/mode drafts. External Base URL is explicitly reserved and never receives a PAT. Public connection state uses its own Pinia store and is cleared on logout, including late reload responses.

## Verification and remaining work

Unit tests cover crypto tampering/wrong keys, persistence across reopen, stale-write rejection, private file permissions, public schema, mutation validation, mocked GitHub verification/errors, authenticated endpoint boundaries and Pinia reset behavior. Successful mocked identity checks do not prove a real PAT's permissions. Real same-account GitHub lifecycle verification and isolated browser account-switch checks are recorded in the [verification report](timeshit-verification-report.md); use the [acceptance runbook](timeshit-acceptance.md) to repeat them without changing the main connection. Two-real-account switching and public HTTPS/proxy acceptance are separate evidence boundaries.

The [activity contract](timeshit-activity-contract.md) retains stable repository IDs, all-branch deduplication `(repositoryId, fullSha)`, server-derived authorship, authored-day grouping in Asia/Jakarta and explicit incomplete coverage. The bounded collector/HTTP operations, client controls, daily digest/copy and heatmap are implemented. Current local/target-host evidence and remaining release gates are in the [verification report](timeshit-verification-report.md).

### Local acceptance evidence (October 13, 2026, Asia/Jakarta)

- Node 22.23.2 / native SQLite 3.51.3 on macOS; crypto/storage and mocked upstream tests passed.
- Production Node smoke: authenticated login, 401 for each unauthed connection method, SQLite-backed disconnected status, foreign-origin rejection, 20 KB request rejection, malformed-token rejection, healthy subsequent request and Settings SSR.
- Browser: login with disposable verification credentials; Settings/Connection renders; token draft clears after Cancel/reopen; Escape closes; light and dark themes; desktop and measured 480 px CSS viewport with scrollable modal and visible footer. Browser console showed no errors/warnings during these checks.
- Verification accounts, keys and databases were temporary. The normal local server uses the ignored `.env`; a missing local Timeshit key/origin was initialized without replacing existing non-empty values. No real GitHub PAT was submitted. Do not interpret this as a live GitHub or Ubuntu deployment check.

Build on the target OS/architecture: Nuxt Image includes platform-specific sharp binaries. Do not copy the macOS `.output` build to Ubuntu.

History default branch preferences, calendar controls and full-width Timeshit layout are documented in the [preference contract](timeshit-preferences-contract.md).
