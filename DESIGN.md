# JCore UI design system

## Direction

The owner selected Swiss Style / International Typographic Style with a black, white and neutral-gray palette. JCore should feel precise, calm and information-led. Inter is the global typeface. Layout, typography, alignment and rules establish hierarchy; hue is not a status channel.

Design intent: ENERGY 1, RHYTHM 2, MOTION 1. The focal point is each page's title/task and its operational data. Repeated square surfaces, aligned numeric values and section rules provide the identity. Contrast acts as the accent. Avoid ornamental gradients, floating shadows, glass panels, marketing sections or decoration without a navigation/data purpose.

These are implementation rules for future changes. Existing deviations and scoped exceptions are recorded below so contributors do not mistake a design target for a fully enforced global theme.

## Implementation sources

| Source | Responsibility |
| --- | --- |
| `app/app.config.ts` | Nuxt UI color aliases, square UCard roots and badge styling |
| `app/assets/css/main.css` | Inter, neutral gray aliases and application surface colors |
| `app/layouts/default.vue` | Shared shell, navigation and theme switching |
| `app/pages/login.vue` | Separate login composition |
| `app/pages/settings.vue` | Service configuration cards/modals |
| `app/pages/services/timeshit.vue` | Repository/history browsing, collection controls, daily digest and activity heatmap with Nuxt UI tables and Chart.js |
| `app/pages/services/vps.vue` | Monitoring grid, typography, tables and chart palette |
| `app/components/VpsDonutChart.client.vue` | Donut layout and tooltip |
| `app/components/VpsResourceChart.client.vue` | Trend chart layout, legends and tooltip |
| `app/utils/vps-status.ts` | Health labels and icons |

Use Nuxt UI's [theme API](https://ui.nuxt.com/docs/getting-started/theme) and component `ui` slots. Keep native semantic structure (`main`, `section`, headings, `dl`) around components; do not recreate interactive primitives in native markup or custom components.

## Color and themes

Current semantic mapping in `app.config.ts`: `primary`, `secondary`, `success`, `info`, `warning`, and `error` all map to `neutral`; the neutral scale is `zinc`. The CSS `gray-*` aliases map to Tailwind's neutral scale. Keep semantic prop names for meaning even when rendered in grayscale.

| Surface token | Light | Dark |
| --- | --- | --- |
| Application canvas | `#f5f5f5` | `#090909` |
| Sidebar / shell surface | `#ffffff` | `#121212` |
| Chart used/main series | `#18181b` | `#f4f4f5` |
| Chart available/background series | `#d4d4d8` | `#3f3f46` |
| Chart secondary series | `#52525b` | `#a1a1aa` |

Prefer tokens (`bg-default`, `text-muted`, `border-default`, application surface classes) for new work. Local gray classes exist for the current composition. Avoid adding untracked colors. Some existing chart text/grid/tooltip constants use gray/slate-like RGB values; therefore the current implementation is a monochrome direction, not a verified guarantee that every rendered pixel has equal RGB channels. If strict pixel-neutrality is requested, audit those constants and defaults together.

Both light and dark modes are supported through Nuxt UI color-mode controls. Check selected/hover/focus/disabled states in each. Do not make success green, warning amber or Danger Zone red; the later approved monochrome direction supersedes earlier color experiments.

## Typography and copy

- Use Inter through Nuxt Fonts and the global `--font-sans` token. Avoid introducing another font dependency.
- Main app page headings use `text-3xl sm:text-4xl`, bold with restrained negative tracking. Login uses a larger scale for its separate two-column composition.
- Data card headings generally use `text-sm font-semibold`; resource section headings use `text-base font-semibold`. Metadata uses `text-xs` with readable contrast.
- Donut center values are exactly `24px`, semibold, with no secondary description. The donut's accessible name carries context.
- Use tabular numerals for comparisons. Reserve monospace for PIDs, paths, commands and technical identifiers.
- Compact uppercase labels identify technical detail fields or totals; they are not the default paragraph/headline style.
- Generated UI, accessible text, validation and documentation use English. Format dates/numbers with `en-US` and time display with `Asia/Jakarta` where dates are formatted by the app.
- Preserve original external source content, such as systemd descriptions and future GitHub messages/patches. Never translate or fabricate source content silently.

