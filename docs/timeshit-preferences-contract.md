# Timeshit history preference

Implemented locally on October 13, 2026. This preference controls the initial branch for **Browse history**. It does not change activity collection: collection uses only tracked repositories and all their observed remote branches, filtered to the connected PAT account.

## API and persistence

- `GET /api/timeshit/preferences` returns the global single-administrator preference.
- `PUT /api/timeshit/preferences` accepts and returns the same versioned envelope.
- Both require a JCore user session and return `Cache-Control: private, no-store`.
- PUT uses the existing exact trusted-origin, same-origin JSON and 4096-byte body checks. Unknown fields, empty names, whitespace/control characters and names longer than 255 characters are rejected with 400. This is a bounded preference string, not proof that a branch exists in any repository; browsing resolves it against branches actually returned by GitHub.
- [Schema](timeshit-preferences.schema.json), [synthetic examples](timeshit-preferences.examples.json), shared type and runtime parser define the version 1.0 envelope. It contains only `schemaVersion` and `historyDefaultBranch`; no credentials or continuation values.

```json
{ "schemaVersion": "1.0", "historyDefaultBranch": "development" }
```

SQLite `user_version=3` adds a singleton `timeshit_preferences` table and initializes `history_default_branch` to `development`. Existing v1/v2 databases migrate automatically through the existing migration path; credentials, tracked repositories and selection revisions remain intact. Back up the private database before upgrading a deployed instance. Preferences survive restarts and PAT replacement/disconnect because they belong to the application administrator, not a GitHub account. Concurrent preference writes use last-write-wins semantics; no GitHub mutation occurs.

## UI and branch resolution

The Timeshit page loads preferences before allowing Browse history. Its History preference form saves the branch to the private Nuxt endpoint. Loading/saving failures remain visible and do not silently overwrite the last known value. The saved preference applies the next time a repository is opened; changing it does not forcibly replace an already selected branch.

Initial branch discovery searches at most ten GitHub branch pages for the preferred name. When found, commits are requested using its captured head SHA. Otherwise select the repository's declared default branch if present among discovered branches, then the first discovered branch. A visible notice identifies this fallback. If more pages remain, the notice says the search was bounded rather than claiming the preferred branch does not exist; Load more branches remains available for manual selection. No available branches means no automatic commit request. The branch preference is captured at the start of browsing, so an in-flight request does not switch scope after a preference edit.

## Calendar and width changes

Activity start/end and digest dates use Nuxt UI `UPopover`, `UButton` and `UCalendar`, with calendar-only `DateValue` objects from the explicitly declared `@internationalized/date` dependency. Dates serialize as `YYYY-MM-DD`, retain Jakarta author-day semantics and avoid native HTML date pickers. Start/end controls constrain date ordering and supported years; the collection validator still enforces the 366-day limit. Digest selection is constrained to the collected range. Choosing a date closes its popover.

The Timeshit page fills the available shell width instead of using the earlier 1440px cap. Commit activity/history cards and table bases explicitly use full width; wide tables and long heatmaps retain internal horizontal scrolling. UCard retains its default padding.

## Verification boundaries

Tests cover preference validation, initial default, database reopen persistence, private endpoint guards/origin rejection, configurable branch selection, later-page discovery, bounded fallback and safe failure messages. A Nuxt DOM test exercises the actual calendar selection and date bounds; The calendar is mounted with the official Nuxt Test Utils `mountSuspended` helper and its Vue Test Utils peer dependency; a bare Vue mount did not provide the required component context. This is not browser or pixel acceptance. Local browser checks now include calendar selection, history browsing, keyboard file expansion, both clipboard formats and responsive themes. See the [verification report](timeshit-verification-report.md) for exact evidence and remaining credential/Ubuntu/complete-collection checks.

See the [history contract](timeshit-history-contract.md), [activity contract](timeshit-activity-contract.md), [approved plan](timeshit-implementation-plan.md), [Nuxt UI Calendar](https://ui.nuxt.com/docs/components/calendar) and [Popover](https://ui.nuxt.com/docs/components/popover). Installed component types/source define the APIs used here.
