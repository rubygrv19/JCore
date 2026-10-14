# JCore project audit and remediation tracker

Audit date: October 14, 2026. Working branch: `development`.

Status: findings recorded; remediation has not started. The owner requested this document as the reference for subsequent fixes. Creating this tracker does not implement or close any finding.

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
| 1 | AUD-01 | P1 | Dependency security advisories | Open |
| 2 | AUD-02 | P1 | Login request body has no application byte limit | Open |
| 3 | AUD-03 | P1 | Login attempts share one global quota | Open |
| 4 | AUD-04 | P2 | Repository refresh resets activity collection state | Open |
| 5 | AUD-05 | P2 | Private VPS responses lack explicit no-store headers | Open |
| 6 | AUD-06 | P2 | CI omits tests, production build, and PR trigger | Open |
| 7 | AUD-07 | P2 | Network overview and trend use different scopes | Open |
| 8 | AUD-08 | P3 | Shared VPS contracts live under app directories | Open |
| 9 | AUD-09 | P3 | Large pages combine view and service orchestration | Open |
| 10 | AUD-10 | P3 | Unused demo chart remains in source | Open |
| 11 | AUD-11 | P3 | Activity schema title is outdated | Open |
| 12 | AUD-12 | P3 | Interactive checkbox lacks pointer cursor | Open |
| Decision | UX-01 | P3 | Navigation clears collected activity | Recommendation; not an undocumented bug |

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

- [ ] Record remaining advisories, affected paths, reachability, and any justified deferral.
- [ ] Confirm installed and built artifact versions after updating.
- [ ] Run tests, lint, typecheck, and production build.
- [ ] Open affected local routes and verify charts, images, authentication, and service pages.

