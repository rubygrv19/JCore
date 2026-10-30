# Security and runtime configuration

This describes the existing implementation, not a security certification. See the [Timeshit connection contract](timeshit-connection-contract.md) for PAT/database controls, setup and recovery, the [repository contract](timeshit-repositories-contract.md) for persisted selection, and the [history contract](timeshit-history-contract.md) for guarded read-only GitHub browsing. All-branch collection, daily digest/copy and heatmap are implemented. Current rendered/live evidence and remaining release checks are in the [verification report](timeshit-verification-report.md); repeatable isolated checks are in the [acceptance runbook](timeshit-acceptance.md).

## Environment variables

All current application runtime variables below are private server configuration. Do not move them under `runtimeConfig.public`.

| Variable | Default / requirements | Consumer |
| --- | --- | --- |
| `NUXT_AUTH_ADMIN_EMAIL` | Empty; must be a valid email | Login credential verification |
| `NUXT_AUTH_ADMIN_PASSWORD` | Empty; 15 to 1024 characters | Login credential verification |
| `NUXT_AUTH_TRUSTED_ORIGIN` | Exact HTTP(S) application origin without a trailing slash; defaults to `http://127.0.0.1:3000` in development and empty in production | Required login Origin policy; missing/invalid production configuration returns 503 |
| `NUXT_AUTH_TRUSTED_PROXY_IPS` | Empty by default; optional comma-separated exact TCP proxy peer IPs | Login client address resolution; forwarded IP headers are ignored unless the actual peer is explicitly trusted |
| `NUXT_SESSION_PASSWORD` | Empty source default; supply a stable unique secret of at least 32 characters | Nuxt Auth Utils sealing/unsealing; login configuration check |
| `NUXT_VPS_PROMETHEUS_URL` | `http://127.0.0.1:9090` | Server dashboard collector |
| `NUXT_VPS_EXPECTED_SERVICES` | `{}`; JSON map of actual `.service` names to `active` or `inactive` | systemd state evaluation |
| `NITRO_PORT` | Node server runtime port, if overridden | Built Nitro server; verify the actual listening port |

`pnpm dev` binds to `127.0.0.1`. `pnpm start` explicitly sets `NITRO_HOST=127.0.0.1`, overriding a caller's host setting. Do not assume `pnpm preview` has that custom restriction.

Nuxt development tooling reads the ignored `.env`. For the built server, inject variables with the service manager or runtime environment. Changing private collector/auth settings requires restarting the running Node server; Settings is not their configuration interface.

Use `.env.example` for variable names and empty placeholders only. Do not print or commit real secrets, private token responses or user telemetry. Keep secret files readable only by the application account and the operator who needs them. Timeshit private variables are NUXT_TIMESHIT_ENCRYPTION_KEY, NUXT_TIMESHIT_TRUSTED_ORIGIN and optional NUXT_TIMESHIT_DATABASE_PATH; use the connection runbook for generation, backup and recovery.

## Login flow

1. Login posts JSON with `email` and `password` to `/api/auth/login`.
2. The handler resolves the client address and consumes a per-client budget before checking credentials or reading the body. It admits 10 attempts per client per 60-second fixed window and at most 100 admitted attempts globally per process per 60-second fixed window. Denied per-client attempts do not consume the global budget or extend the cooldown. Denial returns 429 with a positive integer `Retry-After`; when both budgets are exhausted it reports the longer cooldown. Oversized/unread-body reuse is avoided on Node throttling responses with `Connection: close`. Successful and invalid attempts both count; success does not reset the budget.
3. Incomplete/invalid server credentials, a short session secret, or an invalid/missing trusted Origin configuration return 503. The login request must carry the exact configured Origin and must not declare `Sec-Fetch-Site: cross-site`; otherwise it returns 403. The handler ignores Host and forwarded headers when deciding trust. Uncompressed `application/json` is required (optional parameters such as `charset=utf-8` are accepted); unsupported Content-Type or Content-Encoding returns 415. Malformed/empty JSON returns 400; valid JSON with invalid credentials returns 401 with a generic error.
4. Submitted email is trimmed and lowercased; email comparison is case-insensitive. Password comparison is exact. Submitted emails over 254 characters and passwords over 1024 characters are rejected. A shared streaming reader limits the login body to 8192 bytes before JSON parsing. Oversized Content-Length is rejected before buffering, and actual chunk bytes are checked even without or with an understated length. Overflow returns 413; an invalid length or interrupted body returns 400. The limit is in bytes, not characters. The Node path stops retaining chunks, drains the remaining request after streamed overflow, and marks oversized responses with `Connection: close` to prevent reuse with an unread body; the Web path cancels its reader on streamed overflow. This is a memory bound, not a replacement for proxy/server connection and upload-timeout limits.
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

Login now enforces an explicit Origin and JSON body policy. Set `NUXT_AUTH_TRUSTED_ORIGIN` to the external browser origin (for example, `https://jcore.rubygrv.cloud`) even when the reverse proxy forwards to loopback HTTP. Configure the proxy to preserve Origin. Non-browser acceptance clients must supply the same Origin header. Opening a development server through `localhost`, another port, or another hostname requires an explicit matching setting and restart. Timeshit retains its independent `NUXT_TIMESHIT_TRUSTED_ORIGIN` policy and 4096-byte mutation bound; both services reuse the bounded stream reader. Origin checking supplements authentication; non-browser callers can set Origin themselves.

## Network and cache boundaries

