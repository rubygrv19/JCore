# Timeshit verification report

Audit date: October 14, 2026. This report covers the continued local audit and subsequent approved performance/lifecycle/Ubuntu acceptance work for the [implementation plan](timeshit-implementation-plan.md). Work remains on `development`; no commit, push or public deployment is part of this audit. Ubuntu work used a separate temporary source directory and loopback test server.

## Result and evidence boundaries

The features in phases 1–5 are implemented. Performance optimization, isolated browser credential lifecycle, real same-account GitHub API lifecycle and Ubuntu Node/API acceptance have passed the checks recorded below. Phase 6 still has public-release boundaries: actual HTTPS/proxy browser behavior is unverified because the public domain's port 443 was unreachable, and two-real-account switching has not been exercised. Synthetic browser accounts cover account-switch behavior. Do not describe this report as proof of public production readiness or the absence of every possible bug.

The working tree already contained the Timeshit implementation and related documentation changes when this audit began. Those changes were preserved. The audit reviewed the full current Timeshit flow rather than only tracked Git diffs, because many implementation files are still untracked.

## Approved scope mapped to implementation

| Requirement | Current implementation | Evidence |
| --- | --- | --- |
| One personal GitHub account and PAT configured in web Settings | Local PAT draft; private connection API; AES-256-GCM encrypted SQLite storage | Crypto/storage/route tests; live Settings shows the connected account and an empty password input, with replace/disconnect disabled until their prerequisites are met |
| PAT stays server-side after submission | Secret code in `server/`; browser receives metadata only; fixed GitHub origin | Source trace of Settings, client, API and storage; safe-error tests; no PAT field in response schemas or Pinia |
| Repository discovery and persistent tracking | Authenticated, paginated discovery; account-bound numeric IDs; SQLite selection revisions; track/remove/recheck | Repository API/store/migration tests; live selected private repository and discovery list |
| Browse branches and the connected account's commits | Preferred branch defaults to `development`; bounded preference search; SHA-pinned manual commit paging; server author filter | History/preference tests; real browser opened `development` and returned commits linked to the connected account |
| Read file changes | Commit detail, stats, file accordion, escaped patch text, manual file paging and explicit local/upstream limits | History/parser tests; real commit detail returned a changed file and its patch; Enter expanded the file accordion |
| Daily digest across tracked repositories and all observed branches | Bounded collector, cumulative snapshots, `(repositoryId, SHA)` deduplication, local author-date filtering in `Asia/Jakarta` | Collector/contract/date tests; uninterrupted live collection completed 162/162 observed branches, one repository, zero failures and 47 unique matching commits |
| Plain-text and Markdown copy | Full selected day exported independently of UI paging; source messages preserved; partial/stale warnings included | Digest tests including more than 20 commits and literal Markdown fences; real clipboard checks confirmed selected date, partial/stale warnings and absence of capabilities in both formats |
| Daily heatmap | Existing Chart.js scatter wrapper, fixed grayscale buckets, textual daily counts, shared selected digest day | Pure geometry/count tests and Nuxt wrapper tests; real canvas rendered; Enter on a daily-count action changed the digest date |
| Nuxt UI, English labels, Swiss monochrome, responsive layout | Nuxt UI controls, cards, tables, calendars and accordion; focused Chart.js wrapper exception | Source/design review; real desktop and 390px CSS viewport checks in light/dark; page width stayed 390px, with four wide tables contained by internal horizontal scrolling |
| Explicit partial, stale, paused and expired states | Coverage, timestamps, continuation, cooldown and visibility lifecycle | Fake-clock/store/route tests; real Pause retained the snapshot, and later absolute expiry disabled resume while retaining a stale result |
| Private authenticated APIs | Thirteen route files use a direct or delegated session guard and private no-store header; mutations use trusted-origin JSON validation | Source inventory and in-process route tests for sessions, foreign/missing origins, content type, oversized input and stale scope |

## Defects corrected