## Layout and spacing

Keep content left-aligned on a consistent grid. Shared page content has a maximum width of 1440px. The VPS page uses `space-y-8`, with `gap-4` between neighboring cards. Other pages have their own spacing; reuse the closest existing composition instead of inventing a new scale for every screen.

VPS structure:

1. Page title, source/health/freshness cues and host information.
2. Active alerts spanning the content width.
3. Four overview cards: CPU, Memory, Storage and Network. One column below `xl`, two columns from `xl`.
4. Resource trends: CPU, memory/swap, storage I/O and network, also reflowing to two columns at `xl`.
5. Filesystem and Network interfaces, one column below `xl`, two at `xl`.
6. Services · systemd and Active processes, each full width.

Each overview card places the donut and right-hand definition list in two internal columns from `sm`; smaller screens stack them. The donut container is 176px, increasing to 192px from `sm`. Keep label/value rows aligned and totals separated by a rule. Footer rows hold the relevant load, swap, inode or error/drop information. Network's donut is RX/TX traffic composition, not bandwidth utilization.

Settings uses one column by default and two from `md`. Login becomes a two-area grid from `lg`. The shell uses USidebar with mobile drawer behavior; mobile navigation closes after selecting a link, desktop navigation stays visible.

Use default UCard body padding on VPS cards. Add internal section gaps independently: the tables sit in `mt-4` containers below headings/descriptions. Do not add a second outer padding wrapper that makes a card look empty. The login card currently overrides body padding (`p-5 sm:p-7`); Coming Soon pages set body padding to zero and supply their own composition. These scoped exceptions do not establish a new VPS card default. Expanded table content has its own `p-4 sm:p-5`, distinct from UCard body padding.

## Components and interactions

| Need | Existing component / pattern |
| --- | --- |
| Shell navigation | `USidebar`, `UNavigationMenu`, `NuxtLink` |
| Actions and settings cards | `UButton` |
| Data surfaces | `UCard` |
| Status | `UBadge` plus explicit labels/icons |
| Configuration dialog | `UModal` with Save/Cancel in footer |
| Connection / Danger Zone | `UAccordion` |
| Form labels/inputs | `UFormField`, `UInput`, `URadioGroup`, `UCheckbox` |
| Feedback | `UAlert`, `UProgress` |
| Data table and detail expansion | `UTable`, `v-model:expanded`, `#expanded`, accessible `UButton` toggles |
| Process pagination | `UPagination`, 10 rows per page |
| Theme / identity | `UColorModeButton`, `UAvatar`, `UIcon` |

Nuxt UI button and select slot themes in `app/app.config.ts` provide the shared pointer cursor; Nuxt UI disabled-state cursor variants remain in effect. Every enabled action has a pointer cursor, an accessible name and a visible keyboard focus state. Disabled actions must be visibly disabled and must not imply they are usable. Decorative icons have no click affordance. Use semantic controls rather than clickable containers.

Service Settings opens Connection automatically and leaves Danger Zone closed. Labels sit above inputs. Shutdown requires explicit confirmation. Save is in the modal footer. These mode controls currently change presentation only; labels must not imply an OS shutdown action.

For table expansion, keep details visually attached to their parent row, use consistent subdued surfaces and avoid a new nested card. Systemd details stack vertically. Process details pair labels and values. Long paths/commands wrap within the expanded region; tables scroll horizontally inside their card instead of widening the page. Filesystem, network and systemd currently show all rows; only processes are paginated. Do not document sorting/filter controls that are not present.

