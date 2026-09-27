# Project Rules

## Product and communication

- Do not invent product behavior, API contracts, endpoints, payloads, credentials, or data presented as real. Ask the user when a missing decision materially affects behavior or architecture.
- Use clearly labeled dummy data while a service or API is not available. Do not present mock values as live data.
- Keep service-specific behavior and configuration isolated. VPS, Timeshit, Code Review, and Quota Tracker may use different API base URLs.
- API requests are made directly from the browser. Each API must allow the dashboard origin through CORS. Do not add a dashboard proxy unless the user requests one.
- The backend/database will own persisted service configuration. Until that backend is specified and available, configuration is mock and non-persistent; do not persist it in localStorage or invent a backend schema.
- Never put API secrets or private credentials in browser state, client-visible runtime config, or mock data. Ask before designing authentication or credential storage.

## Stack and state

- Use the existing Nuxt 4 project with Nuxt UI, Nuxt Fonts, Nuxt Icon, and Nuxt Image. Preserve pnpm and its lockfile.
- The dashboard is deployed as a static site to `.output/public`. Keep builds compatible with static generation; ask before introducing server routes or changing the hosting model.
- Use Inter as the global font through Nuxt Fonts.
- Use Nuxt UI components for standard interactive controls and UI primitives. Keep native semantic elements for document structure and navigation.
- Do not recreate primitives already provided by Nuxt UI. A focused app component is allowed only when it integrates a capability Nuxt UI does not provide, such as the existing Chart.js chart wrapper. Keep such components small and use Nuxt UI for their surrounding controls.
- Use Chart.js with Vue Chart.js for real charts. Do not substitute decorative CSS approximations for data visualizations.
- Use Pinia with `@pinia/nuxt` for shared application and service state. Keep one-off form drafts local to their view. Do not add another global state library.
- Use Nuxt Image (`NuxtImg`/`NuxtPicture`) for raster images when the interface needs them; use Nuxt Icon for icons.

## API integration

- Create an independent fetch client for each service, configured with that service's own base URL. Never route all services through one mutable global base URL.
- Keep API access behind service-specific client functions so UI code does not construct endpoint URLs ad hoc.
- Until the user supplies API documentation or confirms a contract, implement only the agreed mock path and base URL configuration. Do not guess endpoint paths, auth, request/response shapes, retries, or business rules.
- Validate and normalize base URLs before use, and make loading, success, empty, and error states clear in the UI.

## UI and accessibility

- Use Nuxt UI components and theme tokens consistently. Avoid adding visual sections or controls without a product need.
- Before implementing a view, understand its user task and establish clear hierarchy, spacing, responsive behavior, and readable contrast. Check desktop and mobile layouts.
- Interactive elements must have a clear action, keyboard access, visible focus, and an accessible name. Use `cursor-pointer` on enabled buttons, links, and other clickable targets; use a disabled cursor/state for disabled controls. Decorative icons must not look actionable.
- Respect reduced-motion preferences. Do not use animation as the only indicator of state.
- Use semantic HTML for page structure and meaningful content; do not wrap every element in a custom component.

## Testing and completion

- Unit tests are required for application logic and behavior changes. Use Vitest with `@nuxt/test-utils` for Nuxt-aware tests; keep tests focused on observable behavior and avoid snapshot-only coverage.
- Add or update tests for service-client isolation, configuration behavior, state transitions, and user-visible interactions as those features are implemented.
- Before completing a change, run the relevant unit tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Fix failures introduced by the change. Do not leave new lint violations.
- Ask before making a choice that changes persistence scope, API access/authentication, or visible product behavior when the user has not specified it.