1. **GraphQL rate-limit handling.** HTTP 200 errors previously used a fixed 60-second retry and only checked extension error types. The reader now recognizes top-level or extension types and honors `Retry-After` or the exhausted rate window's reset header. Tests cover a ten-minute reset, an explicit 125-second delay and top-level forbidden errors.
2. **History response scope.** Schema validation did not prove that a response belonged to the requested repository, branch, captured head, commit or page. Each same-origin history client now checks those fields before returning data. Tests reject structurally valid responses for another request.
3. **Private data after lost access.** Failed paging/mutation requests could retain private history or repository state after 401 or connection invalidation. These failures now reset private view data and invalidate late requests; revoked tracked access also clears history. Regression tests cover session loss and repository access loss.
4. **Duplicate browser branch choices.** Overlapping branch pages could append repeated names to the branch selector. Browser paging now retains one entry per name and its first captured head.
5. **Misleading history empty state.** An initial failed history request could show “No commits ... found.” The unavailable state now tells the user that history could not be loaded. A repository with no available branches has its own message.
6. **Unbounded REST response bytes.** Limiting patch previews after JSON parsing did not bound the upstream download. REST and GraphQL now share the existing stream reader with a 5 MiB ceiling before JSON parsing. REST uses an eight-second abort signal covering its body read. Oversized bodies are cancelled and rejected, and HTTP error streams are cancelled. This is a safe failure, not successful truncation.
7. **Documentation drift.** Current architecture and plan descriptions still called the heatmap unimplemented, activity controls future work, and all GitHub operations GET-only. Current guidance now distinguishes REST GET from read-only GraphQL POST queries and points to this report. Historical milestone records retain their original verification limits.
8. **Repository path reuse during browsing.** History reads previously trusted the stored verified `owner/repo` path without a fresh remote ID comparison. All three history operations now verify repository metadata before the actual read. Reused paths fail before branch, commit or file data is read. Route tests cover each operation; the shared identity helper retains the existing real-parser mismatch test.

The preceding collection bug fix is also covered by the current tests: the parser consumes `data.repository.object.history`, matching the actual query, and branch discovery tolerates page-boundary overlap while rejecting pagination that makes no progress.

## Automated verification

The final runtime change was checked in this audit session with:

- `pnpm test`: **189 tests passed across 34 files**. Includes documented synthetic examples, contract rejection, crypto/storage/migrations, API guards, collector limits/checkpoints, date/deduplication, digest, heatmap, client scopes, remote repository identity and private-state cleanup.
- `pnpm typecheck`: passed. The new REST streaming call uses the installed ofetch `stream` response generic; its first typecheck exposed a generic mismatch, which was corrected before the passing run.
- `pnpm lint`: passed.
- `pnpm build`: passed with the Nitro Node preset. The output contains macOS arm64 image binaries and must not be copied as an Ubuntu release build.
- Route source inventory: 13 Timeshit route files; none missing a direct/delegated session guard or private cache header.
- Source scan found no Timeshit `v-html`, logging of upstream bodies, or browser-storage persistence. Test token strings are explicitly synthetic; this is a scoped source check, not an external credential scan.

The build and Nuxt tests ran sequentially to avoid their known generated-manifest conflict. Browser checks used the existing local development server; the production build passed but was not deployed or used to claim Ubuntu runtime acceptance.

## Browser verification and limits

The authenticated local `/services/timeshit` and `/settings` routes opened successfully. Checks used the user's already configured PAT without replacing it, reading it back or changing tracked selections.

Verified real flows: connection status/modal; empty masked replacement input; modal dismissal; Nuxt calendar date selection using Enter; branch preference resolving to `development`; commit list and file patch; file-accordion keyboard expansion; a live collection advancing to 6 of 162 observed branches with zero failed repositories; Pause; expiry/stale state; keyboard day selection; both clipboard formats; desktop/narrow layouts and theme changes. The temporary viewport override was reset and the original dark theme restored. The partial snapshot was retained.

The earlier representative scan was paused to inspect browsing and UI flows and later expired. The subsequent uninterrupted run documented below supersedes that missing complete-collection check. Empty/complete/nonempty digest aggregation and full multi-page exports are covered by synthetic tests; the live clipboard check used the earlier partial/stale snapshot. Real canvas rendering was inspected, while individual canvas hit testing and denied clipboard permission remain automated/code-path checks rather than fully exercised real-browser scenarios. No zero observed count from the earlier partial scan is asserted as a complete activity total.

The initial audit used temporary databases/mocks for credential replacement, disconnect, account switching and key recovery. Subsequent browser and real API lifecycle evidence is recorded below; the saved main connection was not altered. Public HTTPS/browser release acceptance remains separate.

