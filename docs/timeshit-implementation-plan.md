# Timeshit Service Implementation Plan

- **Status:** Phases 1–5 implemented. Phase 6 local hardening and browser verification is recorded in the [verification report](timeshit-verification-report.md). Public HTTPS/proxy and Ubuntu operator release gates remain open; UX-01 navigation retention is deferred. See the [pending execution plan](superpowers/plans/2026-10-30-pending-task-execution.md).
- **Scope:** Personal, single-user GitHub activity dashboard in JCore
- **Implementation:** Connection APIs, encrypted SQLite, Settings integration, repository discovery/selection, and read-only branch/commit/change browsing are implemented. See the [connection contract](timeshit-connection-contract.md), [repository contract](timeshit-repositories-contract.md), and [history contract](timeshit-history-contract.md). The [activity contract](timeshit-activity-contract.md) defines shared schemas, date/deduplication helpers, continuation behavior, budgets and the heatmap rendering choice. Its bounded HTTP handlers and collector are implemented; client collection controls and daily digest/copy are implemented; heatmap is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md).
- **Reference review:** October 30, 2026

Related guides: [documentation index](README.md), [existing architecture](architecture.md), [security/configuration](security-and-configuration.md), [UI design system](../DESIGN.md), and [official reference catalog](references.md). See the [current Connection/PAT contract](timeshit-connection-contract.md) for implemented endpoints, setup and limits. Remaining sections define the approved target, not completed functionality.

## 1. Goal

Build the Timeshit service so the signed-in JCore administrator can connect one GitHub account, browse repositories and their Git history, review commit changes, prepare a daily commit digest, and view a daily commit heatmap.

The connected GitHub account determines commit authorship. Repository discovery is limited by both that account's access and the PAT's granted access. This feature does not provide multi-user GitHub connections.

## 2. Approved decisions

- One JCore administrator uses this feature for personal use.
- The user configures a GitHub personal access token (PAT; fine-grained recommended, classic accepted) from the web Settings page.
- Store the PAT encrypted in SQLite on the server. Obtain a stable encryption key from server-only environment configuration and use the built-in `node:crypto` API.
- Never return the saved PAT through an API or include it in a session cookie, Pinia, browser storage, client-visible runtime config, logs, URLs, or mock data. The Settings form may hold the entered PAT temporarily in a local draft for submission.
- For fine-grained PATs, request **Metadata: read** and **Contents: read** repository permissions. Classic PATs need `repo` for private repositories; this also grants write capabilities. Use only read operations against GitHub; local Settings mutations do not mutate GitHub resources.
- Support one active PAT (fine-grained recommended; classic also approved by the owner on October 13, 2026). A fine-grained PAT's private-resource scope is limited to one resource owner; classic follows its scopes and organization policies. Do not promise access beyond the actual credential's permissions. Public repository access follows GitHub's documented exceptions.
- Persist the selected repositories in SQLite. Aggregate activity only from that tracked selection, within the token's accessible repository set.
- Include commits authored by the connected GitHub account from all current remote branches of tracked repositories. Deduplicate by stable repository ID and full commit SHA.
- Use `authoredAt` for digest and heatmap day grouping in `Asia/Jakarta`; preserve `committedAt` separately.
- A daily digest is a formatted list of commits, commit messages, and available commit descriptions. It is not an AI-generated summary.
- Provide two copy formats: plain text and Markdown.
- Keep generated application text in English and follow the existing JCore monochrome Swiss Style and Nuxt UI conventions. Preserve original commit messages, repository descriptions, file names, and patches in their source language.

## 3. Current project baseline

Settings implements the GitHub PAT connection, independent from its temporary Base URL/mode drafts. The encrypted PAT and account-bound tracked repositories persist in SQLite v3. The Timeshit page implements repository discovery/selection and branch/commit/file browsing. The application has a global route middleware for signed-in pages, private server handlers that call `requireUserSession(event)`, and Vitest scripts. Activity collection and daily digest/copy are implemented; heatmap is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md).

The implemented connection retains the per-service Base URL concept and uses the same-origin Nuxt backend. A Timeshit backend Base URL and the server's fixed GitHub API origin are different configuration concepts.

The external Timeshit backend path remains unimplemented until its API and authentication contract are specified. Retain the existing Base URL draft, clearly identify the active same-origin backend, and do not send credentials to an arbitrary URL entered in that field. Do not imply that an external URL has been connected or persisted. Keep the other services' configuration behavior scoped to their existing contracts.

`AGENTS.md` records the approved Timeshit server/persistence exceptions and source-content language rule. Live integration code is present, while real GitHub/Ubuntu acceptance must still be distinguished from synthetic tests. Keep the plan and current-capability documentation synchronized as phases are completed.

## 4. Proposed architecture

```text
Browser (authenticated JCore session)
  ├─ Settings: submit PAT once, show connection account/status only
  └─ Timeshit page + Pinia: public connection metadata, selected views,
       accumulated activity batches, coverage, digest, heatmap
          │ same-origin authenticated requests
          ▼
Nuxt server API (session guard, validation, pagination and rate-limit handling)
  ├─ GitHub API client (token added only on the server)
  ├─ SQLite: encrypted PAT, account metadata, tracked repository IDs
  └─ Ephemeral activity job: captured heads, checkpoints, coverage
          │ HTTPS · REST GET / GraphQL POST queries
          ▼
GitHub REST and GraphQL APIs
```

