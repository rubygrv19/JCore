# Timeshit activity collection contract

Status on October 14, 2026: shared contracts/helpers, the bounded process-local collector, authenticated start/continue HTTP handlers, same-origin client, Pinia lifecycle, collection controls, daily digest/copy and heatmap are implemented. The [verification report](timeshit-verification-report.md) records passing automated checks, complete live collections, synthetic browser lifecycle, real same-account PAT lifecycle and isolated Ubuntu build/API acceptance. Public HTTPS/proxy browser checks and two-real-account switching remain unverified.

Read the [approved plan](timeshit-implementation-plan.md), [connection contract](timeshit-connection-contract.md), [repository contract](timeshit-repositories-contract.md) and [history contract](timeshit-history-contract.md) first.

## Scope and source semantics

The server derives account ID, current login, connection generation, selection revision and all tracked repositories. The request cannot supply an author, arbitrary repository, GitHub URL, branch scope or alternative time zone. At collection start, read GitHub `/user` again and confirm its numeric ID matches the saved connection. Use the freshly verified login for the author filter; a login rename must not switch collection to another account.

Each tracked repository is part of the coverage denominator. A repository whose access has not been verified for the active generation is reported as failed with `not-verified`, rather than disappearing from scope. Before branch discovery, read repository metadata and compare its numeric ID with the tracked ID. A rename, transfer or path reuse must not silently attribute another repository's commits to the saved ID.

Discover all current remote branches through paginated GitHub reads and capture each returned head SHA. Branch names repeated across page boundaries are deduplicated, since the branch list can change while offset pagination is in progress; a non-empty page containing no new branch names is treated as pagination failure to avoid looping without progress. Traverse the GraphQL `Commit.history` connection filtered by the freshly verified GitHub user node ID from each captured SHA until the connection's pages are exhausted. Do not use a short page as an author-date stopping rule beyond ordinary pagination exhaustion. Repeated identical head SHAs within the same repository may share a completed traversal; different heads require their own traversal unless a future optimization proves equivalent coverage.

GitHub documents `Commit.history` author, `since` and `until` arguments, but does not guarantee that the latter two select the commit author's calendar date. The collector therefore sends no `since/until` and does not stop at a commit older than the requested author-date range. A rebased commit may have different author and committer dates, and timestamps need not be ordered by author date. GraphQL migration alone is not claimed to improve collection time; a shorter date range still requires traversing matching-author history pages.

After each page, filter `authoredAt` locally and deduplicate matching records by `(repositoryId, SHA.toLowerCase())`. Two branches containing the same commit count once; the same SHA in two tracked repositories counts twice. Different SHAs with identical messages remain distinct. Use the original message, nullable body and timestamps from the history contract. A nullable linked author does not override GitHub's server-requested author filter; a non-null different linked author is rejected.

The date range uses inclusive `startDate/endDate`, `YYYY-MM-DD`, from 1970 through 2099, with at most 366 calendar days and fixed `Asia/Jakarta`. The shared helper converts this to the half-open interval from local start midnight to midnight after the end date. Jakarta uses UTC+07:00 throughout this supported range. `committedAt` is preserved but does not determine the digest day.

Branch discovery across pages and repositories is not atomic. Coverage means that the branches observed during this collection were discovered and their captured histories exhausted. It does not guarantee recovery of deleted, force-pushed unreachable, tag-only or unpushed local history.

## HTTP operations

These operations are implemented in `server/api/timeshit/activity.post.ts` and `server/api/timeshit/activity/continue.post.ts`.

| Operation | JSON body | Behavior |
| --- | --- | --- |
| `POST /api/timeshit/activity` | `expectedGeneration`, `expectedSelectionRevision`, `range` | Validate current scope, start a new collection and process one bounded batch |
| `POST /api/timeshit/activity/continue` | `continuation`, `expectedRevision` | Validate the active collection and process its next bounded batch |

Both operations require the JCore session, trusted mutation origin and JSON content type. Set `Cache-Control: private, no-store`. Use a JSON body because the continuation is a private capability for ephemeral server state and must not appear in URLs or access logs. GitHub reads use REST GET and GraphQL POST queries; no GraphQL mutation or GitHub write is performed.

Reject initial requests with no tracked repositories, invalid dates, unsupported fields, or stale generations/selection revisions before GitHub reads. Keep the existing safe error envelope. The handlers emit `ACTIVITY_EXPIRED` (410) for an expired/lost job, `ACTIVITY_BUSY` (409, with a short retry delay) for concurrent work, and `ACTIVITY_REVISION_CHANGED` (409) for an unusable revision when a continuation cannot be applied.

