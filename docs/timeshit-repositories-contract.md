# Timeshit repository management

This milestone replaces Timeshit's Coming Soon page with repository discovery and tracking. It does not implement commit history, patches, daily digest or heatmap. Use the [connection runbook](timeshit-connection-contract.md) for PAT, encryption key, trusted origin and private SQLite setup. The [approved plan](timeshit-implementation-plan.md) remains the target for later activity phases.

## Private API, version 1.0

Every endpoint independently requires a JCore session and sets `Cache-Control: private, no-store`. Only the Node server receives the saved PAT. GitHub reads use the existing fixed API origin/version, redirect refusal, 8-second timeout per request and no automatic retries. No GitHub mutations are performed.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/timeshit/repositories?page=1` | One authenticated `/user/repos` page, 30 items, sorted by full name ascending |
| `GET /api/timeshit/tracked-repositories` | Read persisted account-bound selection without a GitHub request |
| `PUT /api/timeshit/tracked-repositories` | Perform one `track`, `remove` or `check` action with explicit connection and selection revisions |

PUT JSON fields (all required, unknown properties rejected):

```json
{
  "expectedGeneration": "11111111-1111-4111-8111-111111111111",
  "expectedSelectionRevision": "22222222-2222-4222-8222-222222222222",
  "repositoryId": 123,
  "action": "track",
  "page": 1
}
```

The request uses the same exact-origin, JSON Content-Type, cross-site rejection and 4096-byte body policy as connection mutations. IDs must be positive safe integers; page is 1–10000. Both revisions are opaque UUIDs. Stale writes fail with 409 before upstream calls and again inside the final SQLite transaction. No database transaction is held across network waits.

- **Track:** refetch the supplied discovery page, resolve the requested numeric ID from that server response, fetch documented owner/name repository metadata and require matching numeric identity, then probe `/branches?per_page=1&page=1`. At most three GitHub requests. The browser cannot supply arbitrary owner, URL or account. This also re-verifies an already tracked ID after a rename discovered on that page.
- **Check:** fetch stored owner/name metadata and probe branches. At most two requests. Failed checks mark the tracked row `unavailable` without claiming deletion; the endpoint returns the safe error and the client reloads the saved state. No automatic removal.
- **Remove:** change only SQLite; works while GitHub is unavailable or the PAT is rejected, provided the saved connection remains decryptable. It does not delete a GitHub repository.

Discovery membership can change between display and tracking. A missing ID on the refetched page returns 409 and requires refresh; JCore does not search every page implicitly. Renamed endpoints are not followed automatically, because redirects are refused. Find the new name in discovery and choose Verify selection; matching GitHub ID updates the existing row.

Repository operations allow one upstream operation at a time per Node process and honor received rate-limit delays with 429/Retry-After. This is a single-process guard, not a distributed limiter or cache. The connection verification gate is separate. A full discovery page sets `hasNext=true`; this means another page can be requested, not proof it contains data. An empty next page is valid. No total count is invented.

## Response and access meaning

[JSON Schema](timeshit-repositories.schema.json), [synthetic fixtures](timeshit-repositories.examples.json) and `shared/types/timeshit.ts` define the envelope. `generation` identifies the credential generation; `selectionRevision` protects local changes. Discovery returns the requested page; tracked reads/actions return the full bounded selection with `page=1, hasNext=false`. Browser parsing validates response shape.

Each repository includes stable numeric ID, actual owner/name/description, private/archived flags, nullable default branch, access and check timestamp. Description is original external text, rendered as text. No token, envelope or encryption key is returned. `defaultBranch=null` means GitHub did not provide one, not proof the repository is empty. An empty branches response is a successful read with no branches; conflict/error responses remain unavailable, not fabricated content.

- `not-checked`: discovery only, or verification invalidated after token replacement.
- `readable`: metadata and branch reads succeeded at `checkedAt` for this credential generation. This is a last check, not a continuing permission guarantee or proof of access to other private repositories.
- `unavailable`: latest explicit check failed. GitHub 404 does not distinguish deletion from private-access restrictions. Last-known metadata remains visible.

Only `readable` entries verified for the active generation are eligible for activity collection. The bounded collector and its controls are implemented; see the [activity contract](timeshit-activity-contract.md). The connection-level `checks.contents` is intentionally unchanged; repository-specific checks must not become a global authorization claim.

## SQLite and lifecycle

Schema v2 adds JSON metadata and verification generation to the v1 reserved `tracked_repository` table, and a singleton `repository_selection` revision. Existing encrypted connection data is preserved. The old table had no public selection API; legacy rows without repository metadata are not exposed or treated as verified. Backup the private database/key before deploying a migration; rollback requires restoring a compatible backup. Newer unknown schema versions fail closed.

Each selection change is atomic and rotates its revision. Repository ID is the primary key; owner/name changes do not duplicate it. Selection is bound to the verified numeric GitHub account ID. A same-account PAT replacement rotates connection/selection revisions and marks candidate selection `not-checked`, preserving IDs for explicit revalidation. Different-account replacement or disconnect removes selection. Failed PAT verification leaves the old connection untouched.

At most **200 repositories** can be selected. This is an initial JCore request/UI budget, not a GitHub restriction. Selected rows paginate locally at 20; discovery paginates upstream at 30. No persistent activity cache exists yet. SQLite/private key backup and target-host Node acceptance remain operator responsibilities.

## UI and verification

The Timeshit page uses Nuxt UI UCard, UTable, UButton, UInput, USelect, UBadge, UAlert and UPagination with the existing Inter/monochrome Swiss design and default card padding. Tables contain horizontal overflow on small screens. Search and visibility filter apply only to the current discovery page, explicitly labeled. Tracking saves immediately. Archived flags are source data, not a prohibition on tracking.

Loading, disconnected/unconfigured, empty, safe error, unavailable, rate-limited and needs-recheck states are explicit. Failed discovery leaves tracked selection available for removal. Refresh reloads connection status and lists. Logout/navigation reset private repository Pinia state and ignore late responses. Another tab's connection changes are detected on refresh/mutation through generation checks; there is no live multi-tab broadcast.

Automated tests cover GitHub response validation and bounded requests, identity/access separation, ID mismatch, private endpoint guards, origin/body limits, forged IDs, generation/selection conflicts, SQLite reopen/migration, PAT/account transitions, unavailable rechecks, removal without upstream access, response fixtures, and late client requests. Tests use synthetic data. Live PAT access and Ubuntu deployment are separate acceptance checks; never claim them from mocks.

## Official references

- [Authenticated repository discovery](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user).
- [Get a repository](https://docs.github.com/en/rest/repos/repos#get-a-repository).
- [List branches and Contents permission](https://docs.github.com/en/rest/branches/branches#list-branches).
- [REST troubleshooting](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api).
- [PAT types and organization restrictions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
- [Classic scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

### Local acceptance evidence — October 13, 2026

- 74 tests passed across 17 files, including the existing VPS/auth/service suites and Timeshit connection/repository tests.
- Production Node build was exercised on a separate loopback port with a temporary administrator, encryption key and database. A process-local synthetic GitHub transport was used outside repository source; no production mock switch or credential was added.
- Browser checks: sign-in, authenticated Timeshit rendering, track/recheck/untrack, persistence after reload, page-local search, two discovery pages with correct final-page controls, restricted-access feedback, empty tracked state and logout. With 21 selected repositories, local pagination displayed 20/1 rows and returned to the first page after the final row was untracked.
- Light/dark rendering and measured 480 px CSS viewport passed. Table overflow stayed inside its container; document scroll width matched viewport width. The browser override reported doubled dimensions, so this is not evidence of a 390 px CSS check. Computed styles confirmed pointer cursors on enabled track/select controls and a not-allowed cursor on disabled pagination. No console warnings/errors were captured during these checks.
- No real GitHub PAT or Ubuntu deployment was verified in this milestone. Private GitHub scope/SSO policies must be accepted with the owner's configured token.

The current database version is v3: it preserves the repository v2 structures above and adds the global [history branch preference](timeshit-preferences-contract.md).
