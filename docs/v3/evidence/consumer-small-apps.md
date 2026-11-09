# Consumer audit: finances/ui, image-gateway/app, email-gateway/client

Date 2026-11-09. Read-only. No repo modified, no dev server, no commit. Paths are relative to `~/SourceRoot/`.
Method: import census (perl over `src/**`, routeTree excluded), name-level export scan of the installed
basalt-ui 2.29.0 barrels (`node`, scratch in `/tmp/v3audit`), grep counts, git log/show, and read-only
`basalt-ui check-theme`, `basalt-ui sync --check`, `oxlint`. Tags: **[obs]** observed, **[judg]** judgement.

## 0. Versions and state [obs]

| Consumer             | basalt-ui declared                                                   | basalt-ui installed                                                          | Mantine decl / installed | React decl / installed | Vite  | basalt wiring                                                                                                    |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ | ---------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| finances/ui          | 2.29.0 (`finances/ui/package.json:18`)                               | 2.29.0                                                                       | 9.7.4 / 9.7.4            | 19.3.1 / 19.3.1        | 8.3.5 | `.basalt/`, managed AGENTS block, DESIGN.md, 6 rules, 3 skills, 1 agent                                          |
| image-gateway/app    | 1.41.0 (`image-gateway/app/package.json:31`, root `package.json:28`) | 1.41.0                                                                       | 9.6.1 / 9.6.1            | 19.3.0 / 19.3.0        | 8.3.0 | root `.basalt/`, root `.claude/rules` (6) + skills (3), root DESIGN.md (unfilled template)                       |
| email-gateway/client | 2.29.0 (`email-gateway/client/package.json:25`, `bun.lock` 2.29.0)   | **1.36.0** (`client/node_modules/basalt-ui/package.json`, tree dated Oct 13) | 9.7.5 / **9.6.2**        | 19.3.1 / **19.3.0**    | 8.3.1 | no `.basalt/`, no shipped rules or skills, no DESIGN.md; `enforcementNotice: false` (`client/vite.config.ts:19`) |

Version split: finances and email-gateway declare **2.29.0**; image-gateway is on the **1.x line (1.41.0)**.
email-gateway's runtime tree is still 1.36.0: its 2.x upgrade is commit `3b79827` (2026-11-08), and the
node_modules were not reinstalled, so every local gate it ran targets 1.36.0 and Mantine 9.6.2.

Gates run now (read-only): finances `check-theme` pass, `oxlint` 0 findings; image-gateway `check-theme` pass,
`sync --check` pass, `oxlint` 0 errors / 7 warnings, none `basalt/*`; email-gateway `check-theme` pass (on 1.36),
oxlint not runnable (no `oxlint` binary in the installed tree).

## 1. Census

### 1a. Import statements by subpath (src, routeTree excluded) [obs]

| Subpath                                         | finances      | image-gateway | email-gateway              |
| ----------------------------------------------- | ------------- | ------------- | -------------------------- |
| `basalt-ui` (root)                              | 17            | 7             | 6                          |
| `basalt-ui/tokens`                              | 13            | 8             | 1                          |
| `basalt-ui/charts`                              | 11            | 0             | 0                          |
| `basalt-ui/table`                               | 5             | 0             | 0                          |
| `basalt-ui/format`                              | 4             | 1             | 0                          |
| `basalt-ui/controls`                            | 2             | 2             | 2                          |
| `basalt-ui/state`                               | 1             | 0             | 2                          |
| `basalt-ui/vite` (vite.config)                  | 1             | 1             | 1                          |
| `basalt-ui/styles.css` (main.tsx)               | 1             | 1             | 1                          |
| `basalt-ui/configs/*` (tsconfig/oxlint extends) | yes           | yes           | root `.oxlintrc.json` only |
| src files importing basalt / Mantine            | 22 / 12 of 31 | 13 / 28 of 87 | 6 / 9 of 18                |

### 1b. Symbols actually referenced [obs]