For this integration, the browser calls only same-origin Nuxt Timeshit endpoints. Nuxt adds the PAT to GitHub requests on the server. Keep the HTTP client independent from other services and use a fixed GitHub API origin (`https://api.github.com`).

Keep page/UI code in `app/`, private GitHub/SQLite/crypto code in `server/`, and response types and pure shared normalization/aggregation utilities in `shared/`. Current private views load after mount through service-specific `$fetch` clients and Pinia; they do not prefetch private GitHub data during SSR. If adding SSR reads, use Nuxt request-aware fetch APIs and verify cookie forwarding. Keep the PAT form draft local. Never import server-only modules into the Vue app.

## 5. Connection and credential lifecycle

### Settings experience

Add a Timeshit connection section to Settings with:

- A password-style PAT input with an explicit reveal/hide control.
- A save/connect action that verifies account identity before replacing the stored credential. Report repository discovery and Contents-access checks separately.
- A connected state that shows the GitHub account login and connection status, but never the token or its prefix/suffix.
- A replace-token action and a disconnect action. Disconnect removes the active credential, connection metadata, and tracked selection, and clears the browser's activity state. It does not revoke the token on GitHub; explain how to revoke it there if needed.
- Clear loading, validation, success, and error states. Errors must not include request headers, raw token values, or sensitive upstream response bodies.

Do not persist an unsaved PAT in Pinia or browser storage. Clear the local draft after a successful connection and when the settings modal closes or its view is left. Never prefill it from a server response.

### Server storage

- Use SQLite for the single active connection and tracked repository selection. Bind selection to the GitHub numeric account ID, and identify repositories by numeric repository ID so renames do not create duplicate records.
- Use authenticated encryption through `node:crypto`, with the implementation proposal of AES-256-GCM, a 32-byte key, a fresh random 12-byte IV per encryption, and a 16-byte authentication tag. Version the stored envelope; never reuse an IV with the same key.
- Supply the key through private runtime configuration, independently of the session secret. Validate its encoding and length. Do not generate an ephemeral fallback key on server startup.
- Store only the encrypted PAT, envelope metadata, GitHub account ID/login, connection generation/check time, and tracked selection. Never store decrypted PATs or invent a reliable expiry time that GitHub has not supplied.
- Validate a replacement before changing the existing credential. Update the credential and metadata atomically. Clear activity/cursors whenever a token changes; retain repository selection only for the same GitHub account after access revalidation. A different account starts with an empty selection.
- Fail closed on missing/invalid keys or authenticated-decryption failure. Do not overwrite the unreadable credential. Document recovery by removing the local connection and reconnecting, or by decrypting and re-encrypting with the old/new keys in a controlled maintenance operation.
- Keep the database in a writable persistent location outside `public/`, `.nuxt/`, and `.output/`; ignore the database and its sidecar files in Git. Restrict file access to the application account. Back up the database consistently and keep the key separately protected.
- Verify the SQLite driver against the supported Node version and Nitro Node build before selecting it. Reuse installed tooling where possible and avoid adding an ORM or a cryptography dependency for this scope. Include migrations and a restart-persistence check.

### Connection validation

Validate identity with `GET /user`, then discover repositories with `GET /user/repos`. A successful identity request does not prove Contents access. A successful public-resource request also does not prove private-repository access.

For a chosen repository, probe the read operation actually needed, such as listing branches. Return separate identity, discovery, and repository-read check results, including when the latter has not been checked. No accessible repository is an empty/discovery outcome, not proof of an invalid PAT.

Use documented error details and `X-Accepted-GitHub-Permissions` when available to explain what an endpoint requires. That header is not an inventory of the token's granted permissions. Do not claim to have verified that a submitted token has no write permissions; provide read-only setup instructions and make no GitHub write requests.

GitHub may conceal inaccessible private resources with `404`. Do not claim that a repository was deleted when access and absence cannot be distinguished. Treat organization approval restrictions as access restrictions and avoid inferring approval status without evidence.

## 6. Timeshit page and user flows

### Repository management

**Implemented bounded milestone:** discovery pages of 30, explicitly page-local search/visibility filtering, per-repository track/remove/recheck, and a 200-selection maximum. The limit is a JCore implementation budget, not a GitHub quota. A full page permits requesting the next page, which may be empty. Same-account PAT replacements preserve candidates as `not-checked`; only successful revalidation enables future activity. Details and current API semantics are in the [repository contract](timeshit-repositories-contract.md).


- Load the paginated repository set returned for the authenticated account with the supplied token. This is not a global search of every public GitHub repository.
- Provide repository search/filtering and a clear empty state.
- Allow the user to track/untrack repositories and persist that selection in SQLite. Begin with no tracked repositories and a selection prompt. Revalidate membership in the discoverable/access-checked set before accepting a selection.
- Display repository identity and default branch using values returned by GitHub.
- Handle repositories that are archived, empty, inaccessible, or have no default branch based on actual API fields.

Permit public and private repositories granted by GitHub and selected by the user; show their visibility. Tracking never grants access or expands the PAT's scope. An inaccessible tracked repository remains explicitly unavailable until the user removes it or restores access; do not silently report it as having zero activity.

