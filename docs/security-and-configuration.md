# Security and runtime configuration

This describes the existing implementation, not a security certification. See the [Timeshit connection contract](timeshit-connection-contract.md) for PAT/database controls, setup and recovery, the [repository contract](timeshit-repositories-contract.md) for persisted selection, and the [history contract](timeshit-history-contract.md) for guarded read-only GitHub browsing. All-branch collection, daily digest/copy and heatmap are implemented. Current rendered/live evidence and remaining release checks are in the [verification report](timeshit-verification-report.md); repeatable isolated checks are in the [acceptance runbook](timeshit-acceptance.md).

## Environment variables

All current application runtime variables below are private server configuration. Do not move them under `runtimeConfig.public`.

| Variable | Default / requirements | Consumer |
| --- | --- | --- |
| `NUXT_AUTH_ADMIN_EMAIL` | Empty; must be a valid email | Login credential verification |
| `NUXT_AUTH_ADMIN_PASSWORD` | Empty; 15 to 1024 characters | Login credential verification |
| `NUXT_SESSION_PASSWORD` | Supply a stable unique secret of at least 32 characters | Nuxt Auth Utils sealing/unsealing; login configuration check |
| `NUXT_VPS_PROMETHEUS_URL` | `http://127.0.0.1:9090` | Server dashboard collector |
| `NUXT_VPS_EXPECTED_SERVICES` | `{}`; JSON map of actual `.service` names to `active` or `inactive` | systemd state evaluation |
| `NITRO_PORT` | Node server runtime port, if overridden | Built Nitro server; verify the actual listening port |

`pnpm dev` binds to `127.0.0.1`. `pnpm start` explicitly sets `NITRO_HOST=127.0.0.1`, overriding a caller's host setting. Do not assume `pnpm preview` has that custom restriction.

Nuxt development tooling reads the ignored `.env`. For the built server, inject variables with the service manager or runtime environment. Changing private collector/auth settings requires restarting the running Node server; Settings is not their configuration interface.

Use `.env.example` for variable names and empty placeholders only. Do not print or commit real secrets, private token responses or user telemetry. Keep secret files readable only by the application account and the operator who needs them. Timeshit private variables are NUXT_TIMESHIT_ENCRYPTION_KEY, NUXT_TIMESHIT_TRUSTED_ORIGIN and optional NUXT_TIMESHIT_DATABASE_PATH; use the connection runbook for generation, backup and recovery.

## Login flow