Recheck generation and selection revision before every resumed batch and after its upstream reads. A PAT replacement, disconnect, account change or tracked-selection mutation invalidates the collection. A new initial request replaces the previous active job. No saved PAT, encryption key or upstream response body is included in errors or collection state.

## Continuation and retry behavior

Use one process-local active collection, matching the current single-administrator/single-Node-process topology. Keep captured branch heads, page checkpoints, matching unique items and coverage in server memory. Do not add an activity database, background scheduler, queue, persistent activity cache or SQLite migration for this milestone.

Generate an opaque 32-byte random continuation capability, represented as 64 lowercase hex characters. The browser cannot edit checkpoint contents. Store it only in the active Pinia collection and server memory; clear it on logout, account/selection changes and replacement of the collection. Do not persist it in browser storage.

The response is a cumulative snapshot with a stable `collectionId` and increasing `revision`. Atomically checkpoint successful pages and return the full bounded snapshot; the client replaces the previous revision instead of concatenating repeated batches. If a retry carries exactly the previously applied revision, return the latest snapshot without advancing again. Older revisions fail with `ACTIVITY_REVISION_CHANGED`. Two simultaneous continuations must not scan or append the same page twice.

Each batch holds the existing process-wide GitHub operation gate. Rate-limit timing must be shared with repository/history reads. A page interrupted by a retryable failure remains the next page; do not advance its checkpoint or mark it complete. The browser may continue batches while its explicitly started collection is visible and active. Navigation/pause stops new batches; it does not create a scheduled background task.

GraphQL may report a rate-limit error with HTTP 200. The reader checks both top-level and extension error types and honors `Retry-After` or an exhausted `x-ratelimit-remaining` plus `x-ratelimit-reset`; it does not replace a supplied reset time with a fixed one-minute retry. REST and GraphQL share a reader that rejects bodies over 5 MiB before JSON parsing. Collection queries use up to four object aliases (`h0`–`h3`) under `data.repository`, each with its own captured SHA and cursor. The shared page parser receives one alias as `repository.object.history` after removing the outer envelope.

The collector validates every returned alias before admitting any page from that response. Missing/malformed aliases, restricted responses or transient errors in a multi-head read reduce that repository to single-head reads without advancing those cursors. These fallback attempts consume the same request/time budgets; they are not hidden transport retries. A single-head permanent error retains the existing failed-repository behavior. Rate limiting retains the batched checkpoints unchanged and returns the shared cooldown instead of bypassing it. Independent heads are paged together; this does not skip ancestry or make date ordering assumptions.

Expiry is absolute, 30 minutes after collection start. Server restart loses the job; return `ACTIVITY_EXPIRED` rather than reconstructing a possibly different scan. A successfully collected client snapshot can remain visible as stale; it cannot be resumed after expiry. Connection and tracked repository persistence still use SQLite schema v3.

## Initial budgets

These enforced JCore defaults are conservative application limits, not measured GitHub throughput or GitHub quota values.

| Limit | Initial value | When reached |
| --- | --- | --- |
| Date range | 366 days | Reject invalid start request |
| Tracked repositories | Existing maximum of 200 | Reuse selection limit |
| Branches per collection | 2,000 observed branches | Terminal partial result, `capacity-limit` |
| Upstream page size | 100 branches/commits for collection | Bound each page; browsing keeps its own page sizes |
| History connections per GraphQL request | Up to 4 independent heads, 100 commits each | Fall back to single-head reads on multi-head failures |
| Upstream requests per batch | 5, including identity/metadata/branch/commit reads | Partial result with continuation, `work-budget` |
| Batch deadline | 20 seconds | Start an 8-second upstream request only when at least 8 seconds remain |
| Upstream timeout/retry | Existing 8 seconds, `retry: 0` | Normalize failure; never hide retries outside the budget |
| Request spacing | At least 1 second between GitHub request starts | Shared sequential scheduling for collection |
| Upstream requests per collection | 1,000, including failed attempts | Terminal partial result, `capacity-limit` |
| Raw history entries per collection | 100,000 across all repositories, before deduplication/date filtering | Explicit terminal partial result before admitting a page that exceeds the ceiling |
| Unique matching commits | 5,000 | Terminal partial result before dropping a matching commit |
| Cumulative JSON snapshot | 5 MiB of UTF-8 JSON | Terminal partial result before dropping/shortening source content |
| Active collections/lifetime | 1 per process / 30 minutes | New collection replaces old; expiry invalidates continuation |