### Branch and commit browsing

- For a selected repository, list branches through the GitHub API and allow the user to inspect a branch.
- List commits for the selected repository and branch with pagination. Resolve the authenticated account on the server and apply its login as the upstream `author` filter for commit lists and activity. Do not accept a browser-supplied author override or guess identity from a display name. Nullable/unassociated author details remain unknown; co-author attribution is outside this MVP.
- Include the full SHA, original message, returned author/committer details, `authoredAt`, `committedAt`, and commit URL where available.
- Provide a commit detail view showing changed files, status, additions, deletions, and patch content when GitHub returns it.
- Follow commit-detail file pagination when available. GitHub documents a maximum of 3,000 files for the JSON response; expose remaining-page/truncation state and an upstream link rather than claiming unlimited coverage. Binary changes can lack patch text.
- Label unavailable patches clearly. Mark truncation only when supported by upstream metadata or an explicit local limit; absence of a patch alone is not proof of truncation. Do not fabricate a diff.
- Escape rendered file names and patch text as data. Never render commit content as trusted HTML.
- Keep large file lists and patches bounded; offer a link to the corresponding GitHub page for complete content.

### Daily digest

- Group the connected account's commits by `authoredAt` in `Asia/Jakarta`, using a half-open interval from the selected day's local midnight to the next midnight. Preserve the upstream timestamp and `committedAt`; neither is a reliable GitHub push time.
- For each selected day, display the repository, short SHA, commit message, and available commit description/body.
- Provide **Copy as plain text** and **Copy as Markdown** actions. Keep the text deterministic so copying the same data produces the same output.
- Preserve the complete upstream `commit.message`. Derive the display title from its first line and the optional body from its remaining text; GitHub's REST commit response does not supply an independent description field. Keep original language and whitespace in the raw copy. Format the Markdown copy with tested escaping.
- State the selected date and repository scope in the copied output where useful, without adding claims that are not in source data.

### Commit heatmap

- Aggregate the same tracked-repository, account-filtered activity dataset used by the daily digest, grouped by `authoredAt` in `Asia/Jakarta`.
- Deduplicate on `(repositoryId, fullSha)`. The same SHA in different repositories counts once per repository. Rebase/cherry-pick commits with different SHAs remain separate; do not infer equivalent work from matching messages.
- Use a documented date range and an intensity scale whose thresholds are derived from the displayed data or are explicitly fixed and documented.
- Show a keyboard-accessible day control with date and count text; do not rely on color alone.
- Label the view as an all-branches activity view. Its counts may differ from GitHub's contribution graph, which follows GitHub's own contribution rules.

### All-branch collection and completeness

1. Paginate the tracked repositories' branch listings and capture branch names plus head SHAs for the current collection. Use each captured head SHA as the GraphQL repository object expression to keep later history pages tied to that head.
2. Paginate each captured commit's GraphQL history with the freshly verified account's User node ID as the `author.id` filter. The upstream default branch behavior is insufficient for the approved all-branches scope.
3. Deduplicate commits across branches and then apply the shared author-date/day grouping rules. Do not treat upstream `since/until` as an authored-date guarantee. The correctness baseline is to traverse the reachable author-filtered histories and filter `authoredAt` locally; any optimization must first pass tests covering different author/committer dates and must preserve completeness.
4. Split collection into bounded, resumable requests using the initial request/page/time/state budgets in the [activity contract](timeshit-activity-contract.md). Implement and test enforcement in the collector, then measure representative live workloads before release. Return continuation and coverage information when a budget is reached; do not start an unbounded scan inside one server request.
5. Keep the current result and coverage in Pinia. Mark results complete only after branch discovery and all required history pages succeed. Incomplete counts are provisional; unscanned/failed scope is unknown, not zero. Include the partial-data warning in copied digests. Do not silently truncate exported data.
6. Validate continuations against the active connection generation and requested scope. Reject continuations after disconnect, account/token replacement, scope changes, or expiry. A new collection replaces the old result rather than combining unrelated scans.

Scope covers histories reachable from remote branch heads observed during collection. GitHub does not provide an atomic snapshot across all repositories/branch listings through these calls. Report collection timing; deleted/force-pushed unreachable history, tag-only history, and unpushed local commits are outside this guarantee.

Use manual refresh and reuse the collected dataset for digest and heatmap. Persistent activity caching, scheduled jobs, queues, multiple PATs, and a GitHub App are outside the initial implementation. If measured collection cost requires one of them, document the evidence and obtain a decision before expanding scope.

## 7. Proposed server API surface

These are JCore routes, not official GitHub routes. Connection, repository, history and the two activity handlers below are implemented and defined by the [activity contract](timeshit-activity-contract.md). Every private route must call `requireUserSession(event)` and validate query/body data at runtime.