- Root (19): BasaltProvider, BasaltShell, BasaltRouterContext, createBasaltRouter, createBasaltTheme, defineNav, navGroup,
  PageBar, PageSummary, BarList, Meter, MeterSegment, StatGroup, StatStripCell, StatusVerdict, EmptyState, SettingsMenuItem,
  WidgetHeader, createPersistedState (image-gateway only, from root in 1.41; not in the 2.29 root barrel, which moved it to `basalt-ui/state`).
- Charts (10 incl. types): Bars, BarsBar, BarsLine, Lines, Sparkline, StackedArea, ChartCard, ChartFact, ChartSeries, ChartTooltipRow.
- Tokens: VX, CONTAINER_KEYS, alpha, defineSeries, groupTokens. Format: money, percent, date. Table: BasaltDataTable, createColumnHelper.
- Controls: FilterSet, SelectFilter, ToggleFilter, ViewTabs, FormRow, FormGroup. State: field, createSearchStore, createLocalStore, createPersistedState.
- Vite: basaltViteConfig (3 apps), basaltAppPlugin (finances only, `finances/ui/vite.config.ts:12`).

### 1c. Unused surface (2.29.0 exports, referenced by none of the three) [obs]

"Unused" = the name has zero hits in the consumer `src` (conservative: a name in a comment would count as used, so zero hits is definitive).

| Surface                      | Exported   | Referenced | Unused names                                                                                                                                                                                                                                                             |
| ---------------------------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `./forms` (whole subpath)    | 4          | 0          | useBasaltForm, inputProps, fieldKey, InputProps. image dropped `@mantine/form` in `e0d2310` (FormRow moved to controls)                                                                                                                                                  |
| `./commands` (whole subpath) | 10         | 0          | defineCommands, defineNotifications, emit, overlays, defineOverlays, ShortcutsHelp, NotificationBell, setColorScheme, toggleSidebar. image calls `@mantine/notifications` directly, 23 calls in 8 files                                                                  |
| `./agent` (whole subpath)    | 28         | 0          | all                                                                                                                                                                                                                                                                      |
| `./content` (whole subpath)  | 17         | 0          | Prose, Markdown, TableOfContents, Callout, ArticleLayout, GuideLink, mergeSanitizeSchema                                                                                                                                                                                 |
| `./controls-dates`           | 1          | 0          | DateRangePicker                                                                                                                                                                                                                                                          |
| `./charts`                   | 14 values  | 5          | CartesianChart (direct), Donut, Heatmap, BandStrip, DualPanel, MirroredBars, foldBands, chartCursor, chartCurve                                                                                                                                                          |
| `./format`                   | 16         | 3          | bytes, compact, delta, integer, dateTime, time, duration, durationClock, relativeTime, weekday, kcal, km, defineFormat                                                                                                                                                   |
| `./tokens`                   | 7 values   | 5          | BP, p, CONTAINER_CLASSES, CONTAINER_GRID_BREAKPOINTS, buildPaletteCss, seriesTokens                                                                                                                                                                                      |
| `./controls`                 | 11 values  | 6          | SyncButton, RangeFilter, MultiSelectFilter, NumberFilter, SearchFilter                                                                                                                                                                                                   |
| `./state`                    | 5 values   | 4          | externalField                                                                                                                                                                                                                                                            |
| `./table`                    | 2 values   | 2          | (type DataTableRowAction)                                                                                                                                                                                                                                                |
| root                         | 64 exports | 19         | value exports: Board, EventList, StatCard, DeltaBadge, Section, SettingsSection, SettingsRow, DangerZone, PageAside, PageTitle, StatusDot, ThemeToggle, useSizeClass, useBasaltNav, flattenNav, navTarget, useCoarsePointer, scrollParentOf, basaltRouterOptions, unwrap |

[judg] The owner's factory-console stat card has **no consumer**. The KPI surfaces here are `ChartCard` facts
(`finances/ui/src/components/query-card.tsx:1-46`), the `StatGroup` strip (`finances/ui/src/routes/index.tsx:252`) and `Meter`.
StatCard/DeltaBadge ship in 2.29 and nothing adopts them.