The response validator enforces range, scope/record counts and snapshot bytes. `server/utils/timeshit-activity.ts` enforces request, raw-entry, time, spacing, retained-state and lifetime budgets. The streamed reader in `server/utils/timeshit-activity-github.ts` caps each upstream body at 5 MiB and cancels oversized responses; a multi-head read falls back to single-head reads, and a single-head oversized response fails that repository as `invalid-upstream`. Transport uses an 8-second abort signal, no redirect following and no automatic retries.

A matching commit page is checkpointed only if the complete normalized page fits. Otherwise the previous items remain intact and coverage is terminal partial; no message is shortened to fit. Snapshot admission reserves 1 KiB for envelope updates. The schema also caps revisions at 1,001; after 1,000 applied batches, unfinished work becomes terminal `capacity-limit`, including repeated gate/cooldown responses that consumed no upstream request.

Transient upstream/network failures retain the page checkpoint and return `upstream-error` with a continuation. Rate-limit failures additionally return retry timing shared with repository/history reads. Authentication failures abort and discard the collection. Permanent restricted/conflict/invalid responses fail that repository and continue other scoped repositories. If identity cannot be verified and no repository has resumable work, return the normalized error rather than an invalid resumable envelope.

With 8 seconds reserved before each request, two full timeouts can fit inside a 20-second batch; a third cannot start. Measured representative local and Ubuntu collection timings are recorded in the [verification report](timeshit-verification-report.md); render cost is not separately profiled. If a single repository exceeds collection limits, the correct outcome is partial coverage. A narrower date range may reduce matching payload size but does not reduce full-history traversal under this baseline. Do not promise that changing dates always solves a request budget.

## Snapshot and coverage semantics

`docs/timeshit-activity.schema.json`, `docs/timeshit-activity.examples.json`, `shared/types/timeshit-activity.ts` and `shared/utils/timeshit-activity-contract.ts` define version 1.0. The schema reuses commit fields from the history schema. Per-operation validators reject another operation's otherwise valid payload.

The snapshot contains the verified account, fixed scope revisions/range, collection identity/revision/timestamps, coverage for every tracked repository and cumulative unique matching items. `commitsScanned` counts raw author-filtered entries read, including repeats across different branches; it is work evidence, not the activity total. `branchesDiscovered` is the observed count, not an asserted total while `branchDiscoveryComplete=false`.

Each repository is `pending`, `scanning`, `complete` or `failed`. Complete requires branch discovery to have finished and every discovered branch history to have exhausted its pages. A successful empty branch listing can produce complete zero activity; GitHub 409 is a conflict, not evidence of a successfully empty repository. Restricted, malformed or unavailable responses must remain failed/unknown.

The aggregate is `complete` only when every scoped repository is complete. Otherwise it is `partial`, with explicit reasons. `continuation=null` means there is no resumable work, not that the result is complete. Terminal failed/capacity-limited scans remain partial. A rate-limited snapshot supplies `retryAfterSeconds`; rate-limit or authentication failures must not trigger uncontrolled repeated reads.

Daily counts are derived from the same unique items for digest and heatmap. The shared helper returns `observedCount` plus `count`. During partial collection, `count=null` for every day, including a day with no observed records. After complete collection, `count` equals the exact observed count, including legitimate zeroes.

Keep successful old activity isolated from a new collection. If a refresh fails, show the old snapshot as stale with its scope/time; never merge it with a partial new scan. Copying a partial/stale digest must include its warning and scope. Complete/partial are application coverage claims, not claims to match GitHub's contribution graph.

## Client and Pinia lifecycle

`app/utils/timeshit-client.ts` implements `startTimeshitActivity` and `continueTimeshitActivity` as same-origin POSTs with JSON bodies, `credentials: same-origin`, `retry: 0` and a 30-second timeout. The timeout is an application margin above the server's 20-second batch work budget. Both functions validate complete response envelopes before returning them. The continuation never appears in query parameters.

`app/stores/timeshit-activity.ts` owns a non-persistent snapshot and the `idle`, `collecting`, `waiting`, `paused`, `complete`, `partial`, `error` and `expired` phases. It exposes repository/branch/work counts without inventing a percentage while branch discovery is incomplete. `stale` is independent of coverage: a complete old result may be stale, and a current partial result does not become exact.