| Proposed route | Purpose | Credential handling |
| --- | --- | --- |
| `GET /api/timeshit/connection` | Return account, identity/discovery/read-check status | Never return credential |
| `POST /api/timeshit/connection` | Validate and save/replace PAT | Accept once; encrypt before storage |
| `DELETE /api/timeshit/connection` | Disconnect and remove credential | Delete stored encrypted credential |
| `GET /api/timeshit/repositories` | List visible repositories | Decrypt only on server for upstream request |
| `GET /api/timeshit/tracked-repositories` | Return persisted selection and availability | Never return credential |
| `PUT /api/timeshit/tracked-repositories` | Validate and save selected repository IDs | Session and mutation-origin checks |
| `GET /api/timeshit/repositories/:owner/:repo/branches` | List repository branches | Implemented; see [history contract](timeshit-history-contract.md) |
| `GET /api/timeshit/repositories/:owner/:repo/commits` | List account-authored commits for a selected branch head | Implemented; see [history contract](timeshit-history-contract.md) |
| `GET /api/timeshit/repositories/:owner/:repo/commits/:sha` | Return commit and paginated changed-file details | Implemented; see [history contract](timeshit-history-contract.md) |
| `POST /api/timeshit/activity` | Start collection and return a cumulative bounded snapshot | Implemented; session, mutation-origin and current scope checks |
| `POST /api/timeshit/activity/continue` | Resume the active collection by opaque capability/revision | Implemented; server-only checkpoints and bounded work |
| `GET /api/timeshit/preferences` | Return the persisted history default-branch preference | Never return credential |
| `PUT /api/timeshit/preferences` | Update the persisted history default-branch preference | Session and mutation-origin checks |

### Verified upstream endpoint map

| GitHub REST route | Use | Fine-grained repository permission |
| --- | --- | --- |
| `GET /user` | Authenticated account identity | No additional permission required |
| `GET /user/repos` | Repository discovery | Metadata: read |
| `GET /repos/{owner}/{repo}/branches` | Branch discovery | Contents: read |
| `GET /repos/{owner}/{repo}/commits` | Commit history; `sha` and `author` filters | Contents: read |
| `GET /repos/{owner}/{repo}/commits/{ref}` | Commit detail and changed files | Contents: read |

The table describes documented endpoint requirements, not proof of a submitted token's actual grants. Public-resource exceptions are documented by GitHub. Use explicit `Accept: application/vnd.github+json`, `Authorization: Bearer ...`, a descriptive `User-Agent`, and `X-GitHub-Api-Version: 2026-03-10`, the supported version verified during this review. Recheck the version and compatibility when implementation begins.

Existing browsing uses bounded numeric pages and a full-page next-page heuristic; the next page may be empty. If using upstream pagination links, validate their origin and expected route before following them. Do not accept arbitrary continuation URLs from the browser or forward the JCore session cookie to GitHub. Keep upstream parsing in server utilities and expose a versioned JCore contract. Encode branch names as parameter values so names containing `/` do not break routing.

## 8. Data contract and mock fixtures

Before connecting the live GitHub client to the UI, document the normalized response contract and include representative fixtures for:

- Connection status without credential fields, including independent identity/discovery/read-check outcomes.
- Persisted tracked repository IDs, visibility, and unavailable selections.
- Repository list and pagination metadata.
- Branch list.
- Commit list with original `message`, derived title/optional body, `authoredAt`, `committedAt`, and nullable author details.
- Commit detail with changed files and optional/truncated patch data.
- Activity batches sufficient for digest and heatmap, with connection generation, requested date/timezone/repository scope, `collectedFrom`, `collectedTo`, coverage status, continuation, and partial reasons.
- Coverage fixtures for unfinished branch discovery, a failed repository, interrupted pagination, a rate limit, and a completed empty scan. Define aggregate counters so repeated branch/SHA records do not inflate results.
- GitHub rate limit, insufficient permission, revoked token, not-found/private repository, and upstream-unavailable errors.

Use camelCase JSON properties in the JCore API contract. Preserve upstream SHA values, timestamps, URLs, branch names, and null semantics. Fixtures must be synthetic and marked as test data. Maintain JSON Schema, shared TypeScript types, examples, and contract tests together; reuse the installed AJV tooling for runtime validation instead of adding another validation library without a need.

Define stable error codes that distinguish a missing JCore session from an invalid GitHub credential, upstream permission restrictions, rate limits, partial collection, and temporary upstream failure. A GitHub `401` must not be confused with the administrator having signed out of JCore. Freeze field names and status enums in the response-contract document during phase 1; example names in this plan are proposed contract fields.

## 9. Security and operational requirements

- Require the authenticated JCore session for every Timeshit server route, including connection status and disconnect.
- Keep the saved PAT and encryption key server-only. Never log authorization headers, connection request bodies, or decrypted token values. Never put a PAT in the Nuxt user session, including its sealed cookie.
- Do not accept arbitrary GitHub API URLs from the browser. Build upstream requests from validated owner/repository/branch/SHA parameters and a fixed GitHub API origin.
- Validate route parameters and cap pagination, date range, and response sizes to avoid unbounded upstream work.
- Use HTTPS to GitHub and set explicit request timeouts.
- Handle GitHub `401`, `403`, `429`, ambiguous `404`, empty-repository/conflict responses, validation failure, timeout, and `5xx` through safe normalized errors. Do not map all `403` responses to missing permission or claim a token was specifically revoked when only authentication failure is known.
- Respect `Retry-After` and rate-limit remaining/reset headers, distinguish primary/secondary limits when evidence permits, and stop requests until retry is allowed. Use sequential upstream requests for the MVP, deduplicate simultaneous collection requests, and configure the fetch client's retries explicitly so automatic retries cannot bypass the budget.
- Require a trusted same-origin mutation request for connection save/delete and selection changes, with origin and JSON content-type validation as appropriate to the deployed proxy setup. Do not assume `requireUserSession` implements CSRF protection. Test rejected foreign/missing-origin requests and the intended local browser requests; define the trusted origin explicitly rather than trusting arbitrary forwarded headers.
- Set `Cache-Control: no-store` on private connection and activity responses. Do not place private repository data in a public/shared route cache. Clear private Pinia data on logout and connection changes.
- Do not add token persistence to Pinia, localStorage, sessionStorage, URL parameters, runtime config exposed to the client, or `.env.example` values.
- Document environment variable names and safe setup steps without providing real secrets. Keep local database files ignored by Git.

