# VPS dashboard response contract

Example response: [`public/mock/vps-dashboard.json`](../public/mock/vps-dashboard.json). The language-neutral [JSON Schema](./vps-dashboard.schema.json) is the machine-validated shape for this response. The live snapshot endpoint is `GET /api/vps/dashboard`; on Linux, Nuxt reads local Prometheus over loopback. Prometheus reads host metrics from Node Exporter. On non-Linux development systems this endpoint returns HTTP 501 and the UI uses the validated demo fixture.

## Conventions

- `schemaVersion` identifies the response shape. `dataMode` is `mock` for the bundled fixture and `live` for real VPS telemetry.
- `collectedAt` and every `timestamp`/`since` value use ISO 8601 UTC. Resource history is in `history.samples`; `range` and `stepSeconds` describe its window and sample interval.
- Byte capacities and counters use bytes; rates use bytes per second; percentages are numbers from 0 to 100; uptime and durations use seconds.
- `null` means unavailable or not configured. It must not be converted to zero. Empty arrays mean the collector returned no entries.
- Human-readable API content, including `health.reasons` and service/process `description` values, must be provided in English. Machine-readable field names, enum values, and service names remain unchanged.
- The backend returns `status` fields for the overall host and every resource, filesystem, interface, and service. Allowed values are `healthy`, `warning`, `critical`, and `unknown`. The UI maps those values to green, amber, red, and neutral, and always shows a text label too.
- `health.reasons` explains the overall status. `alerts[]` carries the current alert list.
- `alerts[]` contains current Prometheus pending or firing alerts. It is not a historical event log and does not send notifications. `activeAt` is UTC; `value` can be `null` when the alert source does not report one.

## Agreed initial thresholds

Thresholds are sustained for 300 seconds before the backend reports the corresponding state, allowing brief spikes to settle.

| Signal | Warning | Critical |
| --- | --- | --- |
| CPU usage | `>= 80%` | `>= 90%` |
| Memory available | `< 20%` | `< 10%` |
| Filesystem used | `>= 80%` | `>= 90%` |

Memory availability should follow the host's available-memory metric, not simply `MemFree`; Linux's `MemAvailable` estimates memory available to new applications without swapping. The filesystem status is the worst status among monitored mounts.

Network throughput alone does not indicate a problem. Until an interface capacity or another network policy is configured, its status is `unknown`; still return RX/TX rates and error/drop rates when available. A unit's status must compare `actualState` with `expectedState`, so an intentionally inactive unit is not automatically unhealthy.

Each `current.services.units[]` item includes `description`, `ports` (`port` plus `tcp`/`udp` protocol), `pid`, `uptimeSeconds`, `path`, and `commandLine`. Fields that the collector cannot determine are `null`; an empty `ports` array means no port was detected. `expectedState` may be `unknown` until an expected state is configured. The command line can contain sensitive arguments, so the collector must redact secrets before returning it.

`current.processes.items[]` is the process list shown separately from systemd units. Each item includes `name`, `pid`, `state` (`running`, `sleeping`, `stopped`, `zombie`, or `unknown`), `user`, `cpuPercentOfHost`, `memoryPercent`, `description`, `location`, `startedAt`, and `commandLine`. `cpuPercentOfHost` is the process share of total host CPU capacity, normalized to 0–100%; `memoryPercent` is the process share of total host memory. Unavailable values are `null`; `startedAt` uses ISO 8601 UTC. Command lines can contain secrets and must be redacted by the collector before returning them. Process records in the bundled fixture are illustrative mock values, not live telemetry. The UI shows `running`, `sleeping`, and `unknown` states; stopped and zombie records are omitted. The process table sorts by CPU usage and paginates locally at 10 rows per page.

The browser validates both the dashboard response and the process snapshot against their JSON Schemas before rendering them. Invalid payloads produce the VPS data error state. On Linux, `GET /api/vps/dashboard` reads metrics from the local Prometheus HTTP API through the Nuxt server and refreshes every 10 seconds. It requests a 60-minute trend window; Prometheus stores time-series data in a named Docker volume using its configured retention. The live snapshot includes host metrics, filesystem/network details, systemd unit states, and current pending/firing alerts. The separate process list uses `GET /api/vps/processes` on Linux and refreshes every 10 seconds. On non-Linux development hosts, live endpoints respond with HTTP 501 and the UI keeps the bundled fixture labeled as demo data. The Prometheus endpoint is server-only and must remain bound to loopback unless a separately reviewed access policy is added.

Schema version `1.1` added `current.processes`; version `1.2` clarifies host-normalized process CPU usage; version `1.3` adds in-dashboard alert records and an unknown expected systemd state. The UI displays process rows in descending `cpuPercentOfHost` order; records with unavailable CPU values appear last.

## Mock versus live

Every value in the bundled JSON, including service descriptions, ports, process IDs, paths, and command lines, is illustrative and marked `dataMode: "mock"`. The UI must keep that label visible. Live resource history comes from Prometheus range queries. A current snapshot alone is not enough for real graphs.
