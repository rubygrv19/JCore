# JCore Pending Work Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a green local baseline, close small audit items, then execute release verification gates in dependency order without changing approved product scope.

**Architecture:** Local code/test fixes come first because every later release check depends on a passing suite. Audit cleanup follows. Environment-dependent release gates come last because they need the real HTTPS host, operator credentials and deployment approval. UX-01 is a decision gate, not implementation work until the owner approves it.

**Tech Stack:** Nuxt 4.6.3, Nuxt UI 4.12.0, Vue 3.5.44, Pinia, Vitest 5.0.5, `@nuxt/test-utils` 4.3.4, pnpm 12.5.1, Node 22 baseline, Chart.js.

**Spec:** `docs/project-audit-2026-10-14.md`, `docs/timeshit-verification-report.md`, `docs/timeshit-acceptance.md`, `ops/vps/VERIFY.md`, `docs/README.md`.

## Global Constraints

- Work on `development`. Preserve every pre-existing uncommitted change.
- Progress (October 30, 2026): Tasks 1–6 committed and pushed as `a7ec203`. Task 7 (UX-01) deferred by owner until after HTTPS/Ubuntu release gates; current clear-on-leave retained. Remaining: Tasks 8–11.
- Do not commit, push, publish or deploy unless the owner explicitly asks for that action.
- Do not reset, stash or discard unrelated work.
- Keep `pnpm-lock.yaml`; do not introduce npm as the package manager.
- Node engine range: `^22.22.3 || ^24.15.0 || >=26.0.0`; CI baseline remains Node 22.
- Use English for app copy and documentation. Preserve external source content unchanged.
- Never print, commit or paste real PATs, session secrets, admin credentials or private database content.
- Real-host checks need owner approval and must use isolated temporary databases/servers where the runbook requires it.
- For application changes run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. For documentation-only changes validate links, paths and commands.

---

### Task 1: Restore green test baseline by isolating the calendar regression

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, possibly `pnpm-workspace.yaml`
- Test: `test/nuxt/timeshit-calendar.nuxt.test.ts`
- Record: `docs/project-audit-2026-10-14.md`

**Interfaces:**
- Consumes: current uncommitted dependency set from October 29.
- Produces: a passing full suite; documented root cause and permanent minimal pin/fix.

- [x] **Step 1: Reproduce the current failure**

Run:

```bash
pnpm vitest run test/nuxt/timeshit-calendar.nuxt.test.ts
```

Expected: FAIL with `TypeError: Cannot read properties of null (reading 'ce')` in `reka-ui/src/Calendar/CalendarRoot.vue`.

- [x] **Step 2: Confirm the old baseline still passes**

Do not stash the dirty worktree. Create a separate temporary worktree at the last committed baseline:

```bash
git worktree add /tmp/jcore-calendar-baseline ecdc0a8
cd /tmp/jcore-calendar-baseline
pnpm install --frozen-lockfile
pnpm vitest run test/nuxt/timeshit-calendar.nuxt.test.ts
```

Expected: PASS. Remove the worktree after recording the result:

```bash
cd /Users/rubygrv/projects/JCore
git worktree remove /tmp/jcore-calendar-baseline
```

- [x] **Step 3: Bisect the harness first**

In the main worktree, temporarily pin only the test harness:

```bash
pnpm add -D @nuxt/test-utils@4.3.2
pnpm vitest run test/nuxt/timeshit-calendar.nuxt.test.ts
```

If PASS, keep 4.3.2 only if the project can still run the full suite and the security rationale for 4.3.4 is not lost. Record the decision in the audit document.

- [x] **Step 4: If still failing, bisect the runtime packages one at a time**

Use one temporary pin per run, restoring the previous pin before testing the next:

```bash
pnpm add @nuxt/ui@4.11.3
pnpm vitest run test/nuxt/timeshit-calendar.nuxt.test.ts
```

If still failing:

```bash
pnpm add @nuxt/ui@4.12.0
pnpm add -D happy-dom@20.14.5
pnpm vitest run test/nuxt/timeshit-calendar.nuxt.test.ts
```

If still failing, test Vue 3.5.43 by editing the existing override in `pnpm-workspace.yaml`:

```yaml
overrides:
  vue: 3.5.43
```

Then run:

```bash
pnpm install --lockfile-only
pnpm vitest run test/nuxt/timeshit-calendar.nuxt.test.ts
```

