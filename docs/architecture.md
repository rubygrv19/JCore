# Architecture and existing behavior

This document describes current source. The [Timeshit plan](timeshit-implementation-plan.md) describes future work separately.

## Runtime model

JCore runs as a Nuxt 4 application with a Nitro Node server. Authentication, private server APIs and host-local collectors require a running server; a static export is not a functional deployment for this product.

```text
Browser
  Login -> Nuxt auth API -> sealed session cookie
  Protected pages -> global route middleware
  VPS page -> same-origin /api/vps/dashboard -> loopback Prometheus
                                           -> Node Exporter -> Linux metrics
           -> same-origin /api/vps/processes -> Linux /proc
  Settings -> Pinia memory (no persistent backend)

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
| `app/stores/services.ts` | Service configuration shared through Pinia |
| `app/utils/` | Service clients, response validation, formatting and polling |
| `app/types/` | Existing client and VPS contract types |
| `app/components/*.client.vue` | Client-rendered Chart.js wrappers |
| `server/api/` | Nitro endpoints and private API guards |
| `server/utils/` | Credential checks, login limiter, Prometheus/procfs/systemd collectors |
| `shared/types/auth.d.ts` | Session user typing shared with Nuxt Auth Utils |
| `public/mock/` | Public illustrative fixture; never put credentials or real private telemetry here |
| `docs/*.schema.json` | AJV runtime schemas imported by validators |
| `test/unit/` / `test/nuxt/` | Node logic tests and Nuxt-aware tests |
| `ops/vps/` | Compose stack, scrape/alert rules, Ubuntu runbook |
| `scripts/start-local.mjs` | Loopback-only production start wrapper |

`shared/` is a Nuxt-standard location for code needed by both app and server. Existing VPS types/validators still live under `app/` and are also imported by server collectors/handlers via `~`. This is an existing coupling, not a completed shared-contract migration. New shared contracts should live in `shared/`; migrate existing imports together if that cleanup is requested.

## Routes

| Route | Page | Access and content |
| --- | --- | --- |
| `/login` | `app/pages/login.vue` | Public sign-in, no default dashboard layout |
| `/` | `app/pages/index.vue` | Authenticated Coming Soon Dashboard |
| `/settings` | `app/pages/settings.vue` | Authenticated configuration cards and modal |
| `/services/vps` | `app/pages/services/vps.vue` | Authenticated VPS monitoring |
| `/services/timeshit` | `app/pages/services/[service].vue` | Authenticated Coming Soon |
| `/services/code-review` | Same dynamic page | Authenticated Coming Soon |
| `/services/quota-tracker` | Same dynamic page | Authenticated Coming Soon |
| `/services/<unknown>` | Same dynamic page | Rejected with 404 |

Nuxt resolves the explicit VPS page before the dynamic service page. Navigation uses pathname routes, not legacy hash navigation. The sidebar exposes Dashboard and Settings without children and one Services group with one child level. Mobile link selection closes navigation below 1024px; desktop selection keeps it open.

## Authentication

`POST /api/auth/login` uses server environment credentials, validates the payload, applies a process-wide attempt budget, compares credentials and calls `setUserSession`. `useUserSession()` supplies session state to login, middleware and the dashboard layout. Signing out calls its `clear()` method. The current login page does not automatically redirect an already signed-in visitor merely because they opened `/login`.

Every current VPS API handler calls `requireUserSession(event)` independently of the page guard. Framework session routes come from Nuxt Auth Utils; they are not custom application endpoints. See [security and configuration](security-and-configuration.md) for exact behavior and limits.

## State ownership

- Pinia owns only shared service configuration currently. Config entries are independent for `vps`, `timeshit`, `code-review`, and `quota-tracker`.
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

A blank Base URL is not a universal “connect local” implementation for all services. VPS is explicitly wired to same-origin APIs. Timeshit's approved default is same-origin server APIs but remains unimplemented; other services need agreed contracts first.

Follow the [development change recipes](development.md), [design rules](../DESIGN.md) and [current boundaries](README.md#known-implementation-boundaries).
