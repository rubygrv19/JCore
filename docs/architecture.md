# Architecture and existing behavior

This document describes current source. The [Timeshit connection contract](timeshit-connection-contract.md) describes implemented credential storage; the [plan](timeshit-implementation-plan.md) tracks approved scope and the [verification report](timeshit-verification-report.md) records current acceptance and remaining release checks; [repository management](timeshit-repositories-contract.md) is implemented.

## Runtime model

JCore runs as a Nuxt 4 application with a Nitro Node server. Authentication, private server APIs and host-local collectors require a running server; a static export is not a functional deployment for this product.

```text
Browser
  Login -> Nuxt auth API -> sealed session cookie
  Protected pages -> global route middleware
  VPS page -> same-origin /api/vps/dashboard -> loopback Prometheus
                                           -> Node Exporter -> Linux metrics
           -> same-origin /api/vps/processes -> Linux /proc
  Settings -> temporary Base URL/mode drafts in Pinia
           -> /api/timeshit/connection -> encrypted private SQLite
  Timeshit -> same-origin repository/history/activity APIs -> fixed GitHub REST/GraphQL origin
                                          -> account-bound SQLite selection
           -> ephemeral activity job -> cumulative Pinia snapshot

Nuxt dashboard collector also reads /etc/os-release and inspects
systemd + MainPID procfs + ss for unit details.
```

The monitored host is the host running Nuxt and the collectors. Containerizing Nuxt changes process visibility unless namespaces/mounts are deliberately configured; the current runbook assumes Nuxt runs directly on the Linux host as an unprivileged account.

## Source map

| Location | Responsibility |
| --- | --- |
| `nuxt.config.ts` | Modules, CSS entry, private runtime config, session cookie policy, ESLint setup |
| `package.json` / `pnpm-lock.yaml` | Scripts, declared packages, resolved dependency versions |
| `app/app.vue` | `UApp`, Nuxt layout/page rendering, English metadata and title template |
| `app/app.config.ts` | Nuxt UI semantic colors and component theme overrides |
| `app/assets/css/main.css` | Tailwind/Nuxt UI imports, Inter and application surface tokens |
| `app/layouts/default.vue` | Sidebar, route navigation, theme control, account and sign-out |
| `app/middleware/auth.global.ts` | Dashboard route session guard; `/login` exemption |
| `app/pages/` | File-based routes and page-local view state |
| `app/types/services.ts` | Canonical `SERVICE_KEYS` and service config types (do not re-export from Pinia) |
| `app/stores/services.ts` | Temporary Base URL/mode drafts shared through Pinia |
| `app/utils/` | Service clients, formatting and polling |
| `app/composables/` | Nuxt composables such as VPS `useAsyncData()` orchestration |
| `app/components/*.client.vue` | Client-rendered Chart.js wrappers |
| `server/api/` | Nitro endpoints and private API guards |
| `server/utils/` | Credential checks, login limiter, Prometheus/procfs/systemd collectors |
| `shared/types/auth.d.ts` | Session user typing shared with Nuxt Auth Utils |
| `shared/types/vps*.ts` / `shared/utils/vps*.ts` | VPS response types and pure runtime validation shared by app and server |
| `public/mock/` | Public illustrative fixture; never put credentials or real private telemetry here |
| `docs/*.schema.json` | AJV runtime schemas imported by validators |
| `test/unit/` / `test/nuxt/` | Node logic tests and Nuxt-aware tests |
| `ops/vps/` | Compose stack, scrape/alert rules, Ubuntu runbook |
| `scripts/start-local.mjs` | Loopback-only production start wrapper |

`shared/` contains code used by both app and server. VPS response types and AJV validators live there; the browser fetch client remains in `app/utils/`, and Nuxt `useAsyncData()` orchestration lives in `app/composables/`. `useVpsMonitoring()` owns VPS snapshot/freshness/process polling and cleanup; `useTimeshitPageLifecycle()` owns Timeshit initial loads and view-store cleanup. The page files retain local control state, table definitions and their Nuxt UI markup. Shared VPS modules import only shared types, validation dependencies and contract schemas; they do not import app-only or server-private code.

## Routes

| Route | Page | Access and content |
| --- | --- | --- |
| `/login` | `app/pages/login.vue` | Public sign-in, no default dashboard layout |
| `/` | `app/pages/index.vue` | Authenticated Coming Soon Dashboard |
| `/settings` | `app/pages/settings.vue` | Authenticated configuration cards and modal |
| `/services/vps` | `app/pages/services/vps.vue` | Authenticated VPS monitoring |
| `/services/timeshit` | `app/pages/services/timeshit.vue` | Authenticated GitHub tracking, branch/commit/change browsing, activity collection, daily digest and heatmap |
| `/services/code-review` | Same dynamic page | Authenticated Coming Soon |
| `/services/quota-tracker` | Same dynamic page | Authenticated Coming Soon |
| `/services/<unknown>` | Same dynamic page | Rejected with 404 |

Nuxt resolves the explicit VPS and Timeshit pages before the dynamic service page. Navigation uses pathname routes, not legacy hash navigation. The sidebar exposes Dashboard and Settings without children and one Services group with one child level. Mobile link selection closes navigation below 1024px; desktop selection keeps it open.

## Authentication