Restore `vue: 3.5.44` if this does not fix the failure.

- [x] **Step 5: Apply the smallest permanent fix**

Keep only the pin that makes the calendar test pass without reintroducing a known advisory. Prefer a test-harness pin over downgrading the application runtime. Do not change the calendar test to skip the interaction; the test exists to prove calendar selection works.

- [x] **Step 6: Run the full local verification**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: `pnpm test` passes all tests, including `test/nuxt/timeshit-calendar.nuxt.test.ts`; typecheck, lint and build pass.

- [x] **Step 7: Record the result**

Append to the October 29 AUD-01 record in `docs/project-audit-2026-10-14.md`:

```markdown
Calendar regression resolution: [root cause], [permanent pin/fix], full suite passing on [date].
```

- [x] **Step 8: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml test/nuxt/timeshit-calendar.nuxt.test.ts docs/project-audit-2026-10-14.md
```

---

### Task 2: Close AUD-11 schema title drift

**Files:**
- Modify: `docs/timeshit-activity.schema.json:4`
- Verify: `docs/timeshit-activity-contract.md`, `docs/timeshit-activity.examples.json`, `test/unit/timeshit-activity.test.ts`
- Record: `docs/project-audit-2026-10-14.md`

**Interfaces:**
- Consumes: implemented activity handlers and current contract wording.
- Produces: schema metadata that matches actual implementation; no schema shape/version change.

- [x] **Step 1: Confirm stale title**

Run:

```bash
rg -n "HTTP handlers not implemented|contract foundation" docs/timeshit-activity.schema.json docs/timeshit-activity-contract.md docs/timeshit-implementation-plan.md
```

Expected: stale schema title found; contract/plan wording already says handlers are implemented.

- [x] **Step 2: Update the title**

Change:

```json
"title": "Timeshit activity contract foundation (HTTP handlers not implemented)"
```

to:

```json
"title": "Timeshit activity contract"
```

- [x] **Step 3: Validate JSON and tests**

```bash
node -e "JSON.parse(require('node:fs').readFileSync('docs/timeshit-activity.schema.json','utf8')); console.log('schema ok')"
pnpm vitest run test/unit/timeshit-activity.test.ts
```

Expected: `schema ok`; contract tests pass.

- [x] **Step 4: Mark AUD-11 closed in the tracker**

Update the summary table and AUD-11 acceptance checkboxes in `docs/project-audit-2026-10-14.md`.

- [x] **Step 5: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- docs/timeshit-activity.schema.json docs/project-audit-2026-10-14.md
```

---

### Task 3: Close AUD-12 checkbox pointer cursor

**Files:**
- Modify: `app/pages/settings.vue:288`
- Verify: Settings disconnect modal
- Record: `docs/project-audit-2026-10-14.md`

**Interfaces:**
- Consumes: existing `disconnectConfirmed` checkbox and disconnect confirmation flow.
- Produces: enabled checkbox and label use pointer cursor; disabled state keeps non-pointer behavior.

- [x] **Step 1: Reproduce current markup**

Run:

```bash
sed -n '286,296p' app/pages/settings.vue
```

Expected: `<UCheckbox v-model="disconnectConfirmed" ...>` with no cursor class.

- [x] **Step 2: Add the minimal class**

```vue
<UCheckbox
  v-model="disconnectConfirmed"
  class="cursor-pointer"
  label="Remove the saved GitHub connection and tracked repository selection."
  :disabled="connectionBusy"
/>
```

- [x] **Step 3: Verify in the browser**

Start the isolated synthetic acceptance server, open Settings → Timeshit, open the disconnect confirmation, and inspect the enabled checkbox and its label. Expected: computed cursor is `pointer`. Disable the control via `connectionBusy` if reproducible and confirm it no longer looks clickable. Do not disconnect the owner's real connection.

- [x] **Step 4: Run checks**

```bash
pnpm typecheck
pnpm lint
```

- [x] **Step 5: Mark AUD-12 closed in the tracker**

Update the summary table and AUD-12 acceptance checkboxes in `docs/project-audit-2026-10-14.md`.