- A view must call `attachView()` before an explicit `start(range)` or `resume()`. The Timeshit page attaches on mount and detaches before unmount. Merely visiting it starts no activity scan. Visible date/Collect/Pause/Resume controls explicitly operate this lifecycle.
- Batches run sequentially while that view is active, visible and authenticated. Automatic continuation waits at least one second, or the reported retry delay. Hidden tabs pause; returning to the tab does not automatically resume.
- `pause()` stops future batch scheduling. An already submitted batch is allowed to return and update its checkpoint, avoiding loss of its server revision. Loading prevents overlapping start/resume operations. The client does not abort a POST merely because the view pauses.
- Snapshot bodies replace the previous revision. Account ID, generation, selection revision, repository IDs and date range must match; resumed results must additionally retain collection identity/start/expiry and advance exactly one revision. Server replay after a lost response satisfies that revision check.
- Starting a refresh retains the old snapshot as stale until a validated new result replaces it. A failed start cannot resume the old collection: the server may already have replaced it. No old/new items are concatenated.
- Network or validation failures stop automatic work and retain a labeled stale snapshot. A transient continuation failure can be manually retried with the same capability/revision. Safe busy/rate responses can schedule a delayed retry only for an active resumable collection; a failed start requires another explicit start. Manual start/resume honors cooldowns.
- Revision conflicts require a new collection. Local or server expiry disables resume. Authentication/connection failures clear private snapshots; synchronous watchers also clear state and ignore late responses after logout, PAT generation/account changes, disconnect and tracked-selection changes. The layout explicitly resets activity before sign-out.
- Store disposal removes the visibility listener and timers. The existing Timeshit page also resets tracked repository state on unmount, which clears its dependent activity snapshot. No browser storage or background collection is introduced.

Client/Pinia tests use synthetic responses and fake timers, plus the installed Nuxt Auth Utils session composable. They cover cumulative replacement, lifecycle/pause, cooldown, safe error states, stale refreshes, expiry, exact scope/revisions, private-state invalidation and late responses. These tests do not establish rendered digest/heatmap behavior or live PAT acceptance.

## Collection controls and daily digest

The Timeshit page provides explicit start/end date controls (inclusive, at most 366 days, Asia/Jakarta), Collect, Pause and Resume. Initial dates use the current Jakarta day after mount. No collection starts automatically on navigation. Per-repository coverage, discovered/scanned branch counts, collection timestamps, expiry and partial/stale warnings accompany the result. The observed branch denominator is not a claim that discovery is finished.

The daily date selector is constrained to the snapshot range. Commit messages render as escaped Vue text with preserved whitespace. Results group by repository in coverage order, with author-date ordering within each repository. Display pagination uses 20 commits per page; copying always includes the entire selected day, with no export truncation. An invalid/out-of-range day disables copying. Complete empty days are distinguished from partial days without observed commits.

`shared/utils/timeshit-digest.ts` provides deterministic grouping and export without another API request. Both formats include account, date/timezone, all-branch/tracked-repository scope, repository coverage, requested range, collection times and partial/stale warnings. Plain text preserves the complete original message and its whitespace. Markdown puts source content in literal fenced blocks whose fence is longer than any backtick run in the content; upstream Markdown/HTML is not interpreted as formatting. Full SHA, original author/committer timestamps and GitHub URL accompany each message. Export never includes collection capabilities or scope revisions.

Copy uses the browser Clipboard API on an explicit button click. Success uses a live status message; denied/unavailable clipboard access uses an alert and a retry instruction. Clipboard access depends on browser permission and a secure context. Unit tests verify date/deduplication, complete/partial empty semantics, whitespace, Markdown fences and full export beyond the display page size. Local desktop/mobile, configured-PAT browsing, complete collection and isolated Ubuntu API checks are recorded in the [verification report](timeshit-verification-report.md). Public HTTPS browser acceptance remains separate.

## Heatmap rendering decision

Use the installed Chart.js 4.5.1 and vue-chartjs integration, with scatter points arranged as week/day coordinates and `pointStyle: 'rect'`. This uses the existing visualization stack without a new matrix-chart dependency. A focused wrapper may register only the required Chart.js elements. Use the existing grayscale theme, opaque tooltip and source count/date labels.

Provide a Nuxt UI date control and a Nuxt UI table of date/count rows with keyboard-accessible day actions. Selecting a chart day or table/date control must choose the same digest date. A canvas label alone does not make individual cells keyboard accessible. Explicitly label partial counts as observed, distinguish unknown from zero without relying only on shade, and verify light/dark, reduced motion and small-screen overflow.

