# Timeshit Service Implementation Plan

- **Status:** Updated after the approved technical audit; implementation pending
- **Scope:** Personal, single-user GitHub activity dashboard in JCore
- **Implementation:** Not started
- **Reference review:** October 12, 2026

## 1. Goal

Build the Timeshit service so the signed-in JCore administrator can connect one GitHub account, browse repositories and their Git history, review commit changes, prepare a daily commit digest, and view a daily commit heatmap.

The connected GitHub account determines commit authorship. Repository discovery is limited by both that account's access and the PAT's granted access. This feature does not provide multi-user GitHub connections.

## 2. Approved decisions

- One JCore administrator uses this feature for personal use.
- The user configures a GitHub fine-grained personal access token (PAT) from the web Settings page.
- Store the PAT encrypted in SQLite on the server. Obtain a stable encryption key from server-only environment configuration and use the built-in `node:crypto` API.
- Never return the saved PAT through an API or include it in a session cookie, Pinia, browser storage, client-visible runtime config, logs, URLs, or mock data. The Settings form may hold the entered PAT temporarily in a local draft for submission.
- Request **Metadata: read** and **Contents: read** repository permissions. Use only read operations against GitHub; local Settings mutations do not mutate GitHub resources.
- Support one active fine-grained PAT. Its private-resource scope is limited to one resource owner. Do not promise access across multiple private organizations from that one token. Public repository access follows GitHub's documented exceptions.
- Persist the selected repositories in SQLite. Aggregate activity only from that tracked selection, within the token's accessible repository set.
- Include commits authored by the connected GitHub account from all current remote branches of tracked repositories. Deduplicate by stable repository ID and full commit SHA.
- Use `authoredAt` for digest and heatmap day grouping in `Asia/Jakarta`; preserve `committedAt` separately.
- A daily digest is a formatted list of commits, commit messages, and available commit descriptions. It is not an AI-generated summary.
- Provide two copy formats: plain text and Markdown.
- Keep generated application text in English and follow the existing JCore monochrome Swiss Style and Nuxt UI conventions. Preserve original commit messages, repository descriptions, file names, and patches in their source language.

## 3. Current project baseline

The current Settings page has a Timeshit service card and a Base URL form. Service configuration is held in Pinia memory and is explicitly marked as development-only. The application already has a global route middleware for signed-in pages, a private Nuxt server API pattern that calls `requireUserSession(event)`, and Vitest scripts.

Add GitHub connection settings without silently removing the existing per-service Base URL concept. The approved implementation uses the same-origin Nuxt backend as the Timeshit default. A Timeshit backend Base URL and the server's GitHub API origin are different configuration concepts.

The external Timeshit backend path remains unimplemented until its API and authentication contract are specified. Retain the existing Base URL draft, clearly identify the active same-origin backend, and do not send credentials to an arbitrary URL entered in that field. Do not imply that an external URL has been connected or persisted. Keep the other services' configuration behavior scoped to their existing contracts.

Update `AGENTS.md` alongside this plan to record the approved Timeshit server/persistence exceptions and the source-content language rule. These are implementation permissions, not a claim that live Timeshit integration already exists.

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
  └─ SQLite: encrypted PAT, account metadata, tracked repository IDs
          │ HTTPS with read-only PAT
          ▼
GitHub REST API
```

For this integration, the browser calls only same-origin Nuxt Timeshit endpoints. Nuxt adds the PAT to GitHub requests on the server. Keep the HTTP client independent from other services and use a fixed GitHub API origin (`https://api.github.com`).

Keep page/UI code in `app/`, private GitHub/SQLite/crypto code in `server/`, and response types and pure shared normalization/aggregation utilities in `shared/`. Use `useFetch` for initial authenticated same-origin reads and `$fetch` for user-triggered actions, following Nuxt's cookie-forwarding behavior. Keep shared UI state in Pinia and the PAT form draft local. Never import server-only modules into the Vue app.

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

1. Paginate the tracked repositories' branch listings and capture branch names plus head SHAs for the current collection. Use each captured head SHA as the commit-list `sha` parameter to keep later pages tied to that head.
2. Paginate each branch history with the server-resolved account's `author` filter. The upstream default branch behavior is insufficient for the approved all-branches scope.
3. Deduplicate commits across branches and then apply the shared author-date/day grouping rules. Do not treat upstream `since/until` as an authored-date guarantee. The correctness baseline is to traverse the reachable author-filtered histories and filter `authoredAt` locally; any optimization must first pass tests covering different author/committer dates and must preserve completeness.
4. Split collection into bounded, resumable requests. Define request/page/time budgets during phase 1 and document their values. Return continuation and coverage information when a budget is reached; do not start an unbounded scan inside one server request.
5. Keep the current result and coverage in Pinia. Mark results complete only after branch discovery and all required history pages succeed. Incomplete counts are provisional; unscanned/failed scope is unknown, not zero. Include the partial-data warning in copied digests. Do not silently truncate exported data.
6. Validate continuations against the active connection generation and requested scope. Reject continuations after disconnect, account/token replacement, scope changes, or expiry. A new collection replaces the old result rather than combining unrelated scans.

Scope covers histories reachable from remote branch heads observed during collection. GitHub does not provide an atomic snapshot across all repositories/branch listings through these calls. Report collection timing; deleted/force-pushed unreachable history, tag-only history, and unpushed local commits are outside this guarantee.