[judg] Four Mantine packages are declared but never imported in finances (`finances/ui/package.json:10-13`:
hooks, modals, notifications, spotlight). `finances/docs/research/2026-10-29-basalt-ui-consumer.md:17` lists them as peers of basalt,
so they are load-bearing installs, not dead code. Either way they are a 4-package tax for a consumer that uses none of them directly.

## 2. What the apps built around or against basalt-ui

### 2a. Guard-escape counts [obs]

| Signal                                                                    | finances                                                                           | image-gateway                                                                                      | email-gateway                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `theme-allow` waivers                                                     | 0                                                                                  | 6                                                                                                  | 1                                                                                                           |
| `eslint-disable` lines (react hooks / array-index keys, not basalt rules) | 0                                                                                  | 11                                                                                                 | 0                                                                                                           |
| `oxlint-disable`                                                          | 1 (`finances/ui/vite.config.ts:1`, default-export rule)                            | 0                                                                                                  | 0                                                                                                           |
| `style=` props                                                            | 1                                                                                  | 44 (43 object literals)                                                                            | 10                                                                                                          |
| `!important`                                                              | 0                                                                                  | 0                                                                                                  | 0                                                                                                           |
| hex / rgb / hsl literals in src                                           | 11, all in `src/lib/series.ts:20-38` (exempt via `finances/ui/package.json:39-44`) | 2 waived (`src/views/Refine.tsx:38`, `src/components/create/MaskCanvas.tsx:42`) + runtime readouts | 0                                                                                                           |
| local table component                                                     | 0 (BasaltDataTable at 5 sites)                                                     | 0 (no tables)                                                                                      | `src/components/DataTable.tsx` (4 uses) + 5 hand-built `Table.*` sites (accounts.tsx has 13 `<Table.` tags) |
| local app frame instead of BasaltShell                                    | no                                                                                 | **yes** (`src/App.tsx:52-181`)                                                                     | no                                                                                                          |

### 2b. Per consumer [obs unless tagged]

**finances/ui**