- [x] **Step 6: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- app/pages/settings.vue docs/project-audit-2026-10-14.md
```

---

### Task 4: Close AUD-10 unused demo chart

**Files:**
- Delete: `app/components/RevenueChart.client.vue`
- Modify: `DESIGN.md:109`
- Record: `docs/project-audit-2026-10-14.md`

**Interfaces:**
- Consumes: confirmed no direct or auto-import usage.
- Produces: no dead chart component; design guide no longer refers to it.

- [x] **Step 1: Confirm no usage remains**

```bash
rg -n "RevenueChart" . --glob '!app/components/RevenueChart.client.vue' --glob '!docs/project-audit-2026-10-14.md'
```

Expected: only `DESIGN.md` references the unused component.

- [x] **Step 2: Remove the component**

```bash
rm app/components/RevenueChart.client.vue
```

- [x] **Step 3: Update DESIGN.md**

Remove the sentence identifying `RevenueChart.client.vue` as an unused component. Keep the surrounding Chart.js/vue-chartjs guidance unchanged.

- [x] **Step 4: Verify build**

```bash
pnpm build
```

Expected: build passes with no missing-component reference.

- [x] **Step 5: Mark AUD-10 closed in the tracker**

Update the summary table and AUD-10 acceptance checkboxes in `docs/project-audit-2026-10-14.md`.

- [x] **Step 6: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- DESIGN.md app/components/RevenueChart.client.vue docs/project-audit-2026-10-14.md
```

---

### Task 5: Close AUD-06 with the actual successful CI run

**Files:**
- Modify: `docs/project-audit-2026-10-14.md`
- Verify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: workflow on `development` and GitHub Actions run `40829488434`.
- Produces: tracker records the successful remote run instead of saying CI execution is unverified.

- [x] **Step 1: Confirm the workflow content**

```bash
sed -n '1,60p' .github/workflows/ci.yml
```

Expected: push and pull-request triggers; install, lint, typecheck, test and build steps.

- [x] **Step 2: Confirm the successful run**

```bash
gh run view 40829488434 --json headSha,headBranch,event,conclusion,jobs
```

Expected: `headSha` starts with `ecdc0a8`, branch `development`, event `push`, conclusion `success`, job `ci (ubuntu-latest, 22)` success.

- [x] **Step 3: Update AUD-06**

Change the table status to `Fixed; successful GitHub Actions run recorded`. Check the remaining acceptance box and add the run identifier/date in the AUD-06 remediation record.

- [x] **Step 4: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- docs/project-audit-2026-10-14.md .github/workflows/ci.yml
```

---

### Task 6: Complete AUD-09 mobile visual verification

**Files:**
- Verify: `app/pages/services/vps.vue`, `app/pages/services/timeshit.vue`, `app/pages/settings.vue`
- Record: `docs/project-audit-2026-10-14.md`

**Interfaces:**
- Consumes: refactored page lifecycle composables and current local app.
- Produces: mobile-width visual evidence; no refactor unless a real overflow/accessibility defect is found.

- [x] **Step 1: Start the local app**

```bash
pnpm dev
```

Open the printed loopback URL.

- [x] **Step 2: Verify at mobile width**

Use the browser viewport control at 390px width. Check `/services/vps`, `/services/timeshit`, and Settings → Timeshit in light and dark themes.

Expected: no page-level horizontal overflow; wide tables scroll inside their containers; controls remain reachable; labels remain readable.

- [x] **Step 3: Verify keyboard and reduced motion**

Tab through the affected controls. Confirm visible focus, accessible names, Enter/Space activation, and no animation-only state indicator.

- [x] **Step 4: Record evidence**

Update AUD-09 acceptance and the remediation record with viewport, routes, themes, and result. If a defect is found, add a focused task before closing AUD-09.

- [x] **Step 5: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- docs/project-audit-2026-10-14.md
```

---

### Task 7: Decide UX-01 before writing navigation-retention code

**Files:**
- Modify only after approval: `app/stores/timeshit-activity.ts`, `app/pages/services/timeshit.vue`, `docs/timeshit-activity-contract.md`, `test/nuxt/timeshit-activity.nuxt.test.ts`
- Record: `docs/project-audit-2026-10-14.md`

**Interfaces:**
- Consumes: current behavior where leaving Timeshit resets repository state and clears activity.
- Produces: owner decision. If approved, a non-persistent snapshot retained across in-app navigation; no localStorage persistence.

- [x] **Step 1: Ask the owner for the decision**

Decision (October 30, 2026): **Defer**. Keep reset-on-leave. Do not implement retention until after Tasks 8–9. Steps 2–6 remain blocked unless the owner later approves UX-01.

