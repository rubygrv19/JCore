# VPS dashboard response contract

Example response: [`public/mock/vps-dashboard.json`](../public/mock/vps-dashboard.json). The language-neutral [JSON Schema](./vps-dashboard.schema.json) is the machine-validated shape for this response. The live snapshot endpoint is `GET /api/vps/dashboard`; on Linux, Nuxt reads local Prometheus over loopback. Prometheus reads host metrics from Node Exporter. On non-Linux development systems this endpoint returns HTTP 501 and the UI uses the validated demo fixture.

## Conventions

- `schemaVersion` identifies the response shape. `dataMode` is `mock` for the bundled fixture and `live` for real VPS telemetry.
- `collectedAt` is the response collection time. `source.sampledAt` is the oldest available sample timestamp among the required exporter metric families; use it for freshness, not response time. All dates use ISO 8601 UTC. Resource history is in `history.samples`; `range` and `stepSeconds` describe its window and sample interval.
- `source.status` is `complete`, `partial`, `stale` (samples at least 60 seconds old), or `unavailable` (exporter scrape failed). `missingMetrics` identifies missing required sources. `systemdDetailsAvailable` indicates whether systemctl inspection succeeded; individual PID/path/port fields can still be unavailable.
- Byte capacities and counters use bytes; rates use bytes per second; percentages are numbers from 0 to 100; uptime and durations use seconds.
- `null` means unavailable or not configured. It must not be converted to zero. Empty arrays mean the collector returned no entries.
- Generated human-readable API content, including `health.reasons` and fixture descriptions, uses English. Live systemd descriptions are external OS content and are preserved as returned; no translation layer is implemented. Machine-readable field names, enum values, and service names remain unchanged.
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

Polling makes a new request after failures, retains a labeled last good dashboard/process snapshot, and cancels polling on navigation. Polling waits 10 seconds after each completed request, avoiding overlapping requests. First-load failures show an explicit retry action. No live source failure is replaced with fabricated live values; demo fallback is only for the non-Linux 501 response.

Additional examples in [vps-response-examples.json](./vps-response-examples.json) contain named, complete mock responses for pending/firing, partial, stale, or empty states. Each named object is a standalone API response; empty history is intentional in these scenario examples. These examples are validated in tests.

## Mock versus live

Every value in the bundled JSON, including service descriptions, ports, process IDs, paths, and command lines, is illustrative and marked `dataMode: "mock"`. The UI must keep that label visible. Live resource history comes from Prometheus range queries. A current snapshot alone is not enough for real graphs.

## Endpoint reference

Both endpoints require the JCore administrator session. They are same-origin reads; Settings does not override their target. They do not accept a host, command, PID filter or pagination query from the browser.

| Endpoint | Successful response | Error behavior |
| --- | --- | --- |
| `GET /api/vps/dashboard` | Full dashboard schema 1.4, `dataMode: live` on Linux | 401 without session; 501 on non-Linux; 503 for collection/configuration/schema failure |
| `GET /api/vps/processes` | Process snapshot schema 1.0 with `source: linux-procfs`, `collectedAt`, `items` | 401 without session; 501 on non-Linux; uncaught host-read failures use Nuxt's server error handling |

The process schema version is identified by the schema document, not a `schemaVersion` response property. The dashboard has an explicit `schemaVersion` property. Do not add fields based on this prose without updating the machine schemas and types.

The dashboard handler validates its output; the process browser client validates the process response. Both browser requests have a 20-second timeout and `retry: 0`. Scheduled retries are new polling iterations, not automatic ofetch retries. Server Prometheus queries have individual five-second timeouts. A rejected required query currently fails the dashboard request as a whole; partial responses describe missing series or systemd details when queries themselves succeeded.

## Field groups and units

The linked JSON Schemas are the complete field/enum/nullability reference. This table explains the principal meanings:

| Group | Meaning |
| --- | --- |
| `host` | Hostname/OS, uptime seconds and logical CPU core count; unavailable values are nullable |
| `current.cpu` | Total host usage percentage and 1/5/15-minute load averages; load is not a percentage |
| `current.memory` | Total and available bytes, total/used swap bytes; chart usage is derived from total minus available |
| `current.storage.filesystems` | Mount point, filesystem type, capacity, use and inode percentage per monitored filesystem |
| `current.storage.io` | Aggregate read/write bytes per second from the selected disk metrics |
| `current.network.interfaces` | RX/TX bytes per second, error/drop events per second, nullable bit-capacity and unknown status per selected device |
| `current.services` | Unit list and active/failed counts; expected state does not come from enabled/disabled status |
| `current.processes.items` | Mock process examples in the fixture; empty in the live dashboard response because live processes use the separate endpoint |
| `history.samples` | Sorted query-range timestamps with nullable CPU, available-memory, swap, disk-I/O and network-rate fields |

UI byte formatting uses binary units (KiB/MiB/GiB). Raw API values remain bytes or bytes/second. Process percentages have one display decimal; overview percentages round for display. Do not make rounding part of backend equality tests.

Filesystem used bytes are calculated as total minus space available to unprivileged users, not total minus all free blocks. Reserved space may therefore contribute to the displayed used value. This follows the recording rule and collector formula.

## Collection scope and metric selection

The current Prometheus queries assume the checked-in single Node Exporter target. CPU usage is `100 * (1 - average idle rate over 5 minutes)`. Memory availability follows `node_memory_MemAvailable_bytes`; swap is total minus free. A host with no swap produces unavailable swap percentages rather than an invented utilization.