## 10. Loading, empty, and error states

The page should distinguish:

- GitHub account not connected.
- Repository list loading, loaded, empty, and failed.
- No repositories selected / no matching repositories.
- Branch loading and no branches.
- Commit loading, no commits for the selected range, and load-more state.
- Commit details unavailable or patch omitted/truncated by GitHub.
- Rate-limited, expired/revoked PAT, missing permission, and temporary upstream failure.
- Connected account verified but no repository read access checked yet.
- Collection in progress or partial, with completed scope, missing scope, reason, and an available continuation/retry action.
- Digest has no commits for the selected date.
- Heatmap has no activity for the selected range.

Keep an already displayed successful result during a failed refresh only when it belongs to the same account and scope, label it stale with its collection time, and never mix it with the failed new collection. Clear it on disconnect/logout/account change. This in-memory view state does not introduce a persistent activity cache. A complete empty result may show zero; incomplete data must not appear as a completed empty state.

## 11. Testing and verification plan

### Unit and server tests

- Encrypt/decrypt round trip; missing/wrong/invalid key, fresh IVs, tampered ciphertext/tag, and documented recovery/key rotation behavior.
- Atomic credential replacement, account-change isolation, disconnect cleanup, and persistence across a server restart using a temporary test database.
- Identity success with repository permission failure, public-only read success, no accessible repositories, ambiguous `404`, and organization access restrictions; confirm no response, session cookie, or log includes the token.
- GitHub client request construction, fixed origin, headers, timeout, pagination, and rate-limit parsing.
- Normalization of nullable GitHub fields and optional/truncated patches.
- Server-enforced author filtering, nullable authors, all-branch pagination, captured head SHAs, and `(repositoryId, SHA)` deduplication. Include the same SHA in two branches, the same SHA in two repositories, and different SHAs with identical messages.
- Date grouping in `Asia/Jakarta` at midnight, next-day boundaries, month/year changes, and leap days; include rebased commits with different author/committer dates. Verify that pagination/date optimizations do not omit matching authored dates.
- Bounded activity requests, continuation validation, partial/complete transitions, failed branch discovery, and unknown versus true zero. Test `403`/`429`, retry timing, and the fetch client's automatic-retry configuration.
- Commit-detail file pagination, binary/no-patch changes, renamed files, and explicit local limits.
- Plain-text and Markdown digest generation, including commits without bodies and characters requiring Markdown escaping.
- Authentication guard on every route; mutation-origin checks; safe upstream origin/redirect handling; and input validation for repository selection, owner, repo, branch, SHA, date range, and page limits.

### UI tests

- Connect, replace, and disconnect flows; the UI never re-renders a saved PAT.
- Loading, success, empty, permission, rate-limit, revoked-token, and upstream-error states.
- Repository/branch selection and commit detail navigation.
- Copy buttons use the correct format and report copy success/failure accessibly.
- Partial/stale activity cannot look complete; copying provisional data includes its warning. Repository selection survives reload, and switching the GitHub account clears the previous account's activity.
- Heatmap day controls work by keyboard and expose date/count without color.
- Responsive Timeshit page and Settings connection section using Nuxt UI components.

### Required project checks

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Open the local app and verify the Settings connection flow and Timeshit route render and work at desktop and mobile widths. Do not commit, push, or deploy unless requested.

## 12. Implementation phases

1. **Contract and runtime verification**: implemented Connection/repository/history contracts and the [activity contract](timeshit-activity-contract.md), including executable schemas, author-date/deduplication helpers, initial budgets, continuation semantics and the existing-Chart.js heatmap choice. Local Node/SQLite evidence is recorded. Operational bounds are enforced by the collector; representative live local and Ubuntu measurements are recorded in the [verification report](timeshit-verification-report.md).
2. **Credential foundation**: implemented private runtime configuration, SQLite v1–v3 migration/persistence, authenticated encryption, identity/access-check results and guarded connection status/save/replace/delete endpoints. Synthetic tests cover reopen persistence and mutation-origin checks; real same-account credential lifecycle and isolated Ubuntu acceptance have passed. Public HTTPS/proxy browser acceptance remains separate.
3. **GitHub read client and selection**: implemented validated, paginated repository/branch/commit/detail endpoints, persisted tracking, connection/account isolation and synthetic fixtures; see the repository and history contracts.
4. **Timeshit browsing UI**: implemented repository/branch navigation, author-filtered commit lists, commit detail and paginated file changes. Daily digest and heatmap are not included in this browsing milestone.
5. **Activity, digest, and heatmap**: bounded server collector and authenticated start/continue endpoints are implemented, including identity/repository-ID revalidation, replay/concurrency handling and explicit coverage. Client/Pinia collection state, visible controls, daily digest with two copy formats, and accessible heatmap/table interactions are implemented. Keep live acceptance separate from mocked verification.
6. **Hardening and verification**: review secret handling, auth/origin checks, collection completeness and permission-error behavior; run all required checks; verify local browser routes/responsive layout; update README, environment, database recovery, and contract documentation; review the complete diff.