## Health and availability states

| Machine value | Visible label | Icon |
| --- | --- | --- |
| `healthy` | Healthy | circle-check |
| `warning` | Warning | triangle-alert |
| `critical` | Critical | circle-x |
| `unknown` | Unknown | circle-help |

Status interpretation belongs to the API/contract. Do not infer health from a chart's tone or a single instantaneous percentage. Show source availability, demo/live labels, pending/firing alerts, unavailable values and staleness explicitly. Missing values render as an unavailable marker, not zero. Keep empty, first-load failure, retry, stale and partial states legible.

## Charts

Use Chart.js 4 with vue-chartjs for real data charts. Nuxt UI surrounds the charts; focused client-only chart wrappers are the allowed custom integration.

- Donuts use a 76% cutout and no legend; the adjacent list supplies labels/values. Missing or zero-only segments show an unavailable placeholder ring with tooltip disabled. Do not interpret the placeholder ring as real data.
- Trend series use tone plus solid/dashed line patterns and distinct hover point styles. Multi-series charts show a bottom legend. Do not bridge null samples (`spanGaps: false`).
- Trend containers are `h-52`; percentage axes span 0 to 100, rate axes/tooltips use binary byte-rate units.
- Tooltip backgrounds are fully opaque: `rgb(32, 35, 38)` in dark mode and `rgb(255, 255, 255)` in light mode. The trend `labelColor` callback fills the swatch from the series border color. Translucent area fills and grid lines are allowed and separate from tooltip opacity.
- Donut canvas is above the absolute center label (`z-10` versus `z-0`) so the HTML center cannot appear over the tooltip. Keep that layering when refactoring.
- Charts use 250ms animations and check reduced-motion at mount; donut active transitions use zero duration. Do not add decorative motion or claim live preference-change handling is implemented.

## UI acceptance checklist

The implemented Timeshit heatmap uses the existing Chart.js scatter integration with square week/day points, grayscale intensity and opaque tooltips. Nuxt UI date/table controls provide keyboard day selection and explicit unknown versus zero/observed counts. See the [activity contract](docs/timeshit-activity-contract.md) and current [verification report](docs/timeshit-verification-report.md).

For every UI change, inspect the affected route locally in desktop/mobile widths and both themes. Verify alignment, contained overflow, default card padding, labels, status cues, tooltip fill, keyboard expansion, modal behavior, focus, cursors and reduced motion. Confirm labels and adjacent data remain available for users who cannot inspect a canvas tooltip.

This document specifies the intended system and records current source choices. It is not a claim that every accessibility interaction has automated coverage. Use the [development checklist](docs/development.md#browser-verification-for-ui-changes) and [component references](docs/references.md#nuxt-ui-and-visualization) for verification.

## Timeshit activity layout

Collection controls precede the daily digest and repository management. Use default UCard padding, wrapping date/action rows, repository coverage separated by rules, and full-width commit lists. Controls stack naturally on narrow screens. Preserve original message whitespace and wrap long content; paginate displayed commits at 20 rows without restricting copied output. Use textual complete/partial/stale states and neutral badges; do not invent a progress percentage while branch discovery is unfinished.

The Timeshit heatmap uses Chart.js square scatter points with Sunday-to-Saturday rows, chronological weeks and fixed grayscale intensity buckets (0, 1, 2–4, 5–9, ≥10 observed commits). Keep the legend, partial/stale wording and exact daily-count table together. The 14-day table page provides Nuxt UI buttons for keyboard day selection; chart and table select the same digest date. Keep long charts inside their horizontal scroll container, opaque tooltips and animation disabled.

Timeshit uses the full available shell width as an owner-approved exception to the general 1440px content cap. Its cards/tables fill that width while wide tables and long heatmaps scroll internally. Activity/digest dates use Nuxt UI popover calendars with English date labels and no native HTML date picker. UCard default padding remains unchanged.
