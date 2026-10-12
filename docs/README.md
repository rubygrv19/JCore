# Documentation index

Last source audit: October 12, 2026, on `development`, based on the `280f108` application baseline and the accompanying documentation changes. This date records a source review, not a production release or Linux-host verification.

## Reading paths

- New developer: [README](../README.md), [architecture](architecture.md), [development](development.md), [configuration](security-and-configuration.md).
- UI contributor: [project rules](../AGENTS.md), [design system](../DESIGN.md), then the affected page and its Nuxt UI documentation.
- VPS backend contributor: [response contract](vps-response-contract.md), its linked schemas/examples, collector source, and [Ubuntu verification](../ops/vps/VERIFY.md).
- Timeshit contributor: [approved plan](timeshit-implementation-plan.md). The routes, SQLite storage, encryption, and GitHub integration in that plan are not implemented.
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
| `docs/timeshit-implementation-plan.md` | Approved future Timeshit scope | Decisions change or a phase is implemented |
| `ops/vps/VERIFY.md` | Operator runbook and release evidence checklist | Host/runtime/collector deployment changes |
| `docs/references.md` | External reference catalog | New APIs, dependencies or guidance are introduced |

## Evidence and precedence

Project policy comes from the owner's approved decisions and `AGENTS.md`; visual direction comes from `DESIGN.md`. Actual behavior must be checked in source and tests. JSON Schemas validate shape, while contract prose defines meaning. All must agree. If a discrepancy appears, identify it explicitly and update the affected documents with the implementation; do not silently redefine the contract from a fixture or a planned feature.

`package.json` and `pnpm-lock.yaml` determine dependency requirements/resolution. Online documentation may describe a newer release; check installed types before using a newly documented API. Do not label the project “latest” without a fresh compatibility review.

## Known implementation boundaries

These are existing limits, not features completed by this documentation audit:

- VPS supports live collection on Linux only. macOS/Windows browser development is supported through fixtures. Other Linux distributions still need permission/tooling verification; Ubuntu is the intended deployment target.
- Settings modes change card presentation only. They do not start, stop, disable, or block service routes or collectors. Base URLs and modes disappear after a browser reload; no database exists for them yet.
- VPS ignores the Settings Base URL and always calls the same-origin API. The isolated external-client helper is present and tested but does not make the placeholder services live.
- Timeshit remains a plan. There are no PAT/SQLite variables or Timeshit API endpoints in the running application.
- Live dashboard snapshots leave `current.processes.items` empty. The separate process endpoint supplies live process rows. The fixture includes sample processes for demo use.
- Process snapshots have no explicit coverage/permission metadata; inaccessible or disappearing processes may be omitted. “Active processes” is a filtered view, not proof that every OS process was observed.
- Process state, CPU sampling, command redaction, and systemd listener ownership have the limits described in the [VPS contract](vps-response-contract.md).
- No alert history, external notification delivery, network-capacity policy, remote multi-host monitoring, service-control action, registration, password reset, or database-backed administration is implemented.
- Login throttling is per Node process. There is no shared limiter, explicit app-configured session lifetime, central session revocation, or custom origin-check policy in the current auth route.
- Private VPS handlers require a session but do not explicitly set response cache-control headers. Configure the proxy/CDN to bypass caching authenticated pages and APIs; do not claim application-level `no-store` is implemented.
- CI currently runs install, lint and typecheck on Ubuntu/Node 22 for pushes. Unit tests and production build remain local release requirements and are not CI steps yet.
- Current documentation and mocked tests cannot establish that Ubuntu permissions, exporters, systemd, HTTPS, and production cookies work on the deployment host. Record evidence using the runbook.

Keep this list current. Move a boundary to “implemented” only after the code, contract, tests, and required runtime checks agree.

## Documentation audit verification

The October 12 audit covered all six pre-existing Markdown documents and added five contributor guides. Source inspection covered route/layout/Settings/auth code, service state and clients, chart wrappers, VPS collectors/validators/types, monitoring configuration, schemas/fixtures, test definitions and CI.

Local documentation links/anchors and fenced blocks were checked. The dashboard fixture, five named scenario responses and a process-envelope example assembled from fixture rows were validated with the existing AJV schemas. External URL reachability and the MCP transport exception are recorded in [references](references.md).

This was a documentation-only update. No unit test suite, typecheck, production build, browser interaction test or Ubuntu collector verification was run for this audit. Existing application checks from earlier work are not fresh evidence for this update. No runtime source, response schema or fixture payload was changed.