Each phase should leave the app buildable and its affected route usable. No phase should introduce a real PAT or production credential into fixtures or source control.

## 13. Acceptance criteria

- The administrator can connect one GitHub account with a PAT configured for the required reads (fine-grained read-only recommended); the UI accurately distinguishes identity verification from checked repository access and explains token scope.
- The saved PAT is encrypted at rest in SQLite, used only by Nuxt server code, and never returned to the browser or stored in a session cookie. Only its temporary local input draft exists during submission.
- Repository selection persists in SQLite across reloads/restarts, remains account-bound, and handles revoked repository access explicitly.
- The user can browse accessible repositories, branches, commits, and available file changes from the connected account.
- Daily digest output lists commit messages and available descriptions and can be copied as plain text or Markdown.
- Digest and heatmap share the same account-filtered, tracked-repository activity and `authoredAt`/`Asia/Jakarta` day grouping. Complete results cover the captured current remote branch histories and deduplicate `(repositoryId, SHA)`.
- Interrupted/budget-limited scans expose coverage and a validated continuation; unknown scope is never represented as complete zero activity. Source limitations and collection timing are visible.
- All routes enforce the JCore session, validate inputs, bound upstream work, and return safe, documented errors.
- Mock fixtures, response types/schema, docs, and tests agree on the contract.
- English UI, preserved source-content language, Nuxt UI conventions, keyboard access, responsive behavior, and required project checks pass.
- The implementation makes no claim of live data when disconnected or when rendering fixtures.

The dated milestone subsections below are historical session records. Their “next task”, pending-acceptance and test-count lines describe that day only. Current capability and remaining release gates are in the status block above and the [verification report](timeshit-verification-report.md).

### Implemented browsing milestone — October 13, 2026

- Added authenticated, no-store branch, commit-list and commit-detail endpoints limited to tracked repositories verified for the active connection.
- Commit list requests apply the connected GitHub login as the server-side author filter and use captured branch head SHAs for stable paging.
- Commit messages, author/committer timestamps, file stats and optional patch text are normalized against a versioned TypeScript/JSON Schema contract and synthetic examples.
- The Timeshit page now browses branches and commits, renders changed-file patch text, paginates GitHub responses, and exposes GitHub links for unavailable or truncated patch data.
- Automated contract/client/store tests and required project checks passed on October 13, 2026: `pnpm test` (86 tests across 21 files), `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- The configured-PAT browser check remains unverified in this session: the browser-use policy rejected navigation to the local app. Do not treat the build or automated tests as proof of a live GitHub browser flow. These checks do not establish all-branch collection completeness, daily digest or heatmap behavior.

### Activity contract and history hardening milestone: October 13, 2026

- Corrected stale baseline/phase status and distinguished the implemented routes from the planned activity handlers.
- Added the activity contract/schema/synthetic examples, per-operation validators, author-date range selection, repository/SHA deduplication and daily observed-versus-exact count semantics.
- Defined opaque process-local continuation/revision behavior, initial bounded collection budgets and the installed Chart.js scatter rendering choice with Nuxt UI keyboard/date controls. Budget enforcement and live measurements are future collector acceptance work.
- Fixed history envelope isolation, file-page limits, safe GitHub conflict handling, linked-author checks, stale loading/private-state cleanup and generation checks on paging. A regression test first reproduced cross-generation commit paging before the fix.
- Verification passed: 102 tests across 22 files, `pnpm typecheck`, `pnpm lint`, `pnpm build` and local documentation file-link checks. Local Node/SQLite evidence is recorded in the activity contract. No fresh browser acceptance was completed; the existing browser-policy blocker remains recorded.

### Bounded activity collector milestone: October 13, 2026

- Implemented private POST start/continue routes with session, trusted Origin/JSON, input validation and private no-store headers.
- Added a single process-local job, opaque continuation, revision replay/CAS, bounded batches, expiry and connection/selection invalidation. Tokens are not retained in checkpoints.
- Captured all observed branch heads, traversed author-filtered history without author-date early stopping, deduplicated matching repository/SHA items and exposed coverage for every selected repository.
- Enforced request, deadline, spacing, branch, item and payload budgets; bounded the upstream response stream and retained failed-page checkpoints.
- Verification passed locally: 122 tests across 25 files, `pnpm typecheck`, `pnpm lint`, `pnpm build`, local documentation file-link checks and `git diff --check`. Collector, bounded-reader and in-process H3 route tests use synthetic upstream responses. Live GitHub/Ubuntu acceptance remains pending; no browser acceptance is claimed.
- Next task: client/Pinia activity collection state, followed by daily digest/copy and accessible heatmap UI.

### Activity client and Pinia lifecycle milestone: October 13, 2026

- Added validated same-origin start/continue client functions with JSON capabilities, explicit timeout and no automatic fetch retries.
- Added non-persistent collection phases, coverage counts, stale snapshots, sequential continuation, cooldowns, explicit pause/resume and local expiry.
- Bound scheduling to the authenticated visible Timeshit view. Hidden tabs and navigation stop new batches; in-flight responses checkpoint only while their scope/request remains valid.
- Added synchronous private-state invalidation for logout, connection/account/generation and tracked-selection changes. Response scope/revision checks prevent cross-collection data from entering state.
- Tests exercise client validation, timers, lifecycle, lost-response retries, stale refreshes, rate/busy timing, auth errors, expiry, late responses and scope/revision mismatch with synthetic responses. The full local suite passed: 144 tests across 27 files. Typecheck, lint and production build passed. Build and Nuxt tests were run separately after a concurrent run failed to resolve the generated `#app-manifest` alias; the separate test rerun passed. Browser/live-PAT acceptance remains unverified.
- Visible start/pause/resume controls, daily digest/copy and heatmap remain the next UI tasks. Live PAT/browser/Ubuntu acceptance remains pending.

