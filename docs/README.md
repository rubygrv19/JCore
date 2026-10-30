# Documentation index

Current project baseline: October 30, 2026 on `development`. Nuxt 4.6.3 / Nuxt UI 4.12.0; local suite **269 tests / 39 files** with typecheck, lint and production build passing. Audit findings AUD-01–AUD-12 are closed or mitigated (AUD-01 retains 2 low advisories); UX-01 is deferred; public HTTPS and Ubuntu operator release gates remain open. See the [project audit tracker](project-audit-2026-10-14.md) and [pending execution plan](superpowers/plans/2026-10-30-pending-task-execution.md).

Latest Timeshit feature audit: October 14, 2026. Connection/PAT, repository/history browsing, activity collection, daily digest/copy, heatmap and branch preferences are implemented. The [verification report](timeshit-verification-report.md) maps the plan to current code, records corrected defects and passing checks, and distinguishes local browser evidence from remaining release checks. The October 12 documentation audit record below remains historical.

## Reading paths

- New developer: [README](../README.md), [architecture](architecture.md), [development](development.md), [configuration](security-and-configuration.md).
- UI contributor: [project rules](../AGENTS.md), [design system](../DESIGN.md), then the affected page and its Nuxt UI documentation.
- VPS backend contributor: [response contract](vps-response-contract.md), its linked schemas/examples, collector source, and [Ubuntu verification](../ops/vps/VERIFY.md).
- Timeshit contributor: [approved plan](timeshit-implementation-plan.md). Connection/PAT, repository management and branch/commit/change browsing are implemented; read the [connection](timeshit-connection-contract.md), [repository](timeshit-repositories-contract.md) and [history](timeshit-history-contract.md) contracts. The [activity contract](timeshit-activity-contract.md) defines implemented shared helpers/schema, bounded collector and HTTP operations. Client activity controls and daily digest/copy are implemented; heatmap UI is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md).
- AI agent: read [AGENTS.md](../AGENTS.md) first, then use the relevant reading path. Consult [official references](references.md) and installed dependency source when uncertain.

## Documentation ownership

| File | Owns | Update when |
| --- | --- | --- |
| `README.md` | Onboarding and feature summary | Setup, commands, feature availability changes |
| `AGENTS.md` | Mandatory project policy | The owner approves a new rule or architecture exception |
| `DESIGN.md` | Visual direction and UI implementation guidance | Tokens, component rules, layout or interaction conventions change |
| `docs/architecture.md` | Existing runtime/data flow and boundaries | Routes, state ownership, collectors or integrations change |
| `docs/development.md` | Contributor workflow and verification | Scripts, test structure, CI or change process changes |
| `docs/security-and-configuration.md` | Auth, runtime variables, security limitations | Credentials, guards, storage, exposure or configuration changes |
| `docs/vps-response-contract.md` | Human-readable telemetry semantics | Metrics, fields, polling, collection or UI interpretation changes |
| `docs/vps-dashboard.schema.json` | Machine-validated dashboard shape, version 1.4 | Response shape changes |
| `docs/vps-processes.schema.json` | Machine-validated process snapshot, version 1.0 | Process response shape changes |
| `public/mock/vps-dashboard.json` | Complete illustrative dashboard fixture | Contract or fixture scenario changes |
| `docs/vps-response-examples.json` | Named complete mock scenarios | Error/partial/stale/alert examples change |
| `docs/timeshit-connection-contract.md` | Current Connection/PAT behavior and operator setup | Connection API/storage/UI changes |
| `docs/timeshit-repositories-contract.md` | Repository API, persistence, UI limits and acceptance | Repository behavior changes |
| `docs/timeshit-history-contract.md` | Branch/commit/file browsing API and semantics | History routes, response limits or UI behavior changes |
| `docs/timeshit-activity-contract.md` | Activity collection/resume contract, enforced budgets and coverage | Collector, date semantics, scope, continuation or heatmap decisions change |
| `docs/timeshit-activity.schema.json`, `docs/timeshit-activity.examples.json` | Activity input/snapshot schemas and synthetic scenarios | Activity types, validators, bounds or scenarios change |
| `docs/timeshit-implementation-plan.md` | Approved future Timeshit scope | Decisions change or a phase is implemented |
| `docs/timeshit-verification-report.md` | Plan-to-code audit, corrected defects, local evidence and remaining release checks | Acceptance evidence or unresolved limits change |
| `docs/timeshit-acceptance.md` | Isolated synthetic UI, real PAT lifecycle and Ubuntu acceptance procedures | Test helpers, acceptance prerequisites or release gates change |
| `docs/timeshit-preferences-contract.md` | Persisted history default branch preference | Preference API/schema/UI changes |
| `docs/project-audit-2026-10-14.md` | Dated audit findings, remediation evidence and remaining decisions | Findings close, defer, or re-verify |
| `docs/superpowers/plans/2026-10-30-pending-task-execution.md` | Ordered remaining local/release tasks | Task status or release-gate order changes |
| `ops/vps/VERIFY.md` | Operator runbook and release evidence checklist | Host/runtime/collector deployment changes |
| `docs/references.md` | External reference catalog | New APIs, dependencies or guidance are introduced |