Filesystem queries exclude virtual/pseudo filesystems and mounts under `/proc`, `/sys`, `/dev` and `/run`. The exact regex is in `server/utils/vps-dashboard.ts` and `ops/vps/vps.rules.yml`; update them together. Disk I/O sums devices excluding `loop.*` and `ram.*`; it does not attempt physical-device topology deduplication. On hosts exposing both logical and backing-device counters, review whether aggregation matches the intended storage interpretation.

Network queries exclude `lo`, `docker.*`, `veth.*` and `br.*`. Interfaces are sorted by name. The overview Network donut uses the first returned interface and represents RX/TX composition. It is not a capacity gauge or necessarily an aggregation of all interfaces. Storage overview prefers `/`, then the first returned filesystem; its status reflects the storage status across monitored filesystems, so another mount can raise the badge.

History requests cover the prior 3600 seconds at a 300-second step. A fully populated inclusive range can have 13 timestamps; the UI displays the actual returned sample count. Fixtures may contain a different count. Missing samples remain null/gaps; newly started Prometheus cannot supply an hour of history immediately.

`source.sampledAt` is the minimum timestamp across the selected CPU, total/available memory, filesystem-size and network-receive metric families for the Node Exporter job. It is not a freshness timestamp for every process/systemd field or every history series. `missingMetrics` checks exporter, CPU, memory, filesystem, network, systemd and sample-time availability. Source status precedence is exporter down -> unavailable, old sample -> stale, required missing source -> partial, otherwise complete.

Host health may still be Healthy when network health is Unknown or unconfigured expected unit states are Unknown, provided required data is complete and no firing alert/direct critical condition exists. Unknown health policy and missing telemetry are different conditions.

## Service and process details

systemd collection lists loaded/observed service units plus explicitly configured expectations. It uses batched `systemctl show`, derives active duration from monotonic activation time and host uptime, and resolves executable path/command from MainPID. systemctl calls use a five-second timeout and bounded output buffers. Failure falls back to Prometheus unit states with `systemdDetailsAvailable: false` and source partial; detailed fields can be null.

Direct detection of `failed` or a known expected-state mismatch marks a service Critical immediately. Prometheus `VpsSystemdUnitFailed` and `VpsCollectorUnavailable` alerts each have a one-minute sustain duration. The dashboard also reports an exporter `up == 0` as unavailable/Critical immediately. This response behavior and alert pending timing must not be confused with the five-minute resource thresholds.

The process endpoint inspects readable numeric `/proc` entries in batches of 25. State mapping is R -> running; S/D/I -> sleeping; T/t -> stopped; Z -> zombie; other states -> unknown. The endpoint can return all these states; the UI's active list keeps running, sleeping and unknown only. “Sleeping” does not mean a service is stopped.

Process CPU is the delta of user/system ticks divided by the delta of total host ticks; Linux guest fields are not double-counted. The first sample, new process, reused PID, invalid/zero host delta or unavailable baseline returns null. It is not a one-core percentage, so a fully busy single thread on a four-core host is approximately 25% of total host capacity. Samples are per Node process; concurrent requests share an in-flight snapshot and a completed snapshot can be reused for one second.

Process memory uses VmRSS divided by MemTotal. Start time uses boot time plus process start ticks divided by `getconf CLK_TCK`. User names are resolved from `/etc/passwd`, with UID fallback. OS permission restrictions and process exits can omit rows; there is no explicit process coverage metadata in schema 1.0. An empty result does not prove the host has no processes.

## Backend handoff and safe mocks

Use these artifacts together:

- Dashboard JSON Schema: [vps-dashboard.schema.json](vps-dashboard.schema.json).
- Dashboard example: [public fixture](../public/mock/vps-dashboard.json).
- Additional complete scenarios: [vps-response-examples.json](vps-response-examples.json).
- Process JSON Schema: [vps-processes.schema.json](vps-processes.schema.json).
- Existing TypeScript types: `app/types/vps.ts`, `app/types/vps-processes.ts`.
- Runtime validators: `app/utils/vps-response.ts`, `app/utils/vps-processes-client.ts`.
- Fixture and parser/collector tests: `test/unit/vps-fixture.test.ts`, `test/unit/vps-process-collector.test.ts`, and mocked collector integration tests.

For a standalone process mock, use the process-schema envelope (`source`, `collectedAt`, `items`) and illustrative rows from the dashboard fixture; no standalone public process fixture is checked in. `test/unit/vps-process-collector.test.ts` includes a validated process-envelope example. Do not send a dashboard-shaped object to the process endpoint.

Schemas currently permit additional properties by default; they enforce required known fields/types but do not reject every extra key or express every cross-field relationship. Tests cover selected semantic invariants. Runtime schema validation does not prove data freshness, complete host visibility or correct measurement semantics. Preserve those rules explicitly in backend implementation and tests.

Never put real host responses or credentials into the public fixture. Keep mock mode visible. Contract changes require schema/types/validator/fixture/examples/tests/prose alignment; do not rename published schema IDs solely to change branding. The process schema retains its original `urn:dashboard-minimal:vps-processes:1.0` identifier intentionally for compatibility.

## Related guides

See [architecture](architecture.md) for state/polling ownership, [security](security-and-configuration.md) for auth/exposure/cache limits, [UI rules](../DESIGN.md) for chart/table presentation, [Ubuntu verification](../ops/vps/VERIFY.md) for deployment evidence, and [official references](references.md#linux-telemetry-and-operations) for metric/OS sources.
