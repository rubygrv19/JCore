# JCore project audit and remediation tracker

Audit date: October 14, 2026. Working branch: `development`.

AUD-01 status refreshed October 29, 2026: the current audit reports 0 critical, 0 high, 0 moderate, and 2 low advisories; see the new record below. Historical status updated October 15, 2026: AUD-02 through AUD-05 were fixed and verified locally; reverse proxy/CDN behavior remains a host release check. AUD-06's workflow changes were implemented locally but await a successful GitHub Actions run. AUD-07 and AUD-08 were fixed locally; AUD-09's refactor and desktop check were completed, with mobile visual verification then pending; AUD-10 through AUD-12 remained open; UX-01 remained a recommendation. Historical audit evidence is retained as recorded on October 14.

Status updated October 30, 2026: AUD-06 is fixed and confirmed by successful GitHub Actions run `40829488434`; AUD-09 mobile rendering and AUD-12 cursor/focus behavior are verified at 390px; AUD-10 and AUD-11 are fixed and verified locally. UX-01 is deferred until after public HTTPS/Ubuntu release gates. A fresh probe of `jcore.rubygrv.cloud` still finds no open public HTTP(S) ports. See the remediation records below.

## Scope and evidence

The audit reviewed Nuxt structure, frontend state, server routes, authentication, private data handling, VPS metric interpretation, Timeshit collection lifecycle, UI conventions, CI, dependencies, and documentation. It also inspected local VPS rendering and the Timeshit Settings modal at desktop/mobile viewport sizes.

This is a dated snapshot of the working tree, including existing uncommitted Timeshit work. Source paths below identify evidence locations; line numbers may move during remediation. Recheck the current implementation before editing. No exploit, resource-exhaustion test, or public deployment validation was performed.

Priority meanings:

- **P1:** address before public deployment.
- **P2:** correctness, privacy hardening, or verification gap to address in the next maintenance pass.
- **P3:** maintainability, UI consistency, or documentation cleanup.

## Remediation order

| Order | ID | Priority | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | AUD-01 | P1 | Dependency security advisories | Mitigated; 2 low advisories remain (Oct 29 audit: 0C/0H/0M/2L) |
| 2 | AUD-02 | P1 | Login request body has no application byte limit | Fixed; local HTTP/browser verification passed |
| 3 | AUD-03 | P1 | Login attempts share one global quota | Fixed locally; production proxy check remains a release gate |
| 4 | AUD-04 | P2 | Repository refresh resets activity collection state | Fixed locally; tests and browser refresh check passed |
| 5 | AUD-05 | P2 | Private VPS responses lack explicit no-store headers | Fixed locally; route tests cover success and errors |
| 6 | AUD-06 | P2 | CI omits tests, production build, and PR trigger | Fixed; successful GitHub Actions run recorded |
| 7 | AUD-07 | P2 | Network overview and trend use different scopes | Fixed locally; aggregation and null handling tested |
| 8 | AUD-08 | P3 | Shared VPS contracts live under app directories | Fixed locally |
| 9 | AUD-09 | P3 | Large pages combine view and service orchestration | Fixed; desktop and mobile rendering verified |
| 10 | AUD-10 | P3 | Unused demo chart remains in source | Fixed; unused chart removed and build passed |
| 11 | AUD-11 | P3 | Activity schema title is outdated | Fixed; schema title corrected |
| 12 | AUD-12 | P3 | Interactive checkbox lacks pointer cursor | Fixed; enabled and disabled cursor states verified |
| Decision | UX-01 | P3 | Navigation clears collected activity | Deferred until after public HTTPS/Ubuntu release gates |

## Findings

### AUD-01: Dependency security advisories

**Evidence:** `pnpm audit --prod --json` reported 4 critical, 30 high, 16 moderate, and 6 low vulnerabilities across the resolved production dependency tree. These counts do not represent 56 independently exploitable application routes. Inspect [package.json](../package.json) and [pnpm-lock.yaml](../pnpm-lock.yaml).

Examples identified during triage:

| Package | Installed | Advisory patched range | Observed path/context |
| --- | --- | --- | --- |
| `sharp` | 0.35.4 | >=0.35.5 | Nuxt Image -> ipx; present in the inspected server artifact |
| `devalue` | 5.9.0 | >=5.9.3 for the reviewed advisories | Nuxt/Nitro; present in the inspected server artifact |
| `tar` | 7.5.15 | >=7.5.19 | Nuxt/Nitro tracing dependency chain |
| `simple-git` | 3.36.0 | >=4.0.1 | Nuxt DevTools dependency chain |
| `@simple-git/argv-parser` | 1.1.1 | >=2.0.1 | Nuxt DevTools -> simple-git |
| `shell-quote` | 1.10.0 | >=1.11.0 | Nuxt DevTools -> launch-editor |

The inspected artifact contained `sharp` and `devalue`. The listed build/development packages were absent from its top-level server `node_modules`; this is not an exhaustive bundle reachability proof. The sharp advisory describes a Linux vulnerability under particular runtime conditions. The audit did not establish that JCore exposes those conditions.

**Action:** refresh the advisory inventory, determine runtime/build reachability, and update compatible direct dependencies and their resolved transitive packages. Avoid blind major upgrades or forced audit fixes. Review changes to the lockfile and Nuxt/Image compatibility.

**Acceptance:**

- [x] Record remaining advisories, affected paths, reachability, and any justified deferral.
- [x] Confirm installed and built artifact versions after updating.
- [x] Run tests, lint, typecheck, and production build.
- [x] Open affected local routes and verify charts, images, authentication, and service pages.

