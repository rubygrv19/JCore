# Dashboard Minimal

A multi-page dashboard built with Nuxt 4, Nuxt UI, Nuxt Fonts (Inter), Nuxt Icon, Nuxt Image, and Pinia. The VPS page uses mock host metrics and charts plus a read-only Linux process collector exposed by a Nuxt server endpoint. Settings remain mock configuration held only in browser memory; external service APIs are not connected.

Routes are defined in `app/pages/`: Dashboard (`/`), Settings (`/settings`), and services (`/services/:service`). Run the Nuxt Node server for the process endpoint; static generation does not include the collector.

## Development

```bash
pnpm install
pnpm dev
```

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

The local process endpoint is `GET /api/vps/processes`. On Linux it reads `/proc`; on other operating systems it returns HTTP 501 and the UI continues to show explicitly labeled demo processes. See [the process snapshot contract](./docs/vps-processes.schema.json).

The built server intentionally binds to loopback while authentication and remote access are out of scope. For the target Ubuntu host, build and run it on that host with `pnpm build && pnpm start`.