| Where                                   | What                                                                                               | Note                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/series.ts:20-57`               | 5 series groups as hex pairs via `defineSeries`; accounts beyond 5 fall back to neutral (`:56-57`) | the sanctioned escape; hard cap of 8 hues per group (DESIGN.md "App deviations") |
| `src/lib/format.ts:1-48`                | `eur`, `eurCompact`, `signedEur`, `toneProp` wrap `money()`                                        | app currency and digit policy                                                    |
| `src/components/query-card.tsx:1-46`    | maps react-query state to `ChartCard` state, retry, `retrying`; 13 call sites in 7 routes          | basalt's ChartCard takes a `state` object, not a query                           |
| `src/routes/__root.tsx:22-31`           | custom `isActive` prefix predicate (`/month/*`) passed to `BasaltShell`                            | [judg] nav active matching cannot express path families                          |
| `src/routes/index.tsx` and 11 others    | Mantine `Stack`, `Group`, `SimpleGrid`, `Text`, `Box` beside basalt cards (12 files)               | [judg] layout stays Mantine                                                      |
| `src/components/sentence-list.tsx:18`   | `style={{ listStyle: 'none' }}` on a Stack                                                         | only inline style                                                                |
| `src/components/no-data-state.tsx:1-11` | one-line wrapper that fixes EmptyState copy                                                        | [judg] wrapper value is copy only                                                |
| `src/routes/transactions.tsx:22`        | `ROW_LIMIT = 500` and server-side `limit`                                                          | [judg] stands in for virtualization                                              |
| `DESIGN.md` "App deviations"            | "Charts have no click target ... a month is opened from the link strip"                            | [judg] chart interaction gap                                                     |

**image-gateway/app** (Tauri macOS window, basalt 1.41.0)

| Where                                              | What                                                                                                                                                                                                                         | Note                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/App.tsx:52-181`                               | hand-built frame: header Group, `SegmentedControl` view switch (`:114-122`), `Activity`-kept views (`:142-175`), `height: '100vh'` (`:94`)                                                                                   | no BasaltShell; the switch is waived as control-outside-home (`:113`) |
| `src/App.tsx:99`, `src/components/QueueBar.tsx:93` | `style={{ borderBottom: '1px solid var(--vx-surface-border)' }}`                                                                                                                                                             | border drawn inline                                                   |
| `src/components/library/LibrarySidebar.tsx:28-66`  | Mantine `NavLink` sidebar, not a basalt region                                                                                                                                                                               | no shell                                                              |
| `src/components/library/FacetChips.tsx:18-27`      | `Badge` with `onClick` and `cursor: pointer` as filter toggles                                                                                                                                                               | [judg] a hand-rolled filter; zero `basalt/*` findings                 |
| `src/main.tsx:1-2,6-7,25-33`                       | imports `@mantine/core/styles.layer.css` and notifications CSS by hand; mounts `ModalsProvider` and `Notifications`; `createBasaltTheme()`                                                                                   | 1.x wiring. email dropped the same CSS import in `3b79827`            |
| `src/lib/settings.ts:48-70`                        | `createPersistedState` as a cache, file under the app data dir as store of record                                                                                                                                            | comment `:48-62` explains WebKit partitioning                         |
| `src/components/SettingsIcon.tsx:9-23`             | own icon box via `var(--vx-space-icon-size)`                                                                                                                                                                                 | basalt's Icons rule landed in 1.26 (commit `38b3cfc` body)            |
| `src/components/create/draft.ts:1-20`              | Create draft persisted to file; reference images explicitly not persisted                                                                                                                                                    | the app solved draft persistence itself                               |
| `src/views/Refine.tsx:206,232`                     | inline `flex: '1 1 420px', minWidth: 320`                                                                                                                                                                                    | responsive widths by hand                                             |
| `src/views/Library.tsx` ~355-375                   | `SimpleGrid` over every filtered entry, no virtualization                                                                                                                                                                    |                                                                       |
| `src/views/Create.tsx`                             | 1015 lines (largest file in the three)                                                                                                                                                                                       |                                                                       |
| `src/components/QueueBar.tsx:81`                   | `setInterval` 1 s for an elapsed clock                                                                                                                                                                                       |                                                                       |
| `src/lib/gateway.ts:26`, `src/lib/queue.ts:26`     | SSE stream of partial image frames, app-owned                                                                                                                                                                                | realtime lives outside basalt                                         |
| `src/styles/app.css:16-21`                         | checkerboard via raw `px` background sizes                                                                                                                                                                                   | no colour, not flagged                                                |
| waivers                                            | `Refine.tsx:38` raw-hex matte; `MaskCanvas.tsx:42` raw rgba (canvas cannot read CSS vars); `ReferencesRail.tsx:184` card-inset; `RolesEditor.tsx:31`, `Refine.tsx:207`, `App.tsx:113` control-outside-home                   | [judg] 3 of 6 are the shell/nav gap; 2 are legit canvas constraints   |
| `DESIGN.md`                                        | template placeholders left: row `_e.g. requests_`, "App deviations: _(none yet)_", and a `paletteGroups` snippet shaped `{ 'app-': SERIES_MAP }` that differs from finances' array form (`finances/ui/src/lib/series.ts:46`) | [judg] consumer never filled the file; the two apps show two shapes   |

**email-gateway/client** (basalt 2.29 declared, 1.36 installed)

| Where                                      | What                                                                                                                                                                             | Note                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/DataTable.tsx:11-27`       | local table on Mantine `Table`, `Table.ScrollContainer minWidth={640}` (`:14`); used in `inbox.tsx:116`, `templates.index.tsx:29`, `submissions.tsx:41`, `templates.$id.tsx:142` | no BasaltDataTable; mobile = horizontal scroll (commit `d2541d0`) |
| `src/routes/accounts.tsx`                  | 13 hand-built `<Table.*` tags, grid keyed on `CONTAINER_KEYS`                                                                                                                    |                                                                   |
| `src/routes/inbox.tsx:32-44`               | `createLocalStore({ key: 'email-gateway:inbox' })`, persisted to localStorage, drives a shell-less PageBar (commit `ebad37c`)                                                    |                                                                   |
| `src/routes/templates.$id.tsx:24-27,72-76` | `previewStore` with `persist: false`; `WidgetHeader` + `ViewTabs` bound to it                                                                                                    | the cleanest local-control pattern in the three                   |
| `src/routes/templates.$id.tsx:130`         | `border: '1px solid var(--mantine-color-default-border)'`                                                                                                                        | Mantine var bypasses `--vx-*`; no guard fired                     |
| `src/routes/templates.$id.tsx:55`          | `theme-allow query-fn-unwrap` on a raw fetch                                                                                                                                     |                                                                   |
| `src/components/AppLayout.tsx:6-30,50-53`  | `defineNav` with `mobile: 'tab'` items; `BasaltShell nav={NAV}`                                                                                                                  | the mobile transform used as intended                             |
| `src/main.tsx` (after `3b79827`)           | `<React.StrictMode>` removed; `QueryClient` now created by `createBasaltRouter`                                                                                                  | [judg] dev-only check silently dropped (commit diff)              |
| `client/vite.config.ts:14-19`              | `enforcementNotice: false` and no `basalt-ui init`                                                                                                                               | [judg] no shipped rules or skills reach agents here               |

## 3. How each is wired [obs]

| Concern               | finances/ui                                                                                                           | image-gateway/app                                                                      | email-gateway/client                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shell / nav           | BasaltShell + `defineNav` (`src/lib/nav.tsx:11-58`), custom `isActive` (`__root.tsx:22-31`)                           | none; SegmentedControl top bar in a 100vh window (`App.tsx:114-122`)                   | BasaltShell + `defineNav` with mobile tabs (`AppLayout.tsx:6-30`)                                                        |
| Router                | TanStack file routes, `autoCodeSplitting` (`vite.config.ts:10`), `createBasaltRouter` (`main.tsx:12-23`)              | none (view state in `App.tsx:53`)                                                      | TanStack file routes, `basepath /app` (`main.tsx`), `createBasaltRouter`                                                 |
| Global controls       | `RangeBar` in PageBar: From/To `SelectFilter` bound to URL (`src/components/range-bar.tsx:12-27`)                     | none                                                                                   | none global                                                                                                              |
| Local controls        | table facets and global filter bound to URL (`routes/transactions.tsx:123-167`)                                       | Library facet Badges (`FacetChips.tsx`)                                                | inbox filters in localStorage (`inbox.tsx:32-44`); preview width `ViewTabs` (`templates.$id.tsx:76`)                     |
| URL state             | `finStore` createSearchStore, 8 validated fields, labels (`src/lib/stores.ts:21-37`); `validateSearch` on every route | none                                                                                   | none                                                                                                                     |
| Server state          | TanStack Query, `staleTime: Infinity` for vault data (`src/api/queries.ts:19-20`); retry policy in `main.tsx:14-22`   | app-owned gateway/queue (`src/lib/gateway.ts`, `src/lib/queue.ts`)                     | session query `staleTime: 30 s` (`routes/__root.tsx:14-17`); Eden treaty (`src/lib/eden.ts`); invalidate after mutations |
| Client / localStorage | none for data (`stores.ts:4`: URL only, by design)                                                                    | `createPersistedState` cache for settings (`settings.ts:64`)                           | `createLocalStore` for inbox and preview                                                                                 |
| Disk / file           | none                                                                                                                  | settings file and drafts file (`settings.ts:48-62`, `draft.ts:1-20`)                   | none                                                                                                                     |
| Auth                  | token from URL fragment into sessionStorage, fragment stripped (`src/api/auth.ts:1-20`)                               | not applicable (local bearer in settings file)                                         | HttpOnly session cookie, same-origin (`src/lib/session.ts:1-12`)                                                         |
| Forms and drafts      | none                                                                                                                  | FormRow/FormGroup + Mantine inputs; drafts persisted to file, references not persisted | LoginView PasswordInput; test-send mutation (`templates.$id.tsx:201-206`)                                                |
| Tables                | BasaltDataTable, 5 sites, `meta.priority` on one column (`transactions.tsx:65`), `manualFiltering` with URL sync      | none                                                                                   | local DataTable, 4 sites; hand tables, 5 sites                                                                           |
| Charts                | Lines, Bars, StackedArea, Sparkline, BarList, Meter in 7 routes                                                       | none (no charts)                                                                       | none                                                                                                                     |
| Cards                 | ChartCard via QueryCard (13 sites)                                                                                    | Mantine Card (GenerationCard, PlanCard)                                                | Mantine Card + WidgetHeader (1 site)                                                                                     |
| Notifications         | none                                                                                                                  | 23 `notifications.show` calls in 8 files (Mantine)                                     | none                                                                                                                     |
| Modals                | none                                                                                                                  | Mantine Modal and ModalsProvider (`main.tsx:28`)                                       | none                                                                                                                     |
| Realtime              | none (no polling, no SSE)                                                                                             | SSE stream of partial frames (`lib/gateway.ts:26`), 1 s UI clock                       | none (invalidation only)                                                                                                 |
| Virtual lists         | none; 500-row cap (`transactions.tsx:22`)                                                                             | none (full SimpleGrid)                                                                 | none                                                                                                                     |
| SSR                   | none (SPA)                                                                                                            | none (Tauri SPA)                                                                       | none (SPA served under `/app`)                                                                                           |

## 4. Git and docs mining [obs]

| Ref                                          | Repo     | What the commit or doc says                                                                                                                                          |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `55d2337` (1.32.0)                           | image    | CONTAINER_CLASSES "mirrored locally because 1.32.0 does not export it"; FormRow text-lane waivers until check-theme learned FormRow is a home (retired in `63736ed`) |
| `7888212` (1.20.0)                           | image    | removed guard workarounds; `doctor` added to CI because it hard-fails on a zero-file `basalt.roots`                                                                  |
| `039dad0` (1.30.0)                           | image    | shell-less PageBar "does not fit": tabs render in row 2, two bars in a 100 vh window; tabs accept only ViewTabs; switcher is top-level nav                           |
| `365de57` (1.30.2)                           | image    | repairs a 1.30.1 regression that dropped `VX.minPlotHeight`, leaving a legend with no plot (app unaffected)                                                          |
| `92824c4`, `ae48616`                         | image    | optional peers (motion, three fontsource faces) absent on a frozen install; body: the error "names neither the package nor the fix"; CI never builds `app/`          |
| `38b3cfc` (1.29.2)                           | image    | C1 subpath drops; `basalt-ui sync` retired 9 rules (13 files to 6); check-theme and sync ran only in CI, so four minors of promotions landed unseen                  |
| `e0d2310` (1.36)                             | image    | `@mantine/form` dropped once FormRow moved to `basalt-ui/controls`                                                                                                   |
| `3b79827` (2.x)                              | email    | `createBasaltRouter` migration; `client/src/lib/query.ts` deleted; StrictMode removed; node_modules not reinstalled (installed 1.36.0)                               |
| `43437fe`                                    | email    | check-theme alone left the AST rules unenforced; clearing 16 findings also replaced a hand AppShell (old navbar "simply vanished" below sm)                          |
| `873c934` (1.33)                             | email    | promoted rules flagged 13 items; "nothing in this repo ran basalt's check-theme"                                                                                     |
| `ebad37c` (1.32)                             | email    | inbox filters moved into a shell-less PageBar bound to a local store; template width into a WidgetHeader ViewTabs                                                    |
| `00ca5b4`                                    | email    | declared motion (optional peer) so the client builds from a clean checkout                                                                                           |
| `d2541d0`                                    | email    | "scrolling tables on mobile" fixed by hand (DataTable minWidth)                                                                                                      |
| `e874f53`, `1f7807f`                         | finances | built directly on 2.29 (2026-10-29); no workaround commits; research note reads basalt rules                                                                         |
| `email-gateway/docs/waves/PLAN.md:1675-1690` | email    | Wave 20 "blocked until basalt-ui v2 is released; building on 1.36 would be thrown away"                                                                              |
| `image-gateway/docs/concept.md:183`          | image    | `file:` link pin rejected: `make app-status` certified a stale build                                                                                                 |

## 5. Verdicts (the four questions)

### 5a. Worked, carry over [obs evidence, judg call]

| Item                                                                              | Evidence                                                                           | v3 call                                      |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| Router-bound search store: validated fields, labels, nav links carry it           | `finances/ui/src/lib/stores.ts:21-37`, `src/components/evidence-link.tsx`          | keep; the best single primitive in the three |
| One `defineNav` drives sidebar, mobile tabs, breadcrumb                           | `email .../AppLayout.tsx:6-30`, `finances .../nav.tsx:11-58`                       | keep                                         |
| Router factory owns QueryClient defaults (retry policy)                           | `finances .../main.tsx:12-23`, `email .../main.tsx`                                | keep                                         |
| Series palette: `defineSeries` + `groupTokens` + one exempt file                  | `finances .../series.ts:6-46`                                                      | keep, CSS-var backed                         |
| TanStack Charts kinds + ChartCard with state/facts                                | `finances .../routes/index.tsx`, `query-card.tsx`                                  | keep (brief: TanStack Charts only)           |
| Table filter/facet/sort state in URL (`manualFiltering`, `onColumnFiltersChange`) | `finances .../routes/transactions.tsx:123-167`                                     | keep, deepen                                 |
| Local store with per-field `persist: false`                                       | `email .../templates.$id.tsx:24-27`                                                | keep                                         |
| Guards catch real drift                                                           | image 37 violations on first run (`271f4cd`); email 16 (`43437fe`), 13 (`873c934`) | keep, make stricter                          |
| Container-query grid keys                                                         | `finances .../routes/index.tsx:301`, `email .../accounts.tsx`                      | keep                                         |
| Formatters (`money`, `percent`, `date`)                                           | `finances .../lib/format.ts`                                                       | keep                                         |

### 5b. Hurt [obs, judg as tagged]

| Item                                                                                | Evidence                                                                                                                               | Judgement                                   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| No first-class frame for a single-window app or top-level switch                    | `image .../App.tsx:113`, `039dad0` body                                                                                                | v3 needs an explicit no-sidebar frame       |
| Tables: no responsive transform; apps wrote their own                               | `email .../DataTable.tsx:14`, `d2541d0`                                                                                                | confirms the brief's headline item          |
| Charts have no click or selection target                                            | `finances/ui/DESIGN.md` "App deviations"                                                                                               | v3 chart interaction API                    |
| Nav active matching is consumer code                                                | `finances .../__root.tsx:22-29`                                                                                                        | predicate should accept families            |
| Guard blind spots: Mantine var leak, Badge-as-filter, inline layout on basalt props | `email .../templates.$id.tsx:130`; `image .../FacetChips.tsx:23`; `image .../App.tsx:99`, `Refine.tsx:206`                             | strengthen the rules                        |
| Optional peers required at runtime; error names neither package nor fix             | `image 92824c4`, `ae48616`; `email 00ca5b4`                                                                                            | v3 deps must be explicit                    |
| Mantine peer tax: BasaltProvider needs 4 extra packages even if unused              | `finances/ui/package.json:10-13`                                                                                                       | shadcn removes the tax                      |
| Major-version API churn                                                             | `image` root `createPersistedState` to `basalt-ui/state` in 2.x; `3b79827` provider/router API; `55d2337` CONTAINER_CLASSES unexported | migration codemods and a doc per break      |
| Rules retired by sync; guard promotions landed unseen                               | `image 38b3cfc`, `email 873c934`                                                                                                       | install gate in CI, not only in pre         |
| Install drift: lock says 2.29, tree is 1.36                                         | `email-gateway/client/node_modules/basalt-ui/package.json`                                                                             | process fix: CI verifies installed == lock  |
| Consumers hand-build KPI, empty, table wrappers                                     | `finances .../no-data-state.tsx`, `email .../DataTable.tsx`                                                                            | v3 should ship these with the copy as props |
| Half the surface has zero adopters                                                  | section 1c                                                                                                                             | adopt-or-delete per subpath                 |

### 5c. Missing [obs: absence in three consumers]

| Missing                                           | Evidence                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Responsive table transform (mobile)               | `email .../DataTable.tsx` hard minWidth; `finances .../transactions.tsx:65` only one `meta.priority` |
| Virtualization or pagination at scale             | `finances .../transactions.tsx:22` 500 cap; `image .../Library.tsx` ~355-375 unvirtualized grid      |
| Form drafts that survive reload, with attachments | `image .../draft.ts:1-20` (references not persisted)                                                 |
| An app-facing notification API                    | `image`: 23 direct Mantine calls; basalt commands unused                                             |
| Realtime primitive                                | `image .../lib/gateway.ts:26` hand-built SSE; email invalidation only                                |
| Settings synced to a server                       | `image .../settings.ts:48-62` file-based, app-owned                                                  |
| Sub-navigation for shell-less frames              | `image .../App.tsx:113` waiver; `email .../inbox.tsx` PageBar                                        |
| SSR                                               | not exercised by any of the three (all SPA)                                                          |

### 5d. v3 owns vs leave to the app [judg]

| Area                         | v3 owns                                                                                          | Leave to the app                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Shell, nav, mobile transform | defineNav, sidebar, mobile tabs, a no-sidebar frame variant, `isActive` as a family-aware option | brand, nav content                       |
| Charts                       | TanStack kinds, ChartCard with query state adapter, interaction API                              | series values, headline facts, copy      |
| Tables                       | BasaltDataTable: URL sync, facets, responsive fold, virtual rows                                 | column definitions, row actions          |
| State                        | search store, local store, persisted store (keep names)                                          | which fields exist, file-backed settings |
| Forms and drafts             | FormRow/Group, one draft primitive that persists attachments as a plug-in                        | field sets, submit semantics             |
| Notifications                | one registry that apps can call                                                                  | message copy                             |
| Realtime                     | invalidation helper and a stream hook                                                            | transport choice (SSE, WS)               |
| Tokens and palette           | defineSeries, CSS vars, guards                                                                   | hex values                               |
| Formatting                   | money, percent, date with a currency and locale default                                          | currency, locale                         |

### 5e. Migration cost and risk onto a shadcn v3 [judg]

| Consumer             | Basalt-coupled surface to rewrite                                                                             | Mantine files to rewrite                                                 | Cost                              | Risk                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| finances/ui          | 22 files: 5 BasaltDataTable sites, 11 chart import sites, BasaltShell + nav, PageBar + SelectFilter, finStore | 12 (layout primitives)                                                   | M                                 | table API parity (facets, URL filter sync, `manualFiltering`); chart parity; SimpleGrid container queries to CSS container queries |
| image-gateway/app    | 13 files, about 18 import statements: EmptyState, FormRow/Group, VX, money, createPersistedState, theme       | 28 of 87 files, 44 `style=`, 23 notification calls, 1015-line Create.tsx | L by volume, M by basalt coupling | no shell (frame rewrite); Activity-kept views; canvas-heavy Refine; Tauri build                                                    |
| email-gateway/client | 6 files: BasaltShell, defineNav, PageBar, ViewTabs, WidgetHeader, createLocalStore                            | 9 files, 4 DataTable sites, 5 hand tables                                | S-M                               | the 2.x upgrade landed 2026-11-08 and is unverified on its installed tree; a v3 move would be its first real run                   |

Common to all three: the TanStack router and query wiring, the file-based state stores, and the chart kinds
carry over; the Mantine `style=` and waiver sites are where the rewrite is cheapest to get right.

## 6. Limits of this evidence

- Unused analysis is name-level over the 2.29 barrels. image-gateway's own surface is 1.41, so its
  "used" set comes from the import census alone.
- email-gateway: check-theme ran on 1.36.0, not the declared 2.29; oxlint not runnable.
- No browser, screenshot or visual run. No dev server started. Live app behaviour is not verified here.
- Virtualization, SSE and SSR findings are absence claims over these three repos only.