- Prometheus and Node Exporter bind to loopback. The app validates that its Prometheus URL uses HTTP(S), a loopback hostname (`127.0.0.1`, `localhost`, or `[::1]`), no credentials, and no query/fragment.
- The collector constructs `/api/v1/...` paths from that origin. A path prefix is not an implemented reverse-proxy prefix configuration.
- The browser never calls Prometheus directly. The Settings Base URL cannot redirect the VPS collector to an arbitrary host.
- Future browser calls to external service APIs need CORS and their own agreed authentication contract. CORS is not authentication.
- The private `/api/vps/dashboard` and `/api/vps/processes` handlers set `Cache-Control: private, no-store` before session checks, so success and error responses carry the policy. Configure reverse proxies/CDNs to bypass caching authenticated pages, auth/session routes and telemetry APIs as defense in depth; actual proxy behavior still needs host verification.
- The bundled `/mock/vps-dashboard.json` is a public static development fixture. It must contain illustrative data only; session middleware does not make `public/` files private.
- Login counters remain process-local and reset on restart. Multiple workers have independent budgets; a shared store is required before claiming a shared multi-instance limit. A distributed source can still exhaust the global safeguard; this limiter is not a guarantee against denial of service.

## Login client identity and recommended proxy topology

The recommended deployment is an existing HTTPS Nginx reverse proxy forwarding to Nuxt on `127.0.0.1:3000`. This is an operator recommendation; the repository does not establish that the current VPS uses Nginx or that its configuration is correct.

Default behavior uses only the TCP socket peer. `X-Real-IP`, `X-Forwarded-For`, `Forwarded`, and adapter `context.clientAddress` cannot choose a limiter key. IPv6 spellings are canonicalized; IPv4-mapped IPv6 and IPv4 share a key. A missing/invalid transport address uses a single `unknown` budget instead of accepting arbitrary caller metadata.

For the recommended one-hop proxy, set `NUXT_AUTH_TRUSTED_PROXY_IPS=127.0.0.1` only after inspecting the existing proxy and network access policy. The setting accepts exact IP addresses only, not wildcards, hostnames, CIDRs, arrays, or a chain of proxies. An invalid configuration returns 503. When the actual TCP peer matches this list, the handler requires a single valid `X-Real-IP`; a missing, duplicated, chained, or invalid header returns 503. All other forwarding address headers remain ignored. A trusted proxy must overwrite the header with its transport-derived client IP, never copy the caller's value.

The Nginx fragment below illustrates the expected headers inside an existing HTTPS server block. Review and integrate it with the actual configuration; it is not a complete TLS, service, or deployment configuration and has not been applied to the VPS.

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin $http_origin;
}
```

Keep Nuxt inaccessible from public interfaces. Inspect any existing Nginx real-IP module settings before relying on `$remote_addr`; broad trust in another upstream can undermine this boundary. CDN/load-balancer chains require a separate reviewed policy. Processes on the same trusted host can reach loopback and are part of that trust boundary. Do not enable proxy trust for ordinary direct local development; leave the setting empty.

The client map retains at most 128 live entries, cleans expired entries on subsequent attempts, and never evicts a live budget to admit another client. At capacity, new clients receive 429 until the earliest retained entry expires; known clients retain their budgets. Monotonic `performance.now()` drives the windows, so wall-clock changes do not reset them. There are no background cleanup timers, persistent IP records, or added IP logs. NAT/shared egress clients share an IP budget; changing source addresses can still reach the global safeguard. Proxy/server connection, request-size, and timeout protections remain required independently.

## OS collection and disclosure

Run Nuxt as an unprivileged service account. Current collectors issue read-only `systemctl`, `ss` and `getconf` commands using `execFile` with argument arrays. They do not require application sudo, run arbitrary user commands, or control service state.

Process command lines can contain credentials. The collector retains a safe executable display value and replaces every additional argument with `[ARGUMENTS REDACTED]`; unsafe executable strings become `[EXECUTABLE REDACTED]`. The returned display is not a runnable command. Do not reintroduce raw command lines through logs, fixture generation or error responses.

Hostnames, process names, users, paths, unit descriptions and port metadata are still operationally sensitive. Authentication and private collector binding remain necessary even though arguments are redacted. OS descriptions are external source content; preserve them rather than claiming a guaranteed translation.

## Operator checks

Before remote exposure, verify HTTPS/session cookies, unauthenticated API rejection, proxy cache bypass, collector loopback listeners, service-account permissions, login throttling, correct `NUXT_AUTH_TRUSTED_ORIGIN`, oversized/chunked body rejection, and sanitized errors. Record evidence in the [Ubuntu checklist](../ops/vps/VERIFY.md). Do not change existing proxy, firewall, SSH or sudo configuration as an incidental UI task.

## Sources

See [authentication/runtime references](references.md#authentication-runtime-and-validation) for Nuxt runtime config, Nuxt Auth Utils and Node crypto. Project behavior is defined by `nuxt.config.ts`, `server/api/auth/login.post.ts`, `server/utils/admin-auth.ts`, `server/utils/login-rate-limit.ts`, `app/middleware/auth.global.ts` and the login page.

## Timeshit activity capabilities

The activity continuation is an opaque capability for an authenticated process-local job. The client sends it only in a private same-origin JSON POST body and retains it in non-persistent Pinia state. Never put it in URLs, browser storage, logs or screenshots. Session/connection/selection changes clear client snapshots and invalidate late responses; server guards still independently enforce authentication and scope. See the [activity contract](timeshit-activity-contract.md).

Timeshit history preferences use a private session-guarded GET/PUT endpoint and SQLite v3 singleton. They contain no credentials and persist independently of PAT identity. See the [preference contract](timeshit-preferences-contract.md) for mutation-origin checks and migration behavior.