## Evidence and precedence

Project policy comes from the owner's approved decisions and `AGENTS.md`; visual direction comes from `DESIGN.md`. Actual behavior must be checked in source and tests. JSON Schemas validate shape, while contract prose defines meaning. All must agree. If a discrepancy appears, identify it explicitly and update the affected documents with the implementation; do not silently redefine the contract from a fixture or a planned feature.

`package.json` and `pnpm-lock.yaml` determine dependency requirements/resolution. Online documentation may describe a newer release; check installed types before using a newly documented API. Do not label the project “latest” without a fresh compatibility review.

## Known implementation boundaries

These are existing limits, not features completed by this documentation audit:

- VPS supports live collection on Linux only. macOS/Windows browser development is supported through fixtures. Other Linux distributions still need permission/tooling verification; Ubuntu is the intended deployment target.
- Settings modes change card presentation only. They do not start, stop, disable, or block service routes or collectors. Base URLs and modes disappear after a browser reload; they are not persisted. Timeshit GitHub connection actions persist separately.
- VPS ignores the Settings Base URL and always calls the same-origin API. The isolated external-client helper is present and tested but does not make the placeholder services live.
- Timeshit Connection/PAT uses private same-origin Nuxt endpoints and encrypted SQLite. Repository management and read-only branch/commit/change browsing are implemented. Bounded all-branch collection endpoints and client/Pinia lifecycle are implemented; visible collection controls and daily digest/copy are implemented; heatmap is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md); see the [Timeshit plan](timeshit-implementation-plan.md).
- Live dashboard snapshots leave `current.processes.items` empty. The separate process endpoint supplies live process rows. The fixture includes sample processes for demo use.
- Process snapshots have no explicit coverage/permission metadata; inaccessible or disappearing processes may be omitted. “Active processes” is a filtered view, not proof that every OS process was observed.
- Process state, CPU sampling, command redaction, and systemd listener ownership have the limits described in the [VPS contract](vps-response-contract.md).
- No alert history, external notification delivery, network-capacity policy, remote multi-host monitoring, service-control action, registration, password reset, or database-backed administration is implemented.
- Login throttling uses bounded per-client and global budgets within one Node process. Proxy address trust is opt-in and requires verified header overwriting; no multi-proxy-chain policy is implemented. There is no shared limiter, explicit app-configured session lifetime, or central session revocation. Login enforces an explicit configured Origin and an 8 KiB JSON body bound; see [configuration](security-and-configuration.md).
- Private VPS handlers require a session and set `Cache-Control: private, no-store` on success and errors. Configure the proxy/CDN to bypass caching authenticated pages and APIs as defense in depth; application-level headers do not replace host proxy verification.
- CI runs frozen-lockfile install, lint, typecheck, unit tests and production build on Ubuntu/Node 22 for pushes and pull requests. Browser interaction, authenticated host checks and public HTTPS verification remain outside CI.
- Public HTTPS for `jcore.rubygrv.cloud` was unreachable on October 30, 2026 (DNS resolves; TCP 80/443 closed). Current documentation and mocked tests cannot establish that Ubuntu permissions, exporters, systemd, HTTPS, and production cookies work on the deployment host. Record evidence using the runbook when the public listener exists.

Keep this list current. Move a boundary to “implemented” only after the code, contract, tests, and required runtime checks agree.

## Documentation audit verification

The October 12 audit covered all six pre-existing Markdown documents and added five contributor guides. Source inspection covered route/layout/Settings/auth code, service state and clients, chart wrappers, VPS collectors/validators/types, monitoring configuration, schemas/fixtures, test definitions and CI.

Local documentation links/anchors and fenced blocks were checked. The dashboard fixture, five named scenario responses and a process-envelope example assembled from fixture rows were validated with the existing AJV schemas. External URL reachability and the MCP transport exception are recorded in [references](references.md).

This was a documentation-only update. No unit test suite, typecheck, production build, browser interaction test or Ubuntu collector verification was run for this audit. Existing application checks from earlier work are not fresh evidence for this update. No runtime source, response schema or fixture payload was changed.

- [Timeshit history preferences](timeshit-preferences-contract.md): persisted preferred branch, private API/schema, migration v3, calendar and full-width layout behavior.
