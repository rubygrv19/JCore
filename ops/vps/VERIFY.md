# Ubuntu operations and release verification

This runbook targets one Linux host running JCore's Nuxt Node server and loopback Prometheus/Node Exporter. It is a checklist to execute on the real host, not evidence that deployment has already passed. macOS/Windows fixtures and mocked integration tests cannot verify Linux collectors.

## Deployment assumptions

- Run Nuxt directly on the monitored host as a dedicated unprivileged application user. A container has different process visibility unless host namespaces/mounts are deliberately configured.
- Set `NUXT_AUTH_TRUSTED_ORIGIN` to the exact external HTTPS application origin, without a trailing slash. Preserve Origin through the proxy; login now fails closed when this production setting is missing.
- For a verified one-hop Nginx proxy to `127.0.0.1`, review [login proxy trust](../../docs/security-and-configuration.md#login-client-identity-and-recommended-proxy-topology), overwrite `X-Real-IP`, restrict direct Nuxt access, then set `NUXT_AUTH_TRUSTED_PROXY_IPS=127.0.0.1`. Leave it empty for direct local access. Verify separate clients are isolated and caller-supplied IP headers cannot bypass the limiter; do not assume the existing VPS proxy has this configuration.
- Install the Node/pnpm versions agreed for the project (current CI baseline: Node 22, package manager pinned in `package.json`). Use the lockfile.
- Docker Engine with Compose is needed for the checked-in collectors. This Compose setup uses Linux host networking, host PID visibility, `/proc`, `/sys` and the system D-Bus socket; Docker Desktop on macOS is not equivalent host monitoring.
- Existing HTTPS proxy, DNS, service manager, firewall and access policy must be inspected and configured for the real environment. The repo does not supply a JCore systemd unit, reverse-proxy configuration, TLS provisioning, deployment script or an automatically configured domain.
- Keep Prometheus, Node Exporter and Nuxt private on loopback. Do not grant blanket sudo to the web application.
- Verify authenticated and unauthenticated `/api/vps/dashboard` and `/api/vps/processes` responses include `Cache-Control: private, no-store`; confirm the reverse proxy/CDN does not cache these private routes.

## Collector configuration

| File / setting | Existing value / purpose |
| --- | --- |
| `compose.yaml` Prometheus image | `prom/prometheus:v3.14.0` |
| `compose.yaml` Node Exporter image | `quay.io/prometheus/node-exporter:v1.12.1` |
| Prometheus listener | `127.0.0.1:9090`, host network |
| Node Exporter listener | `127.0.0.1:9100`, host network; systemd collector enabled |
| `prometheus.yml` | 15-second scrape/evaluation interval; one `node-exporter` target |
| `vps.rules.yml` | CPU/memory/filesystem recording rules and pending/firing alerts |
| Prometheus storage | Named `prometheus-data` volume mounted at `/prometheus` |
| Retention | No explicit retention override in Compose; upstream defaults apply |

Do not add a second target to the existing single-host collector without revisiting PromQL selectors, series joins and response aggregation. Images are tagged in source, not pinned by digest; review intentional updates rather than silently pulling a new architecture into the deployment.

## Prepare and start

From the repository root, build on Ubuntu:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

A macOS `.output` contains platform-specific image binaries and must not be copied to Ubuntu. Use a fresh Linux build and keep the verified prior release available for rollback.

Configure the private variables in [security and configuration](../../docs/security-and-configuration.md) through the service manager or deployment environment. Production Node startup does not automatically load `.env`. Set a stable session secret and real administrator credentials; never log their values.

Validate and start collectors:

```bash
docker compose -f ops/vps/compose.yaml config --quiet
docker compose -f ops/vps/compose.yaml up -d
docker compose -f ops/vps/compose.yaml ps
```

If the application user lacks Docker control, the operator should run deployment commands through their approved access. Docker group membership is not a requirement for Nuxt telemetry and is not a substitute for least privilege.

Start the built application with runtime variables supplied:

```bash
pnpm start
```

`pnpm start` forces the Nuxt listener to `127.0.0.1`. Arrange persistence/restarts through the host's actual service manager; this command alone does not install a daemon. Confirm the actual listening port and point the existing HTTPS reverse proxy at it. Production cookies are Secure, so direct browser HTTP to the built production app is not the intended sign-in path.

## Verify collectors and host permissions

```bash
ss -ltn
curl --fail http://127.0.0.1:9090/api/v1/targets
curl --fail http://127.0.0.1:9100/metrics
docker compose -f ops/vps/compose.yaml exec prometheus promtool check rules /etc/prometheus/vps.rules.yml
```

Ports 9090 and 9100 must bind only to loopback. The `node-exporter` target must be UP. Allow time for rate windows and history to accumulate. Do not paste the complete metrics response into public issues; it exposes host information.

As the application account, verify read access to:

- `/proc/stat`, `/proc/meminfo`, `/proc/uptime`, `/etc/os-release`.
- Readable process `stat`, `status`, `cmdline` and `exe` links for the PIDs that account can inspect.
- `systemctl list-units --all --type=service` and `systemctl show` for actual units.
- `ss -ltnup` socket ownership information and `getconf CLK_TCK`.

D-Bus restrictions, procfs `hidepid`, process exits and socket ownership restrictions may omit rows or fields. Do not run the app as root to make every field appear. Missing ownership is not proof of no listeners; ports only describe visible listeners owned by MainPID. The process endpoint does not yet report coverage metadata for omitted inaccessible processes.

## Configure expected services

Inspect the deployed unit names first. Recommended candidates are the actual JCore service, its actual reverse proxy, and `docker.service` if Docker hosts the collectors. This is a selection recommendation, not a claim that those names exist on the host.

Set `NUXT_VPS_EXPECTED_SERVICES` to a JSON map of actual names and states, for example `{"your-app.service":"active"}` with the placeholder replaced. Values are only `active` or `inactive`. Unlisted units remain Unknown; failed units are Critical even without an expectation. Enabled/installed units are not necessarily expected to stay active (oneshot/socket-activated units may be intentionally inactive).

Restart JCore after changing runtime environment configuration. Verify the UI's expected/actual state and status against `systemctl`.

## Release checklist

Record pass/fail/evidence for each item on the actual deployment:

1. Required application checks pass on Ubuntu with the lockfile. Record commit, Ubuntu version, Node/pnpm and collector image tags.
2. HTTPS sign-in succeeds. An unauthenticated `/api/vps/dashboard` and `/api/vps/processes` request returns 401 rather than telemetry. The fixture remains public and contains mock values only.
3. Session cookies have the production name, Secure, HttpOnly, SameSite=Lax and Path=/ attributes. Sign-out removes access. The proxy bypasses caching authenticated pages and APIs.
4. `/api/vps/dashboard` reports `dataMode: live`, schema 1.4 and believable collection/sample timestamps. Compare values with Prometheus and OS readings. CPU and I/O use five-minute rate windows; instantaneous `top` is not the same measurement.
5. Compare available memory with MemAvailable, filesystem use with space available to unprivileged users, and systemd/PID/state with `systemctl`.
6. `/api/vps/processes` has source `linux-procfs`. CPU requires two snapshots and is normalized to total host capacity. Compare start time with `ps -p <actual-pid> -o lstart=`. Verify nulls and sanitized commands when permissions restrict fields.
7. Pending alerts are visible without raising host/resource severity; firing alerts do. Verify explicit 5-minute CPU/memory/filesystem timing. Direct exporter-down/systemd mismatch detection is immediate in the response; matching Prometheus alerts have their own 1-minute pending interval.
8. On controlled staging, stop only the collector being tested, verify stale/unavailable/error feedback, restore it and verify recovery. Do not stop production services merely to exercise monitoring. Use promtool test rules or controlled staging load for timing checks.
9. Exercise process pagination through two refreshes; page is retained/clamped and CPU order remains valid. Expand service/process details. Navigate away/back and confirm polling stops while away.
10. Verify desktop/mobile, both themes, tooltips, contained table scrolling, keyboard actions and Settings draft behavior.
11. In an isolated test window, verify the 11th login attempt is limited with 429/Retry-After. This budget is shared by all callers in one Node process, resets on restart and needs a shared proxy policy for multiple instances.

## Troubleshooting

| Symptom | Inspect |
| --- | --- |
| Sign-in says not configured / 503 | Runtime credentials, password length and session secret; confirm service-manager injection without printing values |
| Login succeeds but session does not persist | HTTPS, production Secure cookie, stable session secret, correct origin/proxy cookie handling |
| Telemetry returns 401 | Valid session at the same origin; cookie delivery and login state |
| Telemetry returns 501 | Nuxt is not running on Linux; demo fallback is expected |
| Dashboard returns 503 | Prometheus reachability, valid loopback URL, expected-services JSON, query/alert responses and schema validation |
| Live source partial | `missingMetrics`, target UP, recording rules, enough samples for rate queries, systemctl permissions |
| Live source stale | Exporter sample age, scrape/evaluation state and host clock |
| No systemd details | D-Bus/systemctl permissions, loaded unit names, MainPID state and procfs access |
| No process CPU yet | Wait for a second successful sample; restarts/new/reused PIDs need a new baseline |
| Empty/missing process fields | procfs permissions and process exits; do not substitute invented values |
| Network status Unknown | Intentional: no capacity/health policy is configured |
| Short/empty history | Newly started Prometheus, recording rules or missing samples; a full hour has not necessarily accumulated |
| Values differ from `top`/`df` | Rate windows, host-normalized process CPU, MemAvailable and unprivileged filesystem availability semantics |

The API intentionally returns generic errors rather than raw internal details. Diagnose from private local tools without exposing secrets in logs or browser responses.

## Updating, retention and rollback

Before a release, preserve the prior verified app artifact/commit and private environment separately, build on Linux, run checks and record the change. Coordinate collector rule/image changes with the response contract and dashboard. Recheck health after restart.

Prometheus history persists in the named volume; do not delete it during a routine app update. A volume is not a backup. Define backup/retention policy from operational requirements using the [official storage documentation](https://prometheus.io/docs/prometheus/latest/storage/). No backup automation exists in this repository. Settings has no persistent database to back up today; Timeshit storage/keys will require separate procedures when implemented.

Rollback should restore the known-good app release and compatible runtime/collector configuration. Do not reset unrelated working changes or blindly remove Docker volumes. Preserve evidence of failures and verify restored sessions/telemetry. This document does not execute a deploy or authorize changes to the host.
