# Development and change workflow

## Setup and branch

The normal working branch is `development`. Check state before editing:

```bash
git status --short --branch
git fetch origin
git switch development
git merge --ff-only origin/development
```

These commands assume a clean checkout or local changes that can safely move with the branch. If switching or fast-forwarding would overwrite work, inspect and preserve it first. Do not reset, discard, force-push, or automatically stash unrelated changes. If the local branch does not exist, create a tracking branch with `git switch --track origin/development`. Inspect divergence rather than guessing how to reconcile it.

Use another branch only when the owner requests it. Commit/push/deploy only when explicitly authorized. A documentation-edit request does not authorize any of those actions.

Use Node 22 as the current CI baseline and the pnpm version in `package.json`. Install with `pnpm install --frozen-lockfile`; preserve `pnpm-lock.yaml`. Set ignored local auth variables as described in [configuration](security-and-configuration.md), then run `pnpm dev` and open its printed loopback address.

## Required reading

Read `AGENTS.md`, the [architecture](architecture.md), relevant [contracts](vps-response-contract.md), and `DESIGN.md` before changing their area. Treat a future plan as approved scope, not an existing implementation. Verify library APIs against installed types and [official documentation](references.md).

The product name is JCore. `package.json` still uses the internal package identifier `dashboard-minimal`, and the process schema retains its published `urn:dashboard-minimal:...` ID. Do not rename contract identifiers as a cosmetic branding change without checking consumers.

## Verification

For application changes, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Run focused tests during development, then the complete checks before handoff. Existing test layout:

| Area | Files |
| --- | --- |
| Credential parsing and validation | `test/unit/admin-auth.test.ts` |
| URL validation and service isolation | `test/unit/service-clients.test.ts` |
| Schema, fixture integrity, filtering and paging | `test/unit/vps-fixture.test.ts` |
| Formatting, statuses and process sorting | `test/unit/vps-status.test.ts` |
| procfs parsing, CPU/start time, redaction, process response | `test/unit/vps-process-collector.test.ts` |
| systemd expectations, properties and MainPID ports | `test/unit/vps-systemd.test.ts` |
| Alert normalization, severity, loopback restrictions | `test/unit/vps-prometheus.test.ts` |
| Mocked Prometheus-to-dashboard integration | `test/unit/vps-dashboard-integration.test.ts` |
| Polling cleanup/retry and login attempt budget | `test/unit/vps-lifecycle.test.ts` |
| Nuxt/Pinia service store behavior | `test/nuxt/services.nuxt.test.ts` |

`vitest.config.ts` separates Node unit tests and the Nuxt test project. These tests do not replace browser interaction checks, a live authenticated endpoint check, or Ubuntu verification. The current workflow in `.github/workflows/ci.yml` runs install, lint and typecheck on pushes to Ubuntu/Node 22; it does not run tests or build yet. Do not call CI a complete release gate.

For documentation-only changes, validate local links, referenced paths, commands, fenced blocks, JSON/schema examples and consistency with source. Do not claim runtime checks from a previous run as fresh evidence. Application checks may be run when requested or when documentation changes reveal an implementation concern; report exactly what was executed.

## Browser verification for UI changes

Use the local development app before publishing. Open each affected route and check:

1. Direct loading and refresh, unauthenticated redirect, sign-in, sign-out and return route.
2. Desktop and narrow mobile layout, both themes, readable labels, contained horizontal table scrolling.
3. Sidebar selection, Services group, Settings modal, accordion defaults, Cancel, validation, Save and Shutdown confirmation.
4. VPS data/source labels, loading/error/retry/stale/empty states, donut and trend tooltips, expanded service/process rows and pagination.
5. Keyboard access, visible focus, accessible names, pointer cursors on enabled actions, and reduced-motion behavior.
6. Polling stops after leaving the VPS route; there are no new console or failed-network errors attributable to the change.

Use authorized credentials without copying them into documentation, logs or screenshots. Do not claim the browser opened or an interaction passed unless it was observed. A macOS demo check cannot prove Linux collector correctness.

## Change recipes

### VPS field or metric

Trace collector -> API -> validator/schema -> type -> fixture/examples -> formatter/page/chart. Update all affected artifacts in one change:

- `server/utils/vps-dashboard.ts`, `vps-systemd.ts`, or `vps-processes.ts`.
- `server/api/vps/*.ts` and `app/utils/vps-*.ts` where applicable.
- `docs/vps-dashboard.schema.json` or `docs/vps-processes.schema.json` and their TypeScript types.
- `public/mock/vps-dashboard.json`, named examples, `docs/vps-response-contract.md`.
- Focused tests, page states, `ops/vps/VERIFY.md` and monitoring rules where semantics change.

Version intentional response-shape changes. Preserve null/empty semantics, source labels and timestamps. Never mask a live source failure with demo values. A new metric needs a real collector source and documented units.

### Threshold or alert

Update Prometheus rules and the response threshold metadata together. Review warning/critical exclusivity, sustain duration, pending/firing behavior and the UI's explanatory text. Verify with tests plus promtool on the appropriate Linux environment. Do not change only the badge color or threshold label.

### UI/layout

Use `DESIGN.md` and Nuxt UI slots/theme APIs. Reuse the installed controls and chart wrappers. Keep data semantics intact. Prefer default UCard body spacing; internal section spacing is separate from card padding. Check table overflow and both themes in the browser.

### New service integration

Define source/API/authentication/persistence/availability contracts first. Add independent service clients and state without a mutable cross-service Base URL. Put secrets and host operations in `server/`, common contracts in `shared/`, UI in `app/`. Align mocks/schema/tests/docs and provide loading, error, empty and partial states. Timeshit must follow its approved phase plan rather than inventing endpoints or storage settings.

### Dependencies and Nuxt updates

Inspect current versions and lockfile first. Check official release/API compatibility, keep pnpm, and run the application checks after a deliberate upgrade. Updating a dependency is separate from refreshing prose; do not silently upgrade packages while auditing documentation.

## AI tools and references

Use filesystem/search/shell tools for source evidence, official documentation for uncertain APIs, and browser tools for rendered UI. The [Nuxt Working with AI guide](https://nuxt.com/docs/4.x/guide/ai) documents its MCP server and LLM documentation feeds. If Nuxt MCP is configured in the current agent environment, use it to retrieve version-appropriate docs; otherwise read the official pages directly. Do not claim that a connector is installed just because its URL is documented.

Anti-Slop is the project UI/copy quality filter. Follow the installed core's mode selection and the task-specific modules listed in `AGENTS.md`; a session-selected mode takes precedence. Do not download missing agent instructions automatically or assume another developer has the same plugin cache path. `DESIGN.md` remains the project's visual direction. Extra plugins are tools, not runtime app dependencies or substitutes for evidence.

## Documentation maintenance and handoff

Update docs in the same change as behavior. Use the [ownership table](README.md#documentation-ownership), keep implemented/planned status explicit, remove stale instructions, and add a direct official source when introducing an API rule. Prefer one canonical explanation with links over duplicated values.

Before handoff, review `git diff --check` and the final diff. State what changed, commands/checks actually completed, browser verification status, unresolved limits, and whether commit/push/deployment occurred. Keep evidence free of secrets. Do not promise zero bugs or production readiness from documentation and mock tests alone.
