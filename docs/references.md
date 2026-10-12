# Official references

Use these primary sources with the installed versions in `package.json` and `pnpm-lock.yaml`. Links document framework/library behavior; they do not prove that JCore implements every described feature. Project-specific behavior is traced in [architecture](architecture.md), [configuration](security-and-configuration.md), [design](../DESIGN.md) and [contracts](vps-response-contract.md).

The catalog was refreshed on October 12, 2026. Critical Nuxt structure/data/AI, Nuxt UI theme/table, authentication, Chart.js tooltip and Prometheus guidance was consulted during the documentation audit. The remaining links are maintained reference entry points; re-read the affected page when changing that area. A URL resolving successfully is not a full API review, and a source on `main` or `/latest/` may exceed the installed release.

## Nuxt 4 foundations

| Topic | Official reference | Use in JCore |
| --- | --- | --- |
| Directory conventions | [Directory structure](https://nuxt.com/docs/4.x/directory-structure) | `app/`, `server/`, `shared/`, `public/` ownership |
| API catalog | [Nuxt API](https://nuxt.com/docs/4.x/api) | Verify composables, utilities and config APIs |
| Views | [Views](https://nuxt.com/docs/4.x/getting-started/views) | App, layout and page composition |
| Configuration | [Configuration](https://nuxt.com/docs/4.x/getting-started/configuration) | `nuxt.config.ts` versus app configuration |
| Assets | [Assets](https://nuxt.com/docs/4.x/getting-started/assets) | Bundled CSS versus public static fixture |
| Routing | [Routing](https://nuxt.com/docs/4.x/getting-started/routing) | File-based pages, middleware, route validation |
| Transitions | [Transitions](https://nuxt.com/docs/4.x/getting-started/transitions) | Framework-supported page/layout motion when needed |
| Data fetching | [Data fetching](https://nuxt.com/docs/4.x/getting-started/data-fetching) | `useAsyncData`, `useFetch`, `$fetch` and SSR cookie forwarding |
| Errors | [Error handling](https://nuxt.com/docs/4.x/getting-started/error-handling) | Page/API errors and recovery |
| Prerendering | [Prerendering](https://nuxt.com/docs/4.x/getting-started/prerendering) | Understand why static generation cannot supply host APIs |
| Tests | [Testing](https://nuxt.com/docs/4.x/getting-started/testing) | Vitest and Nuxt-aware test environment |
| Guides | [Nuxt guide](https://nuxt.com/docs/4.x/guide) | Framework concepts and recipes |
| Private runtime values | [Runtime config](https://nuxt.com/docs/4.x/guide/going-further/runtime-config) | Server environment variables and public/private boundary |
| Authentication | [Sessions and authentication](https://nuxt.com/docs/4.x/guide/recipes/sessions-and-authentication) | Route middleware and server session checks |
| Node deployment | [Deployment](https://nuxt.com/docs/4.x/getting-started/deployment) | Server build/runtime and environment injection |

## Working with AI

- [Nuxt Working with AI / MCP](https://nuxt.com/docs/4.x/guide/ai) documents structured documentation resources and tools. Official server URL: [Nuxt MCP](https://nuxt.com/mcp).
- [Nuxt LLMs.txt](https://nuxt.com/docs/4.x/guide/ai/llms-txt) describes AI-readable documentation feeds. Use version-appropriate content and check installed types; a large documentation feed is not a substitute for reading the relevant API.
- [Nuxt documentation discovery feed](https://nuxt.com/llms.txt) and [Nuxt UI discovery feed](https://ui.nuxt.com/llms.txt) are lookup entry points.
- [Anti-Slop source](https://github.com/miqdadbadjuber/anti-slop) identifies the optional quality filter referenced by `AGENTS.md`. Read the installed matching core/modules, follow its mode rules, and report missing tools rather than inventing plugin availability.

MCP/agent configuration is environment-specific and is not installed or changed by this documentation. Do not copy another assistant's config format into Codex without checking the current tool's official setup instructions.

The MCP URL is a protocol endpoint, not a documentation webpage. During this audit it returned HTTP 405 to a plain GET; validate it with a compatible MCP client before claiming a working connection. The other 70 unique reference URLs used across the documentation resolved with HTTP 200 at the audit time, including redirects. This checks reachability, not every fragment or example's compatibility.

## Nuxt UI and visualization

| Topic | Official reference | Use |
| --- | --- | --- |
| Theme | [Nuxt UI theme](https://ui.nuxt.com/docs/getting-started/theme) | Semantic colors and component slots |
| Cards | [UCard](https://ui.nuxt.com/docs/components/card) | Standard surfaces/default padding |
| Navigation | [UNavigationMenu](https://ui.nuxt.com/docs/components/navigation-menu), [USidebar](https://ui.nuxt.com/docs/components/sidebar) | Services children and responsive shell |
| Tables | [Expandable rows](https://ui.nuxt.com/docs/components/table#with-expandable-rows) | systemd/process detail rows |
| Pagination | [UPagination](https://ui.nuxt.com/docs/components/pagination) | Local process paging |
| Modals and forms | [UModal](https://ui.nuxt.com/docs/components/modal), [UAccordion](https://ui.nuxt.com/docs/components/accordion), [UFormField](https://ui.nuxt.com/docs/components/form-field) | Settings composition and above-input labels |
| Font module | [Nuxt Fonts](https://nuxt.com/modules/fonts) | Inter |
| Icon module | [Nuxt Icon](https://nuxt.com/modules/icon) | Installed Lucide icon set |
| Image module | [Nuxt Image](https://nuxt.com/modules/image), [image docs](https://image.nuxt.com/) | Module enabled; use for raster assets as needed |
| Chart options | [Chart.js tooltip](https://www.chartjs.org/docs/latest/configuration/tooltip.html) | Opaque fill and color-swatch callbacks |
| Chart types | [Doughnut](https://www.chartjs.org/docs/latest/charts/doughnut.html), [line](https://www.chartjs.org/docs/latest/charts/line.html) | Composition and resource trends |
| Vue integration | [vue-chartjs](https://vue-chartjs.org/guide/) | Client chart wrappers |
| Accessibility | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Contrast, keyboard, focus and non-color cues; not a conformance claim |

Swiss Style is the owner's chosen visual direction, documented in `DESIGN.md`. Nuxt UI documentation supplies implementation APIs; it does not dictate JCore's brand or layout.

## Authentication, runtime and validation

- [Nuxt Auth Utils](https://github.com/atinux/nuxt-auth-utils): sealed sessions, server guard, composable and secret requirements. Match the installed 0.5.30 release before using newer APIs.
- [Pinia Nuxt integration](https://pinia.vuejs.org/ssr/nuxt.html): shared service state; do not duplicate session management.
- [Vitest guide](https://vitest.dev/guide/): tests and project setup, together with Nuxt Test Utils guidance above.
- [AJV JSON Schema](https://ajv.js.org/json-schema.html): draft 2020-12 validation; JCore uses `Ajv2020` and `ajv-formats`.
- [Node 22 crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html): credential comparison and planned authenticated PAT encryption.
- [Node 22 child_process](https://nodejs.org/docs/latest-v22.x/api/child_process.html): read-only OS commands through `execFile`.
- [Node 22 filesystem](https://nodejs.org/docs/latest-v22.x/api/fs.html): procfs and host-file reads.

## Linux telemetry and operations

| Topic | Official reference | Use |
| --- | --- | --- |
| Prometheus API | [HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/) | Instant/range queries, targets and alerts |
| Prometheus config | [Configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/) | Scrape/evaluation intervals |
| Recording rules | [Recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) | VPS aggregate metrics |
| Alert rules | [Alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/) | Pending/firing and sustain duration |
| Rule testing | [Unit testing rules](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/) | Staging/promtool verification |
| Storage | [Storage](https://prometheus.io/docs/prometheus/latest/storage/) | Retention and backups; no repo backup automation |
| Node Exporter | [Official repository](https://github.com/prometheus/node_exporter) | Host collectors, systemd support and container limitations |
| Linux procfs | [Kernel /proc documentation](https://docs.kernel.org/filesystems/proc.html) | Process CPU/memory/state and available-memory semantics |
| systemctl | [Official manual](https://www.freedesktop.org/software/systemd/man/latest/systemctl.html) | Unit state/property inspection |
| Docker Compose | [Compose services](https://docs.docker.com/reference/compose-file/services/), [volumes](https://docs.docker.com/reference/compose-file/volumes/) | Host networking/mounts and persistent Prometheus volume |

See `server/utils/vps-dashboard.ts`, `server/utils/vps-processes.ts`, `server/utils/vps-systemd.ts` and `ops/vps/` for the precise selected queries, filters and deployment values.

## GitHub and planned Timeshit

These references support the [approved Timeshit plan](timeshit-implementation-plan.md); they do not describe an existing JCore integration.

- [Fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens): resource owner, permission and repository restrictions.
- [Authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user): connected account identity.
- [Authenticated repository discovery](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user): accessible repository set.
- [Branches](https://docs.github.com/en/rest/branches/branches#list-branches): remote head discovery.
- [Commit list](https://docs.github.com/en/rest/commits/commits#list-commits): author filter, branch/head SHA and pagination.
- [Commit detail](https://docs.github.com/en/rest/commits/commits#get-a-commit): changed files and patch availability.
- [Contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference): author/committer dates and why JCore's all-branches view differs.
- [REST troubleshooting](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api): permission errors and ambiguous private-resource 404s.
- [Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api), [best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api), [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions): bounded collection and upstream compatibility.

## Keeping references useful

Link directly to the relevant official API/section, note the installed version when behavior is version-sensitive, and record project-specific choices separately from upstream requirements. Recheck links and API assumptions when updating a dependency or contract. Never use an online example to claim a JCore feature exists without locating its implementation.