## Complete collection measurement — October 14, 2026

The existing tracked repository and saved connection were preserved. The browser ran one uninterrupted collection for October 1–13, 2026, inclusive in `Asia/Jakarta`. Temporary server instrumentation recorded aggregate counters only and was removed after completion. The sanitized [measurement series](timeshit-collection-benchmark.json) contains all 86 returned batches, without account/repository identifiers, commit content, credentials or continuation capabilities.

| Measurement | Observed result |
| --- | --- |
| Terminal status | `complete`, no continuation and no partial reasons |
| Coverage | 1/1 repository, 162/162 observed branches, 0 failed repositories |
| Elapsed time from collection start | 543,016 ms (9 minutes 3 seconds) |
| GitHub requests | 428 total upstream calls; not GraphQL points |
| Returned batches | 86; five upstream calls per full batch, three in the final batch |
| Raw history entries scanned | 31,683, before date filtering and deduplication |
| Unique matching commits | 47 within the requested author-date range |
| Returned rate-limit delays | None observed |
| Browser acceptance | Complete coverage text displayed; no captured console errors |

The unique result grew from 43 at branch 15 to 44 at branch 129 and 47 at branch 153. Stopping early would have omitted matching activity. The raw entry count includes repeated branch histories and entries outside the requested date range; it is not a duplicate count. This proves terminal coverage for the observed captured heads in this run, not recovery of deleted branches or an independent reconciliation of GitHub's contribution graph.

The 86 batch durations sum to 454,878 ms; the remaining approximately 88 seconds include client scheduling and local overhead and cannot all be attributed to GitHub. A full batch's median duration was approximately 5.27 seconds. This is one local run, without a REST baseline, repeated performance samples or GraphQL point measurements. It demonstrates a working complete path but a material daily-use latency cost.

## Optimized collection and lifecycle follow-up

The collector now queries at most four independent captured heads/cursors per GraphQL call. Every alias is validated before admitting pages. Multi-head restricted, invalid or transient failures fall back to single-head reads without advancing those cursors; rate limits keep their cooldown. An explicit global 100,000 raw-entry ceiling preserves the former traversal bound despite batching. Cursor replay, author filtering, full-SHA deduplication, local author-date grouping, snapshot admission, one-second spacing and lifetime/request limits remain enforced.

The optimized live browser run completed **163/163 observed branches**, zero failures and **47 unique matching commits** for October 1–13, 2026, in **184,572 ms (3 minutes 5 seconds)** using **112 upstream requests** across 23 batches. Its 108 successful GraphQL calls reported total query cost 108. No rate-limit delay or browser console error was observed. Instrumentation was removed after measurement. See the sanitized [optimized batch series](timeshit-collection-optimized-benchmark.json).

Compared with the earlier baseline, the observed elapsed time fell by approximately 66% and requests by approximately 74%. A branch was added between runs, heads were not frozen and network conditions were not controlled. Equal matching counts do not independently establish identical SHA sets, and baseline GraphQL cost was not measured. These are single-run observations, not a universal speed or quota guarantee.

### Credential lifecycle evidence

- A separate loopback production-build instance with a temporary private database and synthetic GitHub upstream exercised browser connect, invalid replacement, same-account replacement, different-account replacement, disconnect, reconnect and Settings reload. Drafts cleared and stayed masked. Same-account replacement retained the repository but required access recheck; different-account replacement returned zero selected repositories with no prior activity view. No unexpected console errors were captured. The test instance and its database were removed.
- A separate local instance using the already saved real PAT verified GitHub connect/same-account replacement, rejected replacement preservation, stale disconnect rejection, disconnect/reconnect, 401 rejection, private no-store responses, encrypted storage and restart persistence. The PAT was read only inside the acceptance process, never printed or returned to the browser. A before/after file digest proved that the main database remained unchanged. No GitHub writes or token revocation occurred.
- A new route regression test covers the whole persisted lifecycle with a stable test encryption key. The earlier route-test setup generated a different key on each config read, which could not support meaningful repeated lifecycle requests; it now uses one key per test.
- Two-real-account switching and real-browser replacement of two actual PATs remain untested. Synthetic browser switching and real same-account API lifecycle are explicitly distinct evidence.

### Ubuntu evidence

