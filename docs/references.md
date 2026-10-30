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
- [AJV JSON Schema](https://ajv.js.org/json-schema.html): VPS uses draft 2020-12 with `Ajv2020`; Timeshit uses draft-07 with `Ajv`. Both use `ajv-formats`. Compile the specific operation/envelope definition rather than accepting an unrelated member of a schema union.
- [Node 22 crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html): credential comparison and authenticated PAT encryption.
- [Node 22 child_process](https://nodejs.org/docs/latest-v22.x/api/child_process.html): read-only OS commands through `execFile`.
- [Node 22 filesystem](https://nodejs.org/docs/latest-v22.x/api/fs.html): procfs and host-file reads.

## GitHub Timeshit reads

- [GraphQL commits](https://docs.github.com/en/graphql/reference/commits): `Commit.history`, author filter, date arguments, and cursor fields. Its `since`/`until` descriptions do not guarantee author-date filtering.
- [GraphQL aliases](https://graphql.org/learn/queries/#aliases): independently named fields with separate variables in the bounded activity query.
- [GraphQL pagination](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api): cursor pagination behavior and connection limits.
- [GraphQL rate and query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api): point budgets and query node limits.
- [REST API endpoints for commits](https://docs.github.com/en/rest/commits/commits?apiVersion=2026-03-10): commit list filters, commit detail fields and changed-file pagination.
- [REST API pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api): GitHub `Link` headers and page behavior.
- [REST API best practices](https://docs.github.com/en/rest/guides/best-practices-for-integrators): pagination and conditional read guidance.

JCore's page sizes, route schemas and patch preview cap are application choices documented in the [Timeshit history contract](timeshit-history-contract.md), not GitHub requirements.

The [activity contract](timeshit-activity-contract.md) records collection-specific decisions and remaining operational verification:

- [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): upstream quota/header behavior; separate from JCore's conservative request/time/state budgets.
- [Chart.js scatter](https://www.chartjs.org/docs/latest/charts/scatter.html), [point styles](https://www.chartjs.org/docs/latest/configuration/elements.html#point-styles), and [accessibility](https://www.chartjs.org/docs/latest/general/accessibility.html): planned week/day square-marker rendering and accessible date/table controls using installed dependencies.

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

## GitHub and Timeshit

These references support the [approved Timeshit plan](timeshit-implementation-plan.md). Connection/PAT, repository management and history browsing are implemented. The [activity contract](timeshit-activity-contract.md) covers shared types/validation/date helpers, the bounded collector and HTTP handlers, client activity controls, daily digest/copy and heatmap UI; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md).

- [Fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens): resource owner, permission and repository restrictions.
- [Classic token scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps): private repo scope also grants write capabilities.
- [Repository identity](https://docs.github.com/en/rest/repos/repos#get-a-repository): documented owner/name lookup and stable numeric ID comparison.
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

- [Node 22 SQLite](https://nodejs.org/docs/latest-v22.x/api/sqlite.html): native DatabaseSync, experimental status and timeout support since 22.16.

## Dependency remediation: October 29, 2026

See [AUD-01 remediation evidence and remaining advisories](project-audit-2026-10-14.md#aud-01-remediation-record-october-29-2026) for the current dated decisions and verification.

- [Nuxt 4.6.3 release](https://github.com/nuxt/nuxt/releases/tag/v4.6.3): framework security and dependency update; package engine metadata remains aligned with the documented Node range.
- [Nuxt UI 4.12.0 release](https://github.com/nuxt/ui/releases/tag/v4.12.0) and [Nuxt DevTools 3.4.4 release](https://github.com/nuxt/devtools/releases/tag/v3.4.4): resolved framework/UI tooling versions.
- [Nuxt Test Utils 4.3.4 release](https://github.com/nuxt/test-utils/releases/tag/v4.3.4): test harness fixes. The October 29 calendar failure was a dual Vue runtime from an accidental npm `package-lock.json`, not this harness; a clean pnpm-only install restored the full suite.
- [node-forge 1.4.1 release](https://github.com/digitalbazaar/forge/releases/tag/v1.4.1), [RSA verification source](https://github.com/digitalbazaar/forge/blob/v1.4.1/lib/rsa.js) and [upstream PR #1152](https://github.com/digitalbazaar/forge/pull/1152): canonical `DigestInfo` validation used to remediate the high advisory; the [GitHub advisory record](https://github.com/advisories/GHSA-86w9-cpqp-85rv) has not caught up with the release evidence. [esbuild](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) and [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) remain under review.

## Dependency remediation: October 15, 2026 (historical)

See [AUD-01 remediation evidence and remaining advisories](project-audit-2026-10-14.md#aud-01-remediation-record-october-15-2026) for the dated decisions and verification.

- [Nuxt 4.6.1 release](https://github.com/nuxt/nuxt/releases/tag/v4.6.1) and published package engine metadata: compatible Node requirements and framework update.
- [Nuxt UI 4.11.3 release](https://github.com/nuxt/ui/releases/tag/v4.11.3): UI patch update.
- [Nuxt DevTools 3.4.3 release](https://github.com/nuxt/devtools/releases/tag/v3.4.3): removal of simple-git from the dependency tree.
- [simple-git 4.0.0 breaking changes](https://github.com/steveukx/git-js/releases/tag/simple-git@4.0.0): default export removal explains why a blind major override was rejected.
- [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), and [esbuild advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr): patched ranges and unresolved tooling triage. Recheck advisory status before release.

## Login request boundary: October 15, 2026

- [OWASP CSRF prevention: verifying Origin](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#using-standard-headers-to-verify-origin): exact source/target Origin comparison and explicit trusted target configuration behind proxies. JCore requires Origin for login instead of falling back to Referer.
- [Nuxt runtime configuration](https://nuxt.com/docs/4.x/guide/going-further/runtime-config): private `runtimeConfig.auth.trustedOrigin` and the matching `NUXT_AUTH_TRUSTED_ORIGIN` runtime variable. Installed project types/build verify the actual configuration shape.
- Installed H3 1.15.11 source was inspected: `readBody` buffers before parsing and has no byte-limit option. JCore therefore reuses its bounded stream reader instead of adding another dependency or using an unsupported API.

See [security and configuration](security-and-configuration.md#login-flow) for statuses, the 8 KiB login limit, and operator requirements.

## Login throttling: October 15, 2026

- [Nginx proxy_set_header](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header): overwriting upstream headers, including X-Real-IP from the proxy's remote address.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling): login throttling and denial-of-service tradeoffs. JCore's 10/client, 100/global, and 128-entry limits are application choices, not OWASP-prescribed values; there is no persistent account lockout.
- [Node net.isIP](https://nodejs.org/docs/latest-v22.x/api/net.html#netisipinput), [WHATWG URL](https://nodejs.org/api/url.html#the-whatwg-url-api), and [performance.now](https://nodejs.org/docs/latest-v22.x/api/perf_hooks.html#performancenow): IP validation/canonicalization and monotonic windows. Installed H3 getRequestIP source was inspected; JCore deliberately reads the socket peer directly instead of trusting forwarded headers or adapter context.

See [login identity and proxy policy](security-and-configuration.md#login-client-identity-and-recommended-proxy-topology) for the actual trust boundary and its limits.