1. Login posts JSON with `email` and `password` to `/api/auth/login`.
2. The handler consumes one attempt from a process-wide one-minute budget before checking configuration or credentials. Ten attempts are admitted; the next gets 429 plus `Retry-After` until reset.
3. Incomplete/invalid server credentials or a short session secret return 503. Payload/credential mismatch returns 401 with a generic error.
4. Submitted email is trimmed and lowercased; email comparison is case-insensitive. Password comparison is exact. Submitted emails over 254 characters and passwords over 1024 characters are rejected.
5. The server compares values using `timingSafeEqual` over comparable buffers and calls `setUserSession` with the normalized administrator email on success. The response body is `{ "ok": true }`.
6. The browser refreshes session state, clears the password draft and navigates to the requested local route. Login rejects redirect values that are not local absolute paths or begin with `//` or `/\`.

The password currently comes from private environment configuration and is compared directly; this is not a database-backed password-hash store. There is no registration, reset-email flow, OAuth login or multi-user account management.

## Session and route protection

| Setting | Development | Production |
| --- | --- | --- |
| Cookie name | `jcore-session` | `__Host-jcore-session` |
| HttpOnly | true | true |
| Secure | false | true |
| SameSite | lax | lax |
| Path | `/` | `/` |

Production behavior is selected by `NODE_ENV`. Use HTTPS at the reverse proxy so the browser can send the Secure production cookie. Keep the session secret stable across restarts; changing it invalidates cookies sealed with the previous value. Do not rely on an automatically generated development secret for production.

The app does not explicitly configure session maxAge, a session database or global revocation. Changing the administrator password alone is not an implemented mechanism to revoke existing cookies; rotate the session secret when global invalidation is required. Confirm module defaults against the installed `nuxt-auth-utils` release before designing a lifetime policy.

The global route middleware checks every route except `/login`. Private VPS API handlers call `requireUserSession(event)` before checking platform or collecting host data. A page redirect alone never protects API data.

The current login route has no custom origin/CSRF check beyond the framework/browser behavior and configured cookie policy. Timeshit credential mutations separately enforce configured trusted Origin and JSON body limits; this does not change the login endpoint policy.

## Network and cache boundaries

- Prometheus and Node Exporter bind to loopback. The app validates that its Prometheus URL uses HTTP(S), a loopback hostname (`127.0.0.1`, `localhost`, or `[::1]`), no credentials, and no query/fragment.
- The collector constructs `/api/v1/...` paths from that origin. A path prefix is not an implemented reverse-proxy prefix configuration.
- The browser never calls Prometheus directly. The Settings Base URL cannot redirect the VPS collector to an arbitrary host.
- Future browser calls to external service APIs need CORS and their own agreed authentication contract. CORS is not authentication.
- Current private VPS handlers do not explicitly set `Cache-Control: no-store`. Configure reverse proxies/CDNs to bypass caching authenticated pages, auth/session routes and telemetry APIs. Add application headers if a stricter cache policy is implemented later.
- The bundled `/mock/vps-dashboard.json` is a public static development fixture. It must contain illustrative data only; session middleware does not make `public/` files private.
- The in-memory login limiter does not use client forwarding headers and is shared across all callers in one process. Restarts reset it; multiple workers have separate budgets. A trusted proxy/shared limiter is required for a shared multi-instance policy.

## OS collection and disclosure

Run Nuxt as an unprivileged service account. Current collectors issue read-only `systemctl`, `ss` and `getconf` commands using `execFile` with argument arrays. They do not require application sudo, run arbitrary user commands, or control service state.

Process command lines can contain credentials. The collector retains a safe executable display value and replaces every additional argument with `[ARGUMENTS REDACTED]`; unsafe executable strings become `[EXECUTABLE REDACTED]`. The returned display is not a runnable command. Do not reintroduce raw command lines through logs, fixture generation or error responses.

Hostnames, process names, users, paths, unit descriptions and port metadata are still operationally sensitive. Authentication and private collector binding remain necessary even though arguments are redacted. OS descriptions are external source content; preserve them rather than claiming a guaranteed translation.

## Operator checks

Before remote exposure, verify HTTPS/session cookies, unauthenticated API rejection, proxy cache bypass, collector loopback listeners, service-account permissions, login throttling and sanitized errors. Record evidence in the [Ubuntu checklist](../ops/vps/VERIFY.md). Do not change existing proxy, firewall, SSH or sudo configuration as an incidental UI task.

## Sources

See [authentication/runtime references](references.md#authentication-runtime-and-validation) for Nuxt runtime config, Nuxt Auth Utils and Node crypto. Project behavior is defined by `nuxt.config.ts`, `server/api/auth/login.post.ts`, `server/utils/admin-auth.ts`, `server/utils/login-rate-limit.ts`, `app/middleware/auth.global.ts` and the login page.

## Timeshit activity capabilities

The activity continuation is an opaque capability for an authenticated process-local job. The client sends it only in a private same-origin JSON POST body and retains it in non-persistent Pinia state. Never put it in URLs, browser storage, logs or screenshots. Session/connection/selection changes clear client snapshots and invalidate late responses; server guards still independently enforce authentication and scope. See the [activity contract](timeshit-activity-contract.md).

Timeshit history preferences use a private session-guarded GET/PUT endpoint and SQLite v3 singleton. They contain no credentials and persist independently of PAT identity. See the [preference contract](timeshit-preferences-contract.md) for mutation-origin checks and migration behavior.
