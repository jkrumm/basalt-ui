# Audit: consumer-usage (cross-fleet survey)

Scope: argo, linewatch, rb, basalt-ui-obsidian, rollhook, weatherorb (`w37-basalt-2` worktree), plus `apps/playground`. Read-only. Everything below was read from the files named; counts are from `grep`/scripted scans of `*.ts(x)` excluding `node_modules`, `dist`, `.claude`, `routeTree.gen.ts` (tests excluded unless stated).

Caveat on lint evidence: the consumers' installed `node_modules/basalt-ui` is behind their pins (argo installs 2.7.1, linewatch 2.11.0, rb 2.8.1; all `package.json` pin 2.11.1). I therefore only use oxlint results that do not depend on a preset fix (see consumer-26).

## 0. Fleet profile

| App                     | Files importing basalt-ui | Subpaths used (import count)                                                                                                                 |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| argo (`apps/dashboard`) | 158                       | tokens 68, root 59, charts 54, format 23, controls 18, commands 18, agent 10, table 9, state 9, content 4, controls-dates 3, vite 1, forms 1 |
| linewatch (`web`)       | 31                        | tokens 20, charts 16, root 11, content 7, state 2, controls 2, vite 1                                                                        |
| rb (`apps/web`)         | 25                        | tokens 16, root 9, content 3, vite 1, state 1, controls 1                                                                                    |
| basalt-ui-obsidian      | 21                        | content 9, root 7, tokens 4, vite 1                                                                                                          |
| weatherorb (w37 branch) | ~25                       | tokens 17, root 6, charts 2, vite 1                                                                                                          |
| rollhook                | 0 TS imports              | CLI only: `basalt-ui tokens:css`, `check-theme`, `sync --check` (`profile: tokens-only`)                                                     |

Waiver inventory across the whole fleet (this is the entire list; nothing else exists): 1 in linewatch (`live-chip.tsx:99` raw-surface), 7 in rb (`raw-breakpoint` knot-detail/page.tsx:36; `in-body-page-title` knot-detail/page.tsx:2577, course/page.tsx:223, lock-screen.tsx:229; `raw-surface` course/page.tsx:82, library/page.tsx:150; `raw-hex` styles.css:12), 1 in obsidian (`raw-form-control`, obsidian-components.tsx:264), 5 `raw-selection-control` in weatherorb, plus weatherorb `basalt.exemptRules.raw-hex` and two `basalt.severity` downgrades to `warn`. argo has zero. The guards are mostly respected; the waivers cluster on four rules (see consumer-12, -13, -14) which are therefore the rules with a missing primitive behind them.

Unused-runtime-export scan (import-site count per consumer, `scripts` in /tmp, tests excluded): see consumer-21 for the table.

---

## Findings (ranked by impact)

### consumer-01 — `ChartCard` height is bookkept three times; 74 `placeholderHeight` props in argo