- [ ] **Step 2: If approved, write the failing lifecycle test first**

Add a Nuxt/Pinia test covering: navigate away pauses scheduling; snapshot remains in memory; return shows the same scope; resume continues the same revision; logout/account/selection change still clears.

Run:

```bash
pnpm vitest run test/nuxt/timeshit-activity.nuxt.test.ts
```

Expected before implementation: FAIL on the new navigation-retention case.

- [ ] **Step 3: Implement the smallest lifecycle change**

Change only the existing attach/detach lifecycle and snapshot reset conditions. Do not persist private activity to browser storage. Do not keep polling while the view is hidden or unmounted.

- [ ] **Step 4: Run checks**

```bash
pnpm vitest run test/nuxt/timeshit-activity.nuxt.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 5: Update contract and tracker**

Update `docs/timeshit-activity-contract.md` lifecycle text and UX-01 in `docs/project-audit-2026-10-14.md`.

- [ ] **Step 6: Review diff, do not commit unless asked**

```bash
git diff --check
git diff -- app/stores/timeshit-activity.ts app/pages/services/timeshit.vue docs/timeshit-activity-contract.md docs/project-audit-2026-10-14.md test/nuxt/timeshit-activity.nuxt.test.ts
```

---

### Task 8: Complete public HTTPS/proxy/browser acceptance

**Files:**
- Verify: deployed `https://` origin, reverse proxy configuration, browser session behavior
- Record: `docs/timeshit-verification-report.md`

**Interfaces:**
- Consumes: real deployment with an approved HTTPS origin and valid certificate.
- Produces: evidence for TLS, proxy Origin preservation, cache bypass and Secure-cookie behavior. No code change unless a defect appears.

- [x] **Step 1: Confirm owner approval and target origin**

Target origin under review: `https://jcore.rubygrv.cloud` (documented example). October 30, 2026 probe: DNS `43.163.109.28`; ports `80`/`443`/`3000`/`8080`/`8443` closed. HTTPS acceptance is blocked until the owner deploys/opens the public listener. Do not change DNS, firewall, proxy or TLS without explicit approval.

- [ ] **Step 2: Check TLS and headers**

```bash
curl -I https://YOUR_APP_ORIGIN/login
```

Expected: valid HTTPS response; no certificate error; security headers/cookie behavior match the documented production policy.

- [ ] **Step 3: Check private routes through the public origin**

```bash
curl -i https://YOUR_APP_ORIGIN/api/vps/dashboard
curl -i https://YOUR_APP_ORIGIN/api/vps/processes
```

Expected: `401` without a session; `Cache-Control: private, no-store` on authenticated responses; proxy/CDN does not cache private routes.

- [ ] **Step 4: Browser sign-in and cookie check**

Open the public origin in a real browser. Sign in, inspect the session cookie, and confirm `__Host-jcore-session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`. Verify sign-out removes access.

- [ ] **Step 5: Record evidence and remaining limits**

Update the verification report release gate 1 with date, origin, browser, results, and any unverified proxy/CDN behavior.

- [ ] **Step 6: Review documentation diff, do not commit unless asked**

```bash
git diff --check
git diff -- docs/timeshit-verification-report.md
```

---

### Task 9: Complete Ubuntu release operator configuration

**Files:**
- Follow: `ops/vps/VERIFY.md`, `docs/timeshit-acceptance.md`
- Record: `docs/timeshit-verification-report.md`, `ops/vps/VERIFY.md`

**Interfaces:**
- Consumes: isolated Ubuntu acceptance already passed; real host and operator access now required.
- Produces: persistent DB/key location, supervised Node process, HTTPS proxy, backup/restart policy, OS-reboot evidence, and the VPS release checklist.

- [ ] **Step 1: Freeze a release candidate**

Record the commit, Ubuntu version, Node/pnpm versions, collector image tags and build command. Build on Ubuntu; do not copy macOS `.output`.

- [ ] **Step 2: Configure private runtime state**

Set private environment variables through the service manager. Place the Timeshit SQLite database and encryption key outside `public/`, `.nuxt/` and `.output/`, with restricted file access and separate backup policy.

- [ ] **Step 3: Start under the real service manager**

Run the built Nuxt Node server as the dedicated unprivileged application user. Do not rely on `pnpm start` alone for daemon supervision. Confirm the listener stays on loopback behind the HTTPS proxy.

