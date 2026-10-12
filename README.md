# JCore

JCore is a personal, single-administrator service dashboard built with Nuxt 4 and Nuxt UI. Its visual direction is monochrome Swiss Style / International Typographic Style, with Inter typography and real Chart.js visualizations.

## Current capabilities

| Area | Existing behavior |
| --- | --- |
| Authentication | Server-configured administrator, sealed cookie session, protected dashboard routes and VPS APIs |
| VPS | One local Linux host: CPU, memory/swap, filesystem/inodes, disk I/O, network, systemd, processes, and current alerts |
| macOS / Windows | Development UI with labeled VPS fixtures; native live collectors are not implemented |
| Dashboard | Coming Soon page |
| Settings | Per-service draft configuration in Pinia memory; no backend persistence |
| Timeshit | Coming Soon page; [approved implementation plan](docs/timeshit-implementation-plan.md), execution pending |
| Code Review / Quota Tracker | Coming Soon pages; external integrations are not implemented |

VPS telemetry comes from same-origin Nuxt endpoints, loopback Prometheus/Node Exporter, and Linux OS inspection. Settings does not connect an external VPS API. A configured Base URL for another service is currently a validated draft, not an active integration.

## Start locally

Use Node 22 (the current CI baseline) and the pnpm release declared in `package.json` (`pnpm@12.5.1`). Exact dependency resolution is recorded in `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Set these in the ignored `.env` before signing in:

- `NUXT_AUTH_ADMIN_EMAIL`: a valid administrator email.
- `NUXT_AUTH_ADMIN_PASSWORD`: a unique password of 15 to 1024 characters.
- `NUXT_SESSION_PASSWORD`: a unique random secret of at least 32 characters.

There are no bundled login credentials. Never commit real values. Then run:

```bash
pnpm dev
```

Open the loopback URL printed by Nuxt and sign in at `/login`. macOS/Windows use labeled demo VPS data. For live Linux metrics, follow the [Ubuntu operations guide](ops/vps/VERIFY.md).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server bound to `127.0.0.1` |
| `pnpm test` | Vitest unit and Nuxt-aware tests |
| `pnpm typecheck` | Nuxt TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm build` | Nuxt Node server build in `.output/` |
| `pnpm start` | Built server bound to `127.0.0.1` by `scripts/start-local.mjs` |
| `pnpm preview` | Nuxt production preview; the custom loopback start wrapper does not apply |
| `pnpm generate` | Static generation tooling only; unsuitable for this app's auth and host APIs |

Production Node startup does not automatically load `.env`. Provide runtime variables through the service manager or deployment environment. Build on the target OS; do not copy a macOS `.output` to Ubuntu because image tooling includes platform-specific binaries.

## Documentation

Start with the [documentation index](docs/README.md). It separates existing behavior, approved plans, and release checks that still require a real Linux host.

| Document | Read it for |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Mandatory project rules and AI workflow |
| [Architecture](docs/architecture.md) | Routes, directory ownership, data flow, current limitations |
| [Development](docs/development.md) | Setup, tests, change recipes, documentation maintenance |
| [Security and configuration](docs/security-and-configuration.md) | Environment variables, login/session behavior, trust boundaries |
| [DESIGN.md](DESIGN.md) | Swiss Style, Nuxt UI usage, theme, spacing, charts, accessibility |
| [VPS contract](docs/vps-response-contract.md) | Endpoint semantics, schema/fixtures, metrics and UI behavior |
| [Ubuntu operations](ops/vps/VERIFY.md) | Collectors, host permissions, verification, troubleshooting |
| [Timeshit plan](docs/timeshit-implementation-plan.md) | Approved future GitHub/PAT integration |
| [References](docs/references.md) | Official Nuxt, UI, auth, chart, monitoring, and GitHub sources |

## Working agreement

Work on `development`, preserve local changes, and verify the affected flow before handoff. Commit, push, merge, and deployment each require the user's authorization for that action. See [the development workflow](docs/development.md).

This documentation describes source behavior. It does not certify that a VPS, domain, proxy, or collector deployment has passed verification.