### Collection controls and daily digest milestone: October 13, 2026

- Added explicit date/Collect/Pause/Resume controls, visible repository coverage, discovered branch progress, timestamps and partial/stale/expiry feedback. No scan starts merely by visiting the page.
- Added selected-day digest grouped by repository using the shared author-date/deduplication semantics. Display pagination uses 20 commits; exports include the entire selected day.
- Added plain-text and Markdown clipboard actions with accessible success/failure feedback. Original messages and whitespace remain intact; Markdown source text uses safe variable-length literal fences. Coverage/scope/time and partial/stale warnings accompany exports.
- Added synthetic digest tests for date scope, deduplication, original content, Markdown fencing, unknown/zero, deterministic output and full export beyond the UI page size.
- Local verification passed: 150 tests across 28 files, `pnpm typecheck`, `pnpm lint`, `pnpm build`, documentation file-link checks and `git diff --check`.
- Rendered browser, clipboard-permission and responsive interaction acceptance are pending due to the existing browser-tool navigation denial. Live PAT/Ubuntu acceptance is also pending; automated logic checks do not substitute for these checks.
- Next task: accessible activity heatmap, followed by rendered and live acceptance once browser access is available.

### Activity heatmap milestone: October 13, 2026

- Added a focused Chart.js/vue-chartjs square scatter wrapper using the existing visualization stack. Pure shared presentation helpers reuse validated author-day counts and deduplication.
- Added fixed grayscale count buckets, a textual legend, opaque multiline tooltips, selected-day outline, partial/stale labels and animation disabled.
- Added a 14-day paginated Nuxt UI daily-count table with accessible day actions and pressed state. Chart, table and digest date share the selected author day; long ranges scroll within the chart container.
- Unit tests cover geometry, leap/year/week boundaries, maximum date range, stable intensity, author-day deduplication and unknown versus exact counts. A Nuxt DOM test mounts the real wrapper with a stubbed renderer to verify cell selection, empty-click handling, selection outline, tooltip and canvas accessibility guidance. These checks do not establish real canvas rendering or browser keyboard/responsive acceptance.
- Local verification passed: 165 tests across 30 files, `pnpm typecheck`, `pnpm lint`, `pnpm build`, documentation file-link checks and `git diff --check`. Theme tests use the installed color-mode preference API. Build output targets this local macOS architecture and is not an Ubuntu release artifact.
- Next: rendered complete/partial/stale/empty state checks, keyboard/clipboard/light-dark/responsive acceptance and representative live PAT workload verification. Ubuntu release checks remain separate. No commit, push or deployment is implied.

### Calendar, width and history preference follow-up: October 13, 2026

- Replaced native date inputs with Nuxt UI popover calendars for collection and digest dates. Declared the already installed internationalized date package directly.
- Removed the Timeshit page width cap and set table/card width explicitly, preserving internal scrolling and default UCard padding.
- Added a global persisted history branch preference, initially `development`, private GET/PUT endpoints, schema/examples/types/runtime parsing and SQLite migration v3. Initial branch discovery searches up to ten pages before a labeled fallback; manual loading remains available.
- Explained collection scope and cost in the UI: tracked repositories only, all observed branches, author-filtered history traversal, deduplication, local authored-date filtering, fresh collection and sequential bounded batches. A short date range does not guarantee a short traversal. No speculative cache/date optimization changes were introduced.
- Local verification passed: 177 tests across 33 files, `pnpm typecheck`, `pnpm lint`, `pnpm build`, documentation file links and `git diff --check`. Calendar interaction uses the official Nuxt mounting helper; preferences include v2-to-v3 migration/persistence and private API/client tests.
- Rendered/browser/PAT/Ubuntu acceptance remains pending. See the [preference contract](timeshit-preferences-contract.md).

## 14. Scope boundaries and implementation gates

The repository-selection, timezone, original-content language, single-PAT scope and execution decisions above are approved. Do not ask for those decisions again unless a new requirement changes them. Continue implementation in the phase order and preserve the distinction between code, synthetic verification and live acceptance.