Use manual refresh and reuse the collected dataset for digest and heatmap. Persistent activity caching, scheduled jobs, queues, multiple PATs, and a GitHub App are outside the initial implementation. If measured collection cost requires one of them, document the evidence and obtain a decision before expanding scope.

## 7. Proposed server API surface

These are planned JCore routes, not existing endpoints or official GitHub routes. Finalize their schemas and continuation representation during phase 1. Every private route must call `requireUserSession(event)` and validate query/body data at runtime.

| Proposed route | Purpose | Credential handling |
| --- | --- | --- |
| `GET /api/timeshit/connection` | Return account, identity/discovery/read-check status | Never return credential |
| `POST /api/timeshit/connection` | Validate and save/replace PAT | Accept once; encrypt before storage |
| `DELETE /api/timeshit/connection` | Disconnect and remove credential | Delete stored encrypted credential |
| `GET /api/timeshit/repositories` | List visible repositories | Decrypt only on server for upstream request |
| `GET /api/timeshit/tracked-repositories` | Return persisted selection and availability | Never return credential |
| `PUT /api/timeshit/tracked-repositories` | Validate and save selected repository IDs | Session and mutation-origin checks |
| `GET /api/timeshit/repositories/:owner/:repo/branches` | List repository branches | Server-only upstream auth |
| `GET /api/timeshit/repositories/:owner/:repo/commits` | List commits for branch/date query | Server-only upstream auth |
| `GET /api/timeshit/repositories/:owner/:repo/commits/:sha` | Return commit and changed-file details | Server-only upstream auth |
| `GET /api/timeshit/activity` | Return an activity batch, coverage, and continuation | Server-only upstream auth; bounded work per request |

### Verified upstream endpoint map

| GitHub REST route | Use | Fine-grained repository permission |
| --- | --- | --- |
| `GET /user` | Authenticated account identity | No additional permission required |
| `GET /user/repos` | Repository discovery | Metadata: read |
| `GET /repos/{owner}/{repo}/branches` | Branch discovery | Contents: read |
| `GET /repos/{owner}/{repo}/commits` | Commit history; `sha` and `author` filters | Contents: read |
| `GET /repos/{owner}/{repo}/commits/{ref}` | Commit detail and changed files | Contents: read |

The table describes documented endpoint requirements, not proof of a submitted token's actual grants. Public-resource exceptions are documented by GitHub. Use explicit `Accept: application/vnd.github+json`, `Authorization: Bearer ...`, a descriptive `User-Agent`, and `X-GitHub-Api-Version: 2026-03-10`, the supported version verified during this review. Recheck the version and compatibility when implementation begins.

Follow upstream pagination links only after validating their origin and expected route. Do not accept arbitrary continuation URLs from the browser or forward the JCore session cookie to GitHub. Keep upstream parsing in server utilities and expose a versioned JCore contract. Encode branch names as parameter values so names containing `/` do not break routing.

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

1. **Contract and runtime verification**: recheck the reference matrix against installed Nuxt/Node and current GitHub docs; define JSON Schema, shared types, errors, author-date completeness rules, collection budgets/continuations, and tracked-selection contract. Select a compatible SQLite driver; use `node:crypto`. Resolve the heatmap rendering choice within the existing Nuxt UI/Chart.js rules before adding dependencies or a custom primitive. Record decisions in contract documentation.
2. **Credential foundation**: add private runtime configuration, SQLite migration, authenticated encryption, identity/access-check results, and guarded connection status/save/replace/delete endpoints. Verify restart persistence and mutation-origin checks.
3. **GitHub read client and selection**: add validated, paginated repository/branch/commit/detail endpoints, persisted tracking, and connection/account isolation. Add fixtures and contract tests.
4. **Timeshit browsing UI**: replace the Coming Soon page with repository/branch navigation, commit list, commit detail, file-change view, and all required states.
5. **Activity, digest, and heatmap**: implement bounded resumable collection, coverage and stale/partial states, shared date grouping/deduplication, two copy formats, and accessible heatmap interactions.
6. **Hardening and verification**: review secret handling, auth/origin checks, collection completeness and permission-error behavior; run all required checks; verify local browser routes/responsive layout; update README, environment, database recovery, and contract documentation; review the complete diff.

Each phase should leave the app buildable and its affected route usable. No phase should introduce a real PAT or production credential into fixtures or source control.

## 13. Acceptance criteria

- The administrator can connect one GitHub account with a fine-grained PAT configured for read-only use; the UI accurately distinguishes identity verification from checked repository access and explains token scope.
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

## 14. Scope boundaries and implementation gates

The repository-selection, timezone, original-content language, and single-PAT scope decisions above are approved. Do not ask for those decisions again unless a new requirement changes them. This approval updates the plan and project rules; application implementation is a separate step.

Phase 1 must produce the concrete schemas, pagination/continuation contract, measured collection limits, SQLite compatibility evidence, and heatmap rendering decision. These are implementation prerequisites, not permission to invent GitHub behavior. Escalate a product change only if evidence requires broader scope, such as multiple resource owners, a different credential model, persistent activity indexing, or an external Timeshit backend.

This implementation covers repository/branch/commit browsing and available commit patches. Creating/deleting repositories, modifying files, GitHub writes, AI summaries, local unpushed commits, and guaranteed recovery of unreachable history are outside scope.

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
