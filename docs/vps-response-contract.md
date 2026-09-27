# VPS dashboard response contract

Example response: [`public/mock/vps-dashboard.json`](../public/mock/vps-dashboard.json). This defines the response body only; HTTP method, endpoint path, authentication, and collection agent remain undecided.

## Conventions

- `schemaVersion` identifies the response shape. `dataMode` is `mock` for the bundled fixture and `live` for real VPS telemetry.
- `collectedAt` and every `timestamp`/`since` value use ISO 8601 UTC. Resource history is in `history.samples`; `range` and `stepSeconds` describe its window and sample interval.
- Byte capacities and counters use bytes; rates use bytes per second; percentages are numbers from 0 to 100; uptime and durations use seconds.
- `null` means unavailable or not configured. It must not be converted to zero. Empty arrays mean the collector returned no entries.
- The backend returns `status` fields for the overall host and every resource, filesystem, interface, and service. Allowed values are `healthy`, `warning`, `critical`, and `unknown`. The UI maps those values to green, amber, red, and neutral, and always shows a text label too.
- `health.reasons` explains the status. `alerts.available` distinguishes an unavailable alert source from an available source with no active alerts.

## Agreed initial thresholds

Thresholds are sustained for 300 seconds before the backend reports the corresponding state, allowing brief spikes to settle.

| Signal | Warning | Critical |
| --- | --- | --- |
| CPU usage | `>= 80%` | `>= 90%` |
| Memory available | `< 20%` | `< 10%` |
| Filesystem used | `>= 80%` | `>= 90%` |

Memory availability should follow the host's available-memory metric, not simply `MemFree`; Linux's `MemAvailable` estimates memory available to new applications without swapping. The filesystem status is the worst status among monitored mounts.

Network throughput alone does not indicate a problem. Until an interface capacity or another network policy is configured, its status is `unknown`; still return RX/TX rates and error/drop rates when available. A unit's status must compare `actualState` with `expectedState`, so an intentionally inactive unit is not automatically unhealthy.

## Mock versus live

Every value in the bundled JSON is illustrative and marked `dataMode: "mock"`. The UI must keep that label visible. For real graphs, the backend must retain and return timestamped samples; a current snapshot alone is not enough.