References: [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [tar advisory](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [argv-parser advisory](https://github.com/advisories/GHSA-v5rq-49vh-5v5c), [simple-git advisory](https://github.com/advisories/GHSA-x6jw-m9v5-85vh), [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).

### AUD-02: Login request body has no application byte limit

**Evidence:** [login handler](../server/api/auth/login.post.ts), especially `parseAdminCredentials(await readBody(event))`, reads the complete request before credential length validation in [admin-auth](../server/utils/admin-auth.ts). Inspection of installed H3 1.15.11 confirmed that this reader accumulates body chunks without an application byte bound.

**Impact:** a large request can allocate memory before validation. An upstream proxy may impose limits, but this audit did not establish such a guarantee. This finding is not an authentication bypass.

**Action:** enforce a small documented byte limit while reading, validate accepted JSON Content-Type, and apply a documented Origin policy that supports the intended same-origin login flow. Review the existing bounded-reader approach in [Timeshit HTTP utilities](../server/utils/timeshit-http.ts) before adding infrastructure.

**Acceptance:**

- [x] Test valid credentials and invalid JSON/credential shapes.
- [x] Test oversized declared and chunked bodies with bounded synthetic inputs.
- [x] Test unsupported Content-Type and allowed/rejected Origin cases.
- [x] Verify ordinary browser login still works and errors expose no secrets.

### AUD-03: Login attempts share one global quota

**Evidence:** [login handler](../server/api/auth/login.post.ts) has one module-level attempts object. [Login rate limit](../server/utils/login-rate-limit.ts) consumes the shared quota of 10 attempts per 60 seconds.

**Impact:** one caller can exhaust the quota and temporarily prevent the administrator from signing in. The limiter is per Node process, so it also resets on restart and does not coordinate multiple workers.

**Action:** add bounded per-client throttling plus a global safeguard. Define trusted proxy handling before using forwarded addresses; do not trust arbitrary client-supplied forwarding headers. Keep the solution appropriate for the approved single-administrator deployment.

**Acceptance:**

- [x] Test same-client throttling and independent-client behavior.
- [x] Test expiry, bounded limiter storage, and `Retry-After`.
- [x] Test that untrusted forwarded headers cannot bypass the policy.
- [x] Document the actual deployment topology and remaining per-process limits.

### AUD-04: Repository refresh resets activity collection state

**Evidence:** Previously, `load()` in [repository store](../app/stores/timeshit-repositories.ts) set `tracked` to null before fetching. The synchronous scope watcher in [activity store](../app/stores/timeshit-activity.ts) resets activity when tracked generation or selection revision changes. [Timeshit page](../app/pages/services/timeshit.vue) refreshes repositories through this path.

**Impact:** refreshing repository discovery, including its paging path, can clear the snapshot and continuation even when the actual account and tracked selection remain unchanged. This finding comes from the source lifecycle trace; the audit did not click refresh on the owner's completed collection.

**Action:** retain the last valid tracked scope while refreshing. Invalidate activity when the confirmed account, connection generation, tracked selection revision, or authentication scope changes. Preserve protection against late responses and stale account data.

**Acceptance:**

- [x] Refresh and discovery paging preserve activity for an unchanged scope.
- [x] Failed non-auth refresh retains the last valid tracked selection and activity snapshot.
- [x] A confirmed tracked-selection change invalidates activity; existing watchers invalidate on account, generation, and authentication changes.
- [x] Repository and activity request revisions prevent late responses from restoring state after reset or scope invalidation.
- [x] Verify the Timeshit route loads, synthetic collection reaches complete, and the completed snapshot remains after repository refresh in the browser. Pinia tests cover collecting, paused, completed, and expired transitions; pause/expiry were not separately held open in the browser.

### AUD-05: Private VPS responses lack explicit no-store headers

**Evidence:** Previously, [dashboard endpoint](../server/api/vps/dashboard.get.ts) and [process endpoint](../server/api/vps/processes.get.ts) required a session but did not set `Cache-Control: private, no-store`. Private Timeshit handlers already use this policy.

**Impact:** application-level cache policy for private host/process data depends on downstream defaults. The audit did not reproduce a cache leak.

**Action:** apply the private no-store policy before authentication and response generation, covering success and errors. Document proxy/CDN cache bypass requirements as defense in depth.

**Acceptance:**

- [x] Check headers on success, unauthenticated, unsupported-platform, and unavailable-source responses.
- [x] Confirm both routes still require a valid session before collectors run.
- [x] Update security, architecture, and Ubuntu verification documentation; actual proxy/CDN behavior remains a host release check.

### AUD-06: CI omits tests, production build, and PR trigger

**Evidence at audit time:** [CI workflow](../.github/workflows/ci.yml) ran only on pushes with Ubuntu/Node 22 and included installation, lint, and typecheck only.

**Impact:** automated checks can pass without detecting unit test or production build regressions before a merge.

**Action:** run the required unit tests and production build, and trigger checks for pull requests. Make frozen lockfile installation explicit. Align the Node matrix with documented supported runtimes; adding Node 24 is a recommendation to assess, not an existing requirement.

**Acceptance:**

- [x] Validate workflow syntax and commands against package scripts.
- [x] Configure push and pull request triggers to run lint, typecheck, unit tests, and production build.
- [x] Record an actual successful CI run; a local run alone does not prove CI execution. GitHub Actions run `40829488434` completed successfully on `development` at `ecdc0a8` (October 29, 2026).

### AUD-07: Network overview and trend use different scopes

**Evidence:** [VPS page](../app/pages/services/vps.vue) uses `latest.network.interfaces[0]` for the overview. [VPS collector](../server/utils/vps-dashboard.ts) sums filtered interfaces for network history queries.

**Impact:** the overview and trend can show different totals on hosts with multiple interfaces, including virtual/VPN interfaces. This is a scope/label consistency issue, not proof that the raw counters are incorrect.

**Action:** choose one explicit scope for comparable values, or clearly label per-interface overview versus aggregate history. Do not assume that the first interface is the primary/public interface. Document filtering and update contract examples if semantics change.

**Acceptance:**

- [x] Test at least two interfaces with different traffic values.
- [x] Verify unavailable values are omitted only when another returned series exists; a total with no available series remains unknown (`null`).
- [x] Confirm overview, trend, tooltip units, one-interface mock fixture, unchanged response schema, and updated contract agree.

### AUD-08: Shared VPS contracts live under app directories

**Evidence at audit time:** server code imported VPS types and response validation from `app/`; the original file locations are retained in the October 14 audit snapshot. The current implementation is documented in the [VPS contract](vps-response-contract.md) and the [architecture source map](architecture.md#source-map).

**Impact:** the project builds, but frontend/server ownership is less clear than the existing Timeshit shared-contract pattern. This is a maintainability finding, not a claim that Nuxt forbids these imports.

**Action:** move shared pure types/validators to `shared/types` and `shared/utils`; move the Nuxt composable to `app/composables`. Preserve response semantics and avoid unrelated abstraction changes.

**Acceptance:**

- [x] Update imports and documentation references without duplicate contracts.
- [x] Verify no shared module imports browser-only or server-private code.
- [x] Keep existing schema/fixture validation and application checks passing.

### AUD-09: Large pages combine view and service orchestration

**Evidence:** [VPS page](../app/pages/services/vps.vue) contains 1,010 lines; [Timeshit page](../app/pages/services/timeshit.vue) contains 1,050 lines in the audited working tree.

**Impact:** polling, derived state, formatting, table definitions, and rendering are harder to review together. File size alone is not a bug.

**Action:** extract cohesive view logic into composables or pure helpers where this reduces responsibility and duplication. Preserve Nuxt UI primitives, current behavior, and the project's restrictions on custom components. Do not split code solely to meet an arbitrary line count.

**Acceptance:**

- [x] Preserve observable behavior and state ownership.
- [x] Add focused tests for page mount/unmount orchestration and VPS polling cleanup.
- [x] Verify desktop page rendering and collection lifecycle after refactoring.
- [x] Verify mobile page rendering after refactoring.

### AUD-10: Unused demo chart remains in source

**Evidence at audit time:** `app/components/RevenueChart.client.vue` contained 87 lines. The audit found no application usage; the design document also identified it as unused.

**Action:** confirm it remains unused, remove it, and update references that describe its presence. Do not remove approved multi-API client foundations merely because placeholder services are not live yet.

**Acceptance:**

- [x] Search for direct and auto-import usage before removal.
- [x] Update affected documentation and verify the build. The component was deleted on October 30, 2026; `DESIGN.md` no longer identifies it, and the production build passed.

### AUD-11: Activity schema title is outdated

**Evidence at audit time:** [activity schema](timeshit-activity.schema.json) had the title `Timeshit activity contract foundation (HTTP handlers not implemented)` although handlers were implemented.

**Action:** correct descriptive metadata and check nearby activity documentation for the same stale wording. Do not alter the API shape or version just to fix this title.

**Acceptance:**

- [x] Schema descriptions agree with the actual routes and current contract. The title was corrected to `Timeshit activity contract` on October 30, 2026.
- [x] Schema JSON parses and existing validation tests pass.

### AUD-12: Interactive checkbox lacks pointer cursor

**Evidence:** the disconnect confirmation `UCheckbox` in [Settings](../app/pages/settings.vue), labeled `Remove the saved GitHub connection and tracked repository selection.`, rendered with `cursor: default` in the inspected modal.

**Action:** use Nuxt UI styling hooks to apply pointer behavior to the enabled checkbox and its clickable label. Preserve appropriate disabled behavior and keyboard focus.

**Acceptance:**

- [x] Verify computed cursor for the enabled control and label. The disconnect checkbox uses `cursor-pointer` when enabled and `cursor-not-allowed` when busy; the enabled computed cursor was `pointer` at mobile width on October 30, 2026.
- [x] Verify keyboard toggle, focus visibility, and disabled states. Keyboard focus reached the checkbox with a visible outline; the busy state is bound to the disabled state and `cursor-not-allowed`.
- [x] Keep the disconnect action protected by its existing confirmation; do not disconnect the owner's account during verification.

## UX recommendation requiring a behavior decision

### UX-01: Preserve collection state during navigation

Leaving Timeshit currently resets repository state and therefore clears the dependent activity snapshot. [The activity contract](timeshit-activity-contract.md) documents this behavior. It is not an undocumented implementation defect.

Recommendation: retain a valid snapshot in Pinia memory while navigating within the application, pause active collection when leaving the view, and provide an explicit resume path when returning. Continue to clear private state on logout or actual account/selection changes. Browser reload persistence and storage of private activity in localStorage are not part of this recommendation.

Owner decision (October 30, 2026): **Deferred**. Keep the documented clear-on-leave behavior for now. Revisit after the public HTTPS/proxy and Ubuntu operator release gates. No lifecycle implementation in this pass.

- [x] Confirm the desired navigation behavior before implementation. Deferred; current reset-on-leave retained.
- [ ] If approved later, update lifecycle tests and the activity contract together.
- [ ] Verify navigation, return, expiry, logout, and account changes.

## Verified foundation and intentional boundaries

The audit found a Nuxt 4 structure using `app/pages`, layouts, middleware, Pinia, `server/api`, `server/utils`, and shared Timeshit contracts. Private routes have session checks. Timeshit holds its encrypted PAT on the server, uses a fixed GitHub origin, validates requests, and exposes partial collection coverage. Commit identity uses repository ID and SHA. The approved Swiss Style/monochrome direction and Nuxt UI usage do not require a wholesale redesign.

Keep these existing boundaries explicit during remediation:

- Live VPS collection targets Linux; macOS/Windows development uses labeled fixtures.
- Settings modes and most service Base URLs remain temporary drafts. They do not control host services.
- Code Review and Quota Tracker remain Coming Soon.
- The approved deployment is one administrator and one application process. Distributed infrastructure is not automatically required.
- Public HTTPS deployment, proxy behavior, host permissions, and complete OS coverage require their own runtime evidence.

## Audit verification record

These checks ran during the audit preceding this document:

| Check | Result |
| --- | --- |
| `pnpm test` | Passed: 194 tests across 34 files |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `git diff --check` | Passed |
| `pnpm audit --prod --json` | Advisories remain; see AUD-01 |
| Inspected VPS layouts and Timeshit Settings modal | No horizontal overflow at the inspected viewport sizes |

The production build was not rerun during this audit. Earlier build/Ubuntu results are historical evidence, not fresh checks for these findings. The audit did not prove the absence of all bugs, inspect every visual interaction, or validate public HTTPS deployment. Creating this Markdown file does not rerun application checks.

## Fix workflow and closure requirements

1. Read [project rules](../AGENTS.md), [design guidance](../DESIGN.md), and the affected contract before editing.
2. Work on `development`; preserve unrelated uncommitted changes.
3. Reproduce or reconfirm the finding against current source. Apply the smallest complete fix.
4. Update tests, contracts, mock JSON, and documentation when behavior or semantics change.
5. For application changes, run tests, lint, typecheck, and production build. Open affected local pages after substantial UI/routing changes and check responsive behavior.
6. Record actual evidence below. Mark an item closed only when its acceptance checks are satisfied, or explain a verified deferral and remaining risk.
7. Commit, push, and deploy only when the owner explicitly requests those actions.

Use one entry per completed item:

```text
ID:
Status: Fixed / Deferred / Not reproducible
Date:
Changed files:
Implementation summary:
Tests and runtime evidence:
Remaining limits:
Commit: Not committed / actual commit identifier
```

### AUD-01 remediation record: October 15, 2026

**Status:** Mitigated with documented deferrals. The dependency tree is not advisory-free. No other finding was addressed at the AUD-01 step.

**Changed files:** `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, `docs/development.md`, `docs/references.md`, and this tracker.

**Implementation:**

- Updated Nuxt 4.5.2 to 4.6.1 and Nuxt UI 4.11.2 to 4.11.3. The compatible production dependency refresh also updated the Lucide collection from 1.2.134 to 1.2.143.
- Refreshed affected transitive resolutions, including sharp 0.35.5, devalue 6.0.3, tar 7.5.22, shell-quote 1.12.0, brace-expansion 2.1.7/5.0.12, source-map-js 1.2.2, and prosemirror-view 1.42.6. Updated affected development resolutions for js-yaml and postcss-selector-parser as well.
- Scoped the DevTools override to `@nuxt/devtools@^3.4.2 -> 3.4.3`. This patch removes simple-git rather than forcing its incompatible v4 export API into DevTools 3.4.2. The three exact DevTools 3.4.3 package versions have release-age exceptions in workspace configuration; the exception is narrow and must be reviewed when upgrading Nuxt/DevTools again. No advisory was hidden through an audit ignore rule.
- Aligned the declared Node engine with Nuxt 4.6.1: `^22.22.3 || ^24.15.0 || >=26.0.0`. Local verification used Node 22.23.2 on macOS arm64 with pnpm 12.5.1. Other allowed Node versions and the updated Linux artifact have not been verified in this change.

**Audit results:**

| Scope | Critical | High | Moderate | Low |
| --- | --- | --- | --- | --- |
| Production tree before updates | 4 | 30 | 16 | 6 |
| Production tree after updates | 0 | 2 | 0 | 1 |
| All dependencies after updates | 0 | 2 | 0 | 1 |

Both final audit commands still exit nonzero because the three advisories remain. Counts describe dependency advisories, not proven exploitable JCore routes.

**Remaining advisory decisions:**

| Package/advisory | Observed path and use | Reason for deferral and follow-up |
| --- | --- | --- |
| `node-forge@1.4.0`, High, [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Nuxt -> Nitro -> nitropack -> listhen -> node-forge. Installed listhen references forge for local TLS certificate handling. | No patched version was published at verification. No package directory was found anywhere in the inspected server artifact. Continue using the built Node server behind the intended TLS proxy; do not expose a development server. Recheck upstream before release or when listhen/Nitro updates. This does not prove every possible deployment is unaffected. |
| `braces@3.0.3`, High, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Nuxt -> Nitro -> nitropack -> globby -> fast-glob -> micromatch -> braces; build-time file globbing. | No patched version was published at verification. No package directory was found in the inspected server artifact and no app/server/shared source usage was found. Build trusted project inputs only; recheck upstream rather than substitute an incompatible package. |
| `esbuild@0.27.7`, Low, [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | Nuxt Fonts 0.14.0 -> fontless 0.2.1. The inspected fontless code imports esbuild `transform`; it does not call the esbuild development server. Other resolved esbuild paths use 0.28.2. | The advisory concerns esbuild's development server on Windows. No esbuild package directory was found in the inspected server artifact. Retained the fontless-supported range rather than force an out-of-range 0.x update or a Fonts major migration. Reassess if font tooling changes or an esbuild server is introduced. |

Artifact inspection also searched the generated server chunks for imports of these packages; it did not establish an application route invoking the vulnerable APIs. This is source/artifact triage, not an exploitability certification.

**Verification:**

- `pnpm install --frozen-lockfile`: passed after the update.
- `pnpm test`: 194 tests passed across 34 files on the completed dependency tree. The first run encountered six Nuxt setup hook timeouts under concurrent verification; the rerun passed with no skipped tests. Do not increase timeouts to conceal a persistent failure.
- `pnpm lint`, `pnpm typecheck`, and `pnpm build`: passed.
- Built artifact versions: sharp 0.35.5 and devalue 6.0.3. A direct ESM invocation of the traced sharp entry transformed an 8x8 synthetic image to a 4x4 PNG successfully. The initial check used untraced CommonJS/legacy entry paths and failed; the actual IPX import path is ESM and passed.
- Browser checks used the built production server with the existing synthetic acceptance launcher, an ephemeral database, and a synthetic administrator. Login and navigation to Dashboard, VPS, Timeshit (disconnected state), and Settings succeeded. VPS rendered eight chart canvases and expandable service details. The Timeshit Settings modal opened; no console errors were recorded in the checked flow. The modal fit a 390px viewport without horizontal overflow. The temporary viewport was reset.
- The owner's saved PAT/database was not changed, no live GitHub collection was rerun, and no real Ubuntu deployment was performed. Live source/HTTPS release checks remain separate.

**Non-blocking warnings to retain for follow-up:** pnpm reports optional WASM peer-range warnings for `@emnapi/core`/`@emnapi/runtime`; Nitro emits third-party annotation and `node:sqlite` externalization warnings. The service-type duplicate auto-import warning was removed on October 30, 2026 by dropping the Pinia store re-exports of `SERVICE_KEYS` / `Service*` so those symbols come only from `app/types/services.ts`. Tests and the built server passed on this platform. These remaining warnings are not proof of compatibility on untested platforms; verify the target Linux build before deployment.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-01 remediation record: October 29, 2026

**Status:** Targeted dependency remediation is complete. The dependency tree still has two low advisories; it is not advisory-free. No other audit point was addressed.

**Changed files:** `.nuxtrc`, `nuxt.config.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, `docs/development.md`, `docs/references.md`, `docs/security-and-configuration.md`, and this tracker.

**Implementation:**

- Updated Nuxt 4.6.1 to 4.6.3, Nuxt UI 4.11.3 to 4.12.0, Nuxt DevTools to 3.4.4, and `@nuxt/test-utils` 4.3.2 to 4.3.4. Updated Vitest to 5.0.5 and happy-dom to 21.0.4 for their patched advisories.
- Updated the Vue override to 3.5.44 to match Nuxt's installed requirements. Added workspace overrides for the transitive packages `fast-uri` 3.1.9, `serialize-javascript` 7.1.4 and `zod` 4.6.7. The DevTools release-age exceptions now match 3.4.4.
- Updated `node-forge` to 1.4.1. The upstream release re-encodes `DigestInfo` and requires a canonical encoding during RSA signature verification; see the [1.4.1 release](https://github.com/digitalbazaar/forge/releases/tag/v1.4.1), [verification implementation](https://github.com/digitalbazaar/forge/blob/v1.4.1/lib/rsa.js), and maintainer comment on [PR #1152](https://github.com/digitalbazaar/forge/pull/1152). The GitHub advisory page still reports no patched version despite that newer release; the resolved local tree and audit no longer flag `node-forge`.
- Added an empty source default for `runtimeConfig.session.password` so Nuxt's required session type passes while the deployment secret remains supplied through `NUXT_SESSION_PASSWORD`. No secret value was added to source or `.env.example`.
- Updated the Nuxt Test Utils setup version in `.nuxtrc`. Updated the Node engine references to the Nuxt 4.6.3 engine range.

**Audit results:**

| Scope | Critical | High | Moderate | Low |
| --- | --- | --- | --- | --- |
| Production tree before updates | 0 | 8 | 17 | 6 |
| Production tree after updates | 0 | 0 | 0 | 2 |
| All dependencies after updates | 0 | 0 | 0 | 2 |

Both audit commands still exit nonzero because two advisories remain. Counts describe dependency findings, not proven exploitable JCore routes.

**Remaining advisory decisions:**

| Package/advisory | Observed path | Reason for deferral and follow-up |
| --- | --- | --- |
| `esbuild@0.27.7`, Low, [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | `@nuxt/fonts@0.14.0` -> `fontless@0.2.1` -> esbuild. | The advisory concerns the Windows development server. Fontless 0.2.1 does not accept the patched 0.28.x line; retain the supported range and recheck when font tooling changes. |
| `deepmerge@4.3.1`, Low, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Nuxt -> Nitro -> nitropack -> `@rollup/plugin-node-resolve` -> deepmerge. | The advisory lists no published patched version. Recheck the upstream package and Nitro dependency chain before release. |

**Verification:**

- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The production build used the Nuxt Node server preset on macOS arm64; an Ubuntu build was not performed.
- Final audit counts were 0 critical, 0 high and 2 low in both production-only and full dependency scopes.
- `pnpm test` initially passed 268 of 269 tests across 39 files. The remaining failure was the Nuxt UI calendar interaction test, which threw `Cannot read properties of null (reading 'ce')` in Reka UI's `CalendarRoot`.
- Calendar regression resolution: an accidental npm install had created a root `package-lock.json` and a second, hoisted Vue runtime (`@vue/runtime-core` 3.5.43) beside pnpm's 3.5.44, so Reka UI's compiled render called `renderSlot` from a different Vue runtime instance than the one rendering the component and read a null `currentRenderingInstance`. The dependency updates were not the cause; focused pin tests of `@nuxt/test-utils` 4.3.2, Nuxt UI 4.11.3, happy-dom 20.14.5 and Vue 3.5.43 each still failed. The permanent fix is a clean pnpm-only install (remove the stray npm `package-lock.json` and reinstall `node_modules` from `pnpm-lock.yaml`); no dependency pin or downgrade was needed, so the 4.3.4 harness and the advisory fixes are retained. Full suite passed 269 of 269 tests across 39 files on October 30, 2026.
- No browser page was opened. No commit, push, deployment or live Ubuntu verification occurred.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-02 remediation record: October 15, 2026

**Status:** Fixed and verified locally. AUD-03 (global login quota) was intentionally unchanged at this step; its subsequent remediation is recorded below.

**Implementation:**

- Replaced login's unbounded H3 `readBody` call with `readLoginRequest` and a shared `readLimitedBody` utility extracted from the existing Timeshit reader.
- Login admits at most 8192 bytes before JSON parsing. Content-Length is checked before attaching buffering listeners, and streamed bytes are counted independently of the declared length. The reader rejects malformed/unsafe lengths, interrupted streams, and overflow without returning submitted credentials.
- Oversized Node responses set `Connection: close`. Streamed overflow removes buffering listeners and drains remaining input; Web streams are cancelled and their reader locks released. The explicit connection policy fixes the keep-alive case discovered during built-server verification, where a header-only oversized request could interfere with the following request.
- Login requires an exact configured HTTP(S) Origin, rejects cross-site Fetch Metadata, and accepts only uncompressed application/json (including charset parameters). Error statuses are 400 for malformed JSON/body, 403 for rejected Origin, 413 for overflow, 415 for unsupported media/encoding, and 503 for missing/invalid trusted configuration. Credential mismatches retain the generic 401 response.
- Added private `runtimeConfig.auth.trustedOrigin` / `NUXT_AUTH_TRUSTED_ORIGIN`. Development defaults to `http://127.0.0.1:3000`; production defaults to empty and fails closed. Host and forwarded headers cannot define the trusted Origin. Operators must set the exact external application origin before deployment and preserve Origin through the proxy.
- Timeshit keeps its separate Origin policy, 4096-byte limit, and INVALID_INPUT error code. Its handlers now reuse the same bounded reader; no PAT or database configuration was changed.
- Updated the synthetic, live lifecycle, and Ubuntu acceptance helpers with explicit login Origin configuration/headers so their intended verification flows remain compatible. These are fixture changes, not evidence of a new live GitHub or Ubuntu run.

**Files:** `server/api/auth/login.post.ts`, `server/utils/login-request.ts`, `server/utils/limited-body.ts`, `server/utils/timeshit-http.ts`, `nuxt.config.ts`, `.env.example`, `test/unit/login-request.test.ts`, the three Timeshit acceptance fixtures, and the relevant onboarding/architecture/security/runbook/reference documents.

**Verification:**

- Added 36 focused tests covering successful login/session creation, malformed JSON and credential shapes, generic credential failure, exact/rejected/missing Origin, forwarding-header spoofing, cross-site metadata, media/encoding rejection, invalid server Origin configuration, byte boundaries, UTF-8 overflow, declared and understated lengths, Node interruption/listener cleanup, Web cancellation/interruption, and Timeshit's preserved size/error behavior.
- A runnable Node HTTP regression test verifies early oversized rejection with `Connection: close` and a successful subsequent request through a keep-alive agent.
- Full suite: **230 tests passed across 35 files**. Lint, typecheck, production build, and diff whitespace checks passed. Existing dependency/tooling warnings remain those recorded under AUD-01.
- Built-server probes on loopback with synthetic credentials returned: rejected Origin 403; text/plain 415; malformed JSON 400; declared 8193-byte request without sending its body 413 with Connection close; chunked 8193-byte request 413 with Connection close; valid login JSON exactly 8192 bytes 200. Responses did not echo the synthetic password. The probes used small bounded payloads, not a resource-exhaustion attack.
- The production build's login page opened in the browser. Submitting the synthetic administrator credentials succeeded and rendered the protected Dashboard. Verification used an ephemeral acceptance database and did not change the owner's saved PAT or credentials.
- The temporary acceptance server was confirmed stopped after the interrupted session. The local development entry point is `http://127.0.0.1:3000`; use `pnpm dev` to restart it when needed. Browser tabs from a previous session are not assumed to have been closed.

**Resume verification:** after the interrupted session, the full 230-test suite, lint, typecheck, production build, documentation path checks, fixture syntax checks, and diff whitespace checks passed again. No application source changed during this finalization.

**Remaining limits at the AUD-02 step:** the shared per-process quota was still pending AUD-03 (addressed in the subsequent record); the body memory bound does not replace proxy/server connection or upload-timeout controls. Public HTTPS, proxy Origin preservation, and the updated Linux deployment have not been verified in this step.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-03 remediation record: October 15, 2026

**Status:** Fixed and verified locally. Production proxy configuration and host verification remain release gates. AUD-04 was addressed in the next remediation entry.

**Implementation:**

- Replaced the one shared 10-attempt quota with independent client budgets: 10 admitted attempts per client per 60-second fixed window, plus 100 admitted attempts per process per 60-second fixed window. Client-denied requests do not consume the global budget or extend the client cooldown. Success still consumes an attempt; no persistent account lockout was introduced.
- Limited the in-memory map to 128 client entries. Expired entries are reclaimed on subsequent requests. When full, new clients are rejected until the earliest retained entry expires; live budgets are never evicted to admit another client. This prevents storage growth and active quota resets through eviction. The bounded scan has at most 128 entries and needs no background timer.
- Windows use monotonic `performance.now()`. Rejections return 429 and a positive integer Retry-After, using the longer wait if both budgets are exhausted. Node throttling responses close the connection before reading a rejected body, preserving AUD-02's unread-body safety.
- Client keys come from the actual TCP socket peer by default; forwarded address headers and adapter clientAddress context cannot choose the key. IPv6 and IPv4-mapped representations are canonicalized so alternate spellings do not create fresh quotas. Missing/invalid peer data shares an unknown bucket.
- Added private `NUXT_AUTH_TRUSTED_PROXY_IPS` / `runtimeConfig.auth.trustedProxyIps`, empty by default. Only an explicitly listed exact peer IP enables the single X-Real-IP header. Invalid proxy configuration or a missing/invalid/chained/duplicated header from a trusted proxy fails closed with 503. X-Forwarded-For and Forwarded remain ignored for limiter identity.
- Recommended one-hop HTTPS Nginx -> loopback Nuxt after the owner requested a recommendation. The [proxy guide](security-and-configuration.md#login-client-identity-and-recommended-proxy-topology) includes header overwriting, Origin preservation, exact allowlisting, direct-access restrictions, and existing real-IP/CDN configuration checks. No VPS proxy, firewall, TLS, or service configuration was changed or assumed present.
- Acceptance fixtures explicitly disable proxy trust for their isolated direct-connection runs, preventing inheritance from the owner's environment. The existing lifecycle rate-limit regression was updated to the new factory API without removing its original window/eleventh-attempt assertions.

**Files:** `server/utils/login-rate-limit.ts`, `server/api/auth/login.post.ts`, `nuxt.config.ts`, `.env.example`, `test/unit/login-rate-limit.test.ts`, `test/unit/vps-lifecycle.test.ts`, the three acceptance fixtures, and the architecture/security/index/runbook/reference documents.

**Verification:**

- Added 27 tests for client/global limits, cooldown rounding and expiry, denied-attempt accounting, capacity/cleanup without eviction, independent instances, direct and trusted-proxy modes, spoofing rejection, IPv4/IPv6 canonicalization, unknown peers, invalid configuration, missing/chained/duplicated headers, and real Node HTTP responses/session behavior.
- Full suite: **257 tests passed across 36 files**. Lint, typecheck, production build, documentation path/fence checks, and diff whitespace checks passed on local macOS arm64 / Node 22.23.2. The first suite run exposed one older test importing the removed limiter function; that caller was updated and the full suite reran successfully. Existing dependency/tooling warnings are tracked under AUD-01.
- Built production server, direct mode: ten incorrect attempts carrying changing spoofed IP headers returned 401; the next attempt, even with correct synthetic credentials, returned 429 with Retry-After in 1..60 seconds, Connection close, and no session cookie.
- Built production server, configured loopback-proxy mode: client A exhausted ten attempts; its IPv4-mapped equivalent remained blocked; client B still signed in successfully with a session cookie. Missing or chained X-Real-IP returned 503. This verifies application trust handling, not a deployed Nginx configuration.
- Browser verification on an isolated production acceptance server: normal synthetic login opened Dashboard; after exhausting the same client budget and signing out, the next sign-in showed the expected rate-limit message and cleared the password draft. Verification used small synthetic requests and an ephemeral database; no real PAT, saved connection, or owner credential was changed.
- Temporary test servers/databases and the agent-created browser tab were cleaned up. The ordinary local development server was preserved.

**Remaining limits:** budgets are in-memory and per process; restarting resets them and multiple workers do not share counters. NAT/shared egress users share an IP budget. A source that can vary actual addresses can still exhaust the global safeguard. A compromised process on a trusted proxy host can reach loopback. This is not a denial-of-service guarantee or an account-based lockout. Verify the actual production proxy, header overwrite rules, and direct Nuxt access restrictions before enabling proxy trust or exposing the application.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-04 remediation record: October 15, 2026

**Status:** Fixed and verified locally. No commit, push, or deployment occurred.

**Implementation:**

- `useTimeshitRepositoriesStore.load()` no longer clears `tracked` at request start. The last verified repository selection remains available while discovery is loading and when a non-auth discovery request fails.
- The existing activity scope watcher remains authoritative: a confirmed generation, selection revision, account, connection state, or login change clears the private activity snapshot and invalidates pending collection responses. Existing request revisions continue to prevent late repository or activity responses from restoring state after reset.
- A saved selection response that confirms the existing scope does not reset activity. A changed selection response triggers the existing synchronous watcher before discovery completes; a generation mismatch still clears the tracked selection.
- Updated the activity contract and this tracker to describe refresh retention and invalidation semantics.

**Verification:**

- Added three Pinia integration tests: refresh/paging with unchanged scope preserves snapshot and continuation; a failed non-auth refresh preserves the last verified selection and snapshot; a confirmed selection revision change clears activity. Existing repository tests cover reset/late-response protection, and existing activity tests cover generation/account/logout changes and late collection responses.
- Targeted tests: **28 passed across 2 files**. Full suite: **260 passed across 36 files**. `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. Existing Nuxt duplicate auto-import and build warnings remain tracked under AUD-01; this change introduced no new warning.
- Opened the isolated production build in the browser using the documented synthetic acceptance server and a disposable database. Connected the fixture-only account and tracked its synthetic repository. Collection visibly entered `collecting`, completed with 1/1 repositories and 1/1 branches, and showed the synthetic commit. Clicking **Refresh repositories** preserved the completed snapshot and digest. This used no real PAT or GitHub request.
- Browser verification covered the route, collecting and complete states, and refresh retention. Paused/expired transitions are covered by the Pinia state tests rather than a timed browser wait.
- The existing local server on port 3000 and its database were not touched. The isolated server uses port 3001 and an ephemeral database; it was stopped and its temporary database removed after verification.

**Remaining limits:** navigation away still resets activity as documented under UX-01. The collection remains in-memory and is not restored after a full page reload. The synthetic browser fixture has one repository/page and cannot exercise real GitHub behavior or multi-page repository discovery.

**Commit:** Not committed. No push or deployment occurred during this remediation.
### AUD-05 remediation record: October 15, 2026

**Status:** Fixed and verified locally. Reverse proxy/CDN cache behavior remains a deployment check.

**Implementation:**

- Both private routes, `/api/vps/dashboard` and `/api/vps/processes`, now set `Cache-Control: private, no-store` as the first handler operation, before session validation, platform checks, or collection. This keeps private telemetry out of browser and shared caches on success and all handler error paths.
- Session validation remains mandatory and precedes platform checks and collectors. No proxy/CDN configuration was changed or inferred.
- Updated security, architecture, Ubuntu verification, and this audit document to match the route behavior and retain proxy/CDN verification as an operator release check.

**Verification:**

- Added four Nuxt route tests covering successful responses, unauthenticated 401 responses, unsupported-platform 501 responses, and collector failures (dashboard 503; process collector 500). Each asserts `Cache-Control: private, no-store`; auth and unsupported-platform tests also assert collectors are not called.
- Full suite: **264 tests passed across 37 files**. `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed. Nuxt duplicate auto-import, third-party annotation, and `node:sqlite` externalization warnings were present during existing project checks; the change introduced no additional warning.

**Remaining limits:** These tests verify Nuxt handler responses with mocked collectors and session rejection. They do not verify the real host's reverse proxy/CDN behavior or a deployed Ubuntu response. Confirm proxy/CDN bypass on the VPS before release.

**Commit:** Not committed. No push or deployment occurred during this remediation.
### AUD-06 remediation record: October 15, 2026

**Status:** Workflow corrected locally; GitHub Actions execution remains unverified because the workflow change has not been pushed. No commit or push was requested.

**Implementation:**

- CI now runs on both pushes and pull requests with read-only `contents` permission.
- Dependency installation uses `pnpm install --frozen-lockfile`; pnpm is explicitly pinned to the repository's `packageManager` version, 12.5.1.
- The job runs `lint`, `typecheck`, `test`, and `build`, each matching an existing `package.json` script.
- Retained the existing Ubuntu / Node 22 CI baseline. Node 22 is within the declared engine range and remains the documented CI baseline; Node 24 is not added because the audit labels it an optional recommendation to assess, not a required supported CI target.

**Verification:**

- Parsed the workflow YAML locally and confirmed that the push and pull-request events, required job steps, and package scripts are present. GitHub Actions event execution cannot be confirmed from an unpushed local change.
- The application verification immediately before this workflow-only change passed: **264 tests across 37 files**, lint, typecheck, and production build. The `pnpm install --frozen-lockfile` CI command still needs to run in GitHub Actions for remote confirmation.

**Remaining acceptance:** Push the change when requested, then record a successful GitHub Actions run on a push and pull request. Until then AUD-06 remains pending remote CI verification.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-06 remediation record: October 30, 2026

**Status:** Fixed. A successful GitHub Actions run now confirms remote CI execution. No commit or push was performed for this tracker update.

**Verification:**

- GitHub Actions run [40829488434](https://github.com/rubygrv19/JCore/actions/runs/40829488434) completed with conclusion `success` on `development` for event `push` at HEAD `ecdc0a8` (October 29, 2026).
- The `ci (ubuntu-latest, 22)` job passed every step: install dependencies with the frozen lockfile, lint, typecheck, test, and production build.
- The workflow still declares both `push` and `pull_request` triggers. The recorded run is a push run; no separate pull-request run is claimed.

**Remaining limits:** CI verifies Ubuntu/Node 22 only, matching the documented baseline.

**Commit:** Not committed. No push or deployment occurred during this tracker update.

### AUD-07 remediation record: October 15, 2026

**Status:** Fixed locally. No commit, push, or deployment occurred.

**Implementation:**

- The VPS Network overview no longer selects the first interface. It now sums RX/TX, error, and drop rates across the same filtered, monitored interfaces returned in the interface table.
- The donut center/details, overview footers, and accessible chart label now identify the aggregate scope. The network trend already uses Prometheus `sum(rate(...))` with the same interface filter, so overview and trend use matching units and scope.
- Aggregation follows Prometheus sum semantics: null/missing interface series do not become fabricated zero values; available series are summed, and a direction with no available values remains `null`/unavailable.
- Updated the VPS response contract. The response shape and schema did not change; the existing mock fixture has one interface, for which the aggregate equals that interface.

**Verification:**

- Added utility tests for two interfaces with different RX/TX, error, and drop rates; empty inputs; and partially unavailable values.
- Full suite: **266 tests passed across 37 files**. `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed. Existing Nuxt auto-import and third-party build warnings remain; no new warning was introduced by this change.
- The documented synthetic acceptance server was started on loopback port 3001 with a temporary database and synthetic credentials. After synthetic sign-in, `/services/vps` returned HTTP 200 with the `VPS — JCore` document title. The observed server-rendered HTML was still at `Loading VPS overview…`; browser-side hydration and the rendered metric values were not visually inspected. The acceptance server was stopped afterward. The existing local server on port 3000 was preserved.

**Remaining limits:** The existing fixture contains one interface, so multi-interface visual rendering is covered by the aggregation unit tests rather than a multi-interface browser fixture. This route smoke check confirms the protected VPS page shell, not the hydrated Network card. The existing Network status remains `unknown` while link capacity is unavailable; these rate sums do not establish interface capacity or network health.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-08 remediation record: October 15, 2026

**Status:** Fixed locally. No commit, push, or deployment occurred.

**Implementation:**

- Moved VPS dashboard and process response types to `shared/types/` and both AJV response validators to `shared/utils/`, using Nuxt's `#shared` alias. App pages, layout, dashboard composable, API handler, and Linux collectors now import the shared contract directly; no duplicate contract definitions were added.
- Moved `useVpsDashboard()` from `app/utils/` to `app/composables/`. It remains the Nuxt `useAsyncData()` client orchestration and continues using the same endpoint, key, fallback fixture, and error behavior.
- Kept process `$fetch` in `app/utils/vps-processes-client.ts`; that browser client delegates response validation to the shared pure validator. No browser-only or server-private imports were introduced into `shared/`.
- Updated the architecture map, development recipe, VPS contract source references, and this tracker.

**Verification:**

- Existing fixture, collector, and dashboard integration tests continue to exercise both response validators and preserve their schemas and behavior.
- Full suite, lint, typecheck, production build, documentation link checks, and `git diff --check` passed. Existing unrelated project/toolchain warnings remain tracked under AUD-01.

**Commit:** Not committed. No push or deployment occurred during this remediation.

### AUD-09 remediation record: October 15, 2026

**Status:** Page lifecycle extraction is implemented and verified locally. Desktop and 390px mobile routes rendered in the local browser.

**Implementation:**

- Extracted VPS dashboard refresh, process collection, freshness state, and polling cleanup into `app/composables/use-vps-monitoring.ts`. The page retains presentation-derived values, chart/table configuration, and UI-local state.
- Extracted Timeshit initial load, repository refresh, activity subscription lifecycle, and page cleanup into `app/composables/use-timeshit-page-lifecycle.ts`. Form and presentation state remain page-owned.
- Updated the architecture map and added Nuxt tests for the extracted lifecycle behavior. Templates and CSS were not changed, and no custom UI components were introduced.

**Verification:**

- Full suite: **269 tests passed across 39 files**. `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. `git diff --check` passed, and local Markdown links passed for 18 documents.
- The local desktop browser rendered `/services/vps` after hydration with the demo metrics and tables, and `/services/timeshit` with its existing connected state and controls. No service configuration or collection action was changed during this check.
- The synthetic acceptance server rendered `/services/vps`, `/services/timeshit`, and `/settings` at 390px in light and dark modes. Each page reported `scrollWidth === innerWidth === 390`; keyboard traversal showed visible focus outlines.
- Lifecycle tests cover initial loading, connected/disconnected repository refresh behavior, activity attach/detach, and stopping VPS pollers on unmount.

**Remaining acceptance:** None for this refactor. Public-host and real-account release checks remain separate.

**Commit:** Not committed. No push or deployment occurred.

### AUD-10, AUD-11, AUD-12 remediation record: October 30, 2026

**Status:** AUD-10, AUD-11, and AUD-12 are fixed and verified locally.

**Implementation:**

- AUD-10: confirmed no direct or auto-import usage of `RevenueChart.client.vue`, deleted the component, and removed the sentence in `DESIGN.md` that described it as an unused chart. Chart.js/vue-chartjs guidance is unchanged.
- AUD-11: changed only the activity schema title to `Timeshit activity contract`. The schema shape, version, examples, and contract wording were not changed.
- AUD-12: made the disconnect-confirmation `UCheckbox` use `cursor-pointer` when enabled and `cursor-not-allowed` when busy. The checkbox label, confirmation requirement, disabled binding, and keyboard behavior are unchanged.

**Verification:**

- AUD-10/AUD-11: the schema parses, and `test/unit/timeshit-activity.test.ts` passed 8/8 tests across 3 suites.
- AUD-12: `pnpm typecheck`, `pnpm lint`, and the production build passed. Mobile browser inspection at 390px confirmed the enabled computed cursor is `pointer`, keyboard focus has a visible outline, and the page has no horizontal overflow. The busy state was not triggered live; its disabled binding and `cursor-not-allowed` class are present in source.
- `pnpm build` passed after the component deletion with no missing-component reference. Existing Nuxt duplicate-import, Rollup annotation, and `node:sqlite` externalization warnings remain; this batch introduced no new warning.

**Remaining acceptance:** Mobile cursor/focus verification is recorded above. A separate desktop-only cursor recheck was not repeated; the same markup applies at both widths. Do not disconnect the owner's real connection.

**Commit:** Included in `a7ec203` on `development`.

### Duplicate service auto-import cleanup: October 30, 2026

**Status:** Fixed and verified locally.

**Implementation:** Removed `SERVICE_KEYS` / `Service*` re-exports from `app/stores/services.ts` so Nuxt auto-import resolves those symbols only from `app/types/services.ts`. Updated `test/nuxt/services.nuxt.test.ts` to import `SERVICE_KEYS` from the types module.

**Verification:** Fresh `pnpm test` (**269/269**), `pnpm typecheck`, `pnpm lint` and `pnpm build` passed. Build log contains no `Duplicated imports` warnings for the service symbols. Remaining Nitro `node:sqlite` externalization and third-party annotation warnings are unchanged.

**Commit:** Pending with the documentation refresh that records this cleanup.