- severity: major | kind: api | breaking: no (additive, then deprecate)
- Evidence: `argo` has 74 `placeholderHeight=` (`{320}` 24x, `{CHART_HEIGHT}` 13x, `{280}` 11x, `{HEIGHT}` 8x ...) and 22 files each declare their own `const CHART_HEIGHT = N` (e.g. `features/body-composition/charts/weight-chart.tsx:16`, `skinfold-chart.tsx:11`, `astro-window/constants.ts:12`). 40 of the 48 `<Suspense>` boundaries are `fallback={<ChartCard state={{ pending: true }} placeholderHeight={320} />}` (`routes/garmin-health.tsx:70-110`). The number must equal the chart's own `height={...}` or the skeleton shifts. `ChartCard.tsx:111-115` documents the coupling in prose ("pass the chart's own `height` when it states one").
- Why wrong: the invalid state "placeholder height differs from chart height" is representable and the framework offloads keeping it true to every call site; the fallback is a second `ChartCard` the consumer must hand-assemble with title/info omitted (so the header also pops in).
- Proposal: `ChartCard` owns the box. `<ChartCard height={240}>` provides the height through context to the child chart kind (child `height` becomes optional and inherits) and to its own placeholder. Add `ChartCard.Skeleton` (or `suspense` prop: `<ChartCard suspense ...>` wraps `children` in Suspense with the card's own header + sized pending state) so the 40 fallbacks vanish and the header does not re-mount. Deprecate `placeholderHeight`.
- Consumers: argo (74), linewatch (0 - it composes `ChartCard` 5x without the pattern).

### consumer-02 — `ChartCard` lacks the `query` prop its siblings have; `QueryState` is private; every app re-derives the ladder

- severity: major | kind: api | breaking: no
- Evidence: `StatCard.query` (`dashboard/stat-card.tsx:278`) and `Section.query` (`section.tsx:96`) hand pending/error/empty to `QueryState`; `ChartCard` only takes `state?: ChartState` (`ChartCard.tsx:111`). Result: argo's local `lib/chart-state.ts:1-10` `chartStateOf(query, empty)` called from 26 files / 51 sites, and two files inline the same object literal instead (`weight-chart.tsx:125`, `skinfold-chart.tsx:86`). `QueryState`/`LoadingState`/`ErrorState` exist (`dashboard/query-state.tsx`) but are not exported from `src/dashboard/index.ts` or the root barrel, whereas rb hand-writes `isError -> <Alert color="red" title="Couldn't load ...">` ladders (`features/home/page.tsx:157-162`, `stats/page.tsx:150`, `ingest/enrichment-panel.tsx:81-83`, `knot-detail/page.tsx:2573`, `course/page.tsx:219`) and argo's `astro-window/components/scout-panel.tsx:130-223` has three nested `isLoading ? ... : isError ? ...` ternaries. `sky-panorama.tsx:209-227` builds a synthetic `{isPending, isError}` from `queries[]` to feed `chartStateOf`.
- Proposal: `ChartCard query={q} empty="..."` (and accept `QueryStateLike[]` for the multi-query case, folding with the one precedence). Export `QueryState` (it is the doc'd "correctness" primitive: it stops "No data" being shown on a 500) from the root barrel; add a lint/guard "`isError` ternary next to `<Alert>`" or simply document it as the only way. Delete `chartStateOf` from argo.
- Consumers: argo (26 files), rb (6 sites), weight/skinfold charts (inline).

### consumer-03 — No frame for a shell-less / standalone page; linewatch forks the gutter, argo and rb hand-compose "centered screen" three times

- severity: major | kind: wiring | breaking: no
- Evidence: linewatch (shell: false) owns `shell/root-layout.module.css` (gutter from `--vx-space-app-shell-inset{,-mobile}` with a hand-written `@media (min-width: 52.5em)`), `shell/page-bar.module.css` (`.bleed` that cancels the same gutter with negative margins), `routes/__root.tsx:36-42` (`<Container size={1600} className={classes.page}>`), and `shell/shell.contract.test.ts:1-30` (a source-regex test that the Container carries no `px`, because an inline `px` beats the class). Friction rows 82, 84 are the same story. Separately: argo `LoginPage` (`lib/auth-gate.tsx:36-52`: `Container size="xs" pt={120} pb={64}` + `Stack` + `PageTitle`), argo `CrashFallback` (`lib/error-boundary.tsx:6-47`: `Container size="sm" pt={64} pb={64}`), rb `components/lock-screen.tsx` (333 lines), plus basalt's own `provider/error-fallback.module.css`. `auth-gate.tsx:27-28` even documents that the page "lives here, not in `routes/`... only a path outside `routes/` says so" (the `in-body-page-title` guard is path-heuristic).
- Proposal: ship `BasaltPage` (a shell-less root: `<BasaltPage width={1600}>` = Container + gutter tokens + the bleed `PageBar` CSS + `--basalt-page-bar-h`), and `CenteredScreen` (`<CenteredScreen title="Argo" description="...">children</CenteredScreen>`) for login/lock/crash/404. Delete the gutter doctrine from consumer CSS and the `shell.contract.test.ts` pattern; the guard then keys on the component, not the file path (`PageTitle` allowed inside `CenteredScreen`).
- Consumers: linewatch, argo (2), rb (1).

### consumer-04 — Three error surfaces; argo wires its own into two of them

- severity: major | kind: wiring | breaking: yes (prop rename)
- Evidence: router default `ErrorComponent` (`provider/create-router.tsx:58`, wired at :121), provider boundary default (`provider/index.tsx:131-150`, prop `fallback` at :63), and argo's `CrashFallback` passed twice: `main.tsx:32` (`fallback={(error) => <CrashFallback .../>}`) and `routes/__root.tsx:30` (`errorComponent`). The argo copy reimplements the same elements (title, message, DEV stack, reload) with Mantine `Alert/Code/ScrollArea`. Row 114-style double-handling: `fallback` accepts `ReactNode | ((error) => ReactNode)`.
- Proposal: one exported `ErrorScreen` (built on `CenteredScreen`, consumer-03) used by both defaults; `BasaltProvider errorScreen?: ComponentType<{ error: unknown; reset?: () => void }>` replaces `fallback` and is also used as `defaultErrorComponent` by `createBasaltRouter` (the provider knows the router). One slot, zero consumer wiring for the 90% case; delete argo `error-boundary.tsx`.
- Consumers: argo.

### consumer-05 — Formatting: `basalt-ui/format` covers 8 functions; the fleet carries ~30 local formatters and shadows basalt's own

- severity: major | kind: api | breaking: no
- Evidence: basalt: `integer, money, percent, durationClock, relativeTime, weekday, kcal, km` (`format/index.ts:20-22`). `money` has 0 imports in the fleet. Local copies: argo 5 duration spellings - `walking-pad/formatters.ts:10` `formatDuration`, `strength-tracker/components/timer-core.ts:29` `formatClock` (`m:ss`), `hermes-chat/voice/audio-utils.ts:28` `formatElapsed` (`m:ss`, duplicated through `audio-player-card.tsx:59-65` wrappers), `agents/model.ts:109` `formatWaitDuration` (the comment explicitly says `basalt-ui/format` "only carries hours/minutes"), `reading/format.ts:2` `formatReadTime`; two local `relativeTime` that shadow basalt's (`walking-pad/formatters.ts:30`, `usage-tracking/constants.ts:98`) with different output ("5m ago" vs "5 minutes ago"); `toFixed(` 111 sites in argo; 15 raw `toLocale*String/Intl.*`; `m365-explorer/explorer-page.tsx:70-84`. linewatch `lib/format.ts` (`fmtMs, fmtMbps, fmtPct, fmtBytes, fmtRate, fmtMinutes, fmtDuration`) treats `null` as an em dash, basalt treats non-finite as `NON_FINITE`; rb `lib/format.ts:12` exists solely to pin `en-US` because basalt's formatters follow the runtime locale (the mini's Chrome is de-DE).
- Proposal: (a) a `locale` default set once on `BasaltProvider locale="en-US"` (context) instead of per-call `opts.locale` - rb's whole file disappears; (b) add `duration(seconds, { style: 'clock' | 'compact' | 'long', largest })`, `bytes`, `rate`, `delta`/signed numbers, `decimals(n, digits)` (the 111 `toFixed`); (c) every formatter accepts `null | undefined` and prints the shared dash (linewatch's rule); (d) delete or justify `money` (0 consumers). Net-negative for the fleet (>300 local lines).
- Consumers: argo, linewatch, rb.

### consumer-06 — Every app hand-wires the same shell root: theme control, global refresh, sign-out

- severity: major | kind: wiring | breaking: no
- Evidence: argo `routes/__root.tsx:45-110` builds a `THEME_OPTIONS` array + `settingsMenuItems` radio rows by hand (`:62-70`), a `SyncButton scope="global"` bound to `useIsFetching()`+`queryClient.invalidateQueries()` (`:90-99`), and a `ThemeToggle` entry with `mobile: 'hidden'` so the toggle is not shown twice; rb `components/app-shell.tsx:50-65` passes `globalActions={[{ key: 'theme', node: <ThemeToggle /> }]}` and a lock menu item; linewatch drops `ThemeToggle` into `PageBar` (`routes/index.tsx:4`); `settingsMenu="menu"` is forced in argo with a comment that the default "reads them wrong". `ThemeToggle` is imported in 4/5 apps and always as the same one-entry `GlobalAction`. Comments in both files spend ~25 lines explaining the `mobile: 'bar'|'more'|'hidden'` decision for a control every app has.
- Proposal: `BasaltShell colorScheme="toggle" | "menu" | "none"` (default `toggle`, shell owns the mobile projection and the de-duplication), `BasaltShell refresh` (a boolean/`QueryClient`-bound global refresh using the provider's QueryClient, `label` optional), `account.signOut`. `ThemeToggle` stays exported only for shell-less apps. Delete the `THEME_OPTIONS` array pattern.
- Consumers: argo, rb, linewatch, playground.

### consumer-07 — Page skeleton `<><PageBar/><Stack gap="md">` and `sync={{syncing, onSync, label}}` repeated per route

- severity: major | kind: api | breaking: no
- Evidence: argo routes `agents.tsx:36-48`, `warden.tsx:38-50`, `reading.tsx:72-82`, `garmin-health.tsx:63-76`, plus 6 more: 10 `<Stack gap="md">` directly under `<PageBar>` inside a fragment (9 route files use `<>`). Three routes build `sync={{ syncing: q.isFetching, onSync: () => void q.refetch(), label: 'Refresh' }}` by hand (`agents.tsx:41-45`, `warden.tsx:42-46`, `reading.tsx:75-79`, identical modulo query). `PageBar` props in use: `filters` 8, `sync` 5, `tabs` 4, `filtersEnd` 2, `actions` 2, `title` 2; no consumer uses anything else.
- Proposal: `<Page bar={{ sync: query, filters, tabs }} gap="md">` (fragment+Stack owned by the framework; the gap becomes a token, not a per-page literal) and `PageBar sync` accepts a `UseQueryResult | UseMutationResult` (derives `syncing`/`onSync`) next to the explicit object. Collapses 10 identical skeletons.
- Consumers: argo (10), rb (1), linewatch (1).

### consumer-08 — Two divergent container-grid idioms for the same job; `CONTAINER_KEYS as CQ` is boilerplate

- severity: major | kind: api | breaking: no
- Evidence: argo uses both `SimpleGrid type="container" cols={{ base: 1, [CQ.wide]: 2 }} spacing="md"` (24 sites; 10 of them byte-identical, e.g. `routes/garmin-health.tsx:88`) and `Grid type="container" breakpoints={CONTAINER_GRID_BREAKPOINTS}` with `Grid.Col span={{ base: 12, lg: 6 }}` (31 sites, `:75-88`) - the second keeps Mantine `lg` names inside a container grid, so the "never `cols={{ base: 1, lg: 2 }}`" rule from `basalt-mantine.md:Scroll and breakpoints` is not what the code does. rb: 12+13, linewatch 2+2. Every file adds `import { CONTAINER_KEYS as CQ }` (13 argo, 6 lw, 6 rb). The distinct `cols` literals in argo: `{1, wide:2}`, `{1, regular:2, wide:3}`, `{1, regular:3}`, `{2, regular:3, wide:6}` ... (~12 variants).
- Proposal: `<ContentGrid cols={[1, 2]}>` / `cols={{ base: 1, regular: 2, wide: 3 }}` (class names as keys, no `CQ` import, `type="container"` baked in, `spacing` defaulted to the token) and `ContentGrid.Span` replacing `Grid.Col span`. Guard: `Grid`/`SimpleGrid` without `type="container"` outside shell code is an error (`raw-breakpoint` covers `visibleFrom` but not the Mantine-key spans).
- Consumers: argo, rb, linewatch.

### consumer-09 — Card/Paper inset rule: documented behaviour and guard disagree; 14 sites violate the doc silently

- severity: major | kind: guard | breaking: no
- Evidence: shipped rule `agent/rules/basalt-mantine.md` (Surfaces): "Card/Paper insets are `py="xs" px="sm"` with the theme radius; **no explicit `p`, `padding` or `radius`**". The plugin (`configs/oxlint-plugin.js:587-640`) flags `p/padding` only when the string is **not** `xs`/`sm` (or numeric), so `padding="sm"` and `p="sm"` pass. 14 such sites ship: argo `reading/unmatched-section.tsx:16`, `book-card.tsx:67`, `m365-explorer/explorer-page.tsx:441,450`, `agents/agent-card.tsx:21`, `hermes-chat/smart-card.tsx:45,87,116`, `voice/audio-player-card.tsx`, `warden/{issues,awaiting-owner,board}-section.tsx`, rb `home/knot-card.tsx:35`, `home/page.tsx:44`. Also rb has ~36 raw `<Card>` + 31 `<Title order={4|5}>` card headings (`knot-detail/page.tsx:411,648,1412`, `home/page.tsx:168,193,216`) while `Section`/`WidgetHeader` exist; no rule covers "titled panel built from Card+Title".
- Proposal: pick one law and make code = doc: either make the rule flag any explicit `p/padding/radius` (matches the doc and the message "not an explicit p/padding") or amend the doc to allow `xs|sm`. Also ship a titled-panel primitive (`Panel title=... actions=...`, thin `Card` + `WidgetHeader`) so rb's 36 `<Card><Title>` pairs have a home, and add a guard "`<Title order={3..5}>` inside `Card`".
- Consumers: argo (11), rb (3 + 36 Card/Title).

### consumer-10 — Notifications: degenerate typed registry in argo, unguarded raw `notifications.show` in rb

- severity: major | kind: guard | breaking: no
- Evidence: argo `lib/notifications.ts:21-50`: 12 of 14 kinds are literally `{ intent, toMessage }` with the **same** passthrough `toMessage = (p) => p.message` declared at :17, and the doc says "title still passed per-call". So the registry encodes only `intent`; the `toMessage` per-kind callback is pure ceremony in 12/14. rb has 15 direct `notifications.show({ color: 'green'|'red', message })` calls (`features/settings/page.tsx:30-71`, ...) and imports `@mantine/notifications` in 5 files; obsidian demo imports `@mantine/*` directly in 2 files. `oxlint.json` restricts only `antd` and `framer-motion`; `basalt-batteries.md:23` says "register every kind ... before calling `emit`" but nothing forbids `@mantine/notifications`' `notifications.show` or `@mantine/modals`' `modals.open`, though the provider owns both.
- Proposal: `defineNotifications({ 'reading:error': 'error', ... })` (shorthand = intent, message passthrough; object form only when a kind needs `toMessage`/title); `emit(kind, message, { title })`. Add `@mantine/notifications` and `@mantine/modals` to `no-restricted-imports` in the preset (messages pointing at `emit` / `overlays`). Fleet impact: rb's 15 calls become typed `emit`.
- Consumers: argo, rb, obsidian.

### consumer-11 — 401/unauthorised handling and API errors are hand-rolled twice; `unwrap` is argo-only

- severity: major | kind: api | breaking: no
- Evidence: argo `lib/router.ts:6-37` layers `QueryCache.onError` + `MutationCache.onError` + a navigate-to-`/login` handler over `createBasaltRouter({ query })`, and `lib/auth.ts:33-37` `isUnauthorizedError` (`(error as {status}).status === 401`); rb `lib/api.ts:8-31` implements its own subscribe/notify `onUnauthorized` with a `ME_PATH` carve-out, consumed by `lib/lock-gate.tsx`. `unwrap` imports: argo 20, linewatch 0, rb 0, obsidian 0, weatherorb 2. argo also duplicates a 404 sentinel: `lib/queries/warden.ts:11` and `hermes.ts:6` `isNotFoundError(e) => e instanceof EdenFetchError && e.status === 404`. Note `unwrap` (`query-client.ts:70`) throws a bare `Error`; the status is only recoverable from Eden's own error class.
- Proposal: `createBasaltRouter({ onError: { 401: (error) => ... } })` (or `auth: { isUnauthorized, onUnauthorized }`) so both layers share one seam; `unwrap` throws a typed `ApiError { status, body }` (exported with `isApiError(e, 404)`), killing both `isNotFoundError` copies and the `(error as {status})` cast. Do NOT absorb a fetch client (rb `api.ts` is app-specific).
- Consumers: argo, rb.

### consumer-12 — A `StatusDot`/pip primitive is missing: 3 waivers + 2 local implementations

- severity: minor | kind: guard | breaking: no
- Evidence: waivers `linewatch/components/live-chip.tsx:99` ("no radius token is 50%"), `rb/features/course/page.tsx:82`, `rb/features/library/page.tsx:150` (`borderRadius: '50%'`, 5x5 and 8x8 `Box`); local implementations `argo/walking-pad/live-card.tsx:259` `PulseDot`, `argo/hermes-chat/smart-card.tsx:34` `StatusDot`, `argo/strength-tracker/workouts-table.tsx:33` `exerciseDot`, `linewatch/components/status-bar.tsx`, 4 more `Badge`/dot in `transition-timeline.tsx`.
- Proposal: `StatusDot tone="good|warn|bad|neutral|accent" size="xs|sm" pulse` and a `Pips value max` for rating rows; add `VX.radiusRound` (50%) so a literal circle needs no waiver. Removes three `theme-allow raw-surface` waivers.
- Consumers: argo, rb, linewatch.

### consumer-13 — `raw-selection-control` has no sanctioned home for panel-local controls (5 waivers in weatherorb, one false-positive history)

- severity: major | kind: guard | breaking: no
- Evidence: weatherorb `map/point/forecast-tab.tsx:163` (SegmentedControl for the meteogram range), `map/chrome/display-controls.tsx:258`, `map/chrome/stack-editor.tsx:301,325,340` (NativeSelect x2, palette select) - each waiver says "panel-local view state in the point panel ... docked or inside a Drawer". Friction row 79 was the same rule's false positive on `SettingsRow control={<Select/>}`. `FilterSet`/`ViewTabs` are the only control homes, and both are page-bar bound.
- Proposal: a `PanelControls`/`PanelSelect`/`PanelSegmented` set in `basalt-ui/controls` (size/density from the panel, no page-bar coupling) as the 4th control home - the guard then offers it in its remedy text. Alternative if rejected: make the rule only fire on page-level bodies, not inside `*-panel.tsx`/Drawer, and say so in `basalt-controls.md`.
- Consumers: weatherorb (5), rb (row 79).

### consumer-14 — `in-body-page-title` is waived for every detail route; the "breadcrumb names the page" law has no detail-page answer

- severity: minor | kind: guard | breaking: no
- Evidence: rb waives it three times with the same reason ("detail route; the breadcrumb names the parent list") at `knot-detail/page.tsx:2577`, `course/page.tsx:223`, `components/lock-screen.tsx:229`; argo moves `LoginPage` out of `routes/` to satisfy the heuristic (`auth-gate.tsx:27`). Detail routes (`/knots/$slug`) have a dynamic title that the nav-item label cannot provide.
- Proposal: `PageBar title` (or `usePageTitle(title)`) is honoured for dynamic titles - set the breadcrumb leaf from loader data - and `PageTitle` stays for shell-less screens only (consumer-03). Then the three rb waivers delete and the guard needs no path heuristic.
- Consumers: rb (3), argo (1).

### consumer-15 — Range/window presets: argo owns the date math and a cast-avoidance helper

- severity: major | kind: api | breaking: no
- Evidence: `lib/window-stores.ts:30-45` defines `monthsBack`, `yearsBack`, `yearToDate` (date-fns) just to feed `field.range({ window: { '3m': monthsBack(3), '1y': yearsBack(1) } })` in 4 stores (garmin, strength 4 presets, body-comp, walking); `toApiWindow` (`:55-60`, 6 call sites in `routes/{garmin-health,strength-tracker,body-composition,walking-pad}.tsx`) exists "to map the unreachable branch ... instead of writing a cast". `garmin-health.tsx:41-46` and `:64-67` compute the identical `toApiWindow(store.field.window.toWindow({ preset, from, to }), '30d')` once in the loader and again in the component.
- Proposal: `field.range` understands a preset grammar (`'7d' | '30d' | '3m' | '1y' | 'ytd' | 'all'`, optional `native: [...]` for what the API accepts) so no resolver map is needed; add `field.range.params(values)` returning the API shape directly, typed without the `'custom'` branch (make the codec's "dateless custom" truly unrepresentable in the return type). Collapses `window-stores.ts` helpers and the duplicated loader/component computation (also expose `store.params(search)`).
- Consumers: argo (4 routes).

### consumer-16 — Palette group ceremony: `defineSeries -> groupTokens -> array -> paletteOptions` + `declare module`, plus raw-CSS `derived` strings

- severity: major | kind: api | breaking: yes (2.x minor with MIGRATING)
- Evidence: argo `lib/series.ts` has 6 groups, each `defineSeries(...)` (:28,100,111,129,137,159), `groupTokens('name', MAP)` (:169-174), a hand-listed `argoPaletteGroups = [...]` (:180), `ARGO_DERIVED` as an array of **raw CSS declaration strings** (`'--vx-optimalZone: color-mix(...)'`, :197-202), a `declare module 'basalt-ui' { interface BasaltRegister { series: typeof SERIES_MAP } }` (:204-208), then `paletteOptions={{ groups: argoPaletteGroups, derived: ARGO_DERIVED }}` in `main.tsx:34`. The group name string is stated twice (`'confidence'` const + `groupTokens`, rb `series.ts:23-35`). rb's own `main.tsx:15-18` comment: "Without it those refs resolve to nothing and swatches render transparent" (a silent failure). weatherorb needs `basalt.exemptRules.raw-hex` for `theme/series.ts` and `providers.tsx` hits `TS2740` on the group shape (basalt-2-migration.md:307). `seriesTokens`, `buildPaletteCss` have 0 imports.
- Proposal: `defineSeriesGroup('confidence', { forgotten: p(BP.red), ... })` returns the tokens **and** registers the group (like `defineNav`/`defineCommands`), the provider reads the registry; `paletteOptions.groups` and the `BasaltRegister.series` augmentation disappear. `derived` becomes a typed `defineDerivedVars({ optimalZone: ... })` or is deleted (one consumer). Guard exempts `defineSeries(` call arguments from `raw-hex` structurally (kills the weatherorb exemption and the rb "pick `p(BP.x)` to avoid a hex" workaround).
- Consumers: argo, rb, weatherorb.

### consumer-17 — Theme API: `theme={createBasaltTheme()}` is a no-op in 2 apps; the 4-axis config surface has 0 consumers

- severity: major | kind: api | breaking: yes
- Evidence: `argo/main.tsx:30` and `weatherorb/app/providers.tsx` pass `theme={createBasaltTheme()}`; `provider/index.tsx:55` says it "Defaults to `createBasaltTheme()`" and `:501-507` re-merges it (`useLabTheme(theme)`). No file in the fleet passes `derive`, `fonts`, `radius` or `density` (`grep derive:|density:|radius:N|fonts:` over all six apps: none); rb, linewatch and obsidian do not call `createBasaltTheme` at all. `BasaltProviderProps` also extends `Omit<MantineProviderProps, ...>` (:98) and spreads `...rest` into `MantineProvider`, so a raw Mantine `theme` object is accepted. `theme/index.ts` is 1,681 lines.
- Proposal: `BasaltProvider theme?: BasaltThemeOptions` (`{ derive, fonts, radius, density, overrides }`, the object `createBasaltTheme` takes today) and the provider builds the theme - no public `createBasaltTheme` for the app path, no raw-theme escape hatch. If the owner's own apps never turn a knob in 6 repos, record the four knobs under the adopt-or-delete clock in MIGRATING.
- Consumers: argo, weatherorb (no-op), all (none use the knobs).

### consumer-18 — linewatch: `useInViewport` gating reimplemented on six charts; the framework half-owns the follower policy

- severity: major | kind: api | breaking: no
- Evidence: `charts/use-in-viewport.ts` (40-line docblock) and its six users, each `tooltip: { onFollow: inView }`: `availability-strip.tsx:264`, `link-speed-strip.tsx:308`, `throughput-chart.tsx:194`, `latency-band-chart.tsx:340`, `speed-chart.tsx:104`, `bufferbloat-chart.tsx:87`. `follower-tooltip.test.ts:25-34` states the gap: "What the framework still does not own is the viewport gate". `compile.ts:914`/`types.ts:199` type `onFollow?: boolean`.
- Proposal: `tooltip.onFollow: boolean | 'in-view'` (default `'in-view'` when true: the chart host already has a ref/ResizeObserver); delete `use-in-viewport.ts`, the `viewRef` plumbing in six charts and the test.
- Consumers: linewatch.

### consumer-19 — No chart test harness; consumers assert on source text

- severity: major | kind: test | breaking: no
- Evidence: linewatch has 6 tests that `readFileSync` their own `.tsx` and regex it (`charts/follower-tooltip.test.ts`, `overlay-color.test.ts`, `tooltip-header.test.ts`, `shell/shell.contract.test.ts`, `components/dashboard-section.render.test.tsx`, `lib/compact.contract.test.ts`). The stated reason is verbatim: "A render test cannot see this - the tooltip mounts only under a live cursor, and `renderToStaticMarkup` never produces one" and "legend swatch vs mark colour" drift (`overlay-color.test.ts:12-30`) caused by the app drawing legend and mark colour from two literals.
- Proposal: `basalt-ui/charts/testing`: `renderChart(<Lines .../>, { cursor: { x }, size: { w, h }, follower: true })` returning the DOM with tooltip/legend/axis mounted under jsdom/happy-dom; and make kinds derive legend swatch colour from the same `series` entry as the mark (already stated as doctrine in `basalt-charts.md`; add a guard when `legend` is hand-composed).
- Consumers: linewatch.

### consumer-20 — linewatch re-forks `Section` views, `StatGroup` and a guided chart wrapper

- severity: minor | kind: api | breaking: no
- Evidence: `components/dashboard-section.tsx` (203 lines: lazy `render` thunks over `ViewTabs`, compact mode that "drops `Section` itself", `useOpenOnHash`); `components/stat-strip.tsx` (139 lines: `value: string | null` for "query in flight", `tone: 'warn'|'bad'`, `hint` tooltip, `group` wrap-together); `components/guided-chart.tsx` (ChartCard + `GuideLink`). `StatCard.value` is `string` (required, `dashboard/stat-card.tsx:249`) with `tone` at :306; `StatGroup` has no pending value. The file's own comment: "a ~190-line fork went with them" and the residue is what is still missing.
- Proposal: `Section views={[{ key, label, render }]}` (lazy active-only body, persisted via the existing `persistKey`) + `Section density="compact"` (header-less); `StatCard value: string | null` (null = pending dash, untinted) and `StatGroup` `hint`/`group`. Adopt `useOpenOnHash` into `Section` (anchors are already basalt's, `Section id`).
- Consumers: linewatch.

### consumer-21 — Adopt-or-delete table (runtime exports and props with zero or one consumer)

- severity: major | kind: dead-code | breaking: yes
- Evidence (import counts across argo / linewatch / rb / obsidian / rollhook / weatherorb; playground excluded from "used"):
  - zero consumers: `flattenNav` (root), `chartCursor`, `foldBands` (charts; note row 80 fixed its absence from dist and linewatch still does not import it), `buildPaletteCss`, `seriesTokens` (tokens), `money` (format), `FormGroup` (controls), `mergeSanitizeSchema` (content).
  - one consumer: `PageAside` (argo 1), `DangerZone` (rb 1), `SettingsRow` (rb 1), `SettingsSection` (argo 1 + rb 1), `scrollParentOf` (rb), `useCoarsePointer` (rb), `useBasaltNav` (obsidian), `navTarget` (argo), `externalField`/`SyncButton`/`BP`/`p`/`CONTAINER_CLASSES` (argo), `forms` subpath whole (argo `lib/auth-gate.tsx:4`), `table` subpath (argo 9), `agent` (argo 10), `controls-dates` (argo 3), `Donut` (argo 1).
  - props: `ChartCard.delta`, `deltaPolarity`, `deltaPeriod` effectively unused (scan of 119 `<ChartCard>` blocks: `value` 6, `deltaPeriod` 1, `delta` 0, `deltaPolarity` 0, `count` 2) - argo's `weight-chart.tsx:106-125` hand-builds the value+delta header inside `actions` instead. `BasaltShell.account`/`brand.menu` (`shell/index.tsx:163,206`): playground only; `BasaltShell.search`: obsidian only; `settingsMenu`: argo only.
  - `src/dashboard/index.ts` (9 symbols incl. `DangerZone`, `EmptyState`) is a barrel behind the root; not a published subpath, fine, but `QueryState` is not in it (consumer-02).
- Proposal: per doctrine - delete the zero-consumer exports now, mark the one-consumer ones on-notice in MIGRATING with the named consumer, fold `ChartCard value/delta*` into `DeltaBadge` composition (delete the props) or make argo's three hero headers adopt them, and either migrate argo's four hand-rolled entry forms (18 `useState` in `weight-panel.tsx`, `skinfold-entry-form.tsx`, `workout-form.tsx`, `edit-workout-modal.tsx`) onto `basalt-ui/forms` or delete the subpath + `@mantine/form` peer + `basalt/forms-field-key`.
- Consumers: all.

### consumer-22 — Vite preset: apps still hand-list optimizer sets, read their own `package.json`, and compose three different ways

- severity: minor | kind: wiring | breaking: no
- Evidence: argo `vite.config.ts` hand-lists `resolve.dedupe: ['@mantine/dates','@mantine/spotlight','@tanstack/react-hotkeys']` and `optimizeDeps.include` of the same plus `@mantine/schedule` (the preset's `include` at `vite.ts:136-147` omits spotlight and hotkeys though `BasaltProvider` mounts both); argo and linewatch each `JSON.parse(readFileSync('package.json'))` for `version`; composition styles: argo `defineConfig(mergeConfig(basalt, {...}))`, linewatch same, rb `defineConfig({ ...basalt, plugins })` (spread, overwrites any preset `plugins`; plus `optimizeDeps: { ...basalt.optimizeDeps, exclude: ['basalt-ui'] }` for a shiki-prebundle reason documented at `vite.config.ts:55-60`), obsidian bare `mergeConfig(...)` without `defineConfig`. argo also hand-adds the HyperDX `/v1/traces` proxies.
- Proposal: `defineBasaltConfig({ port, name, ..., vite: {...}, pwa: {...}, proxy: {...} })` returning the finished config (plugins, aliases, optimizer sets incl. spotlight/hotkeys, `version` read from the app's package.json by default, `optimizeDeps.exclude` for the content highlighter). One composition style, no `mergeConfig` in apps.
- Consumers: all four Vite apps.

### consumer-23 — Nav icons: every app passes `<Icon size={18} stroke={1.5} />` per item

- severity: minor | kind: api | breaking: yes
- Evidence: `argo/lib/nav.tsx:72-102` (`icon: <IconX size={ICON} />` x~15 plus group icons), `rb/lib/nav.tsx:17-60` (`const ICON = 18`, `stroke={1.5}` x8), `obsidian/apps/demo/src/lib/nav.tsx:35-61` - each defines its own `ICON` constant; `stroke={1.5}` appears 10 times in the fleet. The icon-size is a shell concern (and differs between sidebar rail, mobile bar, sheet).
- Proposal: `icon: IconHome2` (component reference); the shell renders it at the size/stroke of the region (`nav-glyph.tsx` already exists). Keep `ReactNode` only for custom glyph.
- Consumers: argo, rb, obsidian.

### consumer-24 — Two divergent root/provider mount shapes; embedded and `spotlight` opt-out are escape hatches

- severity: minor | kind: wiring | breaking: no
- Evidence: argo mounts `BasaltProvider router theme telemetry fallback paletteOptions defaultColorScheme` (6 props, `main.tsx:28-36`) plus two side-effect imports (`./lib/commands`, `./lib/notifications`, :18-21) "so the registry is populated from boot"; rb 3 props; linewatch 1 prop; obsidian `spotlight={false}` + `telemetry` (`main.tsx:63-70`, the telemetry function is a console sink); weatherorb `spotlight={false}` + `children` (embedded). `defaultColorScheme="dark"` is stated here and must be mirrored in `basaltAppPlugin colorScheme: 'dark'` in vite config (argo `vite.config.ts`, comment in `apps/dashboard/AGENTS.md:110`: "keep the two in step").
- Proposal: one source for the scheme - read `colorScheme` from the vite plugin's virtual define so `BasaltProvider` needs no `defaultColorScheme`; make registries import-order independent (defineCommands/defineNotifications/overlays registered lazily on first read from the module, or a `registries={[...]}` prop) to delete the side-effect imports and the comment. (PR #285 covers spotlight bundling only.)
- Consumers: argo, rb, weatherorb.

### consumer-25 — Rollhook (tokens-only) re-maps 20+ Tailwind theme names by hand; recharts remains

- severity: minor | kind: dx | breaking: no
- Evidence: `rollhook/apps/dashboard/src/styles/global.css:14-45` `@theme inline` maps `--color-background ... --color-ring`, `--radius-*` onto `--vx-*` by hand (and adds status colours, tag colours, a `color-mix` for pull); `basalt-tokens.css` is a committed 168-line emit; `packages/ui/src/components/DeployChart.tsx:1-40` uses recharts with `tick={{ fontSize: 10, fontFamily: 'monospace', fill: 'currentColor', opacity: 0.5 }}`. 0 TS imports of basalt-ui.
- Proposal: `basalt-ui tokens:css --tailwind` emitting the `@theme inline` bridge (shadcn-style names) so tokens-only consumers need no hand map; decide explicitly whether `tokens-only` includes charts (document "recharts is out of scope" in MIGRATING) rather than leaving the profile half-defined.
- Consumers: rollhook (and any future Tailwind app).

### consumer-26 — Preset lint noise: `react/only-export-components` as `warn` fires 36 times in two apps

- severity: minor | kind: guard | breaking: no
- Evidence: running the apps' own oxlint 1.87 over `linewatch/web/src` gives 25x `react(only-export-components)` (chart files that co-export constants, e.g. `charts/link-speed-strip.tsx:213,396`, `latency-band-chart.tsx:89,654`), over `rb/apps/web/src` 11x (e.g. `knot-detail/page.tsx:2793`, `content-blocks.tsx:579`); the preset sets it to `warn` (`configs/oxlint.json:32`) and turns it `off` only for `**/routes/**`. A permanently-warning rule trains agents and humans to ignore warnings.
- Proposal: `off` (HMR concern only, and the preset already concedes it for routes) or fix the matching files and make it `error`. Add `--max-warnings 0` to the `lint` script `basalt-ui sync` seeds so warn-level rules cannot accumulate.
- Consumers: linewatch, rb.

### consumer-27 — Agent layer: doctrine restated in consumer AGENTS.md; install drift is not detected

- severity: minor | kind: agent-layer | breaking: no
- Evidence: shipped `basalt-tokens.md:53-58` owns the `theme-allow` grammar; linewatch `AGENTS.md:110-116` and rb `AGENTS.md:118-129` re-explain it (one doctrine, two homes, drift risk); consumer AGENTS.md are 188 (rb), 245 (argo), 398 (linewatch) lines with 27-29 "basalt" mentions each. Managed rules (`.claude/rules/basalt-*.md`) are byte-identical to the shipped ones in all 5 apps (good) and rollhook ships none (tokens-only, consistent). Installed-vs-pinned drift: `argo/node_modules/basalt-ui` = 2.7.1, `linewatch/web/node_modules` = 2.11.0, `rb/node_modules` = 2.8.1 while all pin 2.11.1 - `doctor`/`sync --check` passed against rules synced at 2.11.1 without noticing the tool in use was older (friction row 63 class: oxlint floor).
- Proposal: `doctor` checks `node_modules/basalt-ui/package.json` against the declared version and fails on mismatch; the AGENTS block template (`agent/templates/AGENTS-block.md.tpl`) says "waivers: see basalt-tokens.md" and `sync` lints consumer AGENTS.md for restated `theme-allow` grammar (drift check already exists for repo docs).
- Consumers: argo, linewatch, rb.

### consumer-28 — Severity downgrades and exemptions live in `package.json` with no audit trail in `doctor`

- severity: minor | kind: guard | breaking: no
- Evidence: weatherorb `apps/web/package.json` `basalt`: `severity: { "inline-spacing": "warn", "inline-font-size": "warn" }` and `exemptRules.raw-hex`; linewatch `basalt: { roots, shell: false }`; others have none. The weatherorb downgrade is the only place in the fleet where a guard is softened, and it is two of the rules that fire most in map-style apps (inline sizes).
- Proposal: `check-theme --audit-allows` also reports `severity` downgrades and `exemptRules` entries (with the `reason`), and `doctor` prints them; `severity: warn` requires a `reason` like `exemptRules` does.
- Consumers: weatherorb.

---

## What basalt should absorb / forbid / delete (summary)

Absorb: ChartCard-owned height + suspense (01), ChartCard `query` + public `QueryState` (02), `BasaltPage`/`CenteredScreen` (03), single `ErrorScreen` (04), locale + duration/bytes/delta/null-dash formatters (05), shell-owned theme/refresh/sign-out (06), `Page` + `PageBar sync={query}` (07), `ContentGrid` (08), `StatusDot` (12), panel-local controls (13), range preset grammar + `params()` (15), `defineSeriesGroup` (16), viewport-aware `onFollow` (18), chart test harness (19), typed `ApiError` + `onUnauthorized` seam (11), `Section views`/`StatCard value: null` (20), Tailwind bridge emit (25).

Forbid: `@mantine/notifications`/`@mantine/modals` direct imports (10); explicit Card `p/padding/radius` (09, either direction); `Grid` without `type="container"` (08); `<Title>` panel headings in `Card` (09); raw `borderRadius: '50%'` via a token, not a waiver (12).

Delete: `createBasaltTheme` no-arg ceremony and raw theme escape (17), zero-consumer exports (21), `ChartCard delta*` props, `provider fallback` prop (04), `paletteOptions.groups/derived` (16), `chartStateOf` (argo), `use-in-viewport.ts` (linewatch), `lib/format.ts` (rb), and `forms` subpath unless argo adopts it.
