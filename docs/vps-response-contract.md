# VPS dashboard response contract

Example response: [`public/mock/vps-dashboard.json`](../public/mock/vps-dashboard.json). The language-neutral [JSON Schema](./vps-dashboard.schema.json) is the machine-validated shape for this response. The live snapshot endpoint is `GET /api/vps/dashboard`; on Linux, Nuxt reads local Prometheus over loopback. Prometheus reads host metrics from Node Exporter. On non-Linux development systems this endpoint returns HTTP 501 and the UI uses the validated demo fixture.

## Conventions

- `schemaVersion` identifies the response shape. `dataMode` is `mock` for the bundled fixture and `live` for real VPS telemetry.
- `collectedAt` is the response collection time. `source.sampledAt` is the oldest available sample timestamp among the required exporter metric families; use it for freshness, not response time. All dates use ISO 8601 UTC. Resource history is in `history.samples`; `range` and `stepSeconds` describe its window and sample interval.
- `source.status` is `complete`, `partial`, `stale` (samples at least 60 seconds old), or `unavailable` (exporter scrape failed). `missingMetrics` identifies missing required sources. `systemdDetailsAvailable` indicates whether systemctl inspection succeeded; individual PID/path/port fields can still be unavailable.
- Byte capacities and counters use bytes; rates use bytes per second; percentages are numbers from 0 to 100; uptime and durations use seconds.
- `null` means unavailable or not configured. It must not be converted to zero. Empty arrays mean the collector returned no entries.
- Human-readable API content, including `health.reasons` and service/process `description` values, must be provided in English. Machine-readable field names, enum values, and service names remain unchanged.
- The backend returns `status` fields for the overall host and every resource, filesystem, interface, and service. Allowed values are `healthy`, `warning`, `critical`, and `unknown`. The monochrome UI distinguishes them through text and icons.
- `health.reasons` explains the overall status. `alerts[]` carries the current alert list.
- `alerts[]` contains current Prometheus pending or firing alerts. It is not a historical event log and does not send notifications. `activeAt` is UTC; `value` can be `null` when the alert source does not report one.

## Agreed initial thresholds

Thresholds are sustained for 300 seconds before the backend reports the corresponding state, allowing brief spikes to settle.

Pending alerts remain visible but do not raise resource or host severity. Only firing alerts do. Collector failure and direct systemd state mismatches are reported immediately. Missing required metrics or stale samples cannot produce a Healthy host status; known firing alerts may still produce Warning/Critical during partial collection.

| Signal | Warning | Critical |
| --- | --- | --- |
| CPU usage | `>= 80%` | `>= 90%` |
| Memory available | `< 20%` | `< 10%` |
| Filesystem used | `>= 80%` | `>= 90%` |

Memory availability should follow the host's available-memory metric, not simply `MemFree`; Linux's `MemAvailable` estimates memory available to new applications without swapping. The filesystem status is the worst status among monitored mounts.

Network throughput alone does not indicate a problem. Until an interface capacity or another network policy is configured, its status is `unknown`; still return RX/TX rates and error/drop rates when available. A unit's status must compare `actualState` with `expectedState`, so an intentionally inactive unit is not automatically unhealthy.

Each `current.services.units[]` item includes `description`, `ports` (`port` plus `tcp`/`udp` protocol), `pid`, `uptimeSeconds`, `path`, and `commandLine`. Live details come from read-only `systemctl show`, `/proc/<MainPID>`, and `ss`. Ports include only visible listening TCP/UDP sockets owned by MainPID, not a guarantee of every worker/socket-activated port. Missing socket ownership is `null`, never an invented empty list. Other unavailable details are also `null`.

Set `NUXT_VPS_EXPECTED_SERVICES` to a JSON map of actual unit names to `active` or `inactive`. Empty configuration leaves expected states Unknown. Do not infer expected state from enabled/disabled: oneshot and socket-activated units may intentionally be inactive. A failed unit is Critical even without an expectation. If systemctl cannot be queried, Prometheus unit states remain available and the source is labeled partial.

Command arguments are intentionally hidden wholesale as `[ARGUMENTS REDACTED]`, including unnamed arguments, headers, spaced passwords, URLs, and unknown flags. This is a sanitized display value, not a command to copy and execute. An inactive unit has no live MainPID command line. Process descriptions remain `null` because procfs provides no reliable human-readable description.

`current.processes.items[]` is the process list shown separately from systemd units. Each item includes `name`, `pid`, `state` (`running`, `sleeping`, `stopped`, `zombie`, or `unknown`), `user`, `cpuPercentOfHost`, `memoryPercent`, `description`, `location`, `startedAt`, and `commandLine`. `cpuPercentOfHost` is the process share of total host CPU capacity, normalized to 0–100%; `memoryPercent` is the process share of total host memory. Unavailable values are `null`; `startedAt` uses ISO 8601 UTC. Command lines can contain secrets and must be redacted by the collector before returning them. Process records in the bundled fixture are illustrative mock values, not live telemetry. The UI shows `running`, `sleeping`, and `unknown` states; stopped and zombie records are omitted. The process table sorts by CPU usage and paginates locally at 10 rows per page.

The browser validates both the dashboard response and the process snapshot against their JSON Schemas before rendering them. Invalid payloads produce the VPS data error state. On Linux, `GET /api/vps/dashboard` reads metrics from the local Prometheus HTTP API through the Nuxt server and refreshes every 10 seconds. It requests a 60-minute trend window; Prometheus stores time-series data in a named Docker volume using its configured retention. The live snapshot includes host metrics, filesystem/network details, systemd unit states, and current pending/firing alerts. The separate process list uses `GET /api/vps/processes` on Linux and refreshes every 10 seconds. On non-Linux development hosts, live endpoints respond with HTTP 501 and the UI keeps the bundled fixture labeled as demo data. The Prometheus endpoint is server-only and must remain bound to loopback unless a separately reviewed access policy is added.

Schema version `1.1` added `current.processes`; version `1.2` clarifies host-normalized process CPU usage; version `1.3` adds in-dashboard alert records and an unknown expected systemd state. Version `1.4` requires source availability/freshness metadata and distinguishes pending from firing severity. The UI displays process rows in descending `cpuPercentOfHost` order; records with unavailable CPU values appear last. Pagination is retained during refresh and clamped when the result set shrinks.

The client retries after failures, retains a labeled last good dashboard/process snapshot, and cancels polling on navigation. Polling waits 10 seconds after each completed request, avoiding overlapping requests. First-load failures show an explicit retry action. No live source failure is replaced with fabricated live values; demo fallback is only for the non-Linux 501 response.

Additional examples in [vps-response-examples.json](./vps-response-examples.json) contains named, complete mock responses for pending/firing, partial, stale, or empty states. Each named object is a standalone API response; empty history is intentional in these scenario examples. These examples are validated in tests.

## Mock versus live

Every value in the bundled JSON, including service descriptions, ports, process IDs, paths, and command lines, is illustrative and marked `dataMode: "mock"`. The UI must keep that label visible. Live resource history comes from Prometheus range queries. A current snapshot alone is not enough for real graphs.