`POST /api/auth/login` uses server environment credentials, resolves the TCP client (or an explicitly trusted proxy's single X-Real-IP), applies bounded per-client and global process-local budgets, validates the configured login Origin and JSON Content-Type, reads at most 8 KiB through the shared bounded stream reader, validates credentials, compares them and calls `setUserSession`. The shared reader also preserves Timeshit's separate 4 KiB mutation limit. `useUserSession()` supplies session state to login, middleware and the dashboard layout. Signing out calls its `clear()` method. The current login page does not automatically redirect an already signed-in visitor merely because they opened `/login`.

Every current VPS API handler calls `requireUserSession(event)` independently of the page guard. Framework session routes come from Nuxt Auth Utils; they are not custom application endpoints. See [security and configuration](security-and-configuration.md) for exact behavior and limits.

Both private VPS telemetry endpoints set `Cache-Control: private, no-store` before authentication and collection; this applies to success and error responses. Reverse proxy/CDN cache behavior remains a separate deployment check.

## State ownership

- Pinia owns shared service configuration, public Timeshit connection metadata, private repository view state and ephemeral history view state; it never owns the PAT. Config entries are independent for `vps`, `timeshit`, `code-review`, and `quota-tracker`.
- Settings form values, modal selection, accordions and Shutdown confirmation use local Vue refs. Saving copies the draft into Pinia and closes the modal; Cancel does not save.
- VPS dashboard reads use `useAsyncData('vps-dashboard', ..., { server: false })`. The layout reads its cached snapshot with `useNuxtData` for the source notice. VPS state is not currently a Pinia store.
- VPS keeps the last successful dashboard/process snapshot in page refs, tracks freshness, expanded table rows and pagination locally, and cleans up polling on unmount.
- Auth uses Nuxt Auth Utils session state. Do not duplicate saved credentials into a Pinia store.
- No application state is persisted to localStorage by project code. Theme behavior is provided by Nuxt UI's color-mode integration.

## Settings and client isolation

`normalizeBaseUrl` trims input, requires HTTP(S), rejects embedded credentials, query strings and fragments, and strips trailing slashes. `createServiceClients` creates independent ofetch clients for nonempty URLs and `null` for empty URLs. Tests verify isolation. The pages do not currently consume these clients for real external service calls.

For VPS, Connection shows host-local collector instructions instead of an editable URL; saving its config forces `baseUrl` to an empty string. Prometheus configuration is private server runtime config. It is not a browser-selected target.

Service modes are `''`, `coming-soon`, `maintenance`, or `shutdown`. Settings cards show their chosen label; Shutdown requires a checkbox before Save. These are presentation flags only. There is no service execution/control endpoint or route lock tied to them.

## VPS data flow

1. The browser loads `/api/vps/dashboard` with a 20-second timeout and no ofetch retry. AJV validates the result against dashboard schema 1.4.
2. On Linux the handler queries loopback Prometheus, enriches systemd details, validates the output and returns it. Failed collection/validation returns 503. On other OSes it returns 501; only that status activates the static demo fixture path.
3. Dashboard refresh waits 10 seconds after the prior request completes. It retains the last good snapshot with explicit failure/staleness feedback. A sample age of at least 60 seconds is stale; collection time and exporter sample time have different meanings.
4. A separate process poll calls `/api/vps/processes`. It samples Linux `/proc`, validates the response in the browser, and retains a labeled previous snapshot on failure. On non-Linux demo mode it uses the fixture's process records.
5. Process display filters out stopped/zombie entries, sorts by host-normalized CPU descending with nulls last and paginates 10 rows locally. No server-side pagination exists.
6. Both polling loops and the freshness timer stop when the VPS page unmounts. Requests do not overlap within each polling loop. The dashboard and process endpoints are independent and are not one atomic snapshot.

See the [VPS contract](vps-response-contract.md) for exact metrics, semantics, thresholds, endpoint errors and payloads.

## Extending a service

Keep each service's backend/client/state separate. Define its contract and trust boundary before making live calls. Use standard Nuxt directories and installed tooling. For code needed by client and server, prefer `shared/`; keep secrets, database access and OS commands in `server/`.

A blank Base URL is not a universal “connect local” implementation for all services. VPS is explicitly wired to same-origin APIs. Timeshit Connection/PAT, repository and history reads use same-origin server APIs; all-branch activity endpoints are implemented, while client collection controls and daily digest/copy are implemented; heatmap is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md). Other services need agreed contracts first.

Follow the [development change recipes](development.md), [design rules](../DESIGN.md) and [current boundaries](README.md#known-implementation-boundaries).

## Timeshit Connection/PAT

`server/api/timeshit/connection.{get,post,delete}.ts` guard each method independently. Repository discovery, tracked-selection and branch/commit/detail handlers under `server/api/timeshit/` also enforce the JCore session. `server/utils/timeshit-*` own fixed-origin GitHub reads, validated repository access, authenticated crypto and private SQLite. `shared/types/timeshit.ts` and `shared/utils/timeshit-*-contract.ts` define and validate public response envelopes. `app/utils/timeshit-client.ts` is the same-origin client; `app/stores/timeshit-history.ts` owns ephemeral browsing state. Settings keeps entered tokens local while `app/stores/timeshit.ts` stores only public connection status. See the [connection](timeshit-connection-contract.md), [repository](timeshit-repositories-contract.md) and [history](timeshit-history-contract.md) contracts.

`shared/types/timeshit-activity.ts` and `shared/utils/timeshit-activity*.ts` implement the activity contract foundation: date ranges, author-date filtering, deduplication, daily unknown/zero semantics and runtime validation. The [activity contract](timeshit-activity-contract.md) defines implemented process-local collection checkpoints and guarded start/continue handlers. One active in-memory job holds captured heads, bounded items and coverage; the PAT is decrypted only within requests. The same-origin client and `app/stores/timeshit-activity.ts` implement non-persistent collection state, sequential continuation, cooldowns, pause/visibility and private-state cleanup. Visible collection controls and daily digest/copy are implemented; heatmap is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md). SQLite remains schema v3 and does not store activity.

History default branch preferences, calendar controls and full-width Timeshit layout are documented in the [preference contract](timeshit-preferences-contract.md).
