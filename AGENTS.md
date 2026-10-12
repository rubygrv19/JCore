# AI Project Rules and Workflow

These rules apply to every AI-assisted change in this repository. Read this file before planning or editing.

## Product rules

- Use English for all user-facing text across the application: navigation, headings, labels, descriptions, buttons, forms, status names, charts, tooltips, empty/loading/error states, confirmation text, accessibility labels, and metadata.
- Keep the product's proper name and technical terms unchanged. Use `en-US` for user-facing date, time, number, and relative-time formatting; keep the `Asia/Jakarta` time zone unless the user changes it.
- Generated service API descriptions, health reasons, and errors must also be English. Preserve original external content such as GitHub commit messages, repository descriptions, file names, and patches in its source language. Do not silently translate or invent backend data in the browser.
- Do not invent product behavior, API contracts, endpoints, payloads, credentials, or data presented as real. Ask the user when a missing decision materially affects behavior or architecture.
- Use clearly labeled mock data while a service or API is unavailable. Never present mock values as live data.
- Keep service-specific behavior and configuration isolated. VPS, Timeshit, Code Review, and Quota Tracker may use different API base URLs.
- Direct browser requests to external service APIs require CORS for the dashboard origin. Approved exceptions use same-origin Nuxt endpoints: VPS reads the host-local Prometheus API and Timeshit reads GitHub with its PAT held only on the server. Keep Prometheus and Node Exporter bound to loopback. Never send a GitHub PAT to an arbitrary service Base URL.
- The backend/database owns persisted service configuration. The approved Timeshit implementation persists its encrypted PAT, minimal connection metadata, and tracked repository selection in SQLite. Other unspecified backend configuration remains mock and non-persistent; do not persist it in localStorage or invent its backend schema.
- Never put saved API secrets or private credentials in global browser state, client-visible runtime config, session cookies, or mock data. A user-entered Timeshit PAT may exist temporarily in the local Settings form draft for submission; clear it on success/close and never return a saved PAT through an API. Redact secrets from telemetry command lines. Ask before introducing a credential model beyond the approved Timeshit design.
- Authentication is approved for one administrator configured only through server environment variables. Never add real credentials or session secrets to source, `.env.example`, client runtime config, browser state, or mock data. Guard every dashboard page with the global route middleware and every private server API route with `requireUserSession(event)`; middleware alone does not protect API routes.

## Required stack and Nuxt conventions

- Use the existing Nuxt 4 project with Nuxt UI, Nuxt Fonts, Nuxt Icon, Nuxt Image, and Pinia. Preserve pnpm and its lockfile.
- Run the application with the Nuxt Node server (`pnpm build` / `pnpm start`) when using the local Linux process collector. `pnpm start` binds to loopback for the current local-only stage. Static generation does not include this server endpoint and is not the production mode for VPS telemetry.
- Use Inter as the global font through Nuxt Fonts.
- Use Nuxt UI components for standard interactive controls and UI primitives. Keep native semantic elements for document structure and navigation.
- Do not recreate primitives already provided by Nuxt UI. A focused app component is allowed only to integrate a capability Nuxt UI does not provide, such as the existing Chart.js chart wrapper. Keep it small and use Nuxt UI for surrounding controls.
- Use Chart.js with Vue Chart.js for data visualizations. Do not replace real charts with decorative CSS approximations.
- Use Pinia with `@pinia/nuxt` for shared application and service state. Keep one-off form drafts local to their view. Do not add another global state library.
- Use Nuxt Image (`NuxtImg`/`NuxtPicture`) for raster images when needed, and Nuxt Icon for icons.
- Follow Nuxt 4 directory, routing, data-fetching, error-handling, configuration, transition, and testing conventions. Prefer Nuxt auto-imports and framework APIs over custom infrastructure.

## API and data rules

- Create an independent fetch client for each service, configured with that service's own base URL. Never route all services through one mutable global base URL.
- Timeshit defaults to same-origin Nuxt endpoints. Preserve the per-service Base URL concept and distinguish it from the server's fixed GitHub API origin. External Timeshit backend support requires its own documented API/authentication contract; do not silently activate it or forward the PAT to it.
- Keep API access behind service-specific client functions; UI code must not construct endpoint URLs ad hoc.
- Until the user supplies API documentation or confirms a contract, implement only the agreed mock path and base URL configuration. VPS has approved Linux `/proc` and host-local Prometheus collectors through Nuxt server endpoints. Timeshit has an approved server-side GitHub integration plan in `docs/timeshit-implementation-plan.md`; implement only when execution is requested and finalize its response contract first. Do not guess endpoints, authentication, response shapes, retries, or business rules for unspecified services.
- Validate and normalize base URLs before use. Validate API responses at runtime against the documented contract before rendering them.
- Keep the mock JSON, JSON Schema, TypeScript types, tests, and response-contract documentation aligned. Version intentional contract changes and update all related references together.
- Preserve the meanings of `null`, empty arrays, units, timestamps, and status enums. Do not convert unknown values to zero or translate machine-readable keys/enums.
- For Timeshit, derive commit authorship from the server-verified GitHub account, use all current remote branch histories of tracked repositories, deduplicate `(repositoryId, fullSha)`, and group by `authoredAt` in `Asia/Jakarta`. Respect the single fine-grained PAT's actual scope. Identity validation alone does not prove repository permissions; incomplete collection must expose coverage and must not appear as complete zero activity.
- Keep private Timeshit connection/SQLite/crypto code in `server/`, shared contracts and pure utilities in `shared/`, and UI state in `app/`. Use built-in `node:crypto` with a stable private environment key for authenticated PAT encryption; keep the SQLite database outside public/build output directories and Git.
- Provide clear loading, success, empty, stale-data, and error states. Keep errors useful without exposing credentials or sensitive payloads.

