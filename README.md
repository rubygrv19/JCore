# Dashboard Minimal

A multi-page dashboard built with Nuxt 4, Nuxt UI, Nuxt Fonts (Inter), Nuxt Icon, Nuxt Image, and Pinia. The Dashboard and service pages currently show a Coming Soon state. Settings are mock configuration held only in browser memory. No service API is connected yet.

Routes are defined in `app/pages/`: Dashboard (`/`), Settings (`/settings`), and services (`/services/:service`). Static pages are generated to `.output/public`.

## Development

```bash
pnpm install
pnpm dev
```

Open the local address printed by Nuxt.

## Commands

- `pnpm dev` — start the development server
- `pnpm build` — generate the production static output in `.output/public`
- `pnpm preview` — preview the production build
- `pnpm typecheck` — check TypeScript types
- `pnpm lint` — run ESLint
- `pnpm test` — run tests in `test/unit/` and `test/nuxt/`

See [AGENTS.md](./AGENTS.md) for project rules and the AI-assisted development workflow. See [the VPS response contract](./docs/vps-response-contract.md) for the VPS mock API shape.