`app/components/TimeshitHeatmap.client.vue` implements the Chart.js scatter wrapper. `shared/utils/timeshit-heatmap.ts` derives one cell per Jakarta author day from the validated snapshot, using Sunday-to-Saturday rows and chronological week columns. The same snapshot drives digest and daily counts; no additional GitHub request is made.

Intensity uses fixed buckets: 0, 1, 2–4, 5–9 and ≥10 observed commits, with a grayscale legend. Partial zero remains unknown; tooltip and table explicitly say observed/total unknown. Complete zero means no matching activity in the completed scope, not a guarantee of equivalence to GitHub contributions. Staleness remains separate from completeness and is shown next to the chart.

The selected cell has a stronger outline. Clicking a cell, selecting its Nuxt UI table action, or changing the digest date updates the same selected day. The daily table paginates at 14 days; chart selection moves the table to the selected day's page. Each action has an accessible date/count label, pressed state and normal button keyboard behavior. The table supplies exact values without requiring canvas interaction. The chart uses opaque tooltips and no animation, including for reduced-motion users.

Long ranges retain readable cell sizes inside a horizontal scroll container rather than widening the page. Tests cover coordinates across year/week boundaries, leap day/366-day ranges, authored-day deduplication, fixed intensity buckets and partial/complete count labels. A Nuxt DOM integration test mounts the actual chart wrapper with the `vue-chartjs` renderer stubbed, verifies day-click emission/empty click behavior, accessible canvas guidance, selection outlines, tooltip text/opacity and disabled animation. It does not validate canvas pixels, real keyboard traversal, responsive overflow or browser/PAT acceptance.

## Verification and next implementation task

The shared tests cover local midnight inclusion/exclusion, leap days, year boundaries, invalid/oversized ranges, divergent author/committer dates, cross-branch/cross-repository deduplication, unknown versus zero, envelope isolation, contradictory coverage and synthetic schema examples.

Current local runtime reports Node 22.23.2, SQLite 3.51.3, macOS arm64. Existing connection/repository tests exercise private SQLite v3 migration, persistence and generation/selection invalidation. Ubuntu Node 24.21.0 native SQLite, restart persistence and representative live collection timing are separately verified in the [verification report](timeshit-verification-report.md).

The collector tests exercise fresh identity and repository-ID checks, pinned heads, all-page traversal without author-date early stopping, same-head reuse, deduplication, preserved messages, nullable authors, checkpoints, replay/concurrency, rate-limit/transient failure recovery, scope invalidation, replacement/expiry, spacing/deadlines, request/branch/item/payload caps and failed coverage. API tests exercise session, trusted origin, JSON, URL/input scope restrictions, stale scope, lost state, private headers and secret-free responses. Upstream-reader tests cover fixed origin, redirect policy, cancellation, malformed JSON and safe rate-limit normalization.

The [verification report](timeshit-verification-report.md) records current local browser/PAT checks, complete live collections, isolated Ubuntu acceptance, corrected defects and remaining public-release limits. The [acceptance runbook](timeshit-acceptance.md) defines repeatable procedures. Historical browser-policy denials are not a current blanket blocker; mocked reads alone still do not establish live completeness.

## Sources

- [GitHub GraphQL commits](https://docs.github.com/en/graphql/reference/commits): `Commit.history`, author filtering, cursors and date arguments. The docs do not establish an authored-date guarantee for date filters.
- [GitHub GraphQL pagination](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api): connection cursors and page limits.
- [GitHub GraphQL rate/query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api): query point budgets and node limits.
- [GitHub repository metadata](https://docs.github.com/en/rest/repos/repos#get-a-repository) and [branches](https://docs.github.com/en/rest/branches/branches#list-branches): REST identity and branch discovery reads. [REST commit filters](https://docs.github.com/en/rest/commits/commits?apiVersion=2026-03-10) remain relevant to browsing; REST `since`/`until` semantics are not used for activity author-day selection.
- [GitHub pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api): paginated read behavior. A full page can require checking another page; do not represent a heuristic as an exact total.
- [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): upstream limits and response headers. JCore's budgets above are separate application choices.
- [Chart.js scatter](https://www.chartjs.org/docs/latest/charts/scatter.html), [point styles](https://www.chartjs.org/docs/latest/configuration/elements.html#point-styles), and [accessibility](https://www.chartjs.org/docs/latest/general/accessibility.html): supported coordinates/rectangular points and canvas accessibility responsibilities.

History default branch preferences, calendar controls and full-width Timeshit layout are documented in the [preference contract](timeshit-preferences-contract.md).