## UI, language, and accessibility

- Use English consistently. Check visible copy, screen-reader text, chart accessible names/tooltips, validation messages, sample content, browser metadata, and developer-facing README/docs.
- Use Nuxt UI components and theme tokens consistently. Avoid adding visual sections or controls without a product need.
- Before implementing a view, understand the user task and establish clear hierarchy, spacing, responsive behavior, and readable contrast. Check desktop and mobile layouts.
- Interactive elements need a clear action, keyboard access, visible focus, and an accessible name. Use `cursor-pointer` on enabled buttons, links, and clickable targets; show disabled styling/state for disabled controls. Decorative icons must not look actionable.
- Respect reduced-motion preferences. Never use animation as the only state indicator.
- Use semantic HTML for page structure; do not wrap every element in a custom component.

## AI workflow

1. Read this `AGENTS.md`, inspect the relevant files, and check `git status` before editing. Preserve existing user changes; do not revert unrelated work.
2. Trace the relevant UI and data flow end to end. Search for every related label, formatter, mock value, accessibility string, test, and documentation reference before editing.
3. For broad or ambiguous work, summarize the scope and provide a concrete plan first. If the user approves it, execute the approved work without asking for approval again. Ask only when a material product or architecture decision remains unresolved; continue independent work meanwhile.
4. Verify uncertain Nuxt, Nuxt UI, or library APIs against official documentation or installed project types/source. Do not guess component props or framework behavior.
5. Make the smallest complete change that fulfills the request. Update implementation, mock data, schema/contracts, docs, and tests together when they describe the same behavior.
6. Run the relevant unit tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Fix regressions introduced by the change; report unrelated existing failures separately.
7. For a substantial UI or routing change, start or use the local app, open the affected route in a browser, and verify it loads and renders the expected content. Check responsive behavior when layout changes.
8. Review the final diff and search again for untranslated or inconsistent user-facing text. Confirm the result is local and state whether any commit, push, or deployment occurred.

## Git and deployment

- Use `development` for ongoing project work. Switch to and synchronize this branch before starting changes; use another branch only when the user explicitly requests it. Preserve any existing local work when switching or synchronizing.
- Work locally first. Do not commit, push, publish, or deploy unless the user explicitly asks.
- Do not discard, reset, or overwrite unrelated uncommitted work. Mention pre-existing changes when they affect the requested work.

## Testing and completion

- Unit tests are required for application logic and behavior changes. Use Vitest and `@nuxt/test-utils` for Nuxt-aware tests; keep tests focused on observable behavior and avoid snapshot-only coverage.
- Add or update tests for service-client isolation, configuration behavior, validation, state transitions, formatting, and user-visible interactions as those features are implemented.
- Before completing a change, run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Do not leave new lint violations.
- Final updates must state what changed, what was verified (including whether the browser page opened), and any limitations. Never claim a check or browser verification that was not actually completed.

<!-- antislop:start -->
## Anti-Slop

For UI, copy, accessibility, mobile layout, and code-comment work, read the installed Anti-Slop core (`antislop.md`) from the Anti-Slop plugin in the Codex skill environment, then read the applicable module from the same plugin release:

- UI / visual: `skills/antislop-ui/SKILL.md`
- Copywriting: `skills/antislop-copywriting/SKILL.md`
- Accessibility and human factors: `skills/antislop-human/SKILL.md`
- Responsive and mobile layout: `skills/antislop-layoutmobile/SKILL.md`
- Code comments: `skills/antislop-code/SKILL.md`

Use the plugin's Two Usage Modes flow before applying Anti-Slop. An explicit mode selected for the current session takes precedence over a saved global preference. If neither sets a mode, ask whether to apply it during implementation or after implementation. Do not treat this project's pointer as a saved global preference. When a selected module is not installed in the current agent environment, report that limitation and do not download or invent its instructions.
<!-- antislop:end -->