- [ ] **Step 4: Verify persistence and restart**

Connect/reconnect using an approved test credential, restart the app process, and confirm encrypted connection metadata and tracked selection persist. Reboot the host and confirm service supervision and persistent state return. Do not print the PAT or key.

- [ ] **Step 5: Execute the VPS release checklist**

Run `ops/vps/VERIFY.md` items 1–11 on the actual host: app checks, 401s, cookie attributes, cache bypass, live dashboard values, process coverage, alert timing, collector-failure states, pagination, responsive/keyboard checks, and login throttling.

- [ ] **Step 6: Record evidence**

Update `docs/timeshit-verification-report.md` release gate 3 and `ops/vps/VERIFY.md` with pass/fail evidence. Keep secrets and host-specific private values out of documentation.

- [ ] **Step 7: Review documentation diff, do not commit unless asked**

```bash
git diff --check
git diff -- ops/vps/VERIFY.md docs/timeshit-verification-report.md
```

---

### Task 10: Optional two-real-account acceptance

**Files:**
- Follow: `docs/timeshit-acceptance.md`
- Record: `docs/timeshit-verification-report.md`

**Interfaces:**
- Consumes: owner-approved second GitHub account and PAT.
- Produces: real account-switching evidence. If approval is unavailable, record the verified deferral.

- [ ] **Step 1: Obtain explicit owner approval**

Do not use a second real account or token without approval. Do not paste tokens into chat, logs or repository files.

- [ ] **Step 2: Use the isolated lifecycle flow**

Run the real lifecycle helper in an isolated acceptance database/server. Verify same-account replacement retains selection after recheck; different-account replacement clears prior selection and private activity/history.

- [ ] **Step 3: Record evidence or deferral**

Update release gate 4 in `docs/timeshit-verification-report.md`. If not approved, retain the synthetic-evidence boundary.

- [ ] **Step 4: Review documentation diff, do not commit unless asked**

```bash
git diff --check
git diff -- docs/timeshit-verification-report.md
```

---

### Task 11: Final release audit and authorization gate

**Files:**
- Modify: `docs/project-audit-2026-10-14.md`, `docs/README.md`, `docs/timeshit-verification-report.md`
- Verify: whole worktree

**Interfaces:**
- Consumes: completed tasks 1–10.
- Produces: accurate open/closed status, advisory recheck, final diff review, and an explicit commit/push/deploy decision by the owner.

- [ ] **Step 1: Recheck dependency advisories**

```bash
pnpm audit --prod
pnpm audit
```

Expected: document current counts; do not hide remaining advisories. Recheck `esbuild@0.27.7` and `deepmerge@4.3.1` upstream before release.

- [ ] **Step 2: Update status summaries**

Remove stale "pending" claims only where evidence exists. Keep environment-specific release gates explicit. Do not describe local or mocked checks as production acceptance.

- [ ] **Step 3: Run final checks**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

- [ ] **Step 4: Final diff review**

```bash
git status --short --branch
git diff --stat
git diff
```

- [ ] **Step 5: Ask owner for commit/push/deploy authorization**

Do not commit, push or deploy without an explicit request. Report what changed, what passed, what remains unverified, and whether browser/host checks were actually completed.

---

## Execution Order Summary

1. Task 1 — restore green suite (blocks all other confidence).
2. Tasks 2–5 — close small audit items and stale tracker evidence.
3. Task 6 — mobile visual verification.
4. Task 7 — UX-01 owner decision; implementation only if approved.
5. Tasks 8–10 — real HTTPS, Ubuntu release configuration and optional second-account acceptance.
6. Task 11 — final audit, checks and authorization gate.

## Self-Review

- Calendar regression: Task 1.
- AUD-06 CI evidence: Task 5.
- AUD-09 mobile check: Task 6.
- AUD-10 unused chart: Task 4.
- AUD-11 schema title: Task 2.
- AUD-12 checkbox cursor: Task 3.
- UX-01 decision: Task 7.
- AUD-01 residual advisories: Task 11.
- Public HTTPS/proxy gate: Task 8.
- Ubuntu release/operator gate: Task 9.
- Two-real-account optional gate: Task 10.
- No placeholders: each task names exact files, commands or code.
- Type consistency: no new types or interfaces introduced; tasks reuse existing store, route and UI names.
