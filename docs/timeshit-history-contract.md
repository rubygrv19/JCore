# Timeshit branch and commit browsing contract

This milestone implements read-only branch, commit and changed-file browsing for repositories whose access is verified for the active GitHub connection. The [activity contract](timeshit-activity-contract.md) defines collection budgets and shared date/deduplication behavior. Its bounded all-branch collector/HTTP handlers are implemented, with daily digest/copy implemented; heatmap is implemented; current acceptance and remaining release checks are recorded in the [verification report](timeshit-verification-report.md) in the [approved plan](timeshit-implementation-plan.md).

## Access and origin

All routes require the JCore user session and return `Cache-Control: private, no-store`. The browser calls same-origin Nuxt endpoints. Only the server decrypts and sends the saved PAT to the fixed GitHub REST origin. The API resolves `owner/repo` against the current account's persisted tracked selection and requires `access=readable` for the current connection generation. A missing or stale selection is rejected before any GitHub read. After the upstream request, JCore checks that both the connection generation and repository selection remain valid. No GitHub write request is made.

Before each branch, commit-list or detail read, the server fetches repository metadata and compares its numeric ID with the tracked ID. A reused repository path is rejected instead of attributing the new repository's data to the old selection. This adds one bounded metadata read per history operation; metadata and history reads share the existing operation gate. Upstream discovery and history are not an atomic GitHub snapshot, so this check does not claim transaction-level consistency across remote changes.

## Endpoints

| JCore route | Query | Upstream operation | Response |
| --- | --- | --- | --- |
| `GET /api/timeshit/repositories/:owner/:repo/branches?page=1` | `page` 1–10000 | List branches, up to 100 per page | Branch name, captured head SHA and protected flag |
| `GET /api/timeshit/repositories/:owner/:repo/commits?branch=main&headSha=…&page=1` | Branch label and 40-character SHA from the selected branch, `page` 1–10000 | List commits with `sha=headSha`, `author=<server-verified login>`, 30 per page | Original message, derived title/body, source timestamps, nullable GitHub author identity |
| `GET /api/timeshit/repositories/:owner/:repo/commits/:sha?page=1` | Full 40-character SHA, `page` 1–30 | Get a commit with up to 100 files per page | Commit metadata, aggregate stats, changed files and optional patch text |

The UI obtains branch head SHAs from the branch response and sends that SHA for each commit page. The server validates the SHA but does not treat the branch label from the browser as authoritative metadata. GitHub scopes every request to the server-resolved tracked repository, and commit listing always uses the login stored from the verified `/user` response; the browser cannot set or override the author filter. Detail requests are also restricted to that tracked repository.

`hasNext` for branch and commit pages is true when the upstream response fills the requested page size (100 branches or 30 commits). The next request may legitimately return an empty page if upstream data changed. Pages are read-only snapshots at request time; branch names and refs can move between separate branch requests. Commit pagination remains anchored to the selected head SHA.

For file details, `hasNextFiles` follows the same full-page rule with 100 files per page. GitHub documents a 3,000-file ceiling for commit detail JSON. `filesTruncatedAtGitHubLimit` is set when page 30 is full; the UI links to GitHub for the complete view. A file whose response lacks `patch` is shown with an explicit unavailable message. Each supplied patch is limited to 20,000 characters in the JCore response; `patchTruncated` marks local preview truncation and the UI links to the file on GitHub. This bounds the rendered payload per file without claiming that a shortened patch is complete.

## Data semantics

- `authoredAt` is the Git commit author timestamp returned by GitHub, not push time. `committedAt` is kept separately. The browsing page formats both in `Asia/Jakarta`.
- Commit `message` is kept intact; `title` is its first line and `body` is the trimmed remainder when present. The summary is a deterministic display derivation, not an AI summary.
- `authorLogin` and author/committer names may be `null`; GitHub can return commit records without a linked user. Email addresses are not included in JCore responses.
- `patch: null` means the GitHub JSON entry did not include patch text. It does not establish why the patch was omitted.
- Filenames, messages and patches are untrusted source text. The UI renders them as text, not HTML.
- Response types, JSON Schema, synthetic examples and runtime validators are maintained together in `shared/types/timeshit.ts`, `docs/timeshit-history.schema.json`, `docs/timeshit-history.examples.json` and `shared/utils/timeshit-history-contract.ts`.

## Limits and errors

GitHub requests use the existing fixed API version, timeout, redirect refusal, retry policy and per-process upstream operation gate described in the [connection contract](timeshit-connection-contract.md). Rate-limit errors include `Retry-After` where GitHub supplies a usable delay. Repository selection, generation checks and safe normalized GitHub errors are shared with repository management.

REST response bodies are read as streams, with a 5 MiB limit checked before JSON parsing and an eight-second abort signal covering the body read. Oversized responses fail with `INVALID_UPSTREAM`; they are not truncated into a successful response. The 20,000-character patch preview limit applies only after a bounded upstream page has been parsed.

The UI keeps branch and commit paging manual. It does not download a repository's entire history, infer commits from unreachable objects or local worktrees, or claim global account activity. The separate all-branch collector is connected to its own controls and reports partial coverage, continuation and timestamps independently from these browsing endpoints.

Each response parser validates its own envelope definition, not the union of all history envelopes. File-detail pages outside 1–30 are rejected before an upstream read, and supplied SHA casing is normalized for comparison. Commit-list records with a non-null different linked author are rejected. GitHub 409 becomes `GITHUB_CONFLICT` (409), without asserting that a repository is empty.

History state resets when the loaded connection generation or repository selection revision changes. Every history result also compares its generation with the request's captured view generation; a newly observed generation clears the old view instead of mixing pages, even if a connection changed in another tab. Invalidated pending requests cannot restore old content or leave detail/commit loading active.

Client functions additionally compare each validated response with the requested repository ID and page, plus branch/head SHA for commit lists and commit SHA/file page for details. A structurally valid response for another request is rejected. Repeated branch names across browser discovery pages are deduplicated while retaining their first captured heads. Session loss, rejected GitHub credentials or invalidated repository access clears private history; an initial failed history request has an unavailable empty state instead of claiming no commits were found.

## References

- [GitHub REST API: commits](https://docs.github.com/en/rest/commits/commits?apiVersion=2026-03-10): commit list filters, file fields and endpoint pagination.
- [GitHub REST API pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api): `Link` headers and page behavior.
- [GitHub REST API best practices](https://docs.github.com/en/rest/guides/best-practices-for-integrators): pagination and response handling.

These are GitHub source/API behaviors. The JCore route shapes, page sizes, patch preview limit and response schemas are application contract decisions.