References: [sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [tar advisory](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [argv-parser advisory](https://github.com/advisories/GHSA-v5rq-49vh-5v5c), [simple-git advisory](https://github.com/advisories/GHSA-x6jw-m9v5-85vh), [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).

### AUD-02: Login request body has no application byte limit

**Evidence:** [login handler](../server/api/auth/login.post.ts), especially `parseAdminCredentials(await readBody(event))`, reads the complete request before credential length validation in [admin-auth](../server/utils/admin-auth.ts). Inspection of installed H3 1.15.11 confirmed that this reader accumulates body chunks without an application byte bound.

**Impact:** a large request can allocate memory before validation. An upstream proxy may impose limits, but this audit did not establish such a guarantee. This finding is not an authentication bypass.

**Action:** enforce a small documented byte limit while reading, validate accepted JSON Content-Type, and apply a documented Origin policy that supports the intended same-origin login flow. Review the existing bounded-reader approach in [Timeshit HTTP utilities](../server/utils/timeshit-http.ts) before adding infrastructure.

**Acceptance:**

- [ ] Test valid credentials and invalid JSON/credential shapes.
- [ ] Test oversized declared and chunked bodies with bounded synthetic inputs.
- [ ] Test unsupported Content-Type and allowed/rejected Origin cases.
- [ ] Verify ordinary browser login still works and errors expose no secrets.

### AUD-03: Login attempts share one global quota

**Evidence:** [login handler](../server/api/auth/login.post.ts) has one module-level attempts object. [Login rate limit](../server/utils/login-rate-limit.ts) consumes the shared quota of 10 attempts per 60 seconds.

**Impact:** one caller can exhaust the quota and temporarily prevent the administrator from signing in. The limiter is per Node process, so it also resets on restart and does not coordinate multiple workers.

**Action:** add bounded per-client throttling plus a global safeguard. Define trusted proxy handling before using forwarded addresses; do not trust arbitrary client-supplied forwarding headers. Keep the solution appropriate for the approved single-administrator deployment.

**Acceptance:**

- [ ] Test same-client throttling and independent-client behavior.
- [ ] Test expiry, bounded limiter storage, and `Retry-After`.
- [ ] Test that untrusted forwarded headers cannot bypass the policy.
- [ ] Document the actual deployment topology and remaining per-process limits.

### AUD-04: Repository refresh resets activity collection state

**Evidence:** `load()` in [repository store](../app/stores/timeshit-repositories.ts) sets `tracked` to null before fetching. The synchronous scope watcher in [activity store](../app/stores/timeshit-activity.ts) resets activity when tracked generation or selection revision changes. [Timeshit page](../app/pages/services/timeshit.vue) refreshes repositories through this path.

**Impact:** refreshing repository discovery, including its paging path, can clear the snapshot and continuation even when the actual account and tracked selection remain unchanged. This finding comes from the source lifecycle trace; the audit did not click refresh on the owner's completed collection.

**Action:** retain the last valid tracked scope while refreshing. Invalidate activity when the confirmed account, connection generation, tracked selection revision, or authentication scope changes. Preserve protection against late responses and stale account data.

**Acceptance:**

- [ ] Refresh and discovery paging preserve activity for an unchanged scope.
- [ ] Failed refresh does not silently erase a valid snapshot.
- [ ] Real selection/account/auth changes still invalidate activity.
- [ ] Late requests cannot restore data from an obsolete scope.
- [ ] Verify collecting, paused, completed, and expired states in the browser.

### AUD-05: Private VPS responses lack explicit no-store headers

**Evidence:** [dashboard endpoint](../server/api/vps/dashboard.get.ts) and [process endpoint](../server/api/vps/processes.get.ts) require a session but do not set `Cache-Control: private, no-store`. Private Timeshit handlers already use this policy.

**Impact:** application-level cache policy for private host/process data depends on downstream defaults. The audit did not reproduce a cache leak.

**Action:** apply the private no-store policy before authentication and response generation, covering success and errors. Document proxy/CDN cache bypass requirements as defense in depth.

**Acceptance:**

- [ ] Check headers on authenticated, unauthenticated, unsupported-platform, and unavailable-source responses.
- [ ] Confirm private routes still require a valid session.
- [ ] Update security documentation to match the implemented policy.

### AUD-06: CI omits tests, production build, and PR trigger

**Evidence:** [CI workflow](../.github/workflows/ci.yml) runs on pushes with Ubuntu/Node 22 and includes installation, lint, and typecheck only.

**Impact:** automated checks can pass without detecting unit test or production build regressions before a merge.

**Action:** run the required unit tests and production build, and trigger checks for pull requests. Make frozen lockfile installation explicit. Align the Node matrix with documented supported runtimes; adding Node 24 is a recommendation to assess, not an existing requirement.

**Acceptance:**

- [ ] Validate workflow syntax and commands against package scripts.
- [ ] Confirm push and pull request checks execute the required jobs.
- [ ] Record an actual successful CI run; a local run alone does not prove CI execution.

### AUD-07: Network overview and trend use different scopes

**Evidence:** [VPS page](../app/pages/services/vps.vue) uses `latest.network.interfaces[0]` for the overview. [VPS collector](../server/utils/vps-dashboard.ts) sums filtered interfaces for network history queries.

**Impact:** the overview and trend can show different totals on hosts with multiple interfaces, including virtual/VPN interfaces. This is a scope/label consistency issue, not proof that the raw counters are incorrect.

**Action:** choose one explicit scope for comparable values, or clearly label per-interface overview versus aggregate history. Do not assume that the first interface is the primary/public interface. Document filtering and update contract examples if semantics change.

**Acceptance:**

- [ ] Test at least two interfaces with different traffic values.
- [ ] Verify unknown values remain unknown rather than becoming zero.
- [ ] Confirm chart labels, overview, tooltip units, mock JSON, schema, and contract agree.

### AUD-08: Shared VPS contracts live under app directories

**Evidence:** server code imports [VPS types](../app/types/vps.ts), [process types](../app/types/vps-processes.ts), and [response validation](../app/utils/vps-response.ts) from `app/`. [VPS client](../app/utils/vps-client.ts) defines `useVpsDashboard()` using Nuxt `useAsyncData()` under `utils/`.

**Impact:** the project builds, but frontend/server ownership is less clear than the existing Timeshit shared-contract pattern. This is a maintainability finding, not a claim that Nuxt forbids these imports.

**Action:** move shared pure types/validators to `shared/types` and `shared/utils`; move the Nuxt composable to `app/composables`. Preserve response semantics and avoid unrelated abstraction changes.

**Acceptance:**

- [ ] Update imports and documentation references without duplicate contracts.
- [ ] Verify no shared module imports browser-only or server-private code.
- [ ] Keep existing schema/fixture validation and application checks passing.

### AUD-09: Large pages combine view and service orchestration

**Evidence:** [VPS page](../app/pages/services/vps.vue) contains 1,010 lines; [Timeshit page](../app/pages/services/timeshit.vue) contains 1,050 lines in the audited working tree.

**Impact:** polling, derived state, formatting, table definitions, and rendering are harder to review together. File size alone is not a bug.

**Action:** extract cohesive view logic into composables or pure helpers where this reduces responsibility and duplication. Preserve Nuxt UI primitives, current behavior, and the project's restrictions on custom components. Do not split code solely to meet an arbitrary line count.

**Acceptance:**

- [ ] Preserve observable behavior and state ownership.
- [ ] Add focused tests where extracted logic exposes previously untested behavior.
- [ ] Verify desktop/mobile rendering and collection lifecycle after refactoring.

### AUD-10: Unused demo chart remains in source

**Evidence:** [RevenueChart.client.vue](../app/components/RevenueChart.client.vue) contains 87 lines. The audit found no application usage; the design document also identifies it as unused.

**Action:** confirm it remains unused, remove it, and update references that describe its presence. Do not remove approved multi-API client foundations merely because placeholder services are not live yet.

**Acceptance:**

- [ ] Search for direct and auto-import usage before removal.
- [ ] Update affected documentation and verify the build.

### AUD-11: Activity schema title is outdated

**Evidence:** [activity schema](timeshit-activity.schema.json) still has the title `Timeshit activity contract foundation (HTTP handlers not implemented)` although handlers are implemented.

**Action:** correct descriptive metadata and check nearby activity documentation for the same stale wording. Do not alter the API shape or version just to fix this title.

**Acceptance:**

- [ ] Schema descriptions agree with the actual routes and current contract.
- [ ] Schema JSON parses and existing validation tests pass.

### AUD-12: Interactive checkbox lacks pointer cursor

**Evidence:** the disconnect confirmation `UCheckbox` in [Settings](../app/pages/settings.vue), labeled `Remove the saved GitHub connection and tracked repository selection.`, rendered with `cursor: default` in the inspected modal.

**Action:** use Nuxt UI styling hooks to apply pointer behavior to the enabled checkbox and its clickable label. Preserve appropriate disabled behavior and keyboard focus.

**Acceptance:**

- [ ] Verify computed cursor for the enabled control and label.
- [ ] Verify keyboard toggle, focus visibility, and disabled states.
- [ ] Keep the disconnect action protected by its existing confirmation; do not disconnect the owner's account during verification.

## UX recommendation requiring a behavior decision

### UX-01: Preserve collection state during navigation

Leaving Timeshit currently resets repository state and therefore clears the dependent activity snapshot. [The activity contract](timeshit-activity-contract.md) documents this behavior. It is not an undocumented implementation defect.

Recommendation: retain a valid snapshot in Pinia memory while navigating within the application, pause active collection when leaving the view, and provide an explicit resume path when returning. Continue to clear private state on logout or actual account/selection changes. Browser reload persistence and storage of private activity in localStorage are not part of this recommendation.

- [ ] Confirm the desired navigation behavior before implementation.
- [ ] If approved, update lifecycle tests and the activity contract together.
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

No remediation entries have been recorded yet.