Frozen-lockfile installation, **194 tests in 34 files** (`--maxWorkers=1`), typecheck, lint and a source production build passed on **Ubuntu 26.04.1 LTS x64, Node 24.21.0, pnpm 12.5.1**. Nuxt Image included Linux x64 binaries. The first build with a deliberately constrained 768 MiB V8 heap failed with heap exhaustion; a 1,536 MiB build heap passed using the host's existing approximately 2 GiB RAM and 2 GiB swap. No swap/system configuration was changed. Do not hide the initial failure or interpret the passing heap setting as a universal resource minimum.

The isolated Ubuntu production Node server verified hashes of **80 runtime source files** against local source, unauthenticated API rejection, private no-store headers, exact trusted-Origin rejection, production Secure/HttpOnly/SameSite/Path cookie attributes, a real GitHub connection, readable repository tracking, encrypted SQLite and session/selection persistence across a server-process restart with stable private keys. Its live all-branch collection completed **164/164 observed branches**, zero failures and **47 matching commits** in **178,648 ms (2 minutes 59 seconds)** across 23 batches. Another branch had appeared since the local optimized run. Ubuntu request/point counts were not instrumented and must not be inferred from batch count.

The real PAT was transferred only through authenticated strict-host-key SSH stdin into the acceptance process; it was not an argument, environment file, repository artifact or log. The temporary server bound to loopback, used fresh private keys/database, and stopped/removed its database on completion. The existing target checkout and public service configuration were preserved. See the sanitized [Ubuntu evidence](timeshit-ubuntu-acceptance.json) and repeatable [acceptance runbook](timeshit-acceptance.md).

The latest local suite also passed **194 tests / 34 files**, typecheck and lint. The application production build passed locally; its macOS binaries are not the Ubuntu artifact. The additional acceptance helpers are deliberately operator-invoked, use built-in Node assertions, and are not automatically run by `pnpm test`.

## Remaining release gates and recommendations

1. **Public HTTPS/proxy/browser acceptance.** The actual public domain could not be reached on TCP 443 during this run. Loopback acceptance checks cookie attributes and server behavior but cannot establish TLS, proxy headers/cache bypass or real browser Secure-cookie behavior at the domain. The approved project rules require an explicit deployment request before publishing; no public service, proxy, firewall or TLS configuration was changed here. Run those release checks after the real HTTPS deployment is available.
2. **Keep scope correct when optimizing.** Repository `updated_at` is not historical commit evidence, and skipping a repository based only on that current value can omit commits in the requested past range. Changing to a persistent commit index requires a separate retention, invalidation and force-push design; no index, queue or silent scope reduction was added here.
3. **Release operator configuration.** Isolated Ubuntu build/API acceptance has passed. An actual release still needs an operator-managed persistent private database/key location, one supervised Node process, HTTPS proxy and restart/backup policy; process-restart acceptance does not prove OS-reboot supervision. Follow the [acceptance runbook](timeshit-acceptance.md) and existing security guidance.
4. **Optional additional real-account acceptance.** The current browser account-switch check is synthetic. Use an explicitly approved second GitHub account if two-real-account replacement evidence is required; preserve the administrator's main selection and do not paste tokens into chat.

External Timeshit backend Base URLs, AI-generated summaries, persistent activity indexing, multiple PATs, multi-user access and GitHub writes remain outside the approved implemented scope. Settings labels this boundary explicitly.

## References

- [Approved plan](timeshit-implementation-plan.md), [connection contract](timeshit-connection-contract.md), [repository contract](timeshit-repositories-contract.md), [history contract](timeshit-history-contract.md), [activity contract](timeshit-activity-contract.md), [preference contract](timeshit-preferences-contract.md).
- [GitHub GraphQL rate/query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api): HTTP 200 rate errors and retry/reset headers.
- [GitHub GraphQL commits](https://docs.github.com/en/graphql/reference/commits): history, author ID filtering and cursors; no documented authored-date guarantee for time bounds.
- [GraphQL aliases](https://graphql.org/learn/queries/#aliases) and [GitHub multiple aliased queries](https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids): alias query semantics; implementation and performance evidence are recorded separately above.
- [GitHub pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) and [commit details](https://docs.github.com/en/rest/commits/commits#get-a-commit).
- [Design system](../DESIGN.md), [development checks](development.md), [security/configuration](security-and-configuration.md), [reference catalog](references.md).