The concrete activity schemas, continuation contract, initial limits, local SQLite evidence and heatmap decision are in the [activity contract](timeshit-activity-contract.md). Enforced collector bounds are implemented; measure real workload behavior before claiming release readiness. Escalate a product change only if evidence requires broader scope, such as multiple resource owners, a different credential model, persistent activity indexing, or an external Timeshit backend.

Approved scope covers repository/branch/commit/file browsing plus all-branch activity, daily digest and heatmap. Current code implements browsing, shared activity contracts, server collection and guarded HTTP operations; client collection controls, daily digest/copy and heatmap are implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md). Creating/deleting repositories, modifying files, GitHub writes, AI summaries, local unpushed commits and guaranteed recovery of unreachable history are outside scope.

## 15. Official references

These sources were checked for the technical audit. Recheck changed APIs and installed versions when implementing. The JCore routes and encryption/collection design are project proposals; they are not represented as GitHub-mandated architecture.

- [Fine-grained PAT scope, resource owners, public access, and approval restrictions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
- [Authenticated user endpoint and permission requirements](https://docs.github.com/en/rest/users/users#get-the-authenticated-user).
- [Authenticated repository discovery](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user).
- [Branch discovery and Contents permission](https://docs.github.com/en/rest/branches/branches#list-branches).
- [Commit history filters and pagination](https://docs.github.com/en/rest/commits/commits#list-commits).
- [Commit details, file pagination, and patch availability](https://docs.github.com/en/rest/commits/commits#get-a-commit).
- [GitHub author/committer date differences and contribution rules](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference).
- [GitHub API error, missing-access, and permission-header behavior](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api).
- [GitHub pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api), [request/rate-limit best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api), and [supported API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions).
- [Nuxt server directory](https://github.com/nuxt/nuxt/blob/main/docs/2.directory-structure/1.server.md), [shared directory](https://github.com/nuxt/nuxt/blob/main/docs/2.directory-structure/1.shared.md), [private runtime configuration](https://github.com/nuxt/nuxt/blob/main/docs/3.guide/6.going-further/10.runtime-config.md), and [session/API authentication recipe](https://github.com/nuxt/nuxt/blob/main/docs/3.guide/5.recipes/4.sessions-and-authentication.md). These are the official documentation sources; validate helpers against installed Nuxt types rather than assuming every feature on `main` is available locally.
- [Node 22 cryptography API](https://nodejs.org/docs/latest-v22.x/api/crypto.html).

History default branch preferences, calendar controls and full-width Timeshit layout are documented in the [preference contract](timeshit-preferences-contract.md).

## 16. Activity collection performance follow-up

The GraphQL `Commit.history` date arguments were evaluated as a possible way to reduce traversal for short date ranges. GitHub's reference describes `since` and `until` as time bounds but does not promise that they select commits by `authoredDate`; JCore's day grouping is explicitly based on `authoredAt`. The collector therefore omits those arguments and continues paging the authenticated author's history for each captured branch head, then filters and deduplicates locally. This preserves the approved date semantics but does not claim a shorter date range will reduce GitHub history pages.

The GraphQL switch itself has not been shown to improve elapsed time over the prior REST author-filtered traversal. Treat it as an implementation candidate pending a live configured-PAT comparison of coverage, API cost and timings. Any future optimization must preserve every tracked repository/current branch scope, captured-head coverage, full SHA deduplication and author-date grouping. A persistent commit index could avoid repeat work, but it would retain repository commit data and require a separate retention, invalidation and force-push policy; it is outside the current approval.

### October 14 complete baseline

An uninterrupted local collection for October 1–13 in `Asia/Jakarta` completed 162/162 observed branches in one tracked repository with zero failures: 543,016 ms elapsed, 428 GitHub requests, 31,683 raw history entries and 47 unique matching commits. The [verification report](timeshit-verification-report.md#complete-collection-measurement--october-14-2026) and sanitized [batch measurements](timeshit-collection-benchmark.json) record the evidence and limitations. Temporary measurement logging was removed; no collection behavior, stored PAT or tracked selection was changed.

### October 14 follow-up implementation

Bounded GraphQL aliases are implemented: at most four independent captured heads/cursors per request, with separate checkpoints, whole-response validation before page admission, bounded single-head fallback and an explicit global 100,000-entry ceiling. Existing response schema, account filtering, author-date grouping, deduplication, request spacing and other budgets are preserved. Persistent indexing remains outside scope.

The next live local run completed 163/163 observed branches, zero failures and 47 unique matching commits in 184,572 ms using 112 upstream requests (108 successful GraphQL calls, observed total cost 108). The original baseline completed 162/162 branches in 543,016 ms using 428 requests. The repository gained a branch, and captured heads/network conditions were not frozen between runs; the approximately 66% elapsed reduction and 74% request reduction are observations, not a controlled benchmark or a guaranteed speedup. See the [optimized series](timeshit-collection-optimized-benchmark.json).

Credential lifecycle and Ubuntu evidence, including remaining public HTTPS boundaries, are recorded in the [verification report](timeshit-verification-report.md). The [acceptance runbook](timeshit-acceptance.md) defines isolated synthetic browser checks, real local API lifecycle checks and target-host checks without changing the main saved connection. No commit, push or public deployment is included in this work.
