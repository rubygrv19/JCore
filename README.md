# Dashboard Minimal

A multi-page dashboard built with Nuxt 4, Nuxt UI, Nuxt Fonts (Inter), Nuxt Icon, Nuxt Image, and Pinia. The VPS page reads live Linux host metrics through a same-origin Nuxt server endpoint connected to loopback Prometheus and Node Exporter. On macOS and Windows, it uses clearly labeled fixture data for development. Settings remain mock configuration held only in browser memory; external service APIs are not connected.

Routes are defined in `app/pages/`: Dashboard (`/`), Settings (`/settings`), and services (`/services/:service`). Run the Nuxt Node server for the process endpoint; static generation does not include the collector.

## Development

```bash
pnpm install
cp .env.example .env
# Set NUXT_AUTH_ADMIN_EMAIL, NUXT_AUTH_ADMIN_PASSWORD, and NUXT_SESSION_PASSWORD in .env
pnpm dev
```

Sign-in uses one administrator account configured on the server. Set a valid email, a unique password of at least 15 characters, and a session secret of at least 32 characters. Do not commit `.env`; use the deployment platform's secret manager for production. The login screen reports an unavailable configuration until all three values are set.

Open the local address printed by Nuxt.

## Commands

- `pnpm dev` — start the development server
- `pnpm build` — build the Nuxt Node server in `.output/`
- `pnpm start` — run the built server on `127.0.0.1` only
- `pnpm preview` — preview the production build
- `pnpm typecheck` — check TypeScript types
- `pnpm lint` — run ESLint
- `pnpm test` — run tests in `test/unit/` and `test/nuxt/`

See [AGENTS.md](./AGENTS.md) for project rules and the AI-assisted development workflow. See [the VPS response contract](./docs/vps-response-contract.md) for the VPS mock API shape.

The dashboard pages require an authenticated administrator session. `POST /api/auth/login` validates the configured credentials and issues an encrypted HttpOnly cookie session; private API routes also check that session server-side. The session secret is `NUXT_SESSION_PASSWORD` and must be set to a unique value of at least 32 characters in production.

The VPS snapshot endpoint is `GET /api/vps/dashboard`. It returns resource metrics, 60-minute trends, current systemd states, and Prometheus pending/firing alerts. On non-Linux systems it returns HTTP 501 and the UI loads the validated demo fixture. The process endpoint is `GET /api/vps/processes`; on Linux it reads `/proc`, and on other systems the UI continues to show explicitly labeled demo processes. See [the dashboard response contract](./docs/vps-response-contract.md) and [the process snapshot contract](./docs/vps-processes.schema.json).

## Linux VPS metrics

The collector stack is defined in [`ops/vps/`](./ops/vps/). On the Ubuntu host, start the local exporters and Prometheus with `docker compose -f ops/vps/compose.yaml up -d`. Both HTTP listeners bind to `127.0.0.1`; keep them private. Configure Nuxt with `NUXT_VPS_PROMETHEUS_URL=http://127.0.0.1:9090`, then build and run Nuxt on that same host with `pnpm build && pnpm start`. The built app also binds to loopback; access policy and remote exposure are outside this local-only setup.
