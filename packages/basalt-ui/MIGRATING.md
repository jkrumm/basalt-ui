# Migrating basalt-ui

`CHANGELOG.md` ships in this package and lists every release. It cannot tell you what **broke**:
semantic-release writes one line per commit, and "make the mobile bar navigate, driven by one typed
nav definition" does not say `ChartHoverSync` was deleted. This file is that half — removed and
renamed exports per minor, with the replacement.

Reconstructed from `git diff` over the published export surface across `v1.0.0..v1.19.1`, then
cross-checked against the repo's `scripts/export-surface.json` snapshot. **Every replacement below
was re-audited against the built declaration files at 1.20.0 (2026-08-22)** after round 5 caught one
row that was wrong. That pass corrected 4 table rows and 3 prose claims. Every section from 1.21.0
on was written against source, not against its commit messages — which is not a formality: one
1.23.0 commit message describes a change it did not make (see `1.23.1` § Corrections). Check
the types, not this table, if the two disagree.

**The newest section is headed `## Unreleased`, and the RELEASE renames it to its own number.**
This file is written before `semantic-release` picks the number, so a number written here is a guess
— and it was wrong four rounds running. The rename is therefore a release-time step, not an
authoring-time one: the section is authored as `## Unreleased — <title>`, and the release swaps the
word `Unreleased` for the computed version, leaving the title alone; a fresh `## Unreleased` opens
above it, with a fresh column in the index below.

**Since 1.30.1 a script does it, and that is the fix the previous revision only claimed.** This
paragraph used to end "so that is where the swap belongs" — a statement of intent that read as a
statement of fact. `prepareCmd` was never given the step and MIGRATING.md was never added to
`@semantic-release/git`'s assets, so even a correct local edit could not have reached the tarball,
and 1.30.0 duly shipped `## Unreleased — the chrome wave` to npm; three separate consumer agents
found it there. `packages/basalt-ui/scripts/release-migrating.ts` now performs the rename in
`prepareCmd` beside `gen-llms.ts` and commits through the same assets list, `--check` runs it in
`scripts/release.sh`'s preflight (a dry run SKIPS `prepare`, so nothing else in the pipeline can
catch a shape it cannot rewrite), and it FAILS rather than doing nothing when the shape surprises
it. If you are reading a heading that still says `Unreleased` in an installed tarball, that is a
bug, not an authoring slip.

**Skipping that step is what this file's worst defect was.** 1.27.0, 1.28.0 and 1.29.0 all shipped
under one `## Unreleased` heading — ~1000 lines, two of its subsections still titled "targeting
1.29.0" weeks after 1.29.0 was on npm. Four of five consumer migrations off 1.25.0/1.27.0 named it
their top finding independently: a reader cannot tell which minor introduced which change, and
"read every section between your version and the target" is unusable when the last three sections
claim not to be between them. One of them shipped a real defect through the gap. Restored to
per-minor sections below; keep it that way.

**No majors, by policy.** A rename or a removal ships as a plain `feat:` on the 1.x line, so a minor
bump can require code changes. Skipping several at once is the expensive case — read every section
between your version and the target.

> Reading the CHANGELOG: minors and majors are `#` (h1), patches are `##` (h2). Grepping for
> `## [1.` finds only the patches.

**Minors with no public API delta:** 1.1.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0, 1.8.0, 1.9.0,
1.10.0, 1.13.0, 1.14.0, 1.16.0, 1.18.0 — and every patch. Additive-only subpaths: `./tokens.css`
at 1.3.0, `./agent-chat` at 1.10.0.

## What changed, by surface

**Read your row, then the sections it names — not the whole file.** A `tokens-only` consumer read
all 2294 lines of the previous revision to learn that four minors moved two things in the token
layer; this index is that answer in one line. It is a POINTER, not a second copy: every cell names
the section that carries the detail, and a surface with no row in a minor had no delta in it. The
`Unreleased` column takes the version number at the same moment the section below it does, and a new
column opens at the same time — both performed by `scripts/release-migrating.ts` in the release
commit, so the column head and the section it points at can never disagree.

There is one row per SURFACE, not per export, and a surface earns a row once anything in it moves:
**dashboard** and **toolchain** were added at 1.30.1 because `StatGroup`/`WidgetGrid` and the
shipped lefthook preset both changed in 1.30.0 with no row that owned them — which is how a
consumer read this index, found nothing, and diffed a KPI row that had silently gone 4-up → 2-up.

| Surface | 1.27.0 | 1.28.0 | 1.29.0 | 1.30.0 | 1.30.1 | 1.30.2 | 1.31.0 | 1.32.0 | 1.32.1 | 1.33.0 | 1.34.0 | 1.34.1 | 1.35.0 | 1.36.0 | 1.36.1 | 1.37.0 | 1.37.1 | 1.38.0 | 1.38.1 | 1.39.0 | 1.40.0 | 1.40.1 | 1.40.2 | 1.40.3 | 1.41.0 | 2.0.0 | 2.0.1 | 2.0.2 | 2.0.3 | 2.0.4 | 2.0.5 | 2.1.0 | 2.2.0 | 2.3.0 | 2.4.0 | 2.5.0 | 2.6.0 | 2.6.1 | 2.7.0 | 2.7.1 | 2.7.2 | 2.7.3 | 2.8.0 | 2.8.1 | 2.9.0 | 2.9.1 | 2.10.0 | 2.11.0 | 2.11.1 | 2.12.0 | 2.13.0 | 2.13.1 | 2.13.2 | 2.13.3 | 2.14.0 | 2.15.0 | 2.16.0 | 2.17.0 | 2.18.0 | 2.19.0 | 2.20.0 | 2.21.0 | 2.22.0 | 2.23.0 | 2.24.0 | 2.25.0 | 2.26.0 | 2.27.0 | 2.27.1 | 2.27.2 | Unreleased |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- | ------ | ------ | -------------------------------------------------------------------------------------------- | ------ | ------ | ------ | ------ | ------ | ----------------------------------------------- | ------ | ------ | ------ | ------ | ------------------------------------------------------------ | ---------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **tokens** (`./tokens`) | — | `--vx-divider` → `rgba()` on both schemes (§ Shell) | `--vx-space-touch-target` added (§ Additions) | eight spacing numbers (§ Chrome) | — | — | `--vx-hit` replaces the touch vars; `SIZE_CLASSES` (§ 1.31.0) | — | `SIZE_CLASSES`/`CONTAINER_CLASSES` actually exported (§ Fixes) | `CONTAINER_GRID_BREAKPOINTS`; `raw-breakpoint` trusts it (§ 1.33.0) | `CONTAINER_KEYS` (§ 1.34.0) | — | — | — | — | — | — | — | | `appShellInset` 20 → 16 (§ 1.38.1) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | § 1.x compatibility layer removed | — | — | — | — | — | — | — | — | — | — | — | spacing, radius, type and the dense tier (§ 2.16.0) | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **charts** (`./charts`) | — | phone tier, `curve`, formatters, `state`, log axis (§ preamble) | `ChartState.empty: string`, `AxisBottomNumeric` (§ Additions) | responsive `height`, `legend.maxRows` (§ Charts) | `height` reaches the kinds; `maxRows` beats the `fill` fit (§ Charts) | — | container-class tier + `height` keys (§ 1.31.0) | — | `ResponsiveChartHeight` `sm` → key (§ Container recipes) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | `BandSpan.absentFraction` + `absentState` (§ 2.8.0) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | `Lines` linear curve, `naming`, no lone-series legend, locale tooltip header, y gutter, `RefLine.labelPosition`, `StackedArea.fillOpacity` (§ Chart chrome) | — | error fallback `The request failed.` (§ State defaults) | — | — | — | — | — | — |
| **shell** (`.`) | — | scrollport, region seams, **the brand left the sidebar** (§§ scrollport, brand, Shell) | `PageTitle`, `BasaltDevDock`, `useBreakpoint` (§ Additions) | More popover, aside pill, the responsive gutter, `useBasaltSpacing` (§ Chrome) | — | — | `theme.breakpoints` derived, `useSizeClass`, `data-basalt-host`, `useBreakpoint` on notice (§ 1.31.0) | `useBreakpoint` removal → 1.33.0; `useSizeClass` is shell-only (§ 1.32.0) | shell-less `shell/` gutter, `AppShell` breakpoints, `useSizeClass` for overlays (§§ Shell-less, `useSizeClass`) | — | `useBreakpoint` removed (§ 1.34.0) | — | — | `useCoarsePointer()` (§ `useCoarsePointer()`) | — | — | — | — | | content gutter 16, block 8 from `sm` (§ 1.38.1) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | `BasaltProvider` embedded mode, `spotlight` (§ 2.8.0) | — | — | — | — | — | — | — | — | — | — | — | — | — | expanded gutter 24 (§ 2.16.0) | — | — | light/outline Buttons ink, no status edges (§ 2.19.0) | — | — | — | — | — | — | — | — | — | — | — |
| **controls** (`./controls`) | `NumberFilter`, `field.number` (§ Controls) | sheet renders panel rows; `PanelRow`, `SliderControl` (§ `basalt-ui/controls`) | — | — | — | — | — | — | — | `NumberFilter clearable`; `createSearchStore` `resets` (§ State and controls) | — | — | — | `FormSection`/`FormRow`/`FormGroup`/`FormActions` move here (§ The form layout moves) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | dense 28 tier at a fine pointer (§ 2.16.0) | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **forms** (`./forms`) | — | `field` → `inputProps`, **`inputProps` drops `key`**, the layout tier (§ `inputProps`) | `field` DELETED — and the `--fix` recipe no longer works (§ Consolidation) | — | — | — | — | — | `FormGroup` row no longer stretches (§ Fixes) | — | — | — | — | the layout + `useForm`/`schemaResolver` deprecated, removed 1.37.0 (§ The form layout moves) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | § 1.x compatibility layer removed | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **data** (`./data/table`) | — | root is a `<div>`, row selection, `getItemKey` required (§ `basalt-ui/data`) | `./data` + `./query` + `./connectivity` dropped (§ Consolidation) | — | — | — | — | — | `renderCard` documented (§ `renderCard`) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | `BasaltDataTable` error title `Could not load rows` (§ State defaults) | — | — | — | — | — | — |
| **dashboard** (`.`) | `StatCard`: `unit`, `breakdown`, delta format (§ `StatCard`) | `StatGroup`, `WidgetGrid`, query-aware `StatCard` — additive | — | **the column law keys on the CONTAINER; `cols={4}` is 2-up at `sm`** (§ Dashboard) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | § 1.x compatibility layer removed | — | — | — | — | — | — | — | — | — | — | — | card inset 12/16, `kpi` 22 / 500 (§ 2.16.0) | — | — | StatCard status dot, Meter/BarList refinements (§ 2.19.0) | — | plain `Meter` value bar fill muted (`tone="ink"` to opt out); `BarList` default `thin`, `variant="default"` → `inline` (§ 2.21.0) | — | — | `LoadingState` section skeleton, page spinner neutral (§ State defaults) | — | — | — | — | — | — |
| **toolchain** (`./configs/*`) | — | — | the shipped lefthook preset's `check-theme` BROKE — the CLI resolver stopped ascending (§ CLI) | the preset's default bin, and the `root:` recipe (§ Toolchain) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **CLI** (`basalt-ui`) | — | — | **resolver stops relocating; `doctor` loses 6 of 10 checks** (§ CLI) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | the managed block moves `CLAUDE.md` → `AGENTS.md` (§ 1.41.0) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | `doctor`: CSS + forced dropped subpaths, `oxlint-floor`, Start wiring (§ 2.8.0) | — | § 1.x compatibility layer removed | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **guards** | five rules → `error` (§ Guards) | six new ids at `warn` (§ preamble) | `query-dual-import` retired in 1.29.1 (§ Guards) | four rules → `error` (§ Guards) | — | — | — | `raw-breakpoint`: the container-grid answer, `error` at 1.33.0 (§ 1.32.0) | `FormRow`/`FormGroup` homes in both lanes; `basalt-main` dropped (§ Fixes) | C1 + breakpoint pairs → `error`; `unknown-vx-token` `warn` (§ Guards) | — | — | — | `unknown-vx-token` → `error`; the token factories throw (§ Guards) | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | § 1.x compatibility layer removed | — | — | — | — | — | — | — | — | — | — | — | `inline-spacing` steps, `card-inset` accepts both pairs (§ 2.16.0) | — | — | — | — | `series-palette` at `warn` (§ 2.21.0) | — | `series-palette` → `error` (§ Guards) | `raw-spacing`, `inline-spacing` → `error` (§ Guards) | — | `basalt/card-inset` → `error` (§ Guards) | — | — | — | — |

---

## 2.0.0

Contract: `docs/V2-SPEC.md`. Every removal and move is one row, grouped by area. 1.x is frozen at v1.41.0; 2.0.0 is the only major.

### Upgrading from 1.x

1. Go to `1.41.0` first and clear its deprecations: 2.0 retires the lifecycle, and the compatibility layer 2.0 still carried (camelCase `--vx-*` aliases, `VX.line2Dark`, `StatCardTone`, a bare `theme-allow`) left in the next release — § 1.x compatibility layer removed.
2. Install `basalt-ui@2` and the now-required peers (§ Subpaths, peers and gates); delete only the
   `@mantine/{core,notifications,spotlight}/styles.layer.css` imports, because `basalt-ui/styles.css`
   `@import`s exactly those three. Keep every extension package's layer CSS (`@mantine/dates`,
   `@mantine/schedule`, …) imported AFTER `basalt-ui/styles.css`.
3. Replace the hand-built root (providers, `QueryClient`, router) with `BasaltProvider` +
   `createBasaltRouter` (§ Provider and wiring).
4. Rewrite imports by area, using the tables below. A `move` changes only the specifier.
5. Run `bunx basalt-ui sync`, then `bunx basalt-ui doctor`, and take the lint findings one at a time.

### AI, content, commands, state and table (`w3/delete-agent-data`)

Subpath folds: `basalt-ui/agent-chat` → `basalt-ui/agent`, `basalt-ui/notifications` → `basalt-ui/commands`, `basalt-ui/data/table` → `basalt-ui/table`. `basalt-ui/data/virtual` is removed. A `move` changes only the import specifier; the name is unchanged.

| Old import                                                | New                  | Why                                                                                                                                                       |
| --------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt-ui/commands`: `defineCommand`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `runCommand`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `CommandMap`                        | deleted              | type removed (`'idle' \| 'submitted' \| 'streaming' \| 'done' \| 'error'`); derive with `NonNullable<ComponentProps<typeof ThreadFeedRow>['liveStatus']>` |
| `basalt-ui/commands`: `CommandId`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `CommandRunContext`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `defineOverlay`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `registerModalsProvider`            | deleted              | provider-internal (§ 2)                                                                                                                                   |
| `basalt-ui/commands`: `Overlay`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `OverlayMap`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `OverlayKey`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `ConfirmOptions`                    | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `ConfirmDeleteOptions`              | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `toSpotlightActions`                | deleted              | provider-internal                                                                                                                                         |
| `basalt-ui/commands`: `toRouteActions`                    | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `toShortcutList`                    | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `toHotkeyBindings`                  | deleted              | provider-internal (§ 2); § 8 replaces the mirrored hotkey types                                                                                           |
| `basalt-ui/commands`: `RouteActionItem`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `RouteActionSection`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `ToRouteActionsOptions`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `ShortcutEntry`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `HotkeyBinding`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `ColorScheme`                       | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `ColorSchemeSetter`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `SidebarToggle`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `parseShortcut`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `detectMac`                         | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `formatShortcutDisplay`             | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `useCommandHotkeys`                 | deleted              | provider binds the `defineCommands` registry, Hotkeys 0.13 loaded lazily (§ 2, § 8)                                                                       |
| `basalt-ui/commands`: `ShortcutsHelpProps`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `BasaltOverlays`                    | deleted              | `BasaltProvider` mounts modals, spotlight, hotkeys, notifications (§ 2)                                                                                   |
| `basalt-ui/commands`: `BasaltOverlaysProps`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/commands`: `basaltSpotlight`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `openSpotlight`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/commands`: `closeSpotlight`                    | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notify`                       | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifySuccess`                | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifyError`                  | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifyWarning`                | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifyInfo`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifyPromise`                | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifyUndo`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `notifyUndoable`               | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `NotifyOptions`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotifyPromiseMessages`        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotifyUndoOptions`            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotifyUndoHandle`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `defineNotification`           | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `defineNotifications`          | `basalt-ui/commands` | ./notifications folds into ./commands                                                                                                                     |
| `basalt-ui/notifications`: `emit`                         | `basalt-ui/commands` | ./notifications folds into ./commands                                                                                                                     |
| `basalt-ui/notifications`: `resolveAction`                | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `NotificationAction`           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationKind`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationSpec`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationSpecMap`          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationIntent`           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `add`                          | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `markRead`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `markAllRead`                  | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `dismiss`                      | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `dismissAll`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `remove`                       | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `clear`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `needsAttention`               | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `useNotificationHistory`       | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `NotificationActionRef`        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationHistoryItem`      | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationHistoryState`     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `UseNotificationHistoryReturn` | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationBell`             | `basalt-ui/commands` | ./notifications folds into ./commands                                                                                                                     |
| `basalt-ui/notifications`: `NotificationBellProps`        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/notifications`: `NotificationCenter`           | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/notifications`: `NotificationCenterProps`      | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `BasaltDataTable`                 | `basalt-ui/table`    | ./data/table folds into ./table                                                                                                                           |
| `basalt-ui/data/table`: `BasaltDataTableProps`            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `BasaltDataTableSlot`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `DataTableAlign`                  | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `DataTableColumnId`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `DataTableColumnPinning`          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `DataTableFacet`                  | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `DataTableFacetOption`            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/data/table`: `createColumnHelper`              | `basalt-ui/table`    | becomes basalt-owned: `createColumnHelper<Row>()` over Table v9 (§ 8)                                                                                     |
| `basalt-ui/data/virtual`: `BasaltVirtualList`             | deleted              | no consumer; Virtual stays an internal dep of the transcript/table                                                                                        |
| `basalt-ui/data/virtual`: `BasaltVirtualListHandle`       | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/data/virtual`: `BasaltVirtualListProps`        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/data/virtual`: `BasaltVirtualListSlot`         | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `AgentPartDraft`                       | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `Drafted`                              | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `StartPart`                            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `TextPart`                             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ReasoningPart`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ToolCallState`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `SourcePart`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ErrorPart`                            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `isStartPart`                          | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `isToolCallSettled`                    | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `TERMINAL_TOOL_STATES`                 | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `mergePart`                            | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `withPartIds`                          | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `coalesceParts`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `definePartRenderers`                  | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `narrowAgentPart`                      | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `ConsumerPart`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `PartRenderContext`                    | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `AgentTransport`                       | kept                 | still exported from `basalt-ui/agent` (W9: the DX trial needed it to type a mock or custom transport)                                                     |
| `basalt-ui/agent`: `ResumableAgentTransport`              | kept                 | still exported from `basalt-ui/agent` (W9: the DX trial needed it to type a mock or custom transport)                                                     |
| `basalt-ui/agent`: `edenTransport`                        | deleted              | no consumer; `aiSdkTransport` is the one transport (§ 6)                                                                                                  |
| `basalt-ui/agent`: `isResumable`                          | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `AiSdkTransport`                       | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `AiSdkTransportOptions`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `useAgentStream`                       | deleted              | no consumer; `useAgentThreadRuns` is the one runner                                                                                                       |
| `basalt-ui/agent`: `StreamStatus`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `UseAgentStreamReturn`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `UseAgentThreadRunsArgs`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `UseAgentThreadRunsReturn`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `PartList`                             | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `PartListProps`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `AgentPartRenderers`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `TextPartRenderer`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ReasoningPartRenderer`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ToolCallPartRenderer`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `SourcePartRenderer`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ErrorPartRenderer`                    | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `BasaltStickToBottom`                  | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `BasaltStickToBottomProps`             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `createChatHistoryStore`               | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `ChatHistoryStore`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ChatHistoryStoreOptions`              | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `createThreadsStore`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `ThreadsStoreOptions`                  | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `heuristicOutcome`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `createAdapterThreadsStore`            | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `threadsStoreAdapterContract`          | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent`: `AdapterThreadsStoreOptions`           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ThreadsStoreAdapter`                  | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent`: `ThreadsStoreAdapterContractCase`      | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ThreadWorkspace`                 | deleted              | no consumer                                                                                                                                               |
| `basalt-ui/agent-chat`: `ThreadWorkspaceProps`            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ThreadFeed`                      | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `ThreadFeedProps`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ThreadFeedRow`                   | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `ThreadFeedRowProps`              | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `MessageAffordances`              | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `RowHeightProps`                  | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `VirtualizeOptions`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `VirtualizeProps`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ThreadOutcomeCard`               | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent-chat`: `ThreadOutcomeCardProps`          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ThreadDetailPanel`               | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent-chat`: `ThreadDetailPanelProps`          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `Composer`                        | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `ComposerAttachment`              | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ComposerHandle`                  | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `ComposerProps`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ComposerSubmit`                  | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `threadPartRenderers`             | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/agent-chat`: `ThreadTranscript`                | deleted              | no consumer; argo renders turns through `ThreadFeedRow`                                                                                                   |
| `basalt-ui/agent-chat`: `ThreadTranscriptProps`           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/agent-chat`: `ToolChip`                        | `basalt-ui/agent`    | ./agent-chat folds into ./agent                                                                                                                           |
| `basalt-ui/agent-chat`: `ToolChipProps`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ProseDensity`                       | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ProseProps`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `CodeBlock`                          | deleted              | rendered by `Markdown` fences; no direct consumer                                                                                                         |
| `basalt-ui/content`: `CodeBlockProps`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `CalloutProps`                       | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `TableOfContentsProps`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ReadingProgress`                    | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `ReadingProgressProps`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `headingSlug`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `readingTime`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `SlugTracker`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `ReadingTime`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `HeadingAnchor`                      | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `HeadingAnchorProps`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `FenceRenderContext`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `MarkdownContentTrust`               | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `BASALT_SANITIZE_SCHEMA`             | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `SanitizePropertyDefinition`         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `SanitizeSchema`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `MermaidDiagram`                     | deleted              | rendered by `Markdown` fences; no direct consumer                                                                                                         |
| `basalt-ui/content`: `MermaidDiagramProps`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `blockSplit`                         | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `createMdxComponents`                | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `mdxComponents`                      | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `CreateMdxComponentsOptions`         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ArticleLayoutProps`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ArticleNavTarget`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ArticleCard`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `ArticleGrid`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `ArticleCardProps`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ArticleGridProps`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `filterArticles`                     | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `formatArticleDate`                  | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `sortArticles`                       | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `Article`                            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ArticleFilterQuery`                 | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `ArticleOrder`                       | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `toArticleActions`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `ToArticleActionsOptions`            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `FilterSet`                          | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `MultiSelectFilter`                  | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `ViewTabs`                           | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `FilterSetProps`                     | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `MultiSelectFilterProps`             | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `ViewTabsOption`                     | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `ViewTabsProps`                      | deleted              | duplicate of `./controls`; one import path per symbol                                                                                                     |
| `basalt-ui/content`: `GuideDrawer`                        | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/content`: `GuideDrawerProps`                   | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/content`: `GuideLinkProps`                     | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `PersistedStateOptions`                | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `readPersistedValue`                   | deleted              | no consumer outside the playground                                                                                                                        |
| `basalt-ui/state`: `LocalStore`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `FieldLane`                            | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `ResolvedLane`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `ResolveLane`                          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `RangeValue`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `RangeParams`                          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `RangePresets`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `RangeWindows`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `FieldFallback`                        | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `FieldSetOptions`                      | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `MultiField`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `RangeField`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `NumberField`                          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `BooleanField`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `StringField`                          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `AnyField`                             | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `FieldValue`                           | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `FieldOption`                          | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `SearchValues`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |
| `basalt-ui/state`: `StoredValues`                         | deleted              | type removed; derive with `ComponentProps`/`Parameters`                                                                                                   |

### Lint (`w9/lint`)

Every `basalt/*` rule is `error` in 2.0.0 (the major is the channel). Edit your `.oxlintrc.json`
accordingly; an unknown `basalt/<id>` is a hard oxlint config error.

| Rule                                   | Change                                                                                                                                                                                                                           | Consumer action                                                                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt/provider-above-router`         | removed                                                                                                                                                                                                                          | delete it from `.oxlintrc.json`; `BasaltProvider` mounts `RouterProvider`, so the inverted tree cannot be written                                                                                                                |
| `basalt/page-bar-budget`               | removed                                                                                                                                                                                                                          | delete it; `PageBar.actions` and `Section.actions` are tuple types, so a sixth/second-primary/fourth action is a tsc error. A second `PageBar` in one tree and two filled buttons in one slot are no longer linted               |
| `basalt/agent-resume-guard`            | removed                                                                                                                                                                                                                          | delete it; `resumeStream` exists only on `useChat`/`Chat`, both banned by `agent-no-raw-usechat`                                                                                                                                 |
| `basalt/deprecated-export`             | removed                                                                                                                                                                                                                          | delete it; 2.0.0 ships no deprecations, every removal is a row in this file. Returns with the first 2.x deprecation                                                                                                              |
| `basalt/shadow-basalt-export`          | `warn` → `error`                                                                                                                                                                                                                 | rename the fork to compose the basalt export, or `theme-allow shadow-basalt-export — <why>`                                                                                                                                      |
| `basalt/agent-no-raw-usechat`          | widened to the `Chat` class                                                                                                                                                                                                      | import `Chat` from neither `@ai-sdk/react` nor `ai/react`; use `useAgentStream` / `useAgentThreadRuns`                                                                                                                           |
| `basalt/no-dev-helper`                 | new, repo-local only (not in the preset)                                                                                                                                                                                         | none                                                                                                                                                                                                                             |
| `basalt/no-import-meta-env`            | repo-local only, now enabled                                                                                                                                                                                                     | none                                                                                                                                                                                                                             |
| `configs/oxlint.json` (generic preset) | the six `react/*` compiler rules (`globals`, `immutability`, `incompatible-library`, `preserve-manual-memoization`, `refs`, `set-state-in-effect`), `no-constant-binary-expression` and `typescript/no-explicit-any` are `error` | fix the findings; to turn one down for a path add `{ "overrides": [{ "files": ["src/legacy/**"], "rules": { "react/refs": "off" } }] }` to your own `.oxlintrc.json`, or write `// oxlint-disable-next-line react/refs -- <why>` |

### Table v9 (`w6/table-v9`)

`BasaltDataTable` runs on `@tanstack/react-table` **9.2.8, exact** (peer and dev pin; 9.3.x waits on the `table-parity` / `table-v9.test` gate).

- Move your own `@tanstack/react-table` to `9.2.8` exact. Raw v8 helpers and `ColumnDef` no longer type-check against `columns`.
- `createColumnHelper` stays `import { createColumnHelper } from 'basalt-ui/table'` with the same one-generic call, `createColumnHelper<Row>()`. Do not import the helper from `@tanstack/react-table`: its v9 form needs `<TFeatures, TData>`.
- The table's registry is closed: sort functions `alphanumeric`, `text`, `datetime`, `basic`; filter function `includesString` (global search and facets). A column naming another built-in `sortFn` / `filterFn` falls back to the default with a dev-only warning.
- The `@tanstack/react-virtual` peer floor moves to `>=3.14.0 <4`.
- `initialColumnPinning` is logical: `{ left, right }` → `{ start, end }`.
- `meta.align` / `numeral` / `priority` are typed by the table's own `columnMeta` slot; the global `declare module '@tanstack/react-table'` augmentation is gone, so it no longer leaks into your own TanStack types.
- The global search now filters 250 ms after the last keystroke; `onGlobalFilterChange` fires at the same moment.

### Transitions (`w7/transitions`)

Contract: `docs/V2-SPEC.md` § 5. React 19.3 is required (`ViewTransition`, `Activity`).

- Route changes animate through the router: `createBasaltRouter` sets `defaultViewTransition` with a direction from your `defineNav` order, only where `:active-view-transition-type()` is supported (Chrome 125 / Safari 18.2 / Firefox 147); elsewhere navigation does not animate. A `<ViewTransition>` around `<Outlet>` never fired (the router commits through `useSyncExternalStore`) and is now an error, `basalt/route-view-transition`: delete it. `<ViewTransition>` stays for in-page changes (`docs/waves/evidence/w10/transitions.md`).
- `PageAside` folds inside `startTransition` with a `<ViewTransition>` on the region, and the folded body is hidden under `<Activity>` instead of unmounted. Scroll, input values and `useState` survive a fold. A hidden `Activity` runs the body's effect cleanups and re-runs the effects on expand, so a subscribing or streaming child resumes from its own state; whatever an effect set up (timer, socket) is torn down while folded.
- `ThemeToggle` animates with a CSS transition, not `motion`. `motion` is no longer reached from the package root; it is required only by `basalt-ui/agent`.
- `styles.css` sets `animation: none` on `::view-transition-group(*)`, `-old(*)` and `-new(*)` under `prefers-reduced-motion: reduce`, and the base theme sets Mantine `respectReducedMotion: true`. A consumer theme that sets `respectReducedMotion: false` opts Mantine's own transitions back out.

### Content streaming (`w8/content-streaming`)

`Markdown` no longer drops a blocked or unfinished image silently: when the `src` is refused (an off-origin image under `contentTrust="untrusted"`, or remend's `streamdown:incomplete-image` placeholder mid-stream) it renders the `alt` text as a plain `<span>` instead of an empty `<span aria-label>`. No `<img>` and no URL reaches the DOM either way. No action needed; a test that asserted the empty span must assert the alt text.

### Agent runtime (`w8/agent-runtime`)

Behavior changes to symbols that stay; no import changes. Contract: V2-SPEC § 6, § 7.

| Symbol                                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ThreadRunState.status`                          | `'submitted' \| 'streaming' \| 'error'`. A fresh turn is `'submitted'` until its first text, reasoning or tool part, so `status === 'streaming'` no longer holds from the send. `NonNullable<ComponentProps<typeof ThreadFeedRow>['liveStatus']>` gains `'submitted'`, and the chat rows treat `'submitted'` and `'streaming'` as live, so `liveStatus={runs.get(id)?.status}` stays correct. For your own liveness check use `run?.status === 'submitted' \|\| run?.status === 'streaming'`. |
| `ThreadRunState.error` (new), `AgentError` (new) | A failed turn KEEPS its `runs` entry (`status: 'error'`, the parts so far, `error`) until the next `start()`/`retry()` replaces it or `stop()`/`stopAll()` dismisses it. `runs.has(id)` no longer means live: test `run.status`. `onError` still receives the raw thrown value, and now also fires for an abort that `stop()`/supersede/unmount did not issue.                                                                                                                                |
| `aiSdkTransport` failures                        | A non-2xx response, an `error` chunk and a malformed chunk now reject the stream. They used to end it as if the turn had completed. The run's `error` carries `kind: 'http'` / `'server'` / `'stream'`.                                                                                                                                                                                                                                                                                       |
| `aiSdkTransport({ transport })` (new form)       | Any AI SDK `ChatTransport<UIMessage>` is used as-is, e.g. a `WebSocketChatTransport`. `{ api, headers?, credentials?, fetch? }` is unchanged.                                                                                                                                                                                                                                                                                                                                                 |
| `useAgentThreadRuns({ throttle, telemetry })`    | `throttle` (ms, default `100`; pass `0` to commit every part) batches part commits like `useChat`. A completed or failed turn emits one `chat.turn` event (a `stop()`ped turn emits none) to `telemetry`, which defaults to the enclosing `BasaltProvider`'s sink.                                                                                                                                                                                                                            |
| Optional props of `basalt-ui/agent`              | Every optional prop and field in the public types is `?: T \| undefined`, so a maybe-undefined value (`summary={maybe}`, `Partial<AgentThread>` with `resumeToken: undefined`) compiles under `exactOptionalPropertyTypes`. `undefined` means absent. Drop any omit-destructure or `''` workaround. Exceptions: the `?: never` discriminant markers and optional function parameters, which the option does not govern.                                                                       |

### Root, shell, controls, dashboard, format, forms, tokens, theme (W3 delete-core)

Source of the rows: `docs/waves/v2-surface.md`. A deleted export has no replacement unless the
row names one; a deleted type is derived with `ComponentProps<typeof X>` / `Parameters<typeof f>[0]`.

Behaviour and type changes (`docs/V2-SPEC.md` §§ 3–4):

| Was                                                               | Now                                                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<PageBar actions={{ primary, secondary: [...] }} />`             | `actions` is a tuple: the first entry carries `primary: true`, then up to four more (`PageBarActions`); a missing or second primary and a sixth entry are tsc errors |
| `<Section actions={...} />` taking a `ReactNode` or `BarAction[]` | `actions` is a tuple of at most three `BarAction`s (`SectionActions`); wrap a custom node as `{ key, kind: 'custom', node }`                                         |
| a filter or tab given `value`, `onChange` or `size`               | still an error, now named: the slots are typed `never` on every filter and `ViewTabs`                                                                                |
| `createBasaltTheme(_, { radius: number, density: number })`       | `radius` is `-5 … 5`, `density` is `-3 … 3` (literal unions)                                                                                                         |
| `createBasaltTheme(_, { inputs: 'desktop' })`                     | deleted — four dimensions: `derive`, `fonts`, `radius`, `density`                                                                                                    |
| `paletteOptions.groups` as a string-keyed record                  | `SeriesGroup[]`: pass what `groupTokens` returned, so the `name-` key is written once                                                                                |
| `Section` dev warning for a fourth action                         | gone — the tuple type rejects it                                                                                                                                     |

Removed or moved exports (old import → new):

| Was                                                   | Now                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `BasaltProps` — `basalt-ui`                           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SlotClassNames` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SlotStylesProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `Tone` — `basalt-ui`                                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ToneWithNeutral` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `Tier` — `basalt-ui`                                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `cx` — `basalt-ui`                                    | deleted — no consumer outside the playground                                                       |
| `SCROLLPORT_ATTRIBUTE` — `basalt-ui`                  | deleted — no consumer outside the playground                                                       |
| `baseTheme` — `basalt-ui`                             | deleted — provider-internal                                                                        |
| `cssVariablesResolver` — `basalt-ui`                  | deleted — provider-internal; a second resolver is the misuse it invites                            |
| `BasaltFontsConfig` — `basalt-ui`                     | deleted — duplicate of ./tokens; one import path per symbol                                        |
| `CreateBasaltThemeOptions` — `basalt-ui`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `CTL_THEME` — `basalt-ui`                             | deleted — no consumer outside the playground                                                       |
| `CtlSlot` — `basalt-ui`                               | deleted — no consumer outside the playground                                                       |
| `CtlSlotProps` — `basalt-ui`                          | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `useBasaltSpacing` — `basalt-ui`                      | deleted — no consumer outside the playground                                                       |
| `ThemeToggleProps` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ActionGroup` — `basalt-ui`                           | deleted — duplicate of ./controls; one import path per symbol                                      |
| `BarAction` — `basalt-ui`                             | import from `basalt-ui/controls` instead — duplicate of ./controls; one import path per symbol     |
| `ActionGroupProps` — `basalt-ui`                      | deleted — duplicate of ./controls; one import path per symbol                                      |
| `GlobalAction` — `basalt-ui`                          | import from `basalt-ui/controls` instead — duplicate of ./controls; one import path per symbol     |
| `MOTION_DURATION` — `basalt-ui`                       | deleted — no consumer outside the playground                                                       |
| `MOTION_SPRING` — `basalt-ui`                         | deleted — no consumer outside the playground                                                       |
| `MOTION_EASE_STANDARD` — `basalt-ui`                  | deleted — no consumer outside the playground                                                       |
| `NavCountBadge` — `basalt-ui`                         | deleted — no consumer outside the playground                                                       |
| `NavCountBadgeProps` — `basalt-ui`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `AppSidebar` — `basalt-ui`                            | deleted — BasaltShell is the one mount (§ 3)                                                       |
| `SidebarSearch` — `basalt-ui`                         | deleted — BasaltShell search prop                                                                  |
| `SidebarSearchProps` — `basalt-ui`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarSearchConfig` — `basalt-ui`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarSearchActions` — `basalt-ui`                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarAccount` — `basalt-ui`                        | deleted — BasaltShell account prop                                                                 |
| `MobileNav` — `basalt-ui`                             | deleted — BasaltShell is the one mount (§ 3)                                                       |
| `MobileNavProps` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `projectMobileNav` — `basalt-ui`                      | deleted — shell-internal                                                                           |
| `ProjectMobileNavOptions` — `basalt-ui`               | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MOBILE_MAX_TABS_DEFAULT` — `basalt-ui`               | deleted — no consumer outside the playground                                                       |
| `MOBILE_MENU_MAX_DEFAULT` — `basalt-ui`               | deleted — no consumer outside the playground                                                       |
| `MOBILE_MORE_KEY` — `basalt-ui`                       | deleted — no consumer outside the playground                                                       |
| `AppBreadcrumbs` — `basalt-ui`                        | deleted — BasaltShell is the one mount (§ 3)                                                       |
| `AppBreadcrumbsProps` — `basalt-ui`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PageBarProps` — `basalt-ui`                          | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PageBarSlot` — `basalt-ui`                           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PageAsideProps` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PageAsideSlot` — `basalt-ui`                         | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SizeClass` — `basalt-ui`                             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PageTitleProps` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PageTitleSlot` — `basalt-ui`                         | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarSection` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarItem` — `basalt-ui`                           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarBlockItem` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarBlockTone` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarListBlock` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarProgressBlock` — `basalt-ui`                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SidebarCustomBlock` — `basalt-ui`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `NavAnchor` — `basalt-ui`                             | deleted — duplicate of ./router-tanstack; one import path per symbol                               |
| `NavAnchorProps` — `basalt-ui`                        | deleted — duplicate of ./router-tanstack; one import path per symbol                               |
| `NavMobilePlacement` — `basalt-ui`                    | deleted — duplicate of ./router-tanstack; one import path per symbol                               |
| `NavSectionMobile` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MobileNavConfig` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MobileNavGroup` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MobileNavModel` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MobileNavSlot` — `basalt-ui`                         | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MobileNavSurface` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltShellProps` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BrandConfig` — `basalt-ui`                           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `AppSidebarProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `AccountBadgeTone` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltIdentity` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltRole` — `basalt-ui`                            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltPlan` — `basalt-ui`                            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `AccountMenuItem` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltAccountState` — `basalt-ui`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltAccountActions` — `basalt-ui`                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltAccountProps` — `basalt-ui`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `Slot` — `basalt-ui`                                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `Series` — `basalt-ui`                                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SeriesKey` — `basalt-ui`                             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `AsyncState` — `basalt-ui`                            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `assertNever` — `basalt-ui`                           | deleted — no consumer; x satisfies never needs no import                                           |
| `StandardSchemaV1` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `createPersistedState` — `basalt-ui`                  | import from `basalt-ui/state` instead — duplicate of ./state; one import path per symbol           |
| `PersistedStateOptions` — `basalt-ui`                 | deleted — duplicate of ./state; one import path per symbol                                         |
| `readPersistedValue` — `basalt-ui`                    | deleted — duplicate of ./state; one import path per symbol                                         |
| `createLocalStore` — `basalt-ui`                      | import from `basalt-ui/state` instead — duplicate of ./state; one import path per symbol           |
| `LocalStore` — `basalt-ui`                            | deleted — duplicate of ./state; one import path per symbol                                         |
| `AnyField` — `basalt-ui`                              | deleted — duplicate of ./state; one import path per symbol                                         |
| `BooleanField` — `basalt-ui`                          | deleted — duplicate of ./state; one import path per symbol                                         |
| `EnumField` — `basalt-ui`                             | deleted — duplicate of ./state; one import path per symbol                                         |
| `FieldFallback` — `basalt-ui`                         | deleted — duplicate of ./state; one import path per symbol                                         |
| `FieldHandle` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `FieldLane` — `basalt-ui`                             | deleted — duplicate of ./state; one import path per symbol                                         |
| `FieldOption` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `FieldSetOptions` — `basalt-ui`                       | deleted — duplicate of ./state; one import path per symbol                                         |
| `FieldValue` — `basalt-ui`                            | deleted — duplicate of ./state; one import path per symbol                                         |
| `MultiField` — `basalt-ui`                            | deleted — duplicate of ./state; one import path per symbol                                         |
| `NumberField` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `RangeField` — `basalt-ui`                            | deleted — duplicate of ./state; one import path per symbol                                         |
| `RangeParams` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `RangePresets` — `basalt-ui`                          | deleted — duplicate of ./state; one import path per symbol                                         |
| `RangeValue` — `basalt-ui`                            | deleted — duplicate of ./state; one import path per symbol                                         |
| `RangeWindow` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `RangeWindows` — `basalt-ui`                          | deleted — duplicate of ./state; one import path per symbol                                         |
| `ResolvedLane` — `basalt-ui`                          | deleted — duplicate of ./state; one import path per symbol                                         |
| `ResolveLane` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `SearchValues` — `basalt-ui`                          | deleted — duplicate of ./state; one import path per symbol                                         |
| `StoredValues` — `basalt-ui`                          | deleted — duplicate of ./state; one import path per symbol                                         |
| `StringField` — `basalt-ui`                           | deleted — duplicate of ./state; one import path per symbol                                         |
| `WidgetHeaderDeltaProps` — `basalt-ui`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetHeaderMetricProps` — `basalt-ui`               | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetHeaderProps` — `basalt-ui`                     | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetHeaderSlot` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetHeaderTier` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetHeaderTitleProps` — `basalt-ui`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `DeltaBadgeProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `DeltaPolarity` — `basalt-ui`                         | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SectionProps` — `basalt-ui`                          | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SectionSlot` — `basalt-ui`                           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `StatCardProps` — `basalt-ui`                         | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `StatCardSlot` — `basalt-ui`                          | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetGrid` — `basalt-ui`                            | deleted — no consumer outside the playground                                                       |
| `WidgetGridCols` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetGridItemProps` — `basalt-ui`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WidgetGridProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `StatGroupCols` — `basalt-ui`                         | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `StatGroupProps` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `EmptyStateProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `EmptyStateSlot` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SettingsSectionProps` — `basalt-ui`                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SettingsSectionSlot` — `basalt-ui`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SettingsRowProps` — `basalt-ui`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SettingsRowSlot` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `DangerZoneProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `QueryState` — `basalt-ui`                            | deleted — router defaultPendingComponent/defaultErrorComponent + suspense queries replace it (§ 2) |
| `QueryStateProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `QueryStateLike` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `QueryStateSlot` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `QueryStateTier` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `QueryEmptyCopy` — `basalt-ui`                        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `LoadingState` — `basalt-ui`                          | deleted — router defaultPendingComponent (§ 2)                                                     |
| `LoadingStateProps` — `basalt-ui`                     | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ErrorState` — `basalt-ui`                            | deleted — router defaultErrorComponent (§ 2)                                                       |
| `ErrorStateProps` — `basalt-ui`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SurfaceSpec` — `basalt-ui`                           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `RuleName` — `basalt-ui`                              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SkillName` — `basalt-ui`                             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `GuardKind` — `basalt-ui`                             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ThreadWorkspace` — `basalt-ui`                       | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadFeed` — `basalt-ui`                            | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadFeedRow` — `basalt-ui`                         | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadOutcomeCard` — `basalt-ui`                     | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadDetailPanel` — `basalt-ui`                     | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `Composer` — `basalt-ui`                              | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `threadPartRenderers` — `basalt-ui`                   | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadTranscript` — `basalt-ui`                      | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ToolChip` — `basalt-ui`                              | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadWorkspaceProps` — `basalt-ui`                  | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadFeedProps` — `basalt-ui`                       | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadFeedRowProps` — `basalt-ui`                    | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadOutcomeCardProps` — `basalt-ui`                | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadDetailPanelProps` — `basalt-ui`                | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ComposerProps` — `basalt-ui`                         | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ComposerSubmit` — `basalt-ui`                        | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ComposerAttachment` — `basalt-ui`                    | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ComposerHandle` — `basalt-ui`                        | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ThreadTranscriptProps` — `basalt-ui`                 | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `MessageAffordances` — `basalt-ui`                    | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `VirtualizeOptions` — `basalt-ui`                     | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `VirtualizeProps` — `basalt-ui`                       | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `RowHeightProps` — `basalt-ui`                        | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `ToolChipProps` — `basalt-ui`                         | deleted — duplicate of ./agent-chat; one import path per symbol                                    |
| `createAdapterThreadsStore` — `basalt-ui`             | deleted — duplicate of ./agent; one import path per symbol                                         |
| `createThreadsStore` — `basalt-ui`                    | deleted — duplicate of ./agent; one import path per symbol                                         |
| `heuristicOutcome` — `basalt-ui`                      | deleted — duplicate of ./agent; one import path per symbol                                         |
| `threadsStoreAdapterContract` — `basalt-ui`           | deleted — duplicate of ./agent; one import path per symbol                                         |
| `useAgentThreadRuns` — `basalt-ui`                    | deleted — duplicate of ./agent; one import path per symbol                                         |
| `AdapterThreadsStoreOptions` — `basalt-ui`            | deleted — duplicate of ./agent; one import path per symbol                                         |
| `AgentThread` — `basalt-ui`                           | deleted — duplicate of ./agent; one import path per symbol                                         |
| `AgentOutcome` — `basalt-ui`                          | deleted — duplicate of ./agent; one import path per symbol                                         |
| `ThreadStatus` — `basalt-ui`                          | deleted — duplicate of ./agent; one import path per symbol                                         |
| `ThreadsStore` — `basalt-ui`                          | deleted — duplicate of ./agent; one import path per symbol                                         |
| `ThreadsStoreAdapter` — `basalt-ui`                   | deleted — duplicate of ./agent; one import path per symbol                                         |
| `ThreadsStoreAdapterContractCase` — `basalt-ui`       | deleted — duplicate of ./agent; one import path per symbol                                         |
| `ThreadsStoreOptions` — `basalt-ui`                   | deleted — duplicate of ./agent; one import path per symbol                                         |
| `OutcomeResolver` — `basalt-ui`                       | deleted — duplicate of ./agent; one import path per symbol                                         |
| `ChatMessage` — `basalt-ui`                           | deleted — duplicate of ./agent; one import path per symbol                                         |
| `AgentPart` — `basalt-ui`                             | deleted — duplicate of ./agent; one import path per symbol                                         |
| `AgentTransport` — `basalt-ui`                        | deleted — duplicate of ./agent; one import path per symbol                                         |
| `pxRem` — `basalt-ui/tokens`                          | deleted — no consumer outside the playground                                                       |
| `buildFontsCss` — `basalt-ui/tokens`                  | deleted — provider/CLI-internal                                                                    |
| `buildRadiusCss` — `basalt-ui/tokens`                 | deleted — provider/CLI-internal                                                                    |
| `buildDensityCss` — `basalt-ui/tokens`                | deleted — provider/CLI-internal                                                                    |
| `DEFAULT_DERIVE_CONFIG` — `basalt-ui/tokens`          | deleted — no consumer outside the playground                                                       |
| `deriveTokens` — `basalt-ui/tokens`                   | deleted — no consumer outside the playground                                                       |
| `resolveDeriveConfig` — `basalt-ui/tokens`            | deleted — no consumer outside the playground                                                       |
| `DeriveConfig` — `basalt-ui/tokens`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `DerivedPalette` — `basalt-ui/tokens`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `deriveRadius` — `basalt-ui/tokens`                   | deleted — no consumer outside the playground                                                       |
| `RadiusValues` — `basalt-ui/tokens`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `deriveSpacing` — `basalt-ui/tokens`                  | deleted — no consumer outside the playground                                                       |
| `SpaceValues` — `basalt-ui/tokens`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `resolveContainerClass` — `basalt-ui/tokens`          | deleted — no consumer outside the playground                                                       |
| `SIZE_CLASSES` — `basalt-ui/tokens`                   | deleted — no consumer outside the playground                                                       |
| `ContainerClass` — `basalt-ui/tokens`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BREAKPOINTS` — `basalt-ui/tokens`                    | deleted — no consumer outside the playground                                                       |
| `ColorSchemeSelector` — `basalt-ui/tokens`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BuildPaletteOpts` — `basalt-ui/tokens`               | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltFontsConfig` — `basalt-ui/tokens`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ThemeLabControls` — `basalt-ui/theme-lab`            | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `DeriveControls` — `basalt-ui/theme-lab`              | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `DeriveControlsProps` — `basalt-ui/theme-lab`         | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `applyOverrides` — `basalt-ui/theme-lab`              | deleted — provider applies persisted lab overrides in dev (§ 2) (no longer a subpath)              |
| `AREA_BOTTOM_VAR` — `basalt-ui/theme-lab`             | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `AREA_TOP_VAR` — `basalt-ui/theme-lab`                | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `COLOR_GROUPS` — `basalt-ui/theme-lab`                | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `loadOverrides` — `basalt-ui/theme-lab`               | deleted — provider applies persisted lab overrides in dev (§ 2) (no longer a subpath)              |
| `readVar` — `basalt-ui/theme-lab`                     | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `saveOverrides` — `basalt-ui/theme-lab`               | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `ColorGroup` — `basalt-ui/theme-lab`                  | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `ColorTunable` — `basalt-ui/theme-lab`                | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `Overrides` — `basalt-ui/theme-lab`                   | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `ThemeLabControlsProps` — `basalt-ui/theme-lab`       | deleted — dev-only; provider-internal (§ 2) (no longer a subpath)                                  |
| `BasaltViteOptions` — `basalt-ui/vite`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltAppIcon` — `basalt-ui/vite`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BasaltAppOptions` — `basalt-ui/vite`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `unmatchedExemptPatterns` — `basalt-ui/guard`         | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `guardKindRemedy` — `basalt-ui/guard`                 | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `guardWaiverHint` — `basalt-ui/guard`                 | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `checkSource` — `basalt-ui/guard`                     | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `findAllowAnnotations` — `basalt-ui/guard`            | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `neutralizeAllowAnnotation` — `basalt-ui/guard`       | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `Finding` — `basalt-ui/guard`                         | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `GuardConfig` — `basalt-ui/guard`                     | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `GuardKind` — `basalt-ui/guard`                       | deleted — duplicate of .; one import path per symbol (no longer a subpath)                         |
| `GuardSeverity` — `basalt-ui/guard`                   | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `DEFAULT_GUARD_CONFIG` — `basalt-ui/guard`            | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `GraceEntry` — `basalt-ui/guard`                      | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `GRACE_PERIOD_KINDS` — `basalt-ui/guard`              | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `UnmatchedExemptPattern` — `basalt-ui/guard`          | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `PLUGIN_RULE_IDS` — `basalt-ui/guard`                 | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `WAIVER_ID_ALIASES` — `basalt-ui/guard`               | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `GENERATED_HEADER_LINE` — `basalt-ui/guard`           | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `TOKENS_ONLY_DISABLED_KINDS` — `basalt-ui/guard`      | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `GUARD_RULES` — `basalt-ui/guard`                     | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `AllowAnnotationSite` — `basalt-ui/guard`             | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `NEUTRALIZED_ALLOW_TOKEN` — `basalt-ui/guard`         | deleted — CLI-internal; no import consumer (no longer a subpath)                                   |
| `compact` — `basalt-ui/format`                        | deleted — no consumer outside the playground                                                       |
| `deltaPct` — `basalt-ui/format`                       | deleted — no consumer outside the playground                                                       |
| `DeltaPctOptions` — `basalt-ui/format`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `fmtCompact` — `basalt-ui/format`                     | deleted — alias of compact — one name per formatter                                                |
| `FmtCompactOptions` — `basalt-ui/format`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `fmtCurrency` — `basalt-ui/format`                    | deleted — alias of money                                                                           |
| `FmtCurrencyOptions` — `basalt-ui/format`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `fmtInt` — `basalt-ui/format`                         | deleted — alias of integer                                                                         |
| `fmtPercent` — `basalt-ui/format`                     | deleted — alias of percent                                                                         |
| `FmtPercentOptions` — `basalt-ui/format`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `LocaleOption` — `basalt-ui/format`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `NON_FINITE` — `basalt-ui/format`                     | deleted — no consumer outside the playground                                                       |
| `clock` — `basalt-ui/format`                          | deleted — no consumer outside the playground                                                       |
| `ClockOptions` — `basalt-ui/format`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `duration` — `basalt-ui/format`                       | deleted — no consumer outside the playground                                                       |
| `DurationOptions` — `basalt-ui/format`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `DurationUnit` — `basalt-ui/format`                   | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `RelativeTimeOptions` — `basalt-ui/format`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `WeekdayOptions` — `basalt-ui/format`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `KcalOptions` — `basalt-ui/format`                    | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `KmOptions` — `basalt-ui/format`                      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `UseBasaltFormOptions` — `basalt-ui/forms`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `useFormSubmit` — `basalt-ui/forms`                   | deleted — no consumer outside the playground                                                       |
| `isFieldErrorEnvelope` — `basalt-ui/forms`            | deleted — no consumer outside the playground                                                       |
| `FormFieldErrors` — `basalt-ui/forms`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `UseFormSubmitOptions` — `basalt-ui/forms`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `UseFormSubmitReturn` — `basalt-ui/forms`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormStateProvider` — `basalt-ui/forms`               | deleted — no consumer outside the playground                                                       |
| `useFormState` — `basalt-ui/forms`                    | deleted — no consumer outside the playground                                                       |
| `FormState` — `basalt-ui/forms`                       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormStateProviderProps` — `basalt-ui/forms`          | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `useFieldArray` — `basalt-ui/forms`                   | deleted — no consumer outside the playground                                                       |
| `UseFieldArrayReturn` — `basalt-ui/forms`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormErrorSummary` — `basalt-ui/forms`                | deleted — no consumer outside the playground                                                       |
| `FormErrorSummaryProps` — `basalt-ui/forms`           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `useFormDraft` — `basalt-ui/forms`                    | deleted — no consumer outside the playground                                                       |
| `DEFAULT_AUTOSAVE_DEBOUNCE_MS` — `basalt-ui/forms`    | deleted — no consumer outside the playground                                                       |
| `UseFormDraftOptions` — `basalt-ui/forms`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `UseFormDraftReturn` — `basalt-ui/forms`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ActionGroup` — `basalt-ui/controls`                  | deleted — no consumer outside the playground                                                       |
| `OverflowMenu` — `basalt-ui/controls`                 | deleted — no consumer outside the playground                                                       |
| `MOBILE_GLOBAL_BAR_MAX` — `basalt-ui/controls`        | deleted — no consumer outside the playground                                                       |
| `barActionMobile` — `basalt-ui/controls`              | deleted — no consumer outside the playground                                                       |
| `globalActionMobile` — `basalt-ui/controls`           | deleted — no consumer outside the playground                                                       |
| `BarActionItem` — `basalt-ui/controls`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BarActionMenu` — `basalt-ui/controls`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `BarActionCustom` — `basalt-ui/controls`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ActionGroupProps` — `basalt-ui/controls`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `OverflowMenuProps` — `basalt-ui/controls`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `formatAge` — `basalt-ui/controls`                    | deleted — no consumer outside the playground                                                       |
| `AGE_REFRESH_MS` — `basalt-ui/controls`               | deleted — no consumer outside the playground                                                       |
| `SyncButtonProps` — `basalt-ui/controls`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ControlGroup` — `basalt-ui/controls`                 | deleted — no consumer outside the playground                                                       |
| `ControlGroupProps` — `basalt-ui/controls`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FilterSetProps` — `basalt-ui/controls`               | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `RangeCustomPickerProps` — `basalt-ui/controls`       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `RangeFilterProps` — `basalt-ui/controls`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `CompareFilter` — `basalt-ui/controls`                | deleted — no consumer outside the playground                                                       |
| `COMPARE_VALUES` — `basalt-ui/controls`               | deleted — no consumer outside the playground                                                       |
| `CompareFilterProps` — `basalt-ui/controls`           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `CompareValue` — `basalt-ui/controls`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FilterOption` — `basalt-ui/controls`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SelectFilterEnumProps` — `basalt-ui/controls`        | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SelectFilterProps` — `basalt-ui/controls`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SelectFilterStringProps` — `basalt-ui/controls`      | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `MultiSelectFilterProps` — `basalt-ui/controls`       | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `NumberFilterOption` — `basalt-ui/controls`           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `NumberFilterProps` — `basalt-ui/controls`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SearchFilterProps` — `basalt-ui/controls`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ToggleFilterProps` — `basalt-ui/controls`            | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ViewTabsOption` — `basalt-ui/controls`               | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `ViewTabsProps` — `basalt-ui/controls`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `PanelRow` — `basalt-ui/controls`                     | deleted — no consumer outside the playground                                                       |
| `PanelRowProps` — `basalt-ui/controls`                | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `SliderControl` — `basalt-ui/controls`                | deleted — no consumer outside the playground                                                       |
| `SliderControlProps` — `basalt-ui/controls`           | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormSection` — `basalt-ui/controls`                  | deleted — no consumer outside the playground                                                       |
| `FormActions` — `basalt-ui/controls`                  | deleted — no consumer outside the playground                                                       |
| `FormSectionProps` — `basalt-ui/controls`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormSectionSlot` — `basalt-ui/controls`              | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormRowProps` — `basalt-ui/controls`                 | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormRowSlot` — `basalt-ui/controls`                  | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormGroupProps` — `basalt-ui/controls`               | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `FormActionsProps` — `basalt-ui/controls`             | deleted — type only; derive it with `ComponentProps`/`Parameters`                                  |
| `RangeCustomPickerProps` — `basalt-ui/controls-dates` | deleted — duplicate of ./controls; one import path per symbol                                      |

Still exported from `basalt-ui` in this wave, because the provider, query and dev-dock lanes replace them (V2-SPEC §§ 2, 7): `BasaltProviderProps`, `BasaltErrorBoundary`(`Props`), `BasaltErrorContext`, the `Connectivity*` family, `createBasaltQueryClient`, `BasaltQueryDevtools`, `toErrorMessage`, `errorStatus`, `BasaltDevDock`(`Props`/`Tool`). `BasaltRegister` is also kept: `declare module` augmentation only merges when the entry exports it.

### CLI (`w9/cli`)

`basalt-ui sync` carries a 1.x install forward: untouched rules, skills and the `AGENTS.md` block are rewritten, a locally edited file is reported and left alone (`--force` overwrites it), and the manifest's `basaltVersion` moves. `sync --check` goes green once nothing is stale.

`basalt-ui doctor` gains three hard checks, each failure printing a `Fix:` line:

- `tsconfig-base`: `tsconfig.json` (or a config it references) must extend `basalt-ui/configs/tsconfig.react-app.json` or `tsconfig.base.json`; the 2.0 types assume `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- `retired-lint-rules`: `.oxlintrc.json` (and local `extends`) sets a `basalt/<id>` the installed plugin no longer registers; delete the entry.
- `dropped-subpaths`: a source file under `basalt.roots` imports a `basalt-ui/<subpath>` the install's `exports` lacks; reported as `file:line`.

A check that cannot run (an unloadable plugin, an unresolvable `extends`) prints `SKIPPED` and exits non-zero. `doctor` loads the ESM lint plugin with `require`: the bin runs under Bun, and under Node that needs ≥ 20.19 / 22.12. `init` seeds `src/main.tsx` (when absent, with both TanStack peers: `defineNav` rejects every call until its `Register` augmentation exists) and inserts `extends` into the tsconfig that covers `src`. Removed: the pre-1.41 `CLAUDE.md` → `AGENTS.md` block migration; `doctor` still warns about a leftover `CLAUDE.md`, delete its block by hand.

- `init` always seeds `src/main.tsx`, `src/routes/__root.tsx` and `src/lib/nav.tsx`: `@tanstack/react-router` and `@tanstack/react-query` are required peers of `.`, so `--with-router` and `--with-query` are deleted (passing either exits 1).
- `init` splices the shipped preset into an existing `.oxlintrc.json` by default (a stock create-vite one); `--merge-lint` is deleted and `--no-merge-lint` opts out. A child `plugins` list unions with the preset's, so `jsx-a11y` stays on. A config with comments is left as is and the line names the `extends` to add.
- `doctor` gains the hard check `app-wiring`: the entry `index.html` loads (default `src/main.tsx`) must mount `BasaltProvider` on a `createBasaltRouter` router, and the TanStack router plugin must be in the vite config (or `src/routeTree.gen.*` exist). A stock create-vite `main.tsx` is kept by `init`, so this is the check that turns red until it matches `agent/templates/main.tpl`.
- `init` rewrites create-vite's stock `"build": "tsc -b && vite build"` to `vite build && tsc -b` (vite's router plugin generates `routeTree.gen.ts`, which `tsc` needs); any other build script that runs `tsc` is left as is with a one-line advice.
- The shipped preset sets `react/only-export-components` to `["warn", { "allowExportNames": ["Route"] }]` so TanStack route files stop warning, and `init`'s lint merge adds `"Route"` to your own setting of that rule (its level and other options are kept).

### Charts

Contract: `docs/V2-SPEC.md` § 9. `basalt-ui/charts` moved from visx to TanStack Charts. `@tanstack/charts` `1.1.0` and `d3-scale` `4.0.2` are exact, optional peers of `./charts`; visx is no dependency, peer or re-export. The public surface is `CartesianChart`, `ChartCard`, `chartCursor` and nine kinds (`Lines`, `Bars`, `StackedArea`, `Sparkline`, `BandStrip`, `Donut`, `Heatmap`, `DualPanel`, `MirroredBars`), plus their prop types. `ariaLabel` is required on every chart. The x scale follows the value `x` returns (`Date` → proportional time, which closes 1.x issue #52; `number` → linear; `string` → point or band). Engine marks for `marks` come from the allowed `@tanstack/charts/*` subpaths (`basalt/chart-engine-boundary`); basalt re-exports none.

Lint: `basalt/visx-boundary`, `basalt/visx-tooltip`, `basalt/hand-rolled-plot`, `basalt/chart-legend-literal` and the guard kinds `raw-visx-axis` and `chart-missing-aria-label` are deleted. `basalt/chart-engine-boundary` replaces the first two; the rest have no replacement (the rung and the required prop make them unreachable). A `theme-allow` naming a deleted id waives nothing (an unrecognised id is unknown); delete it. The guard has 26 kinds (was 28), and `profile: 'tokens-only'` disables 16 of them (was 18, the two deleted kinds having been Mantine-coupled). `basalt/chart-in-raw-surface` now names `Lines` and `Sparkline` (was `MultiLine`, `ZonedLine`, `LineSparkline`, `BarSparkline`). New: `basalt/chart-host-single` (repo-local) keeps `@tanstack/charts/react` inside `src/charts/host.tsx`.

| Old import                                              | New                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt-ui/charts`: `LinePath`                          | `lineY` (`@tanstack/charts/line`) in `CartesianChart`'s `marks`, or a `Lines` series                                                                                                                                                                                                                      | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `AreaClosed`                        | `areaY` (`@tanstack/charts/area`) in `marks`, or `ChartSeries.area`                                                                                                                                                                                                                                       | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `AreaStack`                         | `StackedArea`, or `areaY` + `stack` (`@tanstack/charts/stack`) in `marks`                                                                                                                                                                                                                                 | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `Threshold` (the visx component)    | `Lines` `thresholds`, or `differenceY` (`@tanstack/charts/difference`) in `marks`; `Threshold` is now basalt's type for a `thresholds` entry                                                                                                                                                              | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `Bar`                               | `Bars`, or `barY` (`@tanstack/charts/bar`, plus `stack`) in `marks`                                                                                                                                                                                                                                       | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `BarStack`                          | `Bars`, or `barY` (`@tanstack/charts/bar`, plus `stack`) in `marks`                                                                                                                                                                                                                                       | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `BarGroup`                          | `Bars`, or `barY` (`@tanstack/charts/bar`, plus `stack`) in `marks`                                                                                                                                                                                                                                       | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `Line`                              | `ruleX`/`ruleY` (`@tanstack/charts/rule`), `link` (`@tanstack/charts/link`) or `refLines`                                                                                                                                                                                                                 | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `Pie`                               | `Donut`                                                                                                                                                                                                                                                                                                   | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `Group`                             | deleted; marks carry their own position                                                                                                                                                                                                                                                                   | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `GridRows`                          | deleted; `AxisConfig.grid`                                                                                                                                                                                                                                                                                | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `GridColumns`                       | deleted; `AxisConfig.grid`                                                                                                                                                                                                                                                                                | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `scaleLinear`                       | deleted; the x scale follows `x`'s value type; `@tanstack/charts/scales/*` or `d3-scale` (a peer) inside `marks`                                                                                                                                                                                          | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `scaleBand`                         | deleted; the x scale follows `x`'s value type; `@tanstack/charts/scales/*` or `d3-scale` (a peer) inside `marks`                                                                                                                                                                                          | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `scalePoint`                        | deleted; the x scale follows `x`'s value type; `@tanstack/charts/scales/*` or `d3-scale` (a peer) inside `marks`                                                                                                                                                                                          | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `scaleTime`                         | deleted; the x scale follows `x`'s value type; `@tanstack/charts/scales/*` or `d3-scale` (a peer) inside `marks`                                                                                                                                                                                          | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveMonotoneX`                    | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveLinear`                       | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveCatmullRom`                   | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveStep`                         | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveStepAfter`                    | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveStepBefore`                   | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `curveBasis`                        | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                                                                                                                                                                                                            | visx is gone: no dependency, peer or re-export                                                                                                 |
| `basalt-ui/charts`: `ZonedLine`                         | `Lines`; `getX` + `chartId` → `x`, `isPending` → `state`, `areaFill` → `ChartSeries.area`                                                                                                                                                                                                                 | `ZonedLine` and `MultiLine` merged: zones, x-zones, ref lines and `y2` moved to the rung                                                       |
| `basalt-ui/charts`: `ZonedLineProps`                    | `LinesProps`                                                                                                                                                                                                                                                                                              | merged with `MultiLine`                                                                                                                        |
| `basalt-ui/charts`: `ZonedLineThreshold`                | `Threshold`                                                                                                                                                                                                                                                                                               | renamed                                                                                                                                        |
| `basalt-ui/charts`: `ZonedLineRefLine`                  | `RefLine`                                                                                                                                                                                                                                                                                                 | one reference-line type for every kind                                                                                                         |
| `basalt-ui/charts`: `BarsRefLine`                       | `RefLine`                                                                                                                                                                                                                                                                                                 | one reference-line type for every kind                                                                                                         |
| `basalt-ui/charts`: `MultiLine`                         | `Lines`                                                                                                                                                                                                                                                                                                   | merged with `ZonedLine`                                                                                                                        |
| `basalt-ui/charts`: `MultiLineProps`                    | `LinesProps`                                                                                                                                                                                                                                                                                              | merged with `ZonedLineProps`                                                                                                                   |
| `basalt-ui/charts`: `Bars`                              | `Bars`, same name, new props: `positiveBars`/`negativeBars`/`getValue(d, key)` → `bars: BarsBar<T>[]` (each with its own `getValue`), `barLayout` → `layout: 'stacked' \| 'grouped'                                                                                \| 'normalized'`, `getX`+`chartId`→`x` | contract change (V2-SPEC § 9.3)                                                                                                                |
| `basalt-ui/charts`: `BarsProps`                         | kept, reshaped with `Bars`                                                                                                                                                                                                                                                                                | contract change (V2-SPEC § 9.3)                                                                                                                |
| `basalt-ui/charts`: `BarsBar`                           | kept, reshaped with `Bars`                                                                                                                                                                                                                                                                                | contract change (V2-SPEC § 9.3)                                                                                                                |
| `basalt-ui/charts`: `BarsLine`                          | kept, reshaped with `Bars`                                                                                                                                                                                                                                                                                | contract change (V2-SPEC § 9.3)                                                                                                                |
| `basalt-ui/charts`: `StackedArea`                       | `StackedArea`, rebuilt on this engine                                                                                                                                                                                                                                                                     | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `StackedAreaProps`                  | `StackedArea`, rebuilt on this engine                                                                                                                                                                                                                                                                     | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `DualPanel`                         | `DualPanel`, rebuilt on this engine (compiled through `composeViews`)                                                                                                                                                                                                                                     | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `DualPanelProps`                    | `DualPanel`, rebuilt on this engine (compiled through `composeViews`)                                                                                                                                                                                                                                     | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `MirroredBars`                      | `MirroredBars`, rebuilt on this engine                                                                                                                                                                                                                                                                    | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `MirroredBarsProps`                 | `MirroredBars`, rebuilt on this engine                                                                                                                                                                                                                                                                    | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `MirroredBarPane`                   | `MirroredBars`, rebuilt on this engine                                                                                                                                                                                                                                                                    | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `BandStrip`                         | `BandStrip`, rebuilt on this engine                                                                                                                                                                                                                                                                       | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `BandStripProps`                    | `BandStrip`, rebuilt on this engine                                                                                                                                                                                                                                                                       | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `BandStripSeries`                   | `BandStrip`, rebuilt on this engine                                                                                                                                                                                                                                                                       | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `BandSpan`                          | `BandStrip`, rebuilt on this engine                                                                                                                                                                                                                                                                       | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `BandFold`                          | `BandStrip`, rebuilt on this engine                                                                                                                                                                                                                                                                       | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `Donut`                             | `Donut`, rebuilt on this engine                                                                                                                                                                                                                                                                           | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `DonutProps`                        | `Donut`, rebuilt on this engine                                                                                                                                                                                                                                                                           | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `DonutDatum`                        | `Donut`, rebuilt on this engine                                                                                                                                                                                                                                                                           | rebuilt in W5 (props in § 9.3)                                                                                                                 |
| `basalt-ui/charts`: `Heatmap`                           | `Heatmap`, rebuilt on this engine, unless the 3 bespoke grids are cheaper                                                                                                                                                                                                                                 | no TanStack Charts port in W4; the 1.x kind had no consumer                                                                                    |
| `basalt-ui/charts`: `HeatmapProps`                      | `Heatmap`, rebuilt on this engine, unless the 3 bespoke grids are cheaper                                                                                                                                                                                                                                 | no TanStack Charts port in W4; the 1.x kind had no consumer                                                                                    |
| `basalt-ui/charts`: `LineSparkline`                     | `Sparkline`, rebuilt on this engine (`mark: 'line'                                                                                  \| 'bar'`)                                                                                                                                                            | the two sparklines merge; rebuilt in W5 (props in § 9.3)                                                                                       |
| `basalt-ui/charts`: `BarSparkline`                      | `Sparkline`, rebuilt on this engine (`mark: 'line'                                                                                  \| 'bar'`)                                                                                                                                                            | the two sparklines merge; rebuilt in W5 (props in § 9.3)                                                                                       |
| `basalt-ui/charts`: `LineSparklineProps`                | `SparklineProps`, rebuilt on this engine                                                                                                                                                                                                                                                                  | the two sparklines merge; rebuilt in W5 (props in § 9.3)                                                                                       |
| `basalt-ui/charts`: `BarSparklineProps`                 | `SparklineProps`, rebuilt on this engine                                                                                                                                                                                                                                                                  | the two sparklines merge; rebuilt in W5 (props in § 9.3)                                                                                       |
| `basalt-ui/charts`: `CartesianChart`                    | kept, new contract: `children(ctx)` → `marks(plot)`, `getX` + `chartId` → `x`, `isPending` → `state`, `ariaLabel` is required                                                                                                                                                                             | a definition compiler plus one host (V2-SPEC § 9.2)                                                                                            |
| `basalt-ui/charts`: `CartesianChartProps`               | kept names, new contract                                                                                                                                                                                                                                                                                  | V2-SPEC § 9.2                                                                                                                                  |
| `basalt-ui/charts`: `AxisConfig`                        | kept names, new contract                                                                                                                                                                                                                                                                                  | V2-SPEC § 9.2                                                                                                                                  |
| `basalt-ui/charts`: `PlotContext`                       | kept name, new contract: per-field map under the table                                                                                                                                                                                                                                                    | V2-SPEC § 9.2                                                                                                                                  |
| `basalt-ui/charts`: `resolveAxisDomain`                 | internal                                                                                                                                                                                                                                                                                                  | the rung owns the y domains                                                                                                                    |
| `basalt-ui/charts`: `ChartFrame`                        | deleted; the host is private. A bespoke body moves to `CartesianChart` `marks`, a matrix to W5 `Heatmap`                                                                                                                                                                                                  | the engine owns the frame                                                                                                                      |
| `basalt-ui/charts`: `ChartFrameProps`                   | deleted; the host is private. A bespoke body moves to `CartesianChart` `marks`, a matrix to W5 `Heatmap`                                                                                                                                                                                                  | the engine owns the frame                                                                                                                      |
| `basalt-ui/charts`: `ChartFrameLegend`                  | deleted; the host is private. A bespoke body moves to `CartesianChart` `marks`, a matrix to W5 `Heatmap`                                                                                                                                                                                                  | the engine owns the frame                                                                                                                      |
| `basalt-ui/charts`: `PlotRect`                          | deleted; the host is private. A bespoke body moves to `CartesianChart` `marks`, a matrix to W5 `Heatmap`                                                                                                                                                                                                  | the engine owns the frame                                                                                                                      |
| `basalt-ui/charts`: `resolveLegend`                     | deleted; the host is private. A bespoke body moves to `CartesianChart` `marks`, a matrix to W5 `Heatmap`                                                                                                                                                                                                  | the engine owns the frame                                                                                                                      |
| `basalt-ui/charts`: `ResponsiveChartHeight`             | kept                                                                                                                                                                                                                                                                                                      | unchanged                                                                                                                                      |
| `basalt-ui/charts`: `ChartState`                        | kept; the `isPending` alias is deleted (use `state={{ pending }}`)                                                                                                                                                                                                                                        | one state type                                                                                                                                 |
| `basalt-ui/charts`: `ChartCenter`                       | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartPending`                      | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartEmpty`                        | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartError`                        | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartCenterProps`                  | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartPendingProps`                 | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartEmptyProps`                   | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartErrorProps`                   | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ResolvedChartState`                | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `resolveChartState`                 | internal to the host and `ChartCard`; render a state with the `state` prop                                                                                                                                                                                                                                | the host owns the placeholders                                                                                                                 |
| `basalt-ui/charts`: `ChartCard`                         | kept                                                                                                                                                                                                                                                                                                      | unchanged                                                                                                                                      |
| `basalt-ui/charts`: `ChartCardProps`                    | kept                                                                                                                                                                                                                                                                                                      | unchanged                                                                                                                                      |
| `basalt-ui/charts`: `ChartCardSlot`                     | kept                                                                                                                                                                                                                                                                                                      | unchanged                                                                                                                                      |
| `basalt-ui/charts`: `ChartCard` `placeholderHeight`     | default is the chart height law (the box an unsized chart takes), no longer `240`; it is a `number                                                                                                                                                                                                        | ResponsiveChartHeight`. Pass the chart's own `height`when it states one, so a`<Suspense>` fallback reserves the final size                     | a pending card is a streamed section's fallback and must take the final box |
| `basalt-ui/charts`: `Donut` side legend                 | the legend sits beside the ring in a 480px-or-wider container (CSS), no longer when the frame is wider than 1.5 × its height; a stated `height` above 320px now gets the side layout too                                                                                                                  | the layout is a container query, so the server HTML is the hydrated layout                                                                     |
| `basalt-ui/charts`: `ChartCard` short fold              | a chart that states `height` ≤ 180px marks the card short in the server HTML (subtitle folds, KPI numeral `lg`, header top inset trims); no longer decided from a rendered height under 280px. A body that is not a chart is still measured                                                               | the fold is in the markup, so hydration does not re-fold the header                                                                            |
| `basalt-ui/charts`: `legend.placement: 'header'` markup | the legend is drawn at the top of the chart body, spaced as the header's legend row; `[data-basalt-legend-slot]` and the legend inside the card's header element are gone, so a selector or test on the slot reads the chart body instead                                                                 | the legend is in the chart's own markup, so it is in the server HTML and the header never grows on hydration                                   |
| `basalt-ui/charts`: `[data-basalt-chart-legend]` value  | reads `auto` (both swatches render, the container picks none / dots / chips); it was `dots` or `chips`                                                                                                                                                                                                    | the mode is a container query, so the server HTML carries the right legend; read the computed `display` of the swatches for the effective mode |
| `basalt-ui/charts`: `ChartCursorScope`                  | the `cursorGroup` prop                                                                                                                                                                                                                                                                                    | no provider: one controller per group in a module map                                                                                          |
| `basalt-ui/charts`: `ChartCursorScopeProps`             | the `cursorGroup` prop                                                                                                                                                                                                                                                                                    | no provider: one controller per group in a module map                                                                                          |
| `basalt-ui/charts`: `globalCursorStore`                 | `chartCursor(group?)`; read it with `useSyncExternalStore(controller.subscribe, controller.getState, () => null)`                                                                                                                                                                                         | the 1.x store is replaced by TanStack's cursor controller                                                                                      |
| `basalt-ui/charts`: `createCursorStore`                 | `chartCursor(group?)`; read it with `useSyncExternalStore(controller.subscribe, controller.getState, () => null)`                                                                                                                                                                                         | the 1.x store is replaced by TanStack's cursor controller                                                                                      |
| `basalt-ui/charts`: `CursorStore`                       | `chartCursor(group?)`; read it with `useSyncExternalStore(controller.subscribe, controller.getState, () => null)`                                                                                                                                                                                         | the 1.x store is replaced by TanStack's cursor controller                                                                                      |
| `basalt-ui/charts`: `CursorState`                       | `chartCursor(group?)`; read it with `useSyncExternalStore(controller.subscribe, controller.getState, () => null)`                                                                                                                                                                                         | the 1.x store is replaced by TanStack's cursor controller                                                                                      |
| `basalt-ui/charts`: `useCursorState`                    | `chartCursor(group?)`; read it with `useSyncExternalStore(controller.subscribe, controller.getState, () => null)`                                                                                                                                                                                         | the 1.x store is replaced by TanStack's cursor controller                                                                                      |
| `basalt-ui/charts`: `useChartCursor`                    | deleted; TanStack focus plus basalt's cursor resolution                                                                                                                                                                                                                                                   | the engine owns the pointer and keyboard model                                                                                                 |
| `basalt-ui/charts`: `ChartCursor`                       | deleted; TanStack focus plus basalt's cursor resolution                                                                                                                                                                                                                                                   | the engine owns the pointer and keyboard model                                                                                                 |
| `basalt-ui/charts`: `CursorAnchor`                      | deleted; TanStack focus plus basalt's cursor resolution                                                                                                                                                                                                                                                   | the engine owns the pointer and keyboard model                                                                                                 |
| `basalt-ui/charts`: `DomainKind`                        | deleted; TanStack focus plus basalt's cursor resolution                                                                                                                                                                                                                                                   | the engine owns the pointer and keyboard model                                                                                                 |
| `basalt-ui/charts`: `CursorResolution`                  | kept (`'exact'                                                                                                                                                         \| 'nearest'                                                                                \| 'leading'`)                         | unchanged                                                                                                                                      |
| `basalt-ui/charts`: `Crosshair`                         | deleted; the engine's crosshair, focus ring and keyboard focus                                                                                                                                                                                                                                            | the engine owns the overlay                                                                                                                    |
| `basalt-ui/charts`: `SeriesDot`                         | deleted; the engine's crosshair, focus ring and keyboard focus                                                                                                                                                                                                                                            | the engine owns the overlay                                                                                                                    |
| `basalt-ui/charts`: `HoverOverlay`                      | deleted; the engine's crosshair, focus ring and keyboard focus                                                                                                                                                                                                                                            | the engine owns the overlay                                                                                                                    |
| `basalt-ui/charts`: `AxisBottomDate`                    | deleted; `AxisConfig` (`y`, `y2`), `xTicks`, `formatX`                                                                                                                                                                                                                                                    | the engine draws the guides                                                                                                                    |
| `basalt-ui/charts`: `AxisBottomNumeric`                 | deleted; `AxisConfig` (`y`, `y2`), `xTicks`, `formatX`                                                                                                                                                                                                                                                    | the engine draws the guides                                                                                                                    |
| `basalt-ui/charts`: `AxisLeftNumeric`                   | deleted; `AxisConfig` (`y`, `y2`), `xTicks`, `formatX`                                                                                                                                                                                                                                                    | the engine draws the guides                                                                                                                    |
| `basalt-ui/charts`: `AxisRightNumeric`                  | deleted; `AxisConfig` (`y`, `y2`), `xTicks`, `formatX`                                                                                                                                                                                                                                                    | the engine draws the guides                                                                                                                    |
| `basalt-ui/charts`: `ZoneRects`                         | deleted; `zones` / `xZones` props take `ZoneSpec` / `XZoneSpec`, which are kept                                                                                                                                                                                                                           | the rung compiles zones                                                                                                                        |
| `basalt-ui/charts`: `XZoneRects`                        | deleted; `zones` / `xZones` props take `ZoneSpec` / `XZoneSpec`, which are kept                                                                                                                                                                                                                           | the rung compiles zones                                                                                                                        |
| `basalt-ui/charts`: `AreaGradient`                      | `ChartSeries.area`                                                                                                                                                                                                                                                                                        | the engine owns SVG resources                                                                                                                  |
| `basalt-ui/charts`: `areaFillUrl`                       | `ChartSeries.area`                                                                                                                                                                                                                                                                                        | the engine owns SVG resources                                                                                                                  |
| `basalt-ui/charts`: `HatchPattern`                      | deleted; absent-state paint is a flat fill (V2-SPEC § 9 Open item: hatch)                                                                                                                                                                                                                                 | TanStack's SVG resources are gradients and clips only                                                                                          |
| `basalt-ui/charts`: `hatchFill`                         | deleted; absent-state paint is a flat fill (V2-SPEC § 9 Open item: hatch)                                                                                                                                                                                                                                 | TanStack's SVG resources are gradients and clips only                                                                                          |
| `basalt-ui/charts`: `hatchSizeFor`                      | deleted; absent-state paint is a flat fill (V2-SPEC § 9 Open item: hatch)                                                                                                                                                                                                                                 | TanStack's SVG resources are gradients and clips only                                                                                          |
| `basalt-ui/charts`: `ChartTooltipFloat`                 | deleted; rows are `ChartTooltipRow` data from `tooltip.rows(d, { visible, hidden })`, the title is `tooltip.formatHeader(x, d)`                                                                                                                                                                           | the tooltip surface is TanStack's                                                                                                              |
| `basalt-ui/charts`: `TooltipHeader`                     | deleted; rows are `ChartTooltipRow` data from `tooltip.rows(d, { visible, hidden })`, the title is `tooltip.formatHeader(x, d)`                                                                                                                                                                           | the tooltip surface is TanStack's                                                                                                              |
| `basalt-ui/charts`: `TooltipRow`                        | deleted; rows are `ChartTooltipRow` data from `tooltip.rows(d, { visible, hidden })`, the title is `tooltip.formatHeader(x, d)`                                                                                                                                                                           | the tooltip surface is TanStack's                                                                                                              |
| `basalt-ui/charts`: `TooltipBody`                       | deleted; rows are `ChartTooltipRow` data from `tooltip.rows(d, { visible, hidden })`, the title is `tooltip.formatHeader(x, d)`                                                                                                                                                                           | the tooltip surface is TanStack's                                                                                                              |
| `basalt-ui/charts`: `CartesianTooltipConfig`            | `ChartTooltipConfig` (one type for every kind)                                                                                                                                                                                                                                                            | `label` / `prependRows` / `extraRows` / `TooltipRow` collapse into `tooltip.rows`                                                              |
| `basalt-ui/charts`: `CartesianTooltipRowContext`        | `ChartTooltipConfig` (one type for every kind)                                                                                                                                                                                                                                                            | `label` / `prependRows` / `extraRows` / `TooltipRow` collapse into `tooltip.rows`                                                              |
| `basalt-ui/charts`: `BandTooltipConfig`                 | `ChartTooltipConfig` (one type for every kind)                                                                                                                                                                                                                                                            | `label` / `prependRows` / `extraRows` / `TooltipRow` collapse into `tooltip.rows`                                                              |
| `basalt-ui/charts`: `BandTooltipRowContext`             | `ChartTooltipConfig` (one type for every kind)                                                                                                                                                                                                                                                            | `label` / `prependRows` / `extraRows` / `TooltipRow` collapse into `tooltip.rows`                                                              |
| `basalt-ui/charts`: `ChartLegend`                       | internal; an external legend is `legend.placement: 'header'`                                                                                                                                                                                                                                              | legend and tooltip rows derive from `series` inside the host                                                                                   |
| `basalt-ui/charts`: `LegendEntry`                       | internal; an external legend is `legend.placement: 'header'`                                                                                                                                                                                                                                              | legend and tooltip rows derive from `series` inside the host                                                                                   |
| `basalt-ui/charts`: `deriveLegend`                      | internal; an external legend is `legend.placement: 'header'`                                                                                                                                                                                                                                              | legend and tooltip rows derive from `series` inside the host                                                                                   |
| `basalt-ui/charts`: `deriveTooltipRows`                 | internal; an external legend is `legend.placement: 'header'`                                                                                                                                                                                                                                              | legend and tooltip rows derive from `series` inside the host                                                                                   |
| `basalt-ui/charts`: `ChartLegendConfig`                 | kept; `LegendPlacement` is inlined                                                                                                                                                                                                                                                                        | unchanged shape                                                                                                                                |
| `basalt-ui/charts`: `LegendPlacement`                   | inlined in `ChartLegendConfig` (`'top'                                                                                                                                 \| 'bottom'                                                                                 \| 'header'`)                          | one legend type                                                                                                                                |
| `basalt-ui/charts`: `ChartSeries`                       | kept; absorbs `SeriesStyle`, plus `area`                                                                                                                                                                                                                                                                  | one series descriptor                                                                                                                          |
| `basalt-ui/charts`: `SeriesStyle`                       | folded into `ChartSeries` (`ChartSeries['curve']`, …)                                                                                                                                                                                                                                                     | one series descriptor                                                                                                                          |
| `basalt-ui/charts`: `SeriesMark`                        | folded into `ChartSeries` (`ChartSeries['curve']`, …)                                                                                                                                                                                                                                                     | one series descriptor                                                                                                                          |
| `basalt-ui/charts`: `SeriesDash`                        | folded into `ChartSeries` (`ChartSeries['curve']`, …)                                                                                                                                                                                                                                                     | one series descriptor                                                                                                                          |
| `basalt-ui/charts`: `SeriesCurve`                       | folded into `ChartSeries` (`ChartSeries['curve']`, …)                                                                                                                                                                                                                                                     | one series descriptor                                                                                                                          |
| `basalt-ui/charts`: `SeriesRole`                        | folded into `ChartSeries` (`ChartSeries['curve']`, …)                                                                                                                                                                                                                                                     | one series descriptor                                                                                                                          |
| `basalt-ui/charts`: `curveFor`                          | internal                                                                                                                                                                                                                                                                                                  | `ChartSeries.curve` is the public seam                                                                                                         |
| `basalt-ui/charts`: `foldBands`                         | internal                                                                                                                                                                                                                                                                                                  | returns with W5 `BandStrip`                                                                                                                    |
| `basalt-ui/charts`: `useChartSize`                      | deleted; the host measures the width                                                                                                                                                                                                                                                                      | the host owns sizing                                                                                                                           |
| `basalt-ui/charts`: `UseChartSizeResult`                | deleted; the host measures the width                                                                                                                                                                                                                                                                      | the host owns sizing                                                                                                                           |
| `basalt-ui/charts`: `ChartSize`                         | deleted; the host measures the width                                                                                                                                                                                                                                                                      | the host owns sizing                                                                                                                           |
| `basalt-ui/charts`: `autoMargin`                        | deleted                                                                                                                                                                                                                                                                                                   | TanStack's measured guides own the margins                                                                                                     |
| `basalt-ui/charts`: `probeAxisLabels`                   | deleted                                                                                                                                                                                                                                                                                                   | TanStack's measured guides own the margins                                                                                                     |
| `basalt-ui/charts`: `AutoMarginInput`                   | deleted                                                                                                                                                                                                                                                                                                   | TanStack's measured guides own the margins                                                                                                     |
| `basalt-ui/charts`: `measureText`                       | deleted                                                                                                                                                                                                                                                                                                   | TanStack's measured guides own the margins                                                                                                     |
| `basalt-ui/charts`: `maxTextWidth`                      | deleted                                                                                                                                                                                                                                                                                                   | TanStack's measured guides own the margins                                                                                                     |
| `basalt-ui/charts`: `smartTicks`                        | deleted; `xTicks` (a count or the values) plus `tickLabels.thin`; labels never rotate                                                                                                                                                                                                                     | the engine thins colliding labels                                                                                                              |
| `basalt-ui/charts`: `smartTicksEvery`                   | deleted; `xTicks` (a count or the values) plus `tickLabels.thin`; labels never rotate                                                                                                                                                                                                                     | the engine thins colliding labels                                                                                                              |
| `basalt-ui/charts`: `xLabelPxFor`                       | deleted; `xTicks` (a count or the values) plus `tickLabels.thin`; labels never rotate                                                                                                                                                                                                                     | the engine thins colliding labels                                                                                                              |
| `basalt-ui/charts`: `autoXLabelRotate`                  | deleted; `xTicks` (a count or the values) plus `tickLabels.thin`; labels never rotate                                                                                                                                                                                                                     | the engine thins colliding labels                                                                                                              |
| `basalt-ui/charts`: `chartMargin`                       | deleted; margins are measured, band kinds own their top inset                                                                                                                                                                                                                                             | the engine owns the margins                                                                                                                    |
| `basalt-ui/charts`: `ChartMargin`                       | deleted; margins are measured, band kinds own their top inset                                                                                                                                                                                                                                             | the engine owns the margins                                                                                                                    |
| `basalt-ui/charts`: `fmtAxisDate`                       | deleted (also from `basalt-ui/format`); `formatX` and `tooltip.formatHeader` default to the date formats                                                                                                                                                                                                  | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `fmtTooltipDate`                    | deleted (also from `basalt-ui/format`); `formatX` and `tooltip.formatHeader` default to the date formats                                                                                                                                                                                                  | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `fmtCompact`                        | deleted; `AxisConfig.format` defaults to compact numbers                                                                                                                                                                                                                                                  | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `FmtCompactOptions`                 | deleted; `AxisConfig.format` defaults to compact numbers                                                                                                                                                                                                                                                  | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `fmtPercent`                        | `percent` from `basalt-ui/format`                                                                                                                                                                                                                                                                         | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `FmtPercentOptions`                 | `percent` from `basalt-ui/format`                                                                                                                                                                                                                                                                         | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `fmtCurrency`                       | `money` from `basalt-ui/format`                                                                                                                                                                                                                                                                           | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `FmtCurrencyOptions`                | `money` from `basalt-ui/format`                                                                                                                                                                                                                                                                           | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `fmtInt`                            | `integer` from `basalt-ui/format`                                                                                                                                                                                                                                                                         | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `formatters`                        | deleted; `basalt-ui/format`                                                                                                                                                                                                                                                                               | one home for formatters                                                                                                                        |
| `basalt-ui/charts`: `VX`                                | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `alpha`                             | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `buildPaletteCss`                   | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `seriesTokens`                      | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `defineSeries`                      | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `groupTokens`                       | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `ColorPair`                         | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `SeriesMap`                         | `basalt-ui/tokens` (a move: the name is unchanged)                                                                                                                                                                                                                                                        | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `SeriesKey`                         | `basalt-ui/tokens` or `basalt-ui` (a move: the name is unchanged)                                                                                                                                                                                                                                         | `basalt-ui/charts` re-exports no tokens                                                                                                        |
| `basalt-ui/charts`: `VxThemeProvider`                   | deleted; every chart paint is a `var(--vx-*)` reference                                                                                                                                                                                                                                                   | no theme context                                                                                                                               |
| `basalt-ui/charts`: `useVxTheme`                        | deleted; every chart paint is a `var(--vx-*)` reference                                                                                                                                                                                                                                                   | no theme context                                                                                                                               |
| `basalt-ui/charts`: `VxTheme`                           | deleted; every chart paint is a `var(--vx-*)` reference                                                                                                                                                                                                                                                   | no theme context                                                                                                                               |

### `PlotContext`, field by field

`marks(plot)` replaces the 1.x `children(ctx)` render prop. The engine owns the scales, so no pixel scale reaches the callback; marks are declared in data space and the host positions them.

| 1.x `ctx.`     | 2.x `plot.`                                            | Note                                                                                                                                                               |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data`         | `rows(key)`                                            | `PlotRow { x, y, series, datum }[]`; `[]` for a hidden series                                                                                                      |
| `visible`      | `visible`                                              | unchanged: series minus what the legend toggled off                                                                                                                |
| `hidden`       | none                                                   | not exposed: it is your own `series` minus `plot.visible` (`rows(key)` is `[]` for a hidden key)                                                                   |
| `xScale`       | none                                                   | pass `x: 'x'` on `rows(key)`; the engine scales it                                                                                                                 |
| `yScale`       | none (`yDomain` is the resolved domain)                | a mark on the default axis takes no scale argument                                                                                                                 |
| `y2Scale`      | `y2` (`'y2' \| undefined`)                             | a mark opts in with `yScale: plot.y2`, else it draws on the left; `y2Domain` is the domain                                                                         |
| `xMax`, `yMax` | `width`, `height`                                      | the chart box in px, not the plot rect                                                                                                                             |
| `margin`       | none                                                   | margins are the host's; there is no margin prop                                                                                                                    |
| `cursorPoint`  | none (`chartCursor(group?).getState()` is the closest) | `getState()` is engine coordinates (`scene` / `normalized` / `value`), not a datum: there is no direct replacement; for a cursor dot use `ChartSeries.cursorValue` |
| `highlighted`  | `highlighted`                                          | unchanged                                                                                                                                                          |
| new            | `containerClass`                                       | the measured container class                                                                                                                                       |

### Overlays that were drawn from pixel scales

A 1.x overlay that called `ctx.xScale(x)` / `ctx.yScale(y)` and returned `<line>` / `<rect>` / `<text>` has one 2.x route: declare it as a mark in data space from `@tanstack/charts/{line,rule,dot,text,rect,link,arrow,…}` (the `basalt/chart-engine-boundary` allowlist) and return it from `marks`. The engine runs the scales, so the overlay tracks resize and the legend. It does **not** follow `y2` on its own: a mark draws on the left axis unless it carries `yScale: plot.y2` (`undefined` without a `y2` config, which the mark options accept as is: no guard needed).

```tsx
import { lineY } from '@tanstack/charts/line'
import { ruleY } from '@tanstack/charts/rule'
import { CartesianChart } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'

;<CartesianChart
  data={data}
  x={(d) => d.at}
  series={series}
  y2={{}}
  ariaLabel="Latency"
  marks={(plot) => [
    ...plot.visible.map((s) =>
      lineY(plot.rows(s.key), {
        x: 'x',
        y: 'y',
        z: 'series',
        stroke: s.color,
        ...(s.axis === 'right' && { yScale: plot.y2 }),
      }),
    ),
    ruleY([250], { stroke: VX.status.warn }), // left axis, data space
    ruleY([5], { yScale: plot.y2, stroke: VX.status.warn }), // right axis
  ]}
/>
```

Fixed thresholds and bands need no mark: use `refLines`, `zones` and `xZones` data. **There is no route for an overlay positioned in raw pixels** (a free-floating SVG/HTML node placed from a pixel scale, or a mark whose position is computed from the plot rect): `PlotContext` exposes no scale or plot rect and `ChartMarks` takes engine marks only. Express it in data coordinates, or it is unsupported in 2.x.

### Subpaths, peers and gates (W3 gates)

| 1.41 import                                    | 2.0                          | Reason                                                                              |
| ---------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `basalt-ui/agent-chat`                         | `basalt-ui/agent`            | the chat UI folds into `./agent`; `motion` is subpath-required there                |
| `basalt-ui/notifications`                      | `basalt-ui/commands`         | no new peer: `BasaltProvider` mounts `Notifications`, `ModalsProvider`, `Spotlight` |
| `basalt-ui/router-tanstack` (nav half)         | `basalt-ui`                  | nav lives in the root barrel                                                        |
| `basalt-ui/router-tanstack` (store half)       | `basalt-ui/state`            | stores live with `field` and the search store                                       |
| `basalt-ui/data/table`                         | `basalt-ui/table`            | renamed; `@tanstack/react-table` is subpath-required                                |
| `basalt-ui/data/virtual`                       | deleted                      | 0 imports across the fleet                                                          |
| `basalt-ui/guard`                              | deleted                      | CLI-internal                                                                        |
| `basalt-ui/theme-lab`                          | deleted                      | provider-mounted in dev                                                             |
| `basalt-ui/tokens.css`                         | `basalt-ui tokens:css` (CLI) | weatherorb 1.30 and rollhook 1.36 only                                              |
| `basalt-ui/llms.txt`, `basalt-ui/package.json` | deleted from `exports`       | 0 imports; both files stay in the tarball                                           |

Peers: `react`, `react-dom`, `@mantine/{core,hooks,modals,notifications,spotlight}`,
`@tanstack/{react-router,react-query}` and the three `@fontsource-variable/*` are now **required**
(no longer `optional`). `@ai-sdk/provider` (`./agent`) and `dayjs` (`./controls-dates`) are new
optional, subpath-required peers.

### Provider and wiring

| Old import                                                                         | New / deleted                                                                                                                                                                                                 | Why                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `BasaltProvider` `children`, `onError`, `connectivity` props                       | `router` (required), `telemetry?`, `fallback?`; `theme` defaults to `createBasaltTheme()`                                                                                                                     | the provider mounts the router and every overlay (V2-SPEC § 2)                    |
| `createBasaltQueryClient` (`basalt-ui`)                                            | `createBasaltRouter({ routeTree, context?, query? })`                                                                                                                                                         | one QueryClient per router, 1.x defaults kept, `query` merges over them           |
| `BasaltErrorBoundary`, `BasaltErrorBoundaryProps`                                  | deleted: `BasaltProvider fallback` + telemetry `render.error`; routes get `defaultErrorComponent`                                                                                                             | the provider mounts the root boundary                                             |
| `BasaltErrorContext`                                                               | `BasaltEvent` (type)                                                                                                                                                                                          | `onError` is replaced by the `telemetry` seam (V2-SPEC § 7)                       |
| `BasaltOverlays`, `useCommandHotkeys` glue (`basalt-ui/commands`)                  | deleted: the provider mounts `ModalsProvider` (wrapping the router), `Notifications`, `Spotlight`, and binds registry hotkeys                                                                                 | no second mount, no `modals={false}` escape                                       |
| `BasaltQueryDevtools`, `BasaltDevDock`, `BasaltDevDockProps`, `BasaltDevDockTool`  | deleted: the provider mounts one dev dock in dev (router + query devtools, theme lab) behind a literal `NODE_ENV` gate; Spotlight commands `dev.router` / `dev.query` / `dev.theme` open it                   | one dock, never in production                                                     |
| `ConnectivityProvider`, `ConnectivityIndicator`, `useConnectivity` and their types | deleted                                                                                                                                                                                                       | no consumer; the auto-mount is gone                                               |
| `toErrorMessage`, `errorStatus` (`basalt-ui`)                                      | deleted                                                                                                                                                                                                       | no consumer outside the playground                                                |
| `queryClient` seed `agent/templates/query-client.ts.tpl`                           | deleted; `__root.tpl` seeds `createRootRouteWithContext<BasaltRouterContext>()`                                                                                                                               | the router owns the client                                                        |
| `@mantine/{core,notifications,spotlight}/styles.layer.css` imports in the app      | delete them: `basalt-ui/styles.css` now `@import`s all three, so keeping yours emits the bundle twice. With `basalt-ui/controls-dates`, import `@mantine/dates/styles.layer.css` AFTER `basalt-ui/styles.css` | the provider mounts `Notifications` and `Spotlight`, so their layers ship with it |

### Router bridge (`basalt-ui/router-tanstack`)

The `basalt-ui/router-tanstack` subpath is **removed** in 2.x, not moved: an import from it fails to resolve (`doctor`'s `dropped-subpaths` reports `file:line`). Each symbol now lives at exactly one other path, named in the table. Nothing is re-exported from the old subpath.

| Old import                                                                                                                                                                                                                     | New / deleted                                                                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `defineNav`, `navGroup`, `navTarget`, `flattenNav`, `useBasaltNav`, `NavItemId`                                                                                                                                                | import from `basalt-ui` (the root barrel)                                                                                                                                                                                                                                                                                                                                                                                                                  | the subpath is removed; nav lives in the root barrel                |
| `createSearchStore`                                                                                                                                                                                                            | `basalt-ui/state`                                                                                                                                                                                                                                                                                                                                                                                                                                          | the subpath is removed; stores live in `./state`                    |
| `field` and the 20 `Field`/`Range*`/`Search*` types re-exported here                                                                                                                                                           | `basalt-ui/state` (same names)                                                                                                                                                                                                                                                                                                                                                                                                                             | one import path per symbol                                          |
| `defineNav(config)` without the `Register` augmentation                                                                                                                                                                        | compile error: the parameter becomes `'basalt: declare Register { router }'`                                                                                                                                                                                                                                                                                                                                                                               | the definition validated nothing (V2-SPEC § 3)                      |
| `useRouterBreadcrumbs`, `BasaltBreadcrumb`, `BasaltNav`                                                                                                                                                                        | deleted                                                                                                                                                                                                                                                                                                                                                                                                                                                    | shell-internal / unnamed                                            |
| `NavItemMeta`, `NavGroupMeta`, `AnyNavItem`, `AnyNavGroup`, `AnyNavLink`, `FlatNavItem`, `NavConfig`, `NavGroupId`, `NavTabId`, `NavIndex`, `UseNavOptions`, `NavBinding`, `NavAnchor`, `NavAnchorProps`, `NavMobilePlacement` | deleted                                                                                                                                                                                                                                                                                                                                                                                                                                                    | no consumer names them; derive with `ComponentProps` / `Parameters` |
| `useNav`, and `BasaltShell`'s `sections` / `mobileNav` props                                                                                                                                                                   | deleted: pass `nav={NAV}` (plus `badges`, `isActive`, `getScrollElement` — the old `useNav` options) to `BasaltShell`; it resolves the sidebar, the mobile bar and the breadcrumb itself. `mobileNav` tuning moves to `defineNav`'s `mobile`. argo `apps/dashboard/src/routes/__root.tsx`: replace `const nav = useNav(NAV, { badges })` + `{...nav}` with `nav={NAV} badges={…}` (migrates in W12; 1.x consumers stay on their pinned version until then) |

## Unreleased

### Data tables (Wave 42)

Nothing to change unless a test or a style depends on the old look. Each line names its opt-out.

- **Cell kinds.** `BasaltColumnMeta` gains `kind` (`entity` | `status` | `number` | `money` | `relative-time` |
  `meter` | `text`), plus `statusColor(value)`, `meterMax` and `currency`. A kind supplies the cell's chrome, and its
  content when the column has no `cell`. Unset `kind` keeps the plain cell. Units belong in the header
  (`Volume (kg)`, `Salary (USD / yr)`), never in the cell: `money` without a `cell` prints the bare figure
  (`120,000.00`, was `$120,000.00`).
- **Figures are sans.** The automatic numeral style moves from mono to the proportional sans with `tabular-nums`
  (SPEC D33). Opt out per column with `meta.numeral: false`.
- **One line per row.** Body cells no longer wrap; only `meta.kind: 'text'` does. A column that relied on wrapping
  sets `kind: 'text'`. Headers never wrap.
- **Header and widths.** The header shares the body fill; a sorted column's header is ink, the rest faint. In a table
  with any `meta.kind`, data columns (`entity` included) size to their content and a wide container's slack goes to
  the last `kind: 'text'` column, else to an `aria-hidden` trailing spacer cell. A table with no `kind` is
  unchanged. Mark a notes/detail column `kind: 'text'` to have it take the width.
- **Narrow tables.** When the columns no longer fit their container, the `meta.priority` fold now stops at two
  data columns (was one). A table that still overflows pins its first visible data column (`columnDef.minSize` is
  its floor, default 120 px) and scrolls the rest in a focusable `region` (style it with `:focus-visible`). A caller's `initialColumnPinning.start` turns
  the auto-pin off. The table carries `aria-colcount` and every cell `aria-colindex`. The fold toggle is named
  `Show <folded headers>` / `Hide …` (was `Show row details`), and its header cell shows `+N`.
- **States.** The error title is the house `Could not load` (was `Could not load rows`); the count chip and the
  pager range are hidden while loading or failed; an empty paginated table drops its pager; empty and error keep
  the column header, and an empty state's title is never larger than the table's title.
- **Hover.** `highlightOnHover` defaults to `true` (`VX.surface.rowHover`); pass `highlightOnHover={false}` to opt
  out.
- **Toolbar.** One row at the dense 28 tier from a 240 px container up; on a narrow table the facets move behind one
  `Filters (n)` pill. The footer's rows-per-page `Select` and pager are 28 px on a fine pointer. New prop
  `initialColumnFilters` presets the facets.
- **Filter pills.** A set pill reads `Label  Value`, the label muted and the value ink, and its accessible name and
  `title` change with it (`EUR` → `Currency EUR`): a query for `{ name: 'EUR' }` becomes `{ name: 'Currency EUR' }`
  or `/EUR$/`. `MultiSelectFilter` with no `noun` reads `Channels  3 selected` (was `3 channels`; pass `noun` to
  keep a word). `RangeFilter` off its default reads `Window  7d`. An active pill's border and `Pagination`'s current
  page are ink, not the accent; an explicit `color=` on `Pagination` keeps the accent.

### argo upstream rows (Wave 43)

Nothing to change unless a test or a style depends on the old look. Each line names its opt-out.

- **`Meter` reading at the track start.** A marked `Meter` with no zone names puts its reading in the caption row,
  centred on the marker, so it is one caption row (~17 px) shorter and both captions share one line whenever they fit
  the track. The caption row no longer clips descenders (`low 72.3 kg`). Zoned meters are unchanged. No opt-out.
- **`ChartCard` subtitle at compact.** Below a 480 px card a `ChartCard` subtitle stays under the title, up to two lines,
  instead of folding into the info glyph (a chart subtitle is often its key). `StatCard` and `Section` still fold. A
  card under 280 px high still folds it. No opt-out.
- **`Sparkline` `band`.** New prop `band?: { from: number; to: number }`: a productive range drawn behind the line in
  the neutral fill and included in the y domain; not a series (no legend, no tooltip row). `from === to` or a non-finite
  bound draws nothing; a band edge that sets the domain gets a quarter of the band's span as air. The `reference`
  label now takes the start or end, above or below, wherever the line is not;
  it moves only when the old start-above spot would cross the line.
- **Reference legend key and end labels.** A reference line's legend key is drawn at the line's own weight (1 px) and
  dash, not the series' 2 px. `Lines` end labels take the side away from their own last segment, several close labels
  wrap their lines, the gap is one label line plus air (17 px, was 13), and a stack taller than the plot closes up to fit.
  End labels and a `RefLine` caption clear every line's path and each other, not only their own segment.
  No opt-out. A goal line that should read apart from its series sets `dashed: true`.
- **Strip footers.** A `StatGroup` footer entry (`under` or full width) takes the 13 px `sm` step instead of
  inheriting the 15 px body size, so a strip holds three type sizes. No opt-out.
- **`BasaltDataTable` danger row action.** A lone `danger: true` icon action is neutral at rest and red on its own hover
  (fine pointer) or keyboard focus, never on the row's hover. The menu's danger item is unchanged. No opt-out.
- **`basalt/status-fill-as-text` (error).** `VX.status.excellent` is a fill (about 3:1 on a light card): paint zone
  TEXT with `VX.status.good`, keep `excellent` on `bg`, fills and swatches. Flags `c=` and a style-object `color:`;
  `color=` is not judged (a fill on `Badge`/`ThemeIcon`). Waive with `{/* theme-allow status-fill-as-text — <why> */}`.
  Measured zero hits in argo and the playground, so it ships at `error`.
- **`--basalt-main-content-h`.** New CSS custom property on the main region: `height: var(--basalt-main-content-h)`
  fills the scrollport with no page scroll, with or without a `PageBar` band. It replaces a hand-built
  `calc(100dvh - …)` of shell vars (argo's `MAP_FULL_BLEED_HEIGHT`).
- **A `Paper` over a flush card.** A `Paper` inside a `Card variant="flush"` renders at the control radius (6 px at
  level 0, 4 px under the card at every radius level) instead of the card's 10, so a floating panel passes
  `craft-1/nested-radius-step`. Mantine's dropdowns and modal content keep their own. Opt out with an explicit `radius`
  on that Paper. `Paper`'s default radius now comes from a stylesheet rule rather than an inline style, so a consumer
  class can override it.
- **MapLibre attribution.** `basalt-ui/styles.css` styles MapLibre's compact attribution control onto basalt's radius
  and type scale (no maplibre dependency). Override with a selector of equal or higher specificity than
  `:root .maplibregl-ctrl.maplibregl-ctrl-attrib`, later in source.
- **`basalt-ui shot`.** An anchor that renders only in a URL state (`empty`, …) is recorded `absent` at rest with the
  note "not rendered at rest"; the board's "not captured" now means a real capture miss only.

### Event list (Wave 44)

New export, nothing to change in existing code.

- **`EventList`** (`basalt-ui`, type `EventListProps`): a day-grouped event feed (`density="feed"`) or record history
  (`density="timeline"`, with a rail). It replaces argo's `features/agents/event-list.tsx` prototype and its
  `home/activity-feed.tsx` fork, argo's `warden/item-timeline.tsx` rows, rb's journal day groups and linewatch's
  `transition-timeline.tsx`. Pass `items` (`id`, `at`, `actor?`, `title`, `body?`, `leading?`, `chips?`; the type is
  `EventListProps['items'][number]`) in display order — the list never sorts. Line one is the glyph, actor and
  sentence; line two leads with the time, then the body and chips. `group="day"` (default) adds a header per local
  day; `now` makes Today/Yesterday deterministic; `time` picks `clock`, `relative`, `date-time` or a formatter. The
  prototype's `groups`/`limit`/`narrowLines` map to `group="day"`, `earlier={{ onLoad, remaining }}` and the density.
- **History in a box.** `order="oldest-first"` with a `height` opens at the newest row, puts "Show earlier (N)" at the
  top, and keeps the visible row when earlier items are prepended. Without `height` the list scrolls with the page.
- **States.** `loading` draws skeleton rows in the row's shape; `empty={{ title, description?, action? }}` draws the
  § 6.11 tile. Compose an error with the surrounding `Section`'s query, not inside the list.
- **Long lists.** Above 200 rows the list virtualises through `@tanstack/react-virtual` (an optional peer, already one
  for `./agent`), loaded lazily; without it every row renders. At or below 200 rows the peer is never loaded.
- **`basalt-ui shot`.** A full-page shot grows only by the page scrollport's hidden height (`data-basalt-scrollport`, or
  the outermost scroller in a shell-less app); a bounded scroll box inside the page no longer adds its hidden rows as
  blank page. `_page` shots of pages with a scrolling sidebar or inner list get shorter.

### Board (Wave 45)

New export, nothing to change in existing code.

- **`Board`** (`basalt-ui`, type `BoardProps`): status columns of cards with roving-focus keyboard navigation. It
  replaces argo's `features/warden/board.tsx` prototype, its `board.module.css` and `BoardColumn`. Pass `columns`
  (`id`, `title`, `tone?`, `total?`, `empty?`, `cards`) and `onOpen(cardId, columnId)`; a card is typed data
  (`id`, `actor?`, `type?`, `title`, `record?: { label, href? }`, `status?`, `meter?`; the type is
  `BoardProps['columns'][number]['cards'][number]`). `record.href` links only when http(s) or relative, the same rule
  as the prototype's `isSafeHttpUrl`.
- **Keyboard.** One tab stop; arrows move within and across columns, Home/End within one, Enter/Space/click open,
  a polite live region announces the move. `height` bounds each column's own scroll.
- **Compact.** One column at a time under a `SegmentedControl`. The selected column is internal state unless you pass
  `field` (an enum field of the column ids, the type `ViewTabs` takes): argo's persisted `boardStore.field.column`
  maps straight to `field={boardStore.field.column}`.
- **States.** `loading` draws column-shaped skeletons; an empty column is its `empty` line, an empty board is
  `empty={{ title, description?, action? }}` (the § 6.11 tile). The prototype's "Empty: A, B" fold line is gone.

### Forms and states (Wave 46)

Nothing is removed. Each line names its opt-out.

- **Form fields are 32 px.** `FormRow` and `SettingsRow` mount a `CtlSlot`, so a control inside renders at the `ctl`
  tier: 32 px (44 px and 16 px text under a coarse pointer) instead of Mantine's 42 px `md`. `NumberInput`,
  `PasswordInput` and `Textarea` join the tier app-wide through the theme. Opt out per control with `size="md"` (a
  control's own `size` wins). Inside a tiered home slot `basalt/control-size-literal` now also flags a `size` on those
  three.
- **Form type.** `FormRow` labels go from `md` to `sm`, descriptions from `sm` to `xs`; an error leads with a status
  glyph and sits in an always-mounted polite live region. The hint and error ids are on the row's `aria-describedby`.
- **`FormGroup section`** (new prop): the legend becomes the section title (`md`, 500), rows stack 12 apart and
  consecutive sections 24 apart.
- **`EmptyState`.** The title goes from head-font `xl` 550 to the body font at 500: `md` on a page, `sm` inside a
  section, card or chart body (the error title follows), the description from `md` to
  `sm`, and `tier="section"` draws its own ring at card radius: drop a border you wrapped around it. A `Board` column's
  `empty`, `BarList`'s `emptyText` (default now "No items to compare yet"; pass the real cause), an empty
  `BasaltDataTable` body and an empty `renderCard` list all render as that tile.
- **One form row.** `FormRow` and `SettingsRow` share one geometry: a 15rem label column and a control column capped
  at 20rem, left-packed (was `FormRow` 1fr / 1.4fr and `SettingsRow` with its control flush right); below 600 px of the
  row's own width they stack. A wider control (a long textarea, a table) sets its own width. `SettingsRow` is a grid now,
  and `SettingsSection`/`DangerZone` bodies are `basalt-form` inline-size containers.
- **Chart and `StatCard` empties.** Chart `state.empty` and `StatCard` `emptyText` render as the same tile: the first
  sentence is the title (trailing period dropped), the rest the muted line — write "Why it is empty. What to do." The
  data table keeps the tile ring in its empty body and left-aligns its error body (it was centred), like every other host.
- **Pending shapes.** A pending `Lines`/`StackedArea` card draws a line ghost (a body wrapped in your own component passes
  `ghost="line"`); a loading `StatCard` with a `delta` keeps a delta chip.
- **Primary hover.** A filled accent control (`Button`, `ActionIcon`, a `derive`-retuned accent) hovers 10 tone darker
  than rest (was 4.8); at the default seed rest is `#4374a6`, hover `#2d5b88` (was `#3c6895`), and the white label
  stays at 4.90:1 and 7.09:1. An explicit `color=` keeps its family hover.
- **Pending ghosts.** A pending `Sparkline` draws a line (or bar) ghost; a pending card around a `BandStrip` draws one
  band row at the strip's stated `height` (a number or the per-class object), keeping the legend row's room when the
  strip is legended. `ghost` accepts `'band'`; `placeholderHeight` still wins.
- **`Board` record links** are ink in both schemes and do not change colour once visited; hover underlines.
- **`Sparkline`** hides its `referenceLabel` caption while a readout shows.

## 2.27.2

_Nothing to migrate in this release._

## 2.27.1

_Nothing to migrate in this release._

## 2.27.0 — Wave 38 card facts, Wave 39 argo's friction IV

### Card facts and the pending ghost (Wave 38)

No export is removed. `ChartCard` learns a pending plot's shape and documents the state contract.

- **Facts show only at rest.** A card's `facts` and basis `subtitle` render when `state` resolves to ready; pending draws the facts skeleton, empty and error draw neither, in every `placeholderHeight` mode. The card knows a state only through its `state` prop. Opt-out: omit `facts` to keep a card state-agnostic.

  | Before                                                                                         | Now                                                                                                 |
  | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
  | Facts render above the body's own loading or empty line (`Meter loading`, `BarList emptyText`) | Also pass `state={{ pending: true }}` / `state={{ empty }}` to the card; the facts hide or skeleton |

- **`ChartCard ghost`** (new optional prop): `'bars'` (default), `'line'` for a line or area chart, or a number for the bar count when the loaded data length is known. Opt-out: omit it for the previous eight-bar ghost.

### Compact legends name every key (Wave 39)

No export changes. Below 480px the legend no longer folds zone / reference entries into `+N`: every entry is named at every width, the row wraps between entries (series, then overlays, then references) and an entry never wraps mid-label. `foldLegend`, `--bc-fold` and the `+N` element are deleted (a deliberate reversal of the Wave 38 reference fold).

| Before                                                                                           | Now                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| At 390, `role: 'reference'` entries (zone keys, reference lines) fold into `+2: …` while wrapped | Every entry shows; the row takes the extra lines |
| `[data-legend-more]` / `[data-legend-folded]` exist in the legend markup                         | Gone: drop any selector or test that reads them  |

Opt-out: `legend: false` (still absolute), or remove the legend-only entries (a zone's `legend`, a refLine's `legend`) you do not want named.

### One strip cell anatomy (Wave 39)

No export is added or removed. A `StatGroup variant="strip"` cell is now a head (caption line, qualifier, value row) over its readings, and a row's visuals share one drawn top.

| Before                                                                                                                                                        | Now                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Meter, a Sparkline and Bars in one row sat at different heights (a wrapped qualifier, a delta, the Sparkline's readout line).                               | The visuals of one row put their drawn top on one line: a visual cell with a shorter head grows its head's `min-height`. A longer qualifier still pushes only its own value down (D40).                                                                            |
| A cell without a visual, a footer `under` and the odd-count phone rule were untouched by a sibling's height.                                                  | Unchanged: only cells that have a `visual` are levelled, so a footer still hugs its value and no sibling is stretched.                                                                                                                                             |
| A `rows` entry's `visual` had no host: a zoned `Meter` in a row printed its reading at the marker, and a Sparkline readout stacked over its own plotted line. | A row visual is hosted like the cell visual. A zoned `Meter` in a row no longer repeats the row's value at its marker; a Sparkline's hover chip sits above its plot, never over it. Row height is unchanged: a Sparkline row keeps the slot padding it always had. |

Opt-outs: none for the levelling (it only ever adds head height to a visual cell); omit `visual` on a cell to keep it out. A zoned row `Meter` keeps its marker reading with `reading` set on the `Meter` (the prop overrides the host).

### Meter labels at 390 (Wave 39)

No export is removed. A `Meter` zone name or tick label no longer drops for width. A zone name is tried in this order: its full name on the first label row (the names beside it, the holding one included, slide inside their spans to make room, each keeping the gap step), its full name on a **second label row** directly under the first, its `short` on the first row, its `short` on the second, then hidden. A tick label takes the second row before it hides. A second-row label is centred on its span or mark, clamped inside the track, and keeps the gap step from the other labels on that row. The row exists only while a label stands on it; a Meter whose labels all fit keeps its single `1.25em` row and its loading skeleton. The caption row (start figure, tick captions, pace/forecast) keeps its drop order.

| Before                                                                                                         | Now                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A zone name too wide for its span (and its `short`) was hidden: argo's Garmin ACWR meter lost `Caution` at 390 | `Caution` stands on a second row; the other names stay on the first                                                               |
| Zone names only had to not touch: `OptimalCaution Danger`                                                      | Adjacent names keep the gap step; at 1440 (a 203 px cell) all four ACWR names stay full on ONE row, the holding name sliding left |
| A name that did not fit fell back to its `short` on the first row, and every sibling's `short` followed        | The full name goes on the second row first; the `short` register only starts when no full name can hold either row                |
| A tick label wider than the room beside its mark, or one touching another label, was hidden                    | It is shifted inside the track, or stands on the second row (argo's `abandoned at 7 d` at any cell width and reading)             |

Opt-out: give the zone a `short` that fits its span (it is used once the full name holds neither row), or drop the tick's `label` (the mark stays, named in the described-by text). A Meter that needs no second row renders as before. One that now shows a second row is one line (`1.25em`) taller at that width: a card or strip cell that pins the Meter's height should not. At 115 px of track argo's four ACWR zones all show (one a `short` or on the second row); below that the last label hides and stays in the described-by text.

### Tooltips and readouts inside the card (Wave 39)

No export is removed or added; four defaults move.

- **A chart tooltip stays inside its card on both axes.** A tooltip taller than the room above its anchor used to cross the card's top (over the section heading); it now flips to the other side of its anchor, slides in when neither side fits, and only a tooltip taller than the card overflows, aligned to the card's top. In a card at least 192px wide it also grows to its content, up to the card's width, before a label wraps. Narrower cards (a ~120px strip cell) keep the engine's width and horizontal placement. Opt-out: render the chart outside a `ChartCard`, strip cell or `StatCard` (no card ancestor keeps the engine's viewport placement).

  | Before                                                                      | Now                                                                                |
  | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
  | A tall tooltip crossed the card top; its width was the room right of `left` | It flips or slides inside the card, and is as wide as its content (up to the card) |

- **A slotted `Bars` tooltip is the one-line chip.** A `Bars` in a `StatCard` slot or a strip cell opened the engine's titled panel below the plot, hanging out of a cell that sat at the card floor. It keeps the engine's tooltip (hit-test, accessible text, rows) but renders it as the hosted Sparkline's chip: the first row's figure, then the header (`48 pages/h · Mistborn`), one line high (`--basalt-spark-readout-h`), anchored flush above the plot in the line the cell reserves, centred on the bin and held inside the cell; an overlong header ends in an ellipsis. Further rows are hidden in a slot (a chart that needs them belongs in a `ChartCard`). A bin that sums to zero draws no bar, so a baseline marker shows which bin the chip names while it is hovered. Opt-out: render the `Bars` outside the slot to get the card tooltip.

  | Before                                                    | Now                                                                |
  | --------------------------------------------------------- | ------------------------------------------------------------------ |
  | Titled panel under the plot, ~18px below the card at 390  | One-line chip in the reserved line above the plot, inside the cell |
  | A zero bin: the readout named it, nothing in the plot did | A baseline marker on the hovered empty bin                         |

- **Tooltip labels wrap between words.** A label no longer breaks inside a token (`Load (7)` was `Load` / `7)`, `TE 2.1/0.4` could split mid-figure); a single token wider than the card overflows it. Opt-out: `.ts-chart-tooltip__row > span:nth-child(2) { overflow-wrap: anywhere }` in the app's CSS.

- **A short bare `Sparkline` keeps the one-line readout inside its box.** A line `Sparkline` under 36px outside a `StatCard` slot or a hosted strip visual used to put its chip beside the point (over the line) and stack it into two lines when the box was narrow. The chip now slides with the point like a hosted one, stays one line, and takes the in-box band, top or bottom, farthest from the plotted line. It never leaves the box. Opt-out: host it (a `StatCard` slot; a strip visual) to get the readout line above the plot.

  | Before                                                                                      | Now                                                                                        |
  | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
  | `<Sparkline height={28} />` bare: chip beside the point, on the line, two lines when narrow | chip slid with the point, one line (`48 bpm · 19 Oct`), in the band farthest from the line |

## 2.26.0 — Wave 38, argo's friction III

### Chart card loading (Wave 38)

No export is removed or added. A pending `ChartCard` now loads in its loaded shape.

| Surface                                         | Before                                      | Now                                                                              |
| ----------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `ChartCard` with `facts`, `state={{ pending }}` | the facts row was dropped: 40–70 px shorter | a skeleton facts row (figure bar, basis line if `subtitle`) at the loaded height |
| A pending chart body (`ChartPlaceholder`)       | a near-invisible blank shimmer plate        | a faint plot skeleton: an axis baseline and bar ghosts in a neutral tone         |

The stale figure is never shown while pending. Error and empty keep their rule: no facts, and
`placeholderHeight="content"` ends at the content. The plot skeleton is skipped for a `compact`
placeholder (`Sparkline`).

Opt out: pass `state` only once the data settles, or draw the loading yourself as the card's
`children` with `placeholderHeight="content"` (the card then renders `children` while pending). The
facts skeleton follows `facts`; omit `facts` while pending to drop it.

### Strip and Meter loading (Wave 38)

No export is removed or added. A loading state is the loaded shape; two other defaults move with it.

| Surface                                                               | Before                                                           | Now                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Meter loading` (bar)                                                 | one track and one or two caption lines                           | the loaded rows (figure row above, zone-name row, reading row, caption row, part captions), text painted as skeleton, at the loaded height ±2 px                                     |
| Strip cell `loading`                                                  | a value bar alone; a `visual` and `footer` showed as loaded      | the value bar, the `visual` slot and the `footer` line at their loaded height; the visual and footer are laid out hidden under a skeleton                                            |
| Forecast caption (committed/forecast `Meter`)                         | begins at the spent/forecast boundary                            | ends at the forecast fill end (clamped inside the track); if that collides it starts at the boundary instead, and drops only if neither fits; the reading stays at the committed end |
| `StatGroup` hero size in a container under 480 px (a phone, an aside) | a card spanning the row rendered 22, its two-column row-mates 16 | one size for every card of the group in the two-column state (16)                                                                                                                    |

- **Pass the loaded structure.** A Meter keeps its rows from its own props (`ticks`, `zones`, `target`,
  `endCaption`, `segments`), so pass them while loading as at rest; the reading may be `null`. A strip
  cell keeps a visual or footer only when you pass it: pass the same `visual` and `footer` as at rest
  (an empty series is fine). A `Meter` in a loading cell's `visual` loads itself; any other visual is
  covered by one skeleton bar. Give `delta` too, or a delta that wraps under the value is not reserved.
- **The ring is unchanged:** one skeleton disc.
- Opt out of the forecast anchor: none (the old anchor put "Forecast" about 100 px from the fill it
  names); `readingAt="start"` keeps the pre-2.24 anchor at the boundary.
- Opt out of the shared hero size: set `--basalt-stat-group-figure` (a length, e.g. `var(--vx-text-kpi)`) on the
  `StatGroup` or a wrapper; it replaces the group's two-column size.

### Compact legends keep series (Wave 38)

No export is removed or added. 2.24.0's compact legend folded series names into `+N`; this restores them.

| Surface                     | Before (2.24)                                                                           | Now                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Series in a compact legend  | one row; any entry that did not fit folded into `+N`, so seven lines at 390 read by hue | every series stays named at every width; if the series alone overfill a row, it wraps |
| Zone / reference entries    | first in the DOM and the row; the last entries folded                                   | after the series; they alone fold into `+N` (last first) until the key is one row     |
| An entry wider than the row | n/a (the compact row clipped it)                                                        | the label ellipsizes at the row's width, full name in `title`                         |
| An entry's text             | could wrap inside itself (`Low (< 0.8)` over three lines, `Push` / `(≥70)`)             | never wraps: a threshold stays with its name                                          |
| Legend order at every width | zones and references before the series                                                  | series first, then zones and references; DOM order is the visual order                |
| A bottom-placed `Bars` key  | labels wrapped inside their column (`Under 1 % of` / `calls`)                           | each label is one line; the row wraps between entries when it must                    |

The 2.24 premise ("the title and tooltip name the series") is false for a multi-line chart: argo's
strength lifts and weekly volume (`+5` / `+3`), relative progression (`+2`), readiness (`+1`) and the sky
panorama (`+3`) were told apart by hue alone. A chart with only series therefore never shows a `+N`, and a reference folds only when it frees a line the series row would not need.

The fold is measured in the browser, so the server-rendered first paint shows the unfolded key until hydration.

Opt-out: `legend: false` still drops the key, and `naming="endLabels"` names the lines on the plot. To
keep a long zone name off the key, drop `ZoneSpec.legend` on that zone.

### Section subtitle and summary sizes (Wave 38)

**What 2.24.0 / 2.25.0 got wrong:** the summary cap was written as a `font-size` rule on
`.summary > .mantine-Text-root`, which outranks a consumer's own class. argo's reading backlog sets
its summary `Text` to 13 through a class, got 11 instead, and the shell held four sizes (title 15,
rows 13, row meta 12, summary 11). The `Section` subtitle itself was at 12 (`xs`) as promised;
argo's "subtitle" report was this summary line. Separately, a `<Text size="xs">` caption in a
`ChartCard` `actions` slot stayed at 12 beside the chart's 11 ticks: argo's strength / load / balance
shells held four sizes.

**Now:**

- The cap pins `--text-fz`, the variable `Text` reads, `!important`: a `Text` with a `size`, or none,
  in `Section summary` renders at 11; a `Text` sized by your own class keeps that size.
- A `<Text size="xs">` in a `ChartCard` `actions` slot renders at 11, the chart text step. `sm` and
  `md` figures are untouched.

**Opt out:** size the `Text` with your own class, or replace the `Text` with a plain `span` (summary) / give
it another `size` (actions).

| Shell (measured, 1440 and 390)                               | 2.24.0 / 2.25.0   | Now          |
| ------------------------------------------------------------ | ----------------- | ------------ |
| `Section` head: title, `subtitle`, `count`, body             | 12 / 13 / 15      | 12 / 13 / 15 |
| reading backlog: class-sized summary over rows               | 11 / 12 / 13 / 15 | 12 / 13 / 15 |
| strength / load / balance: `ChartCard` `actions` xs captions | 11 / 12 / 13 / 15 | 11 / 13 / 15 |
| strength diagnostics: `xs` summary                           | 11 / 13 / 15      | 11 / 13 / 15 |

### Hosted readouts and tooltips (Wave 38)

No export is removed or added. Three chart readouts keep what they print and stay where they belong.

| Surface                                    | Before                                                                                  | Now                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Sparkline` readout, tight                 | the " · " separator and its spaces collapsed (`62 bpm· 12 Oct`)                         | the separator and its air never drop; tightening only shrinks the chip's padding                                                  |
| `Sparkline` readout, stacked (hosted line) | value over date at the plot's top, over the plotted line                                | value over date placed where the line is not: the plot's top or bottom, beside the cursor, else hung below the plot               |
| Slotted `Bars` tooltip, `Sparkline` chip   | `--vx-tooltip-bg` (96% in dark): the card's footer ghosted through                      | the tooltip tint (`--vx-tooltip-bg`, or `--basalt-tooltip-surface`) layered over the opaque `--vx-surface-elevated`, both schemes |
| Chart tooltip at the first or last point   | placed against the viewport: it opened past the card's edge, over the neighbouring card | slid back inside its card (`ChartCard`, `StatCard`, strip cell) when the card is wide enough for it                               |
| Tooltip rows                               | the label column was one line with an ellipsis, so a figure in a label ended in `…`     | the label wraps at word breaks; the figure column never wraps or truncates                                                        |

Opt out: tint the tooltip and the readout chip with `--basalt-tooltip-surface` (a consumer's
`tooltipBg` palette entry is honoured the same way); either is layered over the elevated surface, so
the result stays opaque. `--basalt-spark-readout-lift: 0` still puts a one-line chip back in the
plot. The card clamp has no switch: render the chart outside a card and the viewport placement
stands.

## 2.25.0

_Nothing to migrate in this release._

## 2.24.0 — Wave 38, argo's friction III

### Section and Button chrome (Wave 38)

A Section shell holds three type sizes (title 15, note and count 12, body 13). Moved defaults:

| Surface                                            | Before       | Now       |
| -------------------------------------------------- | ------------ | --------- |
| `Section` / `WidgetHeader tier="section"` subtitle | `sm` (13)    | `xs` (12) |
| `SettingsRow` label                                | `md` (15)    | `sm` (13) |
| `SettingsRow` description                          | `sm` (13)    | `xs` (12) |
| `DangerZone` eyebrow                               | `micro` (11) | `xs` (12) |

Opt out: restyle the slot with `classNames.header` (Section / SettingsSection / DangerZone) or
`classNames.label` (`SettingsRow`).

An info bubble inside a `basalt-card` no longer flips above the glyph into the card above (it
covered that card's hero at 390): it opens below, slides up to fit, or flips only into room the card
owns, and never covers its own glyph. Outside a card the viewport flip is unchanged.

### Chart readouts and chrome (Wave 38)

No export is removed or added. Six chart defaults move.

- **`Sparkline` readout sits above the plot in a host that reserves a line.** In a `StatCard` sparkline
  slot or a strip cell's `visual` (the `VisualSlotContext` hosts; the sparkline carries
  `data-basalt-hosted`) the hover/focus chip no longer overlays the plotted line: it takes the reserved
  line above the plot (`--basalt-spark-readout-h`). A bare `Sparkline` is unchanged in kind: its chip
  stays inside its own box, on the half away from the point. A hosted chip slides with the point,
  so it stays inside the box at either edge and no longer truncates. A composite visual (a `Meter` above a
  `Sparkline` in one `StatCard` or strip slot) sets `--basalt-spark-readout-lift: 0` on its wrapper, or the
  chip lifts over the `Meter`. Opt out in a host: set
  `--basalt-spark-readout-lift: 0` on it to put the chip back in the box.
- **Hourly readouts name the hour.** `{ at, value }` points inside one UTC day read `0 runs · 14:00` (the
  clock alone); a window that crosses midnight (24 points from 12:00, or 12:00 to 12:00) reads
  `16 Oct 14:00`, so no clock repeats bare. Opt out: pass `labels`.
- **A bar tooltip stays under the card's headline.** `Bars` (any chart with a bar series) lowers the
  tooltip anchor, and steps it beside a tall bar, so its tooltip no longer opens over the header; the anchor
  is clamped into the plot. A short bar is unchanged. Opt-out: none (the tooltip's own `placement` is the
  engine's and not exposed; the old position covered the card's headline, so there is nothing to keep).
- **A compact y axis keeps a fixed domain's end.** At the compact width, `y.domain: [0, 25]` ticks
  `0 · 10 · 20 · 25` (the end joins when it leaves at least 40% of a step above the last tick; the uneven
  last step is intended), so a unit the formatter puts on the top tick survives at 390 px. Opt out: `y.ticks` (a count or exact values).
- **`Bars` series of one colour step down in shade.** Two or more bars sharing a `color`, none setting
  `fillOpacity` and no `barOpacity`, draw at full strength down to 0.4. Any stacked or normalized `Bars`
  where two bars share a colour also draws a surface hairline between segments. Opt out: set `fillOpacity`
  on a bar, or pass `barOpacity` (the shades), and give the bars distinct colours (the hairline).
- **`StackedArea` skips a band whose every value is `0`.** No band, legend entry or tooltip row; a `null`
  stays a gap and the band stays. Opt out: none (a zero band drew nothing but a legend entry; to keep
  the entry, give the band one non-zero value or pass `null` for the zeros).

### State defaults (Wave 38)

| Surface                               | Before                      | After                                                                                                  | Opt-out                                                                                                                           |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `LoadingState tier="section"`         | an accent `Loader` spinner  | three neutral `Skeleton` bars in an `<output>` named by `label`; the block grows from ~18 px to ~58 px | pass `loading` to `QueryState` with a skeleton in the loaded shape; a directly placed `LoadingState` is replaced by your own node |
| `LoadingState` (page tier)            | a `Loader` in the accent    | the same spinner in `VX.muted`                                                                         | no opt-out; the spinner is neutral by design                                                                                      |
| `BasaltDataTable` `query` error title | `Could not load`            | `Could not load rows`                                                                                  | no opt-out; the title is not a prop                                                                                               |
| `ChartCard` / chart error, no message | `The chart failed to load.` | `The request failed.` (the same fallback `ErrorState` shows)                                           | an `Error` with a message, or `state.error` as a string                                                                           |

### Strip and card (Wave 38)

No export is removed or renamed; four defaults move.

- **A strip footer entry `under` a cell is part of that cell.** It now renders inside the cell's slot, under its
  content, at every width, instead of in a footer-row grid column from 800px (and full width below). The cell
  grows by the footer, siblings keep their own height, and the footer follows its cell when the strip folds.
  `data-placed` and `--basalt-strip-footer-col` are gone; `data-strip-footer-cell` / `data-shot="strip-footer-<key>"`
  stay. An entry with no `under`, or one naming no cell, still takes the full row. No opt-out: put the meter in the
  cell's `visual`/`footer` if you want it flush, or drop `under` to keep the old full-width row.
- **`StatGroup` (grid) folds an odd count to a full-width last cell** below 480px, as the strip already did. Three
  cards were two plus a half-empty row. Opt-out for an odd count that should stay two-up: pad the group with a
  cell (an empty `div` spans nothing, so the last row keeps its half), or use `variant="strip"`, which has always
  spanned. An even count is unchanged.
- **A qualifier never truncates** (`StatCard` and strip cell). It stays on the caption row while it fits beside the
  caption and wraps whole to its own line under it otherwise, and wraps again there instead of ending in an
  ellipsis (the strip's qualifier also loses its `title`). A short qualifier in a narrow cell (`all time`) is no
  longer stranded alone on its own line. The cost: a qualifier that needs a second line pushes its own value down
  by that line, so a row-mate's value no longer shares its baseline. This holds at EVERY width (a ~300px cell
  wraps a long qualifier too), not only in narrow cells; only the wrapped cell's own value moves. Opt-out: shorten
  the qualifier, or state the band in `info`.
- **The `under` footer** is a sibling after the cell's `article`, outside its `aria-labelledby` region.
- **`BarList` delta column: glyph and figure are one unit**, end-aligned together. The fixed glyph slot and the
  four-character figure slot are gone, so `▲ 9%` and `▲ 13%` share a right edge but no longer share a glyph x.

### Nested radii (Wave 38)

The `ViewTabs` / `SegmentedControl` indicator and an inline `Code` inside an `Alert` sat 3 px under
their container (`craft-1/nested-radius-step`), which put them at 3 px: off the radius scale. Both
now snap DOWN onto the scale, so every radius is a § 5 step. Under the default 6 px container the
only step that keeps the 3 px step is 2 (`RADIUS_STEP.scaleXs`); under a container below 5 px it
is 0. Where the two rules cannot both hold, "every radius is a scale step" wins over the 3 px step.

|                                               | Before (2.23) | Now       |
| --------------------------------------------- | ------------- | --------- |
| `ViewTabs` indicator, default `radius`        | 3             | 2         |
| inline `Code` in an `Alert`, default `radius` | 3             | 2         |
| either, `radius` knob −5 / 0 / +5             | 0 / 3 / 8     | 0 / 2 / 2 |

Opt-out: restore the 3 px nested radius. The theme's `SegmentedControl` `styles` is a function, and
an object `styles` replaces it (dropping the track background, padding and label rules), so re-spread
its output:

```ts
type StylesFn = (theme: unknown, props: object, ctx: unknown) => Record<string, object>
const base = createBasaltTheme().components?.SegmentedControl?.styles as StylesFn
createBasaltTheme({
  components: {
    SegmentedControl: {
      styles: (theme, props, ctx) => {
        const b = base(theme, props, ctx)
        return {
          ...b,
          indicator: {
            ...(b.indicator as object),
            borderRadius: 'max(0px, var(--sc-radius) - 3px)',
          },
        }
      },
    },
  },
})
```

For `Code`, set `--basalt-code-radius` on the Alert root
(`.mantine-Alert-root { --basalt-code-radius: 3px }`).

### Meter captions (Wave 38)

No export is removed. `Meter` gains one optional prop, `readingAt`; six caption defaults move.

| Before                                                                                                                                                                                    | Now                                                                                                                                                                              | Opt-out                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| The reading caption (the default `format(value)` or your `startCaption`) sat at the track's start                                                                                         | It ends at the end of the fill, clamped inside the track (at the start when the fill is too short to hold it); a committed/forecast bar anchors at the end of the committed part | `readingAt="start"` (a pure opt-out; it does not opt out of caption dropping)                                        |
| The default target figure (`Target 28 sessions`) could wrap to two lines and clip at the card edge                                                                                        | It is one line and never wraps; your own `endCaption` is prose and still wraps                                                                                                   | none: shorten it with `format`                                                                                       |
| Captions that did not fit one line wrapped onto a second row                                                                                                                              | Tick captions go first, then the forecast caption, until the row fits; the reading and the target never drop. A dropped caption stays in the accessible description              | `startCaption`/`endCaption` state what stays; a host that wants a caption always visible gives the Meter a wider row |
| A zone name fell back to its `short` alone, so one zone read "Over" beside "Low", "Optimal", "High"                                                                                       | Once one name falls back to its `short`, every other name that has one follows; the holding zone keeps its full name                                                             | give the zones no `short`, or none will fall back                                                                    |
| On a zoned Meter, the figures at the track's two ends (ticks at `min` / `max`) shared the row below with the zone names and won every clash, so a name could vanish ("Good" beside "100") | They sit in a row above the track; the zone names own the row below and show whenever they fit their span. The zoned Meter is one caption row taller when it has end ticks       | none: drop the end ticks to drop the row                                                                             |
| Categorical part captions that did not fit under their segments wrapped, which could leave one entry alone on a second row                                                                | One row when they fit, else a grid with the most columns that fit and no lone entry on the last row                                                                              | none                                                                                                                 |

### Narrow legends and readouts (Wave 38)

No export is removed or renamed; one prop is added and two defaults move.

- **The compact legend is one row, and a zone-named chart has one.** Before: below 480px of chart width the key
  wrapped to as many rows as it had entries (five entries, two rows), so argo dropped it with
  `legend: false` and ACWR, recovery and stress read by hue alone at 390. Now: a chart with two or more legend
  entries shows a compact key there, and what does not fit folds into a `+N` chip whose `title` and hidden text
  list the folded names. **Superseded in the next minor** (`### Compact legends keep series`): this release
  folded SERIES names too and put the zone / reference entries first, on the premise that "the title and tooltip
  name the series". That premise is false for a multi-line chart, where the series are told apart by the legend
  alone; the fold now takes zone / reference entries only and the series lead. From 480px up the key wraps and
  shows every entry. An explicit `legend: false`
  still drops the legend at every width; delete the `compact && { legend: false }` workaround to take the new
  default.
- **`ZoneSpec.legend: { label, mark?, color? }`** names a band in the legend, so a zone chart needs no always-`null`
  legend-only series (argo's `ACWR_SERIES` zone keys). `mark` defaults to `'bar'`; `color` is the swatch when the
  fill is a whisper-alpha wash (`alpha(VX.goodSolid, 0.06)` would vanish in a 10px swatch), else the fill (a
  status tint maps to its solid). Named zones count as entries, so one series plus named zones now shows a legend
  by default. Opt-out: omit `legend` on the zone, or `legend: false` on the chart.
- **A `Sparkline` readout never ends in an ellipsis.** Before: a chip wider than the box was clipped (`62 bpm · Sun
  5 O…`, the date lost). Now: a chip that overflows first drops the air round its `·` and its padding, and if it
  still overflows the date moves to its own line under the value and wraps, inside the top band of the plot (never
  up past the host's reserved readout line). Opt-out: pass a shorter `labels` entry (`5/10`) so the one-line form
  fits.
- **A `StatCard` with a bleed sparkline reserves its readout line.** The sparkline slot and the foot's minimum height
  grow by the readout line less the card gap, so EVERY `StatCard` is about 10px taller (the foot's reserve is
  unconditional, so cards with and without a sparkline keep one height) and a hovered readout sits above the plot
  instead of on the delta / qualifier row. Opt-out: none; the reserve is the
  fix.

### `basalt-ui shot`: skeleton bars count as content (Wave 38)

`emptyRatio` now counts a `::before`/`::after` fill (Mantine `Skeleton` paints its bar there) as a painted box, so a card of loading skeletons no longer measures near 1 and no longer fails `craft-3`. A loading anchor's `metrics.json` `emptyRatio` drops; a genuinely blank card still reads 1. No opt-out needed.

### Section summary line (Wave 38)

**Before:** a bare `<Text size="xs">` passed as `Section summary` rendered at the size it asked for
(12). argo's strength diagnostics shell then counted four sizes: title 15, chart-card title 13,
summary 12, chart ticks and legend 11.

**Now:** a `Text` that is a direct child of the summary slot renders at 11 (the chart text step),
sized by a `size` prop or not. A `Text` sized by your own class keeps that size (see "Section
subtitle and summary sizes" below). A bare `Text` nested inside a `Group` keeps the size it asks for.

**Opt out:** replace the `Text` with a plain `<span>`, wrap it in a `Group`, or size it with your own class.

### Empty cells and Meters (Wave 38)

A gap is stated once. Moved defaults:

| Surface                                                    | Before                                                                                | Now                                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strip cell `state: { kind: 'empty', reason }`              | `—` in the value slot, the reason under it                                            | the reason in the value's place, no glyph (`data-strip-reason` replaces the `data-strip-value` hook on that cell); `—` and `data-strip-value` only when no `reason` is given |
| `Meter` with a null reading                                | muted track with a `—` caption line under it                                          | muted track, one blank caption line (two when zoned), no glyph, a visually hidden `No reading`; `emptyText` still wins                                                       |
| `Meter` `loading` (bar)                                    | track plus a short skeleton bar, about half the loaded height                         | the loaded footprint: figure row (zoned), track, caption / zone-name row                                                                                                     |
| Footer `Meter` captions in a strip (placed at their marks) | an end caption could wrap to a second line and spill out of its footer box            | every placed caption is one line (`nowrap`); a caption that does not fit drops, never wraps                                                                                  |
| `StatCard` qualifier in a card narrower than 240px         | beside the caption when it fit, under it otherwise, so siblings of one group differed | always on its own line under the caption (the reserved line is now always used)                                                                                              |

`size="row"` keeps no caption lines, empty or loading. Ring Meters are unchanged (the centre reading stays `—`).

Opt out: none for the caption and qualifier rows (they are layout fixes; shorten the text instead); pass `emptyText="—"` on a `Meter` to keep the dash caption; for a strip cell, drop `reason` (and say it in the caption or qualifier) to keep the bare `—`.

### Bars in a visual slot (Wave 38)

New capability, no behaviour moves for a `Bars` outside a slot; a `Bars` already in a slot loses its axes. A `Bars` rendered inside a
`StatCard` `sparkline` slot or a strip cell's `visual` now drops both axes, the grid, the plot margin
and the legend, and fills the slot like a `Sparkline`: the catalogue's "distribution as a slot
micro-visual". Nothing to opt into and no new prop; the slot is the signal. Give it the slot's box:

```tsx
<StatCard
  title="Pace"
  sparkline={({ height }) => (
    <Bars ariaLabel="Pace by book" data={bins} x={(d) => d.bin} height={height} bars={[…]} />
  )}
/>
```

The marks keep the house fills. The bins are named in the tooltip, which opens below the slot, so
5–12 bars read as a distribution, not a time series. A `Bars` you mount in a slot on purpose WITH axes
has no way back; use a `ChartCard` (the catalogue's "distribution as a card's subject").

### List and Meter card states (Wave 38)

No export is removed. `ChartCard`'s `placeholderHeight` gains the value `'content'`; the default is unchanged.

| Before                                                                                                                                                                                        | Now                                                                                                                                                                                                    | Opt-out                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| A `ChartCard` around a list or a `Meter` showed its error and empty state in a box at the chart height (or your `placeholderHeight` number) — about half void under Retry for a four-row list | With `placeholderHeight="content"` the error and empty state end at their content: one title, the cause, Retry, no void. A pending state leaves `children` in place, so the body draws its own loading | leave `placeholderHeight` off (or a number): D37 keeps the box |
| A `BarList` loading skeleton was fixed 1.5rem blocks, shorter than the rows it became                                                                                                         | The skeleton is real empty rows with a skeleton over each: it keeps the loaded height in the compact and the wide layout                                                                               | none: it is a layout fix, the rows are the list's own          |

A chart body keeps D37 (the loaded height) by default. `BarList`'s own empty line is unchanged.

### `shot detect` judges a nested radius (Wave 38)

`craft-1/off-scale-radius` now also reads every `nested` surface in `metrics.json`, not just the anchor, and names it in the defect (`nested <path> 3px`). The steps are the round's own `scale.radius`, so a `radius` knob shift moves them. An off-scale nested radius is always P1; the anchor's own radius keeps P3 within 1 px of a step. A round that was clean may now list a finding; the fix is the component's radius token, not a suppression.

### Guards

`raw-spacing` and `inline-spacing` promote from `warn` to `error`: their grace entries (since
2.16.0, re-dated to 2.24.0) came due at 2.24.0. `check-theme` now fails on a Mantine spacing prop
equal to a scale step (`p={16}`, `gap={24}`) and on an inline spacing literal (`style={{ padding: 16 }}`,
a CSS `padding: 8px`). The remedy is the scale: `xs` 8, `sm` 12, `md` 16, `lg` 20, `xl` 24 as a
prop (`p="md"`) or `var(--mantine-spacing-md)` in CSS. Measured before flipping: argo
`apps/dashboard` on 2.23.0 reports 0 findings of either kind; rb (2.13.1) and rollhook (2.11.1)
predate 2.16 and meet both rules on their next bump.

Opt-out: `"basalt": { "severity": { "raw-spacing": "warn", "inline-spacing": "warn" } }` keeps both a
warning; `"basalt": { "exemptRules": { "inline-spacing": ["<path>"] } }` silences one for a path.

`basalt/card-inset` is now `error` in the shipped preset (`warn` since 2.16.0; the redundant
`py="sm" px="md"` pair class since 2.20.0). It fails an explicit `py="sm" px="md"` pair on a `Card`
(the theme owns the 12/16 inset) and a partial inset. Delete the pair; for a flush card use
`variant="flush"` or `Card.Section`; for a deliberate exception write
`{/* theme-allow card-inset — reason */}`. Measured before flipping: argo already runs it at
`error` with 0 findings.

Opt-out: in the consumer's `.oxlintrc.json` set `"basalt/card-inset": "warn"`.

### Footer shot states and zone names (Wave 38)

No export is removed or added. `StatStripFooterEntry` gains an optional `shotAbsent`, and a zoned `Meter` names more of its zones.

| Surface                | Before                                                                                                                                                                     | Now                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatStripFooterEntry` | no `shotAbsent`: a footer entry production omits in a state (argo's budget poller line under `empty`) was recorded by `shot` as an `error` ("anchor absent in this state") | `shotAbsent?: readonly StatStripShotState[]` on the entry emits `data-shot-absent` on its `strip-footer-<key>` anchor and replaces the strip's `shotAbsent` for that entry, as a cell's does                                                        |
| `Meter` zone names     | a name wider than its own span hid or fell to its `short` even with free room beside it (argo's ACWR `Caut.` at 1440)                                                      | the zone names beside it slide inside their own spans and it takes the gap, centre kept in its span: the full name shows wherever the row has room, then the `short`, then nothing. The holding zone, ticks and the one-register rule are unchanged |

A row that is genuinely too narrow still hides a name (argo's ACWR at 390 has 22px where `Caut.` needs 25); the name stays in the described-by text.

Opt-out: none for the zone names; a zone that must keep to its span sets a `short` that fits it, and a page that does not want a footer entry's shot anchor omitted declares no `shotAbsent`.

## 2.23.0 — Wave 37, argo's friction II

No export is removed. `MeterTick` gains an optional `caption`; five Meter defaults move.

### Behaviour changes

| Surface                                                     | Before                                                                                                         | Now                                                                                                                                                                                                                | Opt-out                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Zoned Meter, end ticks (`ticks` at `min`/`max`)             | a zone name always won: at 390 the `2.0` / `100` end figure hid                                                | both end figures stay; a zone name that would touch one falls back to its `short`, then hides (still described). An end figure hides only when it cannot clear the other end, an interior tick or the holding name | none                                                      |
| Bar with `ticks` or `target`                                | no start figure                                                                                                | `format(min)` is labelled at the start of the track, above it                                                                                                                                                      | `startCaption={null}` (also drops the reading, as before) |
| Captions at their marks                                     | forecast and target captions anchored; two captions closer than a gap step sent the whole row back to the flow | closer captions are pushed apart, in order, the least that clears them; the flow is the fallback only when they cannot all fit inside the row                                                                      | none                                                      |
| `MeterTick.caption` (new)                                   | a tick's text sat in `endCaption` at the track end                                                             | `ticks={[{ at, label: 'Pace', caption: '14 sessions by 16 Oct' }]}` captions under the track, centred on the mark                                                                                                  | omit `caption`                                            |
| Categorical part captions that do not fit under their parts | an entry could wrap inside itself                                                                              | each entry (swatch, name, value) stays on one line in a wrapping row from the track's start; only an entry wider than the row breaks                                                                               | none                                                      |

`target` already captioned its value (`Target 28 sessions`, with `format`); `endCaption={null}` drops it.
An end figure that hides still reads in the accessible description.

### `BarList` and `Badge` defaults (lists and chrome II)

Two defaults move; `BarList` gains `secondaryAlign`.

| Surface               | Before                                                                                                                                                                                 | Now                                                                                                                                                                                                                                                                                                                                                      | Opt-out                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `BarList` `secondary` | one end-aligned column, so a status (dot plus word) had ragged dots; a long status ran past the track end at a phone width; a `DeltaBadge` column lined up on neither glyph nor figure | aligned by content: a string that is not a figure and a `StatusVerdict`/`StatusDot` start, a number, a numeric string and any other element end; a `DeltaBadge` gets a fixed-width glyph slot and a 4-character tabular figure slot inside the list, so glyphs and right edges line up; a status is clipped inside its cell and its word carries `title` | `secondaryAlign="start"` or `"end"` on `BarList` |
| `Badge`               | Mantine's `text-transform: uppercase`                                                                                                                                                  | the word as written (`Healthy`), for the status chip (SPEC § 6.10); a deliberate micro-caption passes `tt="uppercase"`, which is inline and wins                                                                                                                                                                                                         | `tt="uppercase"` per Badge                       |

`StatusVerdict`'s word now carries `title` (the `phrase`, else the word). `DeltaBadge` carries `data-delta` and its glyph
`data-delta-glyph`; outside a `BarList` it looks as before. A literal `"▲ 9%"`
string keeps the spacing its author typed — use `DeltaBadge` for a column of deltas.

No export is removed. Four behaviours move and one optional field is new.

| Surface                                   | Before                                                                                                                                                         | Now                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StatCard` in a container under 240 px    | caption and qualifier shared one nowrap line and both truncated (`TRAINING V…`, `month to…`)                                                                   | the qualifier takes its own line under the caption; a card with a qualifier, or in a `StatGroup` where one does, reserves that line so values share a baseline. Cost: a qualifier-less card in such a group is one caption line taller. The qualifier truncates (with `title`) only if it alone does not fit |
| `StatGroup variant="strip"` cell          | a subgrid on six shared tracks: a short visual or rows sat in the track its tallest sibling sized, so its box kept the sibling's void (`emptyRatio` 0.25–0.32) | a plain column that ends at its content; the slot still runs the row, so the dividers do. A cell's caption line is one line (qualifier beside it, truncating with `title`; in a narrow cell under it, reserved on every cell of a strip that has a qualifier), so captions share a top and values a baseline |
| `StatGroup variant="strip"` footer line   | a cell's footer (rows, visual, hero) sat on a track shared with its row-mates                                                                                  | a footer follows the cell's last part; **footer tops no longer align across cells**. Opt-out: none (a deliberate law change; pin a shared footer with a `footer[]` entry under the strip instead)                                                                                                            |
| `StatGroup variant="strip"` empty / error | the state copy sat flush on the cell's bottom edge                                                                                                             | the cell's inset (`stack-md`) on every side                                                                                                                                                                                                                                                                  |

Tests that pinned the old law and were rewritten: `strip-align.layout.test.ts` (`compact: … per-footer-track tops are equal`, `a mixed row keeps one top per footer kind`: footers now hug their own part; `no cell has a void beyond one row-gap` lost its sibling-slack allowance) and `stat-strip.test.tsx` (`the caption group never wraps; …`: the wrap is the narrow-cell container query, not the default).

### `footer[].under` (new, optional)

`footer={[{ key: 'week', under: 'spend', content: <Meter … /> }]}` — from 800 px the entry sits in
the column of the cell whose `key` is `under`; an entry without `under` then takes the full row.
Below 800 px, and for a key that names no cell, nothing changes: full width under the grid. Opt-out:
omit `under`.

No export is removed and none is added. `Sparkline`'s `data` widens, and six chart defaults move.

### Behaviour changes

| Surface                                                          | Before                                                                                                                      | Now                                                                                                                                                                                   | Opt out                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `Sparkline` readout placement                                    | a chip above the plot box, over whatever the host draws there (a card's delta period) and clipped by a host slot that clips | inside the plot box, beside the hovered point on the roomier side (flips at the edges) and on the half of the box away from it                                                        | none: the chip no longer leaves the box |
| `Sparkline` readout label                                        | only a consumer's `labels` named the point                                                                                  | `data` may be `{ at, value }` points (`at`: Date, epoch ms or ISO string); the readout names the day (the hour when the points share one day) in the page locale; `labels` still wins | keep `data` a `number[]`                |
| `Bars` hover                                                     | the engine's point marker drew on the hovered bar                                                                           | bar chrome only (the hovered x at full strength)                                                                                                                                      | none                                    |
| Reference caption on a band x                                    | could sit over a bar taller than its line                                                                                   | treats each bar as a filled column and takes the first clear spot                                                                                                                     | `RefLine.labelPosition` pins one        |
| Date tick labels                                                 | `DD.MM`, whatever the page locale                                                                                           | the day and month in the page locale (`4 Oct`, `Oct 4`), the runtime's with none set: the same source as the tooltip header                                                           | `formatX`                               |
| `Lines` end label that flips left of a falling line's last point | drawn above it, across the last segment                                                                                     | drawn below it (above for a rising line)                                                                                                                                              | `naming: 'legend'`                      |
| Errored `ChartCard` / chart                                      | the anatomy (dot, title, message, Retry) was centred vertically in the chart's height                                       | top-aligned in the same height: the frame keeps its size (no jump when a fetch fails), the room sits below the content                                                                | none                                    |

A `StatCard` / strip-cell sparkline slot still reserves the old readout line above its plot
(`--basalt-spark-readout-h`); the chip no longer uses it.

A histogram that marks its median as a second series names the count through the series' own
`formatValue` (`(v) => \`${v} days\``): a `Bars` tooltip row already takes it, and a bin lists only
the series that has a value for it.

No export is removed. One default moves.

### Heading digits come from the sans face

Hubot Sans has no `zero` OpenType feature and its default zero is slashed, so the 2.22.0
`:root { font-feature-settings: 'zero' 0 }` reset was a no-op and head-face titles still showed
`3Ø days`. `styles.css` now declares `@font-face 'Basalt Head Digits'` over the Nunito Sans variable
file, `unicode-range: U+0030-0039`, and `--basalt-font-head` leads with it: Hubot draws the letters,
Nunito the digits, in every h1–h6, Mantine `Title` and CSS-module title that reads the var. The no-op
reset is removed. `basalt-ui fonts:css` emits the same face.

**Opt out:** set your own `--basalt-font-head` (or `createBasaltTheme(_, { fonts: { head } })`); a
head stack that does not lead with `'Basalt Head Digits'` draws Hubot's own digits, slashed zero
included. Stretch: the digit face has no `wdth` axis, and neither does the shipped wght-only Hubot Sans file,
so `--basalt-font-head-stretch` (88%) condenses neither letters nor digits today and they cannot
mismatch. A consumer who swaps in a `wdth` cut of the head face gets condensed letters over
full-width digits. The face costs no extra download beyond the Nunito latin file `styles.css` already loads.

### `Meter`: muted zones and segments share one flat fill

`tone: 'muted'` on a `MeterZone` or `MeterSegment` no longer steps lightness per part (2.22.0's ramp):
an outer non-verdict band read as a value bar. Every muted zone now takes one flat `--vx-muted` fill
(35%) and every muted segment one flat fill (65%, 3:1 on the track). Neighbours are told apart by the
1px gap every zone after the first already leaves (the track shows through; no change there), a 1px
track-coloured seam between muted segments, and their names; the marker stays the only strong mark.
`data-meter-zone-seam` / `data-meter-seam` are test hooks, not styling API. The plain zone ramp (no `tone`) is unchanged, and a `color` still wins.

Opt-out: give a zone or segment its own `color`, or drop `tone` for the line ramp.

### `shot` desktop hover reports a hovering fine pointer

A headless Chromium with no pointing device reports `(hover: none)` / `(pointer: coarse)`, so no
`@media (hover: hover)` rule (Mantine's filled `Button` hover, any consumer hover) applied in a
desktop hover shot and the crop looked identical to rest. The launcher now starts Chrome with
`--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`;
the mobile viewport (`hasTouch`) keeps `hover: none` / `pointer: coarse`. Desktop hover crops of
filled controls now differ from rest, so a committed baseline of them will diff once. No opt-out:
the previous crop was the defect.

`shot detect`'s `craft-7/no-declared-states` is now **P2** (reported, exit 0) instead of P1, and only
fires on a route with an anchor that renders a state surface (`ChartCard`, `StatCard`, a chart
state); it names those anchors and the `data-shot-states="empty loading error"` to add. A route
without one gets no finding. A consumer that gated on exit 2 for it no longer does.

### Chart header, label and tick behaviour (round r3)

No export is removed and none is added. Seven chart defaults move; the first is the only one a consumer
can see change on a page that was fine before.

| Surface                                                            | Before                                                                            | Now                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooltip header of a day-granular Date x under a consumer `formatX` | the tick format (`2 Sep`): weekday and year lost, though this file said otherwise | weekday, day, month and year in the page locale; `formatX` shortens the ticks only                                                                             |
| `Sparkline` `referenceLabel`                                       | centred 4 px above its dashed line (struck through) at the plot edge              | clear of the line (above, or below when the line is near the top), 3 px inside the plot start                                                                  |
| `ChartCard` `facts` `period` list behind a `unit`                  | `['basis']` ran into the unit; the separator joined between items only            | `· basis`: the list leads with `·` behind a `unit` (an item already led by `·` is not doubled)                                                                 |
| Y tick labels when every tick is whole                             | a padding formatter printed `2.0 s`                                               | `2 s`; the tooltip keeps the full format                                                                                                                       |
| `BandStrip` glyph                                                  | drawn from a 12 px cell, unreadable                                               | drawn from a 16 px cell (`Heatmap` keeps 12 px); a narrower warn/bad cell draws a bottom notch in its own fill pulled to the ink (3 px warn, 6 px bad) instead |
| Empty chart (`state={{ empty: true }}`) with no label              | the bare filler `No data`                                                         | `Nothing recorded in this range.`; a string `empty` still wins                                                                                                 |
| `Lines` end label near the plot's top or bottom edge               | its flip offset could push it outside the plot (`Low` clipped)                    | its centre stays 7 px inside the plot                                                                                                                          |

Opt-out for the header: `tooltip={{ formatHeader: (x) => yourFormat(x) }}` restores any title. The
`period` string form is unchanged (write it with its own `· ` as before).

### Strip `shotAbsent`; `Meter` prints no filler; nested radius steps

`StatGroup variant="strip"` takes `shotAbsent?: ('empty' | 'loading' | 'error')[]` on the group (every
derived cell and footer anchor then carries `data-shot-absent`) and on a cell (replaces the group's for
that cell). Additive.

A `Meter` with no reading no longer prints `No data` under the track: the reading is `—` and there is no
caption. Opt-out: pass `emptyText` for the caption you want.

Two nested radii step down so `craft-1/nested-radius-step` passes: an inline `Code` inside an `Alert`
is 3 px under the Alert's radius (was the tight 5 px), and the `SegmentedControl` (`ViewTabs`) indicator
is 3 px under its own track radius (`--sc-radius` − 3, so a custom `radius` nests too; was 4 px at the
default). The indicator change is global, not limited to card headers: the track-to-indicator gap was 2 px
everywhere and the nested-radius lint step (≥ 3 px) wins over exact concentricity.

A strip cell's error body now says `Could not load` instead of `Failed`, matching the card, query and table wording.

Opt-out: `Code` has no `radius` prop — set `--basalt-code-radius` on an ancestor or `styles={{ root: {
borderRadius } }}` on the `Code`; for the indicator, `styles={{ indicator: { borderRadius } }}` on the
`SegmentedControl`.

### One error wording, bar Sparkline hover chrome (round r2)

No export is removed and none is added. Two defaults move.

| Surface                      | Before                                     | Now                                                                   |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `ErrorState` with no `title` | `Something went wrong`                     | `Could not load`, the wording every other error default uses          |
| `Sparkline mark="bar"` hover | a point marker and a leader dot on the bar | none: the bar and the readout chip are the marker (a line keeps both) |

Opt-out: pass `title="Something went wrong"` to `ErrorState`. The `BasaltDataTable` error
already renders the shared anatomy (status dot, title, message, Retry); an app that rebuilds it with
`EmptyState` and a search glyph should drop that and pass `query`.

### Guards

`series-palette` promotes from `warn` to `error`: its grace entry (since 2.21.0) came due at 2.23.0.
`check-theme` now fails on a series file whose palette misses a computed check (lightness, chroma,
colour-blind separation, worst pair, contrast, group size); the fix is to retune the hex in the
series file. Measured before flipping: argo `apps/dashboard` on 2.22.0 reports 0 findings.

Opt-out: `"basalt": { "severity": { "series-palette": "warn" } }` keeps it a warning;
`"basalt": { "exemptRules": { "series-palette": ["<series file>"] } }` silences it for the file.

## 2.22.0 — Wave 37, argo's friction II

No export is removed. Five defaults move and one export is new.

### `PageSummary` (new export)

`import { PageSummary } from 'basalt-ui'` — the SPEC § 6.9 page-summary recipe: `sentence` (must carry
a live number), `facts` (`null`/`false` drop; sans `xs` muted, `·` separators that never lead a wrapped
line), `aside`, and `loading` for a same-shape skeleton. argo's `components/upstream/page-summary.tsx`
is deleted in favour of it; its `facts` were mono, they are sans now (D33) — a fact that is a time may
wrap itself in `<span style={{ fontFamily: 'var(--basalt-font-mono)' }}>`.

### Behaviour changes

| Surface                              | Before                                                                 | Now                                                                                                                                                                                                                                                                                              | Opt-out                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `Section` with `tabs` and no `title` | `title` was required, so a tabs-only switch carried a restated heading | `title` is optional when `tabs` is given: no heading, no fold, the header row is the tabs; a `ViewTabs` names its own tablist, so the section adds no second name (pass `aria-label` for tabs that are not self-naming); `count`, `info`, `subtitle`, `icon` and the hero metric are type errors | pass a `title`                                          |
| `Section` `group` tier heading       | `micro` (11)                                                           | `xs` (12), the step the rows' meta already use: three sizes where argo counted four                                                                                                                                                                                                              | none; the rank still reads from case, face and tracking |
| `SyncButton scope="page"` below `sm` | icon only                                                              | icon plus a short locale-narrow age (`2m`, `2 Min.`, `now`), one line, content-width; no age → the square icon as before                                                                                                                                                                         | omit `lastCompletedAt`                                  |
| Filter pill (`PageBar filters`)      | clipped at `15rem`                                                     | fits its selected option up to `24rem`, then truncates with the full name as `title`                                                                                                                                                                                                             | none                                                    |
| `ViewTabs` phone `Select`            | 10.67 px inline-start inset                                            | the `ctl` inset (10 px), the buttons'                                                                                                                                                                                                                                                            | none                                                    |

The sticky-PageBar anchor clearance argo filed (`--vx-space-sticky-header-clearance` 12 px vs a 36 px
bar) needs no change: a shell-less `Section id` already adds the bar's published height
(`--basalt-page-bar-h`), and in `BasaltShell` both bars sit outside the scrollport. `section-anchor`
now pins the title, not just the root, at 390 and 1440.

### Chart facts, sparklines and strips gain tone, glyph and focus

New, additive: `ChartFact` takes `tone` (`good` / `warn` / `bad` / `muted`: ink only, never a fill)
and `period` takes a list, joined by `·`; `ChartCard` takes `stale` (the facts dim to the strip
cell's 0.55 while placeholder data shows) and `stateNoun` (an errored card reads "Could not load
{stateNoun}"); `Sparkline` takes `tone="muted"` and `referenceLabel`; a state of `BandStrip` or
`Heatmap` takes `glyph` (drawn centred in each of its cells wide enough for it, 12px); a `Heatmap`
state takes `tone` (`good` / `warn` / `bad` / `neutral`) instead of a `color`. A categorical status grid is therefore `states` + `getState` with a
`tone` per state, nothing read from `dist`.

**Changed defaults:**

- A failed `ChartCard` / `ChartPlaceholder` used to read "Could not load this chart"; it now reads
  "Could not load". **Opt out:** `stateNoun="this chart"` on the card restores the old words.
- The `Sparkline` readout reads the value, then the day (`3 items · 12 Oct`, the label in the
  proportional sans, no longer mono and first), and rides the hovered point instead of sitting
  at the opposite corner. **Opt out:** none for the placement.
- A line `Sparkline`'s plot has a 3px margin so its end marker clears the keyboard focus outline;
  the line is 6px shorter in each axis. **Opt out:** none.
- A `BandStrip` or `Heatmap` state whose `color` is `VX.status.warn` / `VX.status.bad` (or whose
  `tone` is `warn` / `bad`) now draws `!` / `×` in its cells wide enough for it, in the panel
  surface ink. **Opt out:** `glyph: ''` on the state.
- A `Heatmap` tooltip opens below the hovered cell (above only when there is no room), so it no
  longer covers the caption row over the grid. **Opt out:** none.

### Chart chrome: tooltips, ticks, reference captions and the `Lines` defaults

Wave 37, the cartesian half. Every change below is a default; the opt-out is named in each line.

- **`Lines` and `Bars` line overlays default to `curve: 'linear'`.** Discrete daily or monthly values
  are joined by straight segments; the smoothed curve drew crossings between points that never
  happened. **Opt out:** `curve: 'monotone'` on the series (a continuous measure). `StackedArea` and
  `Sparkline` are unchanged.
- **A single-series chart draws no legend.** The title, the axis and the tooltip name it.
  **Opt out:** `legend={{}}` (any explicit `legend` config draws it).
- **`Lines` takes `naming?: 'auto' | 'legend' | 'endLabels'`.** `auto` (default): from the wide class
  a chart of up to three lines and no `y2` names them with end labels and its legend is hidden; below
  wide the legend names them and no end label draws. A chart whose legend names more than its lines (a
  `y2`, a legend-named `refLines` entry, a `role: 'reference'` series) keeps the legend at every width
  and draws no end labels, as does one whose last point a narrower `xDomain` clips. From the wide class
  the legend's series toggle is gone with the legend. Two end labels that collide are now spread apart
  instead of both dropped. **Opt out:** `naming="legend"` for the old always-legend chart (toggle kept); `naming="endLabels"` for end labels
  at every width and no legend.
- **The tooltip header reads the page locale and drops a clock time a daily bucket never had.** It
  was `Mon Sep 1 2026` (a fixed US order) and printed `22:00` for a bucket keyed by a local midnight
  east of UTC. A day-granular x (every step at least a day) is now the date only — weekday, day, month,
  year through `Intl` in the locale `BasaltProvider`/`defineFormat` set, on the nearest UTC day; a
  sub-day x adds `HH:MM`. **Opt out:** `tooltip.formatHeader`.
- **A lone series whose formatted value already ends in its own name prints the name once**
  (`Sessions` / `27 sessions` is `Sessions` / `27`). **Opt out:** `tooltip.rows` for a custom row, or a
  `formatValue` that omits the unit.
- **The tooltip name column never wraps.** It keeps a 6rem floor, stays on one line and ends in an
  ellipsis past 14rem; the value stays right-aligned. No prop; the full name is in the tooltip's
  accessible label.
- **Y tick labels always sit in a gutter outside the plot.** The compact-and-short mode that drew them
  inside the plot, above their grid line, is gone (a line ran through the label). The plot is
  correspondingly narrower on a chart under 180 px tall at the compact width. **Opt out:** none.
- **An auto y domain ends on a tick at or above the data's maximum.** The padded top could fall
  between ticks, so the line peaked above the last label (`4` as the top tick for a series reaching
  `5`); the domain now rises to the next tick. **Opt out:** `y.domain` as a tuple or function, or
  `y.nice`.
- **Ticks and the legend share one size step** (the 11 px tick step, `VX.text.micro`); the legend was
  12 px. `VX.legendFontSize` is deleted (nothing else read it): use `VX.text.micro`. A bar legend swatch is one rounded
  square at every width (it was a circle below 480 px).
- **`Bars` hover highlights the bar** (the hovered x paints at full series strength) and paints no
  crosshair rule; the rule is line-chart chrome. **Opt out:** none.

New, additive:

- **`RefLine.labelPosition`:** `'end-above' | 'end-below' | 'start-above' | 'start-below'` pins the
  caption's spot. Without it the caption takes the first spot (the plot's end above the line; the
  start for a right-axis line) that stays inside the plot and that no data line runs through, so a
  line in the top or bottom quarter, or one a series ends on, moves its caption instead of sitting on
  the data. **Opt out:** pin the old spot with `'end-above'`.
- **`StackedArea` `fillOpacity`:** every band's opacity, 0–1; a band's own `fillOpacity` wins. The
  default (0.85) and the legend swatch are unchanged without it.

### `Meter`: the reading once, muted zones, stops, ring ticks, captions at their marks

New, additive (a `Meter` that passes none of them draws as before):

- `reading={false}` — a zoned bar prints no reading at its marker (the marker keeps its
  `aria-valuenow` / `aria-valuetext`). Inside a basalt host (`StatCard` slot, strip `visual`) it was
  already dropped; pass `reading` there to print it. Use it when your own headline states the value.
- `track={false}` — a `value` bar with no `target` and no `ticks` draws no track (still `role="meter"`).
- `tone: 'muted'` on a `MeterZone` or `MeterSegment` — a muted lightness ramp instead of the line ramp.
- `shape="ring"` takes `target` and `ticks`: a short radial mark at the value, listed in the
  described-by text; the value stays centred.
- `stops: { at, color }[]` on a `value` bar — one gradient track through your colours with the reading
  as a marker; no labels unless `ticks` are given.
- A plain bar or ring with no `tone` / `color` takes its host's verdict tone once a host passes one.

Changed behaviour (no API change):

- **Captions sit at their marks.** The forecast caption and the target caption are centred on their
  tick (clamped inside the track) instead of at the track end, whenever every caption fits a gap step
  apart; otherwise the row flows and wraps as before. **Opt out:** pass your own `endCaption` (it stays
  at the end as written); the forecast caption has no opt-out beyond `forecastCaption`.
- **Ticks keep a gap step from zone names, and the end tick yields.** A tick on the zone row now keeps at
  least `--vx-space-control-gap` from every label (it was "not touching"); zone names among themselves
  keep the old rule. A zone name
  that clears the holding one is placed before a tick at the track's start or end, so that end tick
  hides where it would touch the name (a zone name used to lose to it); interior labelled ticks still
  beat a name. A hidden name or tick stays in the described-by text. **Opt out:** none; give the zone a
  `short` label.
- **The uncoloured zone ramp is floored at 15 points per step**, so five or more zones step further
  apart than before (cap 95 %); `tone: 'muted'` uses the same ramp. Up to six zones (five segments)
  stay distinguishable by lightness.
- **`size="row"` keeps categorical part captions** (swatch, name, value); it dropped them before, so
  the parts were unnamed. **Opt out:** none for `segments`; a `value` bar is unaffected.
- **Part captions never wrap inside themselves** while they fit: each sits under its own segment when
  all of them fit there, else the wrapped list (a caption wider than the row still wraps).

### Strip cells end at their content (`StatGroup variant="strip"`)

**Changed:** each strip cell now spans only the shared tracks down to its last part, so a cell's own
box (`[data-strip-cell]`, `data-shot="strip-<key>"`) ends at its content instead of filling the row
height. Captions still share one top and values one baseline across a row; a footer under a hero
alone now has its own track right under the hero (it hugs the value, and sibling footers share one
top); a rows cell's footer keeps the shared footer track. The vertical dividers moved from the cell
to a row-high `[data-strip-slot]` wrapper, so they still run the full row and the area under a short
cell is the strip's own surface. The cell's foot inset moved to the slot with them. `stale` dims the cell content only; the dividers on
the wrapper stay at full strength.
**Affects you if** you selected `[data-strip-cell]` for its height or its box-shadow, or painted a
background on it. **Opt out:** none needed for markup; a custom rule that needs the old full-row
cell can target `[data-strip-slot]` instead (it is the row-high box). No per-cell `align="stretch"`
was added: no consumer case needs it.

A strip footer-row entry that is a `Meter` now keeps its start and end captions together
(`Today €5  €5 left of €10`) instead of at the two ends of a wide track.

New, additive: `StatStripCell.action` (a control at the end of the caption line; the caption
truncates first, so it never wraps the line), and `StatStripRow.hideValue` (print the row label
only, for a reading the hero already shows; `value` is ignored).

### A cell's `tone` colours its visual

A strip cell's `tone` (and `StatCard`'s) now also reaches a plain `Meter` in its `visual` / sparkline
slot as the fill's verdict colour, not just the value. **Opt out:** give the `Meter` its own `tone` or
`color`.

### `StatCard` states

**Changed:** in the `empty` and `error` states the `subtitle` footer is no longer drawn (it captioned
a sparkline that is not there). The default error title is `Could not load` (was
`Could not load this figure`) so the error line stays on one line in a two-column phone card. A
`qualifier` in a card narrower than 240px (a two-column phone cell) no longer wraps under the caption:
it truncates, with the full text in its `title`, so the value keeps its row neighbours' line. That
is the whole guarantee: in a card of 240px or more a long qualifier still wraps and moves the value
down a line (measured: 10px at a 304px card). **Opt out:** put the
text in `info` or `subtitle` instead of `qualifier`; for the error title, render `ErrorState` yourself.

### `BarList` in a wide container

A thin `BarList` in a container 480px or wider now lays each row out as `[label][value][secondary][track]`:
the label column fits the longest label (capped at 40% or 14rem, truncating with its `title`), value and secondary
are right-aligned and shared by every row, and the bar track takes the remaining width on the one shared
scale. Compact containers keep the stacked layout. Every state (list, loading, empty) is now a `div`
frame around the list, and `className` / `style` land on that frame. The frame is a size container
named `basalt-card` (the only names the theme guard permits) with `inline-size: 100%`: it shadows an
enclosing card's container for the list's descendants only, and the 480px threshold measures the list's
own width. Opt-out: `variant="inline"` is unchanged; to keep the stacked
thin layout in a wide card, constrain the list's width below 480px.

### `basalt-ui shot` captures tall anchors and keeps chrome off crops; `init` wires a stock Vite app

**Changed:** an anchor that is not rendered at a viewport (a hidden mobile pane, `display: none`) now
fails in under 5 s with the reason, where it used to wait out a 30 s Playwright timeout: a hover,
focus or tooltip shot is recorded `absent`, a `rest` shot stays an `error` unless the anchor
declares `data-shot-absent="rest"`. A hung step costs 5 s, never 30. Crops of an anchor hide the shell's fixed and
sticky chrome (PageBar, mobile bottom nav) for the shot, and an anchor taller than the viewport is
captured whole (the viewport grows for that shot). The `_page` shot grows the viewport by what an
inner scrollport hides, so it reaches the end of the page at 390 with the chrome kept. Focus, hover
and tooltip crops read the anchor's box once it stops moving. A route whose anchors declare no
`data-shot-states` logs a warning, its URL-state shots carry the note `page declares no
data-shot-states`, and `shot detect` reports it as `craft-7/no-declared-states` (P1, exit 2).
**Opt out:** none for the capture; declare `data-shot-states` on an anchor (`empty loading error`)
to clear the finding.

`basalt-ui init` over an unmodified create-vite `src/main.tsx` now replaces it with the seeded entry
and adds the peers `basalt-ui` imports (Mantine, TanStack Router and Query, the three fonts,
`motion`) to `package.json` `dependencies`; it prints `bun install` and never installs. An edited
`main.tsx` is still left alone, with the wiring steps and the missing peers printed. **Opt out:**
edit `main.tsx` before running `init`.

### Selected Tabs are ink in every variant

**Changed default:** the selected `pills` tab filled with the accent and the `outline` border took the
default border; both now follow `default`'s underline and read by ink. The pill is an ink-mixed
panel with an ink label, the outline border is ink. **Opt out:** pass `color="blue"` (any
colour) and the tab keeps its hue and the on-colour label.

### A status `Badge` is a dot on the neutral surface

**Changed default:** the `light` Badge (the theme default) painted a tint of its colour, so a row of
status chips read as coloured slabs. It is now the subtle surface with an ink word, and a named theme
colour (`color="green"`, `"red.6"`, `"#e03131"`, a var) adds a leading 6px dot in that colour; an unnamed or `gray` chip has no dot.
A `leftSection` or `rightSection` replaces the dot. `filled`, `outline`, `dot` and `default` are
unchanged, so an accent count keeps its fill. **Opt out:** `variant="filled"` for the old strong chip,
or a per-site `vars` with `--badge-bg` and `--badge-color` for the tint.

### Disabled Button and the icon-side inset

**Changed default:** a disabled `Button`/`ActionIcon` has one ink-mixed panel surface in both schemes
(dark had none and read as the subtle variant). A `Button`'s `leftSection`/`rightSection` inset now
equals its text side (it was one scale step tighter: 8/12, 12/16, 12/20), so an icon Button is
balanced and one step wider. **Opt out:** set `--button-section-padding-x` on the Button.

### No slashed zero in titles; no mono ligatures

**Changed default:** `:root` resets the `zero` feature (its off state; nothing in the package turns it
on), so every head-face surface (headings, `Title`, section/card/widget titles, a CSS-module class that
only sets the family) inherits a plain zero: `2026` and `90 days` no longer carry a slashed one.
`font-variant-ligatures: none` applies to `code`, `kbd`, `samp`, `pre`, `[data-numeric]`,
`[data-monospace]`, a `ff="monospace"` Text and `Code`/`Kbd`, so `<>` in a facts line is two
characters; body sans keeps its ligatures. Mono-only CSS-module classes are not reached by the
ligature selectors (follow-up). **Opt out:** an unlayered `font-feature-settings` or
`font-variant-ligatures` on the element.

### Chart focus ring

**Fixed:** the chart host's keyboard focus ring was the UA ring (white in dark); it is now
`2px solid var(--vx-accent)`, like every Mantine control. It was never a mobile or coarse-pointer
branch: no `mantine-focus-*` class reaches the host, so the UA drew it at every width in dark.

### `VX.surface.rowHover` and `VX.surface.rowSelected`

New, additive: `--vx-surface-row-hover` and `--vx-surface-row-selected`, typed on `VX.surface`. The
panel mixed toward the ink (5% / 7.5% light, 7% / 9% dark), so a hovered or selected row on a panel
reads in both schemes where `panelHover` (lighter than `panel` in light) does not. Replace a
hand-rolled `color-mix(in srgb, var(--vx-ink) N%, …)` row wash with them.

**Changed default (derivation):** the row surfaces join the status-text solve, and every text colour
clears 4.5:1 on both. At the default config three status hexes moved to clear them: good light
`#327a4d` → `#2f774b`, warn light `#966200` → `#935f00`, bad dark `#f97d74` → `#fe8178`; and the dark
`faint` ink `#a1a1a4` → `#a7a7aa` (tone 66.24 → 68.5). **Opt out:** none for the hexes; a consumer
that pinned them reads them from `VX.status.*` / `VX.faint`.

## 2.21.0 — strip cell state, one Retry, and the marker reading

### One Retry in the shared error anatomy

**Changed:** `ErrorState`'s Retry (and so `StatCard`'s) is now a plain button shared with `ChartCard`
and the strip cell error, styled from the same tokens as the Mantine `size="xs" variant="default"`
Button it replaces (panel fill, `shadow-raised`, control radius, 30px). A refetch in flight now
disables it and sets `aria-busy` instead of showing Mantine's loader overlay. **Opt out:** render
your own Mantine `Button` through `ErrorState`'s `action` and omit `onRetry`.

New, additive: `ChartCard` takes `onRetry` and `retrying`. An errored `state` then shows that same
Retry under the message, before `stateAction` (which stays for other actions). Without `onRetry`
nothing changes, so a consumer passing its own Retry through `stateAction` keeps it — drop it for
`onRetry` to match `StatCard`.

### `StatGroup variant="strip"` cells take `state`

New, additive: a cell's `state` is `{ kind: 'empty', reason? }` or `{ kind: 'error', error?, onRetry?,
retrying? }`. Empty shows `—` in the value position plus the muted reason; error shows the compact
error anatomy (status dot, `Failed`, the message, Retry). Either replaces the cell's hero, `visual`,
`rows` and `footer`; the caption stays and `loading` wins while pending. Before, both read as `—`
with a footer note.

### A zoned `Meter` names each zone under its own span

**Changed default:** zone names were left-aligned at their band start and wrapped into a list when two
touched. They now sit centred on their zone's span in one label row; a name wider than its span (or
clashing with a tick) hides instead of wrapping, and every zone stays named in the accessible
description. Labelled `ticks` on a zoned `Meter` join that row at the track's ends instead of floating
above the track, so the Meter has at most one caption line below. A plain tick `Meter` is unchanged
except that two colliding tick captions now hide the later one instead of wrapping to a list.
An end tick yields to the holding zone's name; the holding name never hides for width. **Opt out:** none for the placement; render a legend yourself from the same zones if you need every
name visible at any width.

### `MeterZone` takes a `short` label

New, additive: `{ from, to, label, short? }`. A zone name too wide for its span now falls back to
`short` before it hides; the holding zone keeps its full `label`, and the described-by text still
names every zone in full. Without `short` nothing changes. **Opt out:** omit `short`.

### A zoned `Meter` in a hero host no longer prints the reading at its marker

**Changed default:** a `Meter` with `zones` inside a `StatCard` `sparkline` slot or a strip cell's
`visual` drew the reading at the marker beside a hero showing the same number. Those hosts now
suppress it; the track, marker and zone labels stay, and a standalone `Meter` is unchanged.
**Opt out:** render the reading yourself where you want it (the value is in the Meter's `aria-valuetext`),
or place the `Meter` outside those two slots.

### `Meter`: the non-verdict fill is now muted

**Changed default:** plain `value` bars only (no `segments`, no `zones`, no `color`, no `tone`);
`segments` (incl. forecast) and `zones` keep today's fills. A bar `Meter` with no `color` used to
draw the full ink fill (`--vx-line`), near-white in dark. With no `color` and no `tone` it now draws
`tone="muted"` (`--vx-muted` at a strength that holds 3:1 against the track in both schemes).
Verdict colours (`color`, status tones) are unchanged; the ring is unchanged. Opt out: `tone="ink"`.

### `BarList`: the thin track is the default

**Changed default:** `variant` is now `'thin' | 'inline'`, default `'thin'`
(label on its own line above a thin bar, value right-aligned). The old default look is
`variant="inline"`. The `'default'` literal is gone, so `variant="default"` is a type error: replace
it with `variant="inline"` to keep the heavy label-in-track slabs, or delete the prop to take thin.
`variant="thin"` is now redundant and still valid. The root now always carries `data-variant`
(`thin` or `inline`) — it was absent on the old default, so `[data-variant]`-absent selectors must
become `[data-variant='inline']`.

### New guard kind `series-palette` (ships `warn`)

`check-theme` now judges the series module (`basalt.seriesModulePath`, default
`<root>/lib/series.ts`) — the file the line scan exempts. Each `defineSeries({...})` call is one
ordered categorical group; each scheme is measured against its own surface (the derive engine's
default `surface.panel`; a consumer's `derive` overrides are not read). One finding per failed
check, naming the key(s), scheme, measured number and threshold:

| Check                                                                        | Threshold                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| OKLCH lightness                                                              | light 0.43–0.77, dark 0.58–0.88                                                            |
| OKLCH chroma                                                                 | ≥ 0.10 per categorical series                                                              |
| Adjacent series under protanopia / deuteranopia (Machado 2009, severity 1.0) | OKLab ΔE×100 ≥ 8                                                                           |
| Worst pair in the group, normal vision                                       | OKLab ΔE×100 ≥ 15                                                                          |
| Contrast against the surface                                                 | ≥ 3:1                                                                                      |
| Group size / repeats                                                         | ≤ 8 series (a 9th folds into `other`), no repeated colour                                  |
| Value format                                                                 | #rgb or #rrggbb only; anything else is reported and left out of that scheme's other checks |

Only literal `{ light: '#hex', dark: '#hex' }` entries are read. A deliberately neutral series is
keyed `other`: it skips the chroma floor and nothing else. The kind is a grace kind — `warn` from
2.21.0, `error` from 2.23.0 — so the upgrade stays green; the fix is to retune the hex in the series
file, not to waive anything.

**Opt-out:** `"basalt": { "severity": { "series-palette": "warn" } }` keeps it a warning past
2.23.0, `"basalt": { "exemptRules": { "series-palette": ["<series file>"] } }` silences it for the
file. The guard now has 27 kinds.

### `StatGroup variant="strip"` cells align by part

**Changed:** strip cells no longer stretch to the row's tallest cell with the footer pinned to the
bottom. Each cell spans the same five tracks of the grid (caption, value, visual, rows, footer), so
captions and values line up across a row, and a void opens only where a sibling's same part is
taller. Footers line up for `rows` cells (the shared footer track) and for visuals of equal height;
a `footer` under a `visual` (and no `rows`) rides with that visual and sits one gap under it, so a
taller sibling's visual never pushes it down or shows as a void (S3's oldest-wait Meter read 46 %
empty beside a tall fleet legend). A cell without a visual keeps its `rows` and `footer` directly
under its value, so a short cell ("verdicts 78 %") stays compact. The strip's hairlines are outer
box-shadows (borders in forced-colors mode), so every cell has the same `stack-md` top inset. No new
prop, no opt-out for the alignment, and no per-cell `align`.

### `Button` section insets sit on the spacing scale

**Changed:** a `Button` with a `leftSection` / `rightSection` padded that side by Mantine's
`--button-padding-x / 1.5` (5.33 / 10.67 / 13.33 / 21.33 px by size), off the 4px scale. The section
side now takes the nearest stack step at level 0: xs 8, sm 12, md 12, lg 16, xl 24, `ctl` 8;
compact-xs/sm 4, compact-md/lg 8, compact-xl 12 (density-scaled). The side without a section is
unchanged.

**Opt out:** set `--button-section-padding-x` on the Button (`vars` or `style`) — e.g.
`calc(var(--button-padding-x) / 1.5)` restores Mantine's value.

## 2.20.0 — the sparkline reference and readout

**`Sparkline` now answers hover and keyboard focus.** A pointer over the cell, or arrow keys /
Home / End on the focused chart, show the point's value in one quiet in-cell line (Escape or blur
clears it) and mark the point with a dot. It was inert before. Value text comes from the new
`format` prop (default: the compact number format), the x text from the new `labels` array
(index-aligned with `data`). **Opt out** by putting the sparkline under an `aria-hidden` ancestor,
which disables the readout.

New, additive: `reference={n | 'mean'}` draws a dashed `--vx-line` hairline and widens the y domain
to include it (`'mean'` is over the plotted values).

### `Meter` captions share one size, and gains `ticks`, `tone`, `size`

**Changed default:** the `Meter` empty line ("No data") was `--vx-text-sm`; every Meter caption
(reading, target, forecast, part, zone and tick names, the empty line) now reads one token,
`--basalt-meter-caption`, defaulting to `--vx-text-micro`. **Opt out** (or follow the host text) per
Meter: `style={{ '--basalt-meter-caption': 'var(--vx-text-sm)' }}`, or `1em` to inherit the host size.
The target tick now also carries a 1px track-coloured halo, and at `target === max` sits inside the
track end instead of straddling it.

New, additive: `ticks={[{ at, label? }]}` (several marks; out-of-range ticks are dropped, not
clamped), `tone="muted"` (a non-verdict fill, 3:1 against the track in both schemes), `size="row"`
(one text line tall, no caption rows), and root types `MeterSegment`, `MeterZone`, `MeterTick`.

### `relativeTime` honours the format locale

`relativeTime` (and `SyncButton`, which calls it with no locale) now falls back to the
`defineFormat` / `BasaltProvider` `locale`, like `numberFormat` and `dateFormat` always did. Before,
it fell back to the runtime's own locale, so an `en-GB` app on a German system read "vor 4 Tagen".
The fix is in `relativeTime`'s formatter only: `duration` and the date builders already resolved the default, and no other `Intl.RelativeTimeFormat` exists in `src`.

**Opt-out:** pass `locale` per call, or leave `defineFormat` / the provider `locale` unset to keep
the runtime locale. argo can drop its `APP_LOCALE` wrapper around `relativeTime`.

### Proportional numerals (`StatCard`, `WidgetHeader`, `DeltaBadge`, `BarList`, `Meter`)

Hero values, row labels and body text are now the proportional sans with lining figures; mono is
for captions, times and code only (`docs/DESIGN-CORE.md`). Before, every numeral rendered in
JetBrains Mono.

- **What changed:** `StatCard` / `WidgetHeader` hero value, unit and count chip, `StatCard`
  breakdown values, `DeltaBadge`, `BarList` value and secondary, and `Meter` ring value, captions
  and zone labels now read `font-family: var(--basalt-font-numeral, var(--basalt-font-sans))` with
  `font-variant-numeric: lining-nums`. Sizes, weights and letter-spacing are unchanged. Headings
  (`h1`–`h6`, `.mantine-Title-root`) drop the face's slashed zero (`font-feature-settings: 'zero' 0`).
- **Unchanged:** uppercase captions, qualifiers, the group-tier heading and times stay mono;
  `src/table/**`, `[data-numeric]` controls and axis ticks keep tabular figures.
- **Opt out (old mono heroes):** one declaration restores every site above:

  ```css
  :root {
    --basalt-font-numeral: var(--basalt-font-mono);
  }
  ```

  Heading zeros: `h1, h2, h3, h4, h5, h6, .mantine-Title-root { font-feature-settings: normal; }`
  (needs to out-rank `@layer basalt` — declare it unlayered).

### `<Card>` and `<Paper>` default to the 12/16 inset

The theme now sets the inset itself — `--vx-space-card-inset-y` 12 / `-x` 16, density-scaled — on
every `Card` and `Paper`. Before, a bare `<Card>` got Mantine's 16 px all round and a bare
`<Paper>` got 0, so both missed the law and consumers wrote `py="sm" px="md"` on every card.

| You wrote                      | Before       | Now                                                           |
| ------------------------------ | ------------ | ------------------------------------------------------------- |
| `<Card>`                       | 16 all round | 12 / 16                                                       |
| `<Paper>`                      | 0            | 12 / 16                                                       |
| `<Card py="sm" px="md">`       | 12 / 16      | 12 / 16 — and `basalt/card-inset` flags the pair as redundant |
| `<Card padding={0}>` / `p={0}` | flush        | flush, flagged: use `variant="flush"`                         |

- **Delete** every `py="sm" px="md"` on a `Card` or `Paper`.
- **Flush whole card** (a map, an image, a table that owns its own padding): `variant="flush"` on
  `Card` or `Paper`. **Full-bleed region inside a padded card**: `<Card.Section>`, whose negative
  margins now cancel the 12/16 pair rather than one `--card-padding`.
- **Opt out of the theme inset for one card**: an explicit padding with
  `{/* theme-allow card-inset — <why> */}`. A Card `padding` prop still works (it retargets the same
  pair), and `p`/`py`/`px` style props win as inline styles.
- A `Paper` you relied on being padding-free (a bare wrapper, a custom overlay) now has 12/16:
  add `variant="flush"`. Mantine's own `Modal`, `Drawer`, `Dialog`, `ActionBar` and `FloatingWindow`
  are excluded and gain nothing.
- `basalt/card-inset` stays at `warn` (grace → 2.26.0); the redundant pair is a new finding, so a
  codebase that was clean last release will report until the pairs are deleted.

### `DeltaBadge` `period` composes "vs <period>"

`period` (and `deltaPeriod` on `StatCard`, `WidgetHeader`, `Section`) now renders `vs <period>`: `period="MoM"` reads "vs MoM" where it read "MoM". A period that already starts with the prefix is left alone, so a caller passing `"vs last week"` still renders "vs last week", not "vs vs last week". **Opt out** with `periodPrefix=""` on `DeltaBadge` (renders the period raw), or pass your locale's word (`periodPrefix="gegenüber"`). A period that is not a comparison (`"30d"`, a change over a window) now reads wrongly ("vs 30d"): pass `periodPrefix=""` on `DeltaBadge` itself, or reword it through the card props (`"30 days ago"`). Drop the hand-written "vs " at your leisure.

### Chrome: on-scale Button padding, neutral selected nav row, neutral error state

**Button inline padding is on the spacing scale.** Every size reads `--vx-space-stack-*` steps
(density-scaled) instead of Mantine's 14/18/22/26/32 px and compact 7/8/10/12/14 px: `xs` 12, `sm` 16,
`md` 20, `lg` 24, `xl` 32; `compact-xs`/`-sm` 8, `compact-md`/`-lg` 12, `compact-xl` 16 (at density 0).
Heights are unchanged, and `size="ctl"` keeps its own 10 px inset. **Opt out** per component with
`<Button styles={{ root: { '--button-padding-x': 'var(--button-padding-x-<size>)' } }}>`, using the
matching Mantine size var (`--button-padding-x-xs`, `-compact-xs`, …), or globally by overriding
`Button.vars` in your theme.

**The selected nav row is a neutral ink fill, not an accent tint.** `NavLink[data-active]` paints
ink 10 % (14 % on hover) with the existing weight 600; the accent stays on the active icon, focus and
the filled primary. **Opt out** with a consumer class on the row that sets `background-color`
(consumer classes win over the theme module).

**Errors render as a dot, a word, the message and a retry.** `ErrorState` (and so `QueryState`
and `StatCard` error bodies) no longer renders a red-tinted Mantine `Alert`; it is a neutral
`role="alert"` stack led by a `StatusDot` and the title. `ChartCard`'s error body gets the same idiom
(dot, "Error", the message, Retry); the compact sparkline `—` is unchanged. **Opt out** by rendering your own
`<Alert color="red" variant="light">` in the `error` slot of the surface (or a custom `ErrorState`
wrapper).

Also fixed (no action): a hovered `Tab` now shows an ink-5 % fill in dark as in light.

### Facts at rest, strip captions, tick fonts

**Changed default:** `ChartCard` `facts` show only at rest; while `state` is pending, errored or empty
the header keeps its title row alone (the figure above a skeleton contradicted it). **Opt out:** none;
pass the figure as `info`/`subtitle` text if a loading card must still state it.

**Changed default:** the lowercase `qualifier` of a `StatCard` and a `StatGroup` strip cell is the muted
proportional sans (mono stays on the UPPERCASE caption), and a strip cell's `· ` separator is gone. The
caption and its info glyph are one unit (the caption truncates with a `title`; the qualifier wraps
whole below it). Chart axis ticks (the chart host's font) are the proportional sans with `tabular-nums`, not mono.
**Opt out:** set `--basalt-chart-font: var(--basalt-font-mono)` on the chart or an ancestor.

`Meter` captions wrap with `text-wrap: pretty` and join a number and a known unit (`24 h`, `7 d`, `5 min`, `40 %`)
with a no-break space, so `textContent` carries U+00A0 there; its visually-hidden summary now reads the caption
size instead of the inherited body size.

### Round-2 board fixes: sparkline readout, chart error, tick size, captions, thin rows, verdict word

**Changed default — `Sparkline` readout.** The hover/focus chip is opaque and sits on a line ABOVE the plot
box (it sat inside it and covered the line's last segment, a bar or the end dot). The `StatCard` `right`
slot and a strip cell's `visual` now reserve that line (`--basalt-spark-readout-h`, 18px) as padding above
a sparkline, so the card/cell grows by up to 18px and the chip never covers the hero value; `bleed` already
had the room. **No opt-out for the position:** a chip inside the plot has to cover some mark. Resize the
line with `--basalt-spark-readout-h` (chip and reserve move together); the readout itself is off under an
`aria-hidden` ancestor.

**Changed default — chart error body.** A `ChartCard` (or any chart) error is StatCard's anatomy: a
left-aligned stack of dot, "Could not load this chart", the message and `stateAction`; it was a centred
"Error" word. The body now grows past the chart's height rather than clip its action. **No opt-out:** the
old body clipped Retry at 390px, so there is no layout worth restoring; pass your own `state` copy via the
error's message.

**Changed default — tick size.** Chart tick labels (every kind, `Heatmap` included) are `--vx-text-micro`
at every container width; they were the 10px nano rung below 480px. **No opt-out:** one size is the law.

**Changed default — `Meter` captions.** They wrap with `text-wrap: balance`, and the last two words of a
caption `Meter` composes are joined by a no-break space when the last is 6 characters or fewer
(`textContent` carries U+00A0 there). **Opt out:** pass a node to `startCaption`/`endCaption` (a node is never
glued).

**Changed default — `BarList variant="thin"`.** The label wraps to two lines before truncating (its `title`
has the whole text) and the secondary column takes at most 40% of the list. **No opt-out:** the old width
cut titles to a few characters at 390px.

**Changed default — `StatusVerdict` word.** It is the proportional sans (`--basalt-font-sans`) at the micro
size in muted ink, not the mono: it is a sentence fragment, not an UPPERCASE caption. This reaches the
`StatCard` tone word, `BarList` secondaries that use it, and the notification centre. **Opt out:** pass
`className` with `font-family: var(--basalt-font-mono)`.

## 2.19.0 — the status dot, ink buttons and Meter refinements

### Status is a dot and a word, not an edge stripe (`StatCard`, `Callout`, notification centre)

Wave 34. `StatCard`'s `tone` no longer draws a 3 px coloured rail down the card's leading edge. It
now puts a 6 px status dot and a short word on the caption row, after the title and `info` glyph:
`good` → `OK`, `warn` → `Watch`, `bad` → `Over`. The dot carries the colour (`VX.status[tone]`);
the word is muted ink and carries the meaning, so the verdict no longer rides on colour alone. Screen
readers still hear the full phrase ("Past the severe threshold") from a visually hidden sibling, not a
bare "Over".

Two other shipped status edges went the same way, each visible without any prop change:

- **`Callout`** loses its 2 px coloured left border. The tint, icon and title still carry the kind's
  colour (`info` / `good` / `warn` / `bad`), and a visually hidden kind word ("Info", "Success",
  "Warning", "Error") means a title-less callout is never tint-only. A consumer's CSS that restyled
  the border has nothing to target.
- **Notification-centre rows** (`NotificationCenter`) lose their 3 px coloured leading border and show
  a 6 px status dot plus the intent as a visible muted word ("Success", "Error", "Warning", "Info")
  before the title, or before the message on an untitled row. The `info` dot is neutral ink, not the
  accent.

`tone?: 'good' | 'warn' | 'bad'` keeps its API, and omitting it still renders neither dot nor word.
There is no opt-out: a coloured edge for status is retired (owner decision). A consumer's own
`[data-tone]` CSS that targeted the rail element should target the card (`[data-tone]` stays on the
root) or drop the rule.

The shipped `basalt-design-reviewer` now fails a status drawn as a coloured edge stripe (Craft 4,
Expression 3), so boards that passed before this release can fail now: re-score them. The verdict
words (`OK`, `Watch`, `Over`, and the phrases screen readers hear) are fixed English; for i18n, omit
`tone` and render your own dot and word.

### Light and outline Buttons are ink

A `Button` or `ActionIcon` with `variant="light"` or `variant="outline"` and no `color` used to paint
the primary (accent) colour. It is now ink: `light` takes the subtle surface (hover one ink step) with
an ink label; `outline` takes the surface border with an ink label and the subtle-surface hover.
Only `variant="filled"` and any explicit `color=` carry the accent. `default`, `filled`,
`transparent` and `white` are unchanged, as are disabled, loading and focus-ring behaviour.

An empty or `null` `color` now counts as unnamed everywhere, matching Mantine's own
`color || primaryColor`: `subtle` Buttons and ActionIcons and the `Tabs` underline with `color=""` or
`color={null}` take ink too, where they kept the accent before.

Opt out: name the primary colour explicitly — `color="<primary>"`, your theme's `primaryColor` name.
Omitting `color`, or passing `""` or `null`, does not restore the accent.

### `Meter` and `BarList` refinements since 2.18.0

No export, prop or type changes; the rendering moved after the Wave 34 board rounds:

- **`Meter` categorical `segments`** (no forecast part) caption every part under the track (swatch, name,
  value) and drop the default start caption that stated the total; pass `startCaption` to keep a total.
- **`Meter` zones** name every zone on the band (the holding zone in ink and a weight step, a wrapped list
  when the names would collide) and anchor the reading at the marker; the start caption is the bare reading,
  no longer `Zone · reading`.
- **`Meter` captions** wrap and never truncate; the ring value is on the hero type role and the ring grows
  square when the value is wider than its inner circle; ticks and the marker take the `fine` radius.
- **`Meter` in a `StatCard` visual (`sparkline`) slot** sizes to its content and keeps the card inset
  instead of a 22 px bleed. The slot's loading skeleton keeps the card inset on both sides.
- **`BarList`**: the bar spans the label column only, so a full-scale bar ends before its value; value and
  secondary are shared grid columns, and the secondary is `sm`.
- A selector that targeted the old markup (`li > span[aria-hidden]` for a BarList bar) needs `[data-bar-track]`.

## 2.18.0

### Status text derived per surface

Wave 34 of the design-parity track (`docs/waves/design-parity/SPEC.md` § 12 D22). No export is
added, removed or renamed.

`--vx-status-good`, `--vx-status-warn` and `--vx-status-bad` (light and dark) are painted as text
(`DeltaBadge`, a toned row), but their tones were fixed while the surfaces move with `lightLevel`,
`darkLevel` and `neutral`; off the defaults they read 3.2–3.9:1. Each solid is now derived from the
surfaces the palette produced: **it shifts in lightness only when needed to restore the 4.5:1
floor** on every text surface (`bg`, `panel`, `panelHover`, `elevated`, `subtle`, `field`). Light
darkens, dark lightens; hue is preserved and chroma may clip at the gamut edge.

- **Defaults are unchanged**: at the default config every status hex is byte-identical.
- At a non-default `lightLevel`, `darkLevel` or `neutral` the status solids shift in lightness only as far as the floor needs.
- `lightLevel` / `darkLevel` outside -5..5 are clamped to the nearest bound (non-finite becomes 0).
- No opt-out is needed. A consumer that pins a status hex at a non-default config passes its own
  colour and owns the contrast.

### `shot` on a real app

- `basalt-ui shot` captures a signed-in app with live data. `--local-storage <key>=<@env:NAME|@file:path>` seeds
  localStorage on the app origin before any page script (an argo-style bearer token); `--api /api=https://app.example.com`
  makes the `--dist` server proxy GET/HEAD under that prefix (other methods get 405 unless `--api-allow-writes`);
  `--header authorization=@env:NAME` is added to every proxied request, to every `--api` origin (https required), never
  to a page navigation; `--wait <ms>` adds a settle after `networkidle` (default none); `--auto-anchors` crops every
  Card, Paper and table over 120×60 px on a page with no `data-shot`. A redirect, 401/403/404, 5xx or unreachable API fails every shot of that page; a localStorage key the app already holds is not overwritten; `--header` is refused when `--api` names more than one origin; any secret (`--header` or `--local-storage`) requires an https `--api` origin.
  Secret values are never printed or written to `board.html` or `metrics.json`. Shots of real data reach the reviewer
  subagent's model provider: point `--api` at staging or synthetic data for an app holding third parties' data. No
  action needed; every flag is opt-in.

## 2.17.0 — the metric card and chrome

Wave 33 of the design-parity track (`docs/waves/design-parity/SPEC.md` § 6.10, § 6.12). No export is
added, removed or renamed; three theme defaults change, each with a one-prop way back.

- **Grace extended: `basalt/card-inset`, `raw-spacing` and `inline-spacing` stay `warn` until 2.24.0** (they were dated 2.17.0). No consumer has run 2.16 yet, so promoting them now would skip their warn period. They become `error` at the fleet rollout.

### Badge, subtle Button, Tabs

| What                            | Old                                    | New                                                       | Opt out                                                              |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| `Badge` default variant         | `filled` (accent fill, on-colour text) | `light` (13% status tint, ink-pulled text)                | `variant="filled"`                                                   |
| `Badge` default colour          | the primary colour (accent tint)       | `gray` (neutral tint); the accent is not a status default | a Badge that relied on the accent default passes `color="<primary>"` |
| `Badge` radius                  | `ctrl` (6 at level 0)                  | `tight` (5 at level 0; follows the `radius` knob)         | `radius="md"`                                                        |
| `Badge` leading glyph           | Mantine's section, 4px gap, unsized    | `leftSection` svg is 12px, 4px gap, centred at 20 high    | `classNames={{ section: … }}` override                               |
| `Button variant="subtle"` label | accent ink                             | neutral ink (`--vx-ink`)                                  | `color="blue"` (any explicit colour)                                 |
| `Tabs` active underline         | accent (`--tabs-color`)                | ink (`--vx-ink`)                                          | `color="blue"` on `Tabs`                                             |

- `Badge` height stays 20 (Mantine `md`). `filled` remains right for a count on an accent surface.
- The subtle opt-out is any explicit `color` prop, the primary colour included. An explicit colour
  keeps Mantine's own tinted label **and hover**: the ink-6% hover (1.x–2.16) now applies only to a
  subtle control that names no colour, so `color="blue"` hovers into the accent tint again.
- `Tabs variant="pills"` is untouched: it fills with the colour, so it keeps the accent.

### StatCard and Sparkline

Wave 33 of the design-parity track restyles the metric card (`docs/waves/design-parity/SPEC.md` § 6.1, § 6.2) and flips the `Sparkline` defaults. No export is removed or renamed, but **the `state` field of the `StatCardSparklineSize` type is removed** and the defaults and the card's anatomy change.

| What                          | Old                                                                               | New                                                                                                                                                                                                                | Opt-out / replacement                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `Sparkline` `emphasizeLast`   | `false` (no end dot)                                                              | `true`                                                                                                                                                                                                             | `emphasizeLast={false}`                                                                                |
| `Sparkline` `emphasisColor`   | `VX.accent`                                                                       | `VX.line` (the line's own neutral)                                                                                                                                                                                 | `emphasisColor={VX.accent}`, or a status / trend colour                                                |
| `Sparkline` stroke            | 1.6                                                                               | 1.5                                                                                                                                                                                                                | none                                                                                                   |
| `StatCard` composition        | composed `WidgetHeader tier="widget"` (head-font title, merged title row ≥ 480)   | renders its own caption row, value row and foot; `WidgetHeader`, `Section` and `ChartCard` are unchanged                                                                                                           | `classNames.header` still reaches the caption + value block; there is no `WidgetHeader` slot to target |
| `StatCard` `title`            | head-font heading                                                                 | mono uppercase `micro` caption, faint ink                                                                                                                                                                          | none (`ChartCard` keeps its head-font title)                                                           |
| `StatCard` `subtitle`         | muted line under the title; folded into the info glyph below 480 px               | **one muted `sm` line in the foot, under the visual, at every width**; ellipsized, full text in `title`                                                                                                            | a period or target → the new `qualifier`; a method → `info`; a source or "as of" stays in `subtitle`   |
| `StatCard` `qualifier`        | —                                                                                 | new `string`: `micro` muted, right-aligned on the caption row; when caption and qualifier do not fit it takes its own line under the caption, left-aligned, and breaks its words only if it alone exceeds the card | keep it on one line by shortening the copy                                                             |
| `StatCard` value row          | delta on the title row from 480 px                                                | figure, `unit` inline at `sm` muted, then the delta, in one row at every width                                                                                                                                     | none                                                                                                   |
| `StatCard` sparkline slot     | 26 px, bled through the card bottom                                               | 22 px (`'right'` slot 72×22), bled to the side edges, in the foot above the footer; the render prop receives `height: 22`                                                                                          | none                                                                                                   |
| `StatCard` footprint          | height followed content                                                           | the foot reserves 22 + 4 + 20 px when a `sparkline` (bleed) or `subtitle` exists, so cards with and without either share a height; `'right'` keeps its 72×22 slot while pending                                    | none                                                                                                   |
| `StatCard` `query`            | `QueryState` wrapped the breakdown only; pending was a spinner, empty was blank   | resolved by `resolveQueryBranch` (error > pending > empty > ready): pending is a skeleton at the card's footprint, empty is one muted line, error is `QueryState`'s error + Retry in place of the figure           | `value` needs no `'—'` placeholder while pending                                                       |
| `StatCard` `emptyText`        | —                                                                                 | new `string`, default `No data for this period`                                                                                                                                                                    | pass your own sentence that says why it is empty                                                       |
| `StatCard` `loading`          | —                                                                                 | new `boolean`: the same skeleton with no query, with a visually hidden `Loading <title>` and `aria-busy`                                                                                                           | —                                                                                                      |
| `StatCardSparklineSize.state` | the query as a chart state, so `<Sparkline {...size} />` drew its own placeholder | **removed**: the card shows its own skeleton / error / empty branch and never calls the render prop outside `ready`                                                                                                | spread `size` as before; the placeholder is now the card's branch, not the chart's                     |
| `DeltaBadge` / `deltaPeriod`  | status colour on a 13 % tint, padding, control radius                             | text only: glyph and signed figure in `var(--vx-status-good\|bad)` (or `--vx-faint` for zero / neutral), no fill, no padding; `deltaPeriod` is `micro` muted                                                       | none                                                                                                   |
| `DeltaBadge` glyph            | 0.8 em of its parent (9.6 px)                                                     | the `micro` rung (11 px)                                                                                                                                                                                           | none                                                                                                   |

- **Behaviour: the delta is text only.** `DeltaBadge` paints no background in either scheme (DESIGN-CORE: "deltas are text colour only, never a fill"), so it reads the derived status token directly. `Section` and `WidgetHeader` deltas follow, since they render the same `DeltaBadge`.
- **Behaviour: two status solids moved so the text clears 4.5:1.** With no tint behind it, the delta (and a toned `breakdown` row) is judged on the card surface. At the default seed `status.warn` (light) goes from tone 54.64 to 46 and `status.bad` (dark) from 58.58 to 66.5; hue and chroma are untouched. Every other use of those two solids (tone rail, ref lines, zone bands, the on-colour text on a status fill) reads the new hexes. `derive.test.ts` proves ≥ 4.5:1 for good / warn / bad on every text surface **at the default derive config only**; a retuned `derive` (`lightLevel`, `darkLevel`, `neutral`) is not covered by that proof.
- **Behaviour: the `info` bubble is placed in the viewport.** It is portalled to `<body>` with `position: fixed`, opens below the glyph, flips above at the bottom edge and shifts off the left / right edges, so a card's `overflow: hidden` can no longer clip it (W32 rounds 0-3 at 390). `InfoGlyph` is shared, so `ChartCard`, `Section` and the inspector row `hint` get the same bubble. **Tests that looked for the bubble inside the card should query `document.body`** (`getByRole('tooltip')` is unaffected). A folded subtitle's note inside the bubble is revealed from the bubble's own `data-folded`.
- **Migrating a card:** `<StatCard title="Revenue" subtitle="Trailing 30 days" …/>` becomes `<StatCard title="Revenue" qualifier="30 days" subtitle="Source: billing" …/>` — the period moves to `qualifier`, and `subtitle` is kept only for a source or "as of" line that does not restate the caption. Drop `icon` (it stays a prop; the recipe leaves it off).
- **Migrating a sparkline:** a `Sparkline` that relied on the bare line now draws an end dot in the line neutral — pass `emphasizeLast={false}`. One that passed `emphasizeLast` alone drew a `VX.accent` dot; it now draws `VX.line`, so pass `emphasisColor={VX.accent}` to keep the accent (or a status colour where the end value carries a verdict).

### Date ticks

The default x tick labels of a Date axis (`CartesianChart`, so `Lines`, `Bars`, `StackedArea`) follow
the tick step instead of printing `DD.MM` everywhere, and never repeat on one axis. Reads stay UTC.

| Tick step | Old                   | New                                                                        |
| --------- | --------------------- | -------------------------------------------------------------------------- |
| sub-day   | `17.10`, `17.10`, ... | `HH:MM`, `DD.MM` on each midnight tick (`12:00, 18:00, 18.10, 06:00, ...`) |
| days      | `DD.MM`               | `DD.MM` (unchanged)                                                        |
| months+   | `DD.MM`               | `Oct`, the year on each January (`2027`)                                   |

A clock or month may recur on one axis, always behind a day or year label. With no such marker in
reach (36 h with no midnight tick; two Aprils with no January) the first tick of each day carries
its date (`17.10 06:00`), or the month its year (`Apr 2026`); sub-minute steps add seconds, then
milliseconds. `BandStrip`, `DualPanel` and `MirroredBars` take the same default (they printed
`DD.MM`).

Opt out: pass `formatX` (it always wins), e.g. the old one-liner:

```ts
const ddmm = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`
<Lines formatX={ddmm} … />
```

| Hover readout selector             | Old               | New                                 |
| ---------------------------------- | ----------------- | ----------------------------------- |
| `.ts-chart-tooltip[role="status"]` | the engine's role | `.ts-chart-tooltip[role="tooltip"]` |

The hover readout now carries `role="tooltip"` (it was the engine's `role="status"`) and keeps
`aria-live="polite"` on purpose: a tooltip role alone is not announced, and keyboard users should still
hear the reading; a test that queried `.ts-chart-tooltip[role="status"]` must follow. `Donut`'s and `Heatmap`'s readouts follow.

## 2.16.0 — the even-pixel grid

Wave 32 of the design-parity track moves the spacing, inset, radius and type scales onto an
even-pixel grid (`docs/waves/design-parity/SPEC.md` § 5). No export is removed or renamed; **every
number below changes at level 0**, so a layout that was tuned against the old scale moves. Plain
`feat:` — the way back is **partial**: `density` and `radius` bring back some numbers (last table), the page gutter, the type sizes and the faint ink have no knob.

| What                                             | Old                          | New                                    |
| ------------------------------------------------ | ---------------------------- | -------------------------------------- |
| Mantine spacing `xs / sm / md / lg / xl`         | 11 / 13 / 18 / 20 / 26       | 8 / 12 / 16 / 20 / 24                  |
| `inline-spacing` guard default steps             | 11, 13, 18, 20, 26           | 8, 12, 16, 20, 24                      |
| Card inset (`--vx-space-card-inset-y` / `-x`)    | 11 / 13                      | 12 / 16                                |
| Card horizontal inset below `sm`                 | 11                           | 12                                     |
| Page gutter, expanded size class (≥ 1200)        | 16                           | 24 (medium 16, compact 8 unchanged)    |
| `--vx-radius-card`                               | 7                            | 10                                     |
| `--vx-radius-floating` (card + 1)                | 8                            | 11                                     |
| `SegmentedControl` track / indicator radius      | 7 (card) / 5 (tight)         | 6 (ctrl) / 4 (fine)                    |
| Type `sm` (dense rows, table cells, menu items)  | 13.5, line 1.45              | 13, 20px line                          |
| Type `xs`                                        | 12.5, line 1.4               | 12, 16px line                          |
| Type `kpi` (hero numeral)                        | 24, weight 600               | 22, weight 500                         |
| Nav row / menu item / timeline font              | `md` 15                      | `sm` 13 (nav row stays 32 tall)        |
| `--vx-space-row-line-height`                     | 1.35                         | 1.54 (a 20px line at `sm`)             |
| Table body cell font                             | inherited body               | `sm` 13 (row 40 / header 36 unchanged) |
| Table toolbar and `FilterSet` controls, fine ptr | 32                           | 28 (`--vx-space-control-height-dense`) |
| Axis ticks / chart small labels (`--vx-axis`)    | ink at 60% — 4.06:1 on light | the `faint` ink — ≥ 4.5:1 both schemes |

- **Behaviour: spacing props and `--mantine-spacing-*` reads shrink.** `p="xs"` is 8 (was 11), `"sm"` 12 (was 13), `"md"` 16 (was 18), `"xl"` 24 (was 26); `"lg"` is unchanged. Hand-written `px={18}` / `gap={26}` no longer equal a step, and `raw-spacing` reports them.
- **Behaviour: the CSS sub-scale ceiling of `inline-spacing` drops from 10px to 7px** (it sits one below the smallest stop, now 8). A CSS `padding: 8px` or `10px` is now a finding; 2 / 4 / 6px clusters stay legal.
- **Behaviour: `basalt/card-inset` is strict.** The only accepted inset is the pair `py="sm" px="md"` (12/16) or leaving both to the theme. Uniform `p`/`padding` (any value) and every other pair, including the old `py="xs" px="sm"` (now 8/12), are findings. **Severity: `warn` for this minor, `error` from 2.24.0** (re-dated in 2.17.0) (`PLUGIN_RULE_GRACE`, one entry for the rule); that also demotes the rule's older findings (explicit `radius`, `p="lg"`) to `warn` for the minor, because a level is per rule id. Also flagged now: numeric or non-literal `py`/`px`, and a lone `py="sm"` or `px="md"` without its partner. Move each `<Card py="xs" px="sm">` to `py="sm" px="md"`.
- **Behaviour: the compact card inset reads `--vx-space-card-inset-x` below `sm`**, and `StatCard`'s full-bleed sparkline now bleeds by the card inset tokens rather than the `sm`/`xs` scale stops, so the bleed matches the inset at every width.
- **Behaviour: the `SegmentedControl` concentricity law restated.** `RADIUS.card === RADIUS_STEP.tight + segmentedTrackInset` could not hold at card 10, so the track now takes the control radius and the indicator the `fine` tier: `RADIUS.ctrl === RADIUS_STEP.fine + 2`, exact down to `radius: -4` (at `-5`, `fine` clamps to 0 against a 1px track).
- **Behaviour: `shot` `metrics.json` `radius` may be the string `"full"`** (also on `nested[]`) for a fully rounded box (a `50%` circle or `9999px` pill); it was the number `50` or `9999`. A consumer reading it as a number checks the type first.
- **Behaviour: `deriveSpacing(0).rowLineHeight` is 1.54** (was 1.35); the additive range across `density` −3..+3 is 1.44..1.64.
- **Behaviour: the dense control tier is internal.** `PageBar`'s filter row (the `pills` line) and the `BasaltDataTable` toolbar carry `data-basalt-dense`; at a fine pointer their `ctl` controls resolve to 28. A coarse pointer keeps 32 and the 44px hit overlay. `--vx-space-control-height-dense` is the only new name.
- **Added: `--vx-space-control-height-dense`.** An emitted token (28, floored at 24 by `density`); not exported from `basalt-ui/tokens`.
- **Behaviour: the page gutter is a trial at the expanded class** (SPEC D7). `appShellInsetExpanded` is one constant in `tokens/palette.ts`; setting it equal to `appShellInset` reverts it.

### Migrating the guards

`raw-spacing` and `inline-spacing` ship at **`warn` for this minor and `error` from 2.24.0** (re-dated in 2.17.0) (`GRACE_PERIOD_KINDS`, since 2.16.0): their steps follow the new scale, so after the upgrade `p={16}` and `gap={24}` are findings (use `"md"` / `"xl"`) and `p={18}` / `gap={26}` are no longer flagged. To migrate on your own schedule, in the consumer's `package.json`:

```json
"basalt": {
  "spacingSteps": [11, 13, 18, 20, 26],
  "severity": { "raw-spacing": "warn", "inline-spacing": "warn" }
}
```

`spacingSteps` keeps the guard on the old numbers (matching a scale you have not moved off yet); `severity` pins both at `warn` past 2.24.0, when the grace entries are deleted and they become `error`. Drop both once the call sites read tokens. The CSS sub-scale ceiling (10 → 7px: a CSS `padding: 8px` or `10px` is now a finding) has no switch of its own; it rides on `inline-spacing`'s severity.

### Restoring the old feel

| Dimension                                               | Knob      | Closest level, honestly                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spacing scale                                           | `density` | `+1` gives 9 / 13 / 18 / 22 / 26 — matches old `sm`, `md`, `xl`, misses `xs` (9 vs 11) and `lg` (22 vs 20). It also scales every other density-tracking number: control height 35, table row 44, gutter 26.                                                                                       |
| Card inset                                              | `density` | No level restores 11/13: `-1` gives 11/14, `0` gives 12/16. A consumer that wants the old inset sets `--vx-space-card-inset-y: 11px; --vx-space-card-inset-x: 13px` in its own `:root` CSS.                                                                                                       |
| Card radius                                             | `radius`  | `-3` gives card 7 / floating 8 — and control 3, tight 2, fine 1, which is not the old control radius (6). No level moves card alone. Set `--vx-radius-card: 7px` in `:root` to restore just the card.                                                                                             |
| Floating radius (Tooltip, Popover, Modal, Notification) | none      | These four take a numeric Mantine `radius` from the theme, not the CSS var, so `--vx-radius-floating` does not reach them: there is no CSS-only restore. Pass `createBasaltTheme({ components: { Tooltip: { defaultProps: { radius: 8 } } } })` per component (or `radius={8}` at the call site). |
| Type `sm` / `xs` / `kpi`                                | none      | The `fonts` knob changes families, not sizes. A consumer that needs 13.5 / 12.5 / 24 at one site writes the size at that site with a `theme-allow`.                                                                                                                                               |
| Faint chart ink                                         | none      | `derive` retunes the whole neutral ramp; there is no separate knob for the axis ink, and a lighter axis fails the 4.5:1 gate by construction.                                                                                                                                                     |
| Page gutter                                             | none      | The expanded gutter is a constant; `density` scales it (`-1` gives 22).                                                                                                                                                                                                                           |

## 2.15.0 — the reviewer subagent and the ViewTabs law

- **Behaviour: `basalt/bound-control-outside-home` now reports a `ViewTabs` in every `PageBar` slot except `tabs` (`actions`, `filters`, `filtersEnd`, `sync`), in `Section.actions`, or inside a `FilterSet`.** It was accepted there (any slot was a home). A `ViewTabs` that switches a page or a section belongs in a `tabs` slot (`PageBar.tabs`, `Section.tabs`); one that switches only a card's view belongs in that `ChartCard` / `WidgetHeader` `actions` slot (still allowed). **Fix: move it to `tabs`.** The lint is structural: only a `ViewTabs` written inside the slot (JSX attribute or object spread) is seen; one passed through a hoisted `const` is not.
- **Behaviour: `init`/`sync` render every installed rule's `paths:` from `basalt.roots`** — one `'<root>/**'` per root, with a leading `./` and trailing `/` stripped. Before, every rule shipped the fixed globs `src/**`, `apps/**/src/**` (and `packages/**/src/**` in `basalt-tokens.md`), and `basalt-charts.md` matched only `**/charts/**`. With `basalt.roots` unset, `init`/`sync` write the inferred roots first (a workspace repo gets each UI package's `src/`), so rules then load for exactly those roots; with nothing inferable they keep `src/**`, `apps/**/src/**`, `packages/**/src/**`. **Remedy: set `"basalt": { "roots": [...] }` to every directory the rules should load for** (a root you leave out stops loading them). `sync --check` reports the rules as drifted until you run `sync`.
- **Added: `sync` / `init` install the `basalt-design-reviewer` subagent** at `.claude/agents/basalt-design-reviewer.md`, and the managed AGENTS.md block names the skills and the subagent. A `.claude/agents/basalt-*.md` that basalt stops shipping is retired like a rule. **Restart a running Claude Code session** after `sync`: subagents are read at session start, so the new one is not visible until then.

## 2.14.0 — the format layer, the filter family and chart fixes

### `basalt-ui/format`

- **Behaviour: `money` keeps the currency's own digits.** `money(12.5, { currency: 'USD' })` was `$13`, is `$12.50`; `money(1234, …)` was `$1,234`, is `$1,234.00`; JPY stays whole. **Opt-out: `digits: 0`.** `compact: true` is unchanged.
- **Behaviour: `km` and `kcal` go through `Intl`.** `kcal(1243)` was `1.24 k cal`, is `1.24k kcal`; `de` prints `5,30 km` / `1,24k kcal`. **Opt-out: pass `locale: 'en-US'`** (or set it once, below).
- **Behaviour: `-0` and negatives that round to zero print `0`**; every number and measure formatter takes `null | undefined` and prints the dash. `LocaleOption.locale` is `string | undefined`.
- **Behaviour: `relativeTime` is one Intl formatter** with `style: 'long' | 'short' | 'narrow'` and `numeric: 'auto' | 'always'`. Sub-minute is `now` (was the hard-coded `just now`), the count rounds before the unit promotes (59.6 min is `1 hour ago`), future and past are symmetric, the locale is the runtime's (or the provider's). The chat timestamps (message, feed row, outcome card) lost their hard-coded `en` and print the dash, not `''`, for a bad `createdAt`; `SyncButton`'s age (`2m ago` → `2 min. ago`) and the notification center follow. `formatAge` is removed; `relativeTime(ts, { style: 'short' })` replaces it. **Update any assertion on `just now` / `Nm ago`.** **Opt-out: none** (`locale` pins the language).
- **Behaviour: `weekday('2026-02-31')` prints the dash** (it rolled to March 3) and years below 100 are no longer remapped.
- **Renamed: `fmtCompact`, `fmtCurrency`, `fmtInt`, `fmtPercent` (+ `Fmt*Options`) → `compact`, `money`, `integer`, `percent` (`CompactOptions`, `MoneyOptions`, `PercentOptions`).**
- **New: `date`, `time`, `dateTime`, `duration` (`style: 'clock' | 'compact' | 'long'`), `bytes` (decimal SI), `delta` (`+3.2`), `compact`, `defineFormat({ locale, timeZone })`.** `BasaltProvider` takes `locale` and `timeZone` and applies them as the process-wide default (one value per process, not per request; per-call `locale` overrides; an unset prop leaves the default alone). Delete local duration, signed-delta, byte and `en-US`-pinning helpers.

### Controls

- **Behaviour: `SearchFilter` commits on Enter, blur and unmount** (the pending phrase used to be lost inside the 200 ms window; unmount used to cancel it), is `type="search"` (role `searchbox`, was `textbox`) and shows a clear button. **Opt-out: `clearable={false}`; query `searchbox`.**
- **Behaviour: `ToggleFilter`'s Switch is named by its label only** (the duplicate `aria-label` is gone).
- **New: `disabled` on every filter**, `MultiSelectFilter` takes `clearable`, `NumberFilter` option rows take `disabled`. `FilterOption<V> { value, label, disabled? }` is the one option type (`NumberFilterOption`, `PanelChoiceOption` are gone; `ViewTabsOption` extends it); `RangeCustomPickerProps` is exported.
- **Type break: `RangeFilter`'s `customPicker` is required exactly when the field is `custom: true`, and `never` otherwise.** A `field.range({ custom: true })` without a picker, a picker on a preset-only field, and a wrapper typed `RangeFilterProps<P>` (picker now required) fail `tsc`. **Fix: `customPicker={DateRangePicker}`, or drop `custom: true`.** This supersedes the dev warning described under 1.x's `RangeFilter` note.

### Charts

- **Fix: a follower chart draws nothing when the shared cursor's x is outside its x-domain.** Since 2.13.2 a follower clamped the leader's cursor onto its edge datum, so a chart covering 20:00–08:00 drew a dot at 12:00 the next day that was not the cursor's hour. The domain is the one the chart renders (`xDomain`, else the data extent); a cursor exactly on an edge still draws, and the leader is unaffected. No crosshair, no dots and no tooltip outside the domain, on `CartesianChart`, its kinds and `DualPanel`. Pass one `xDomain` to charts that should cover the same range.
- **Fix: the line legend key reads as a dash at every size.** `LINE_SWATCH` in `legend.tsx`: below 480px of chart width (a container query on the chart, not the viewport) the key is 14px (was 8px, dash `2.5 2`, which read as two dots) with dash `4 3`; from 480px of chart width it is 16px (was 12px) with dash `4 3`. The dots-mode gap between entries goes 38 → 30px to pay for it, so a four-entry legend still fits one row at 390px. Selectors or snapshots that expected an 8px or 12px line key match the new widths.

## 2.13.3 — the router defaults need no provider

- **Behaviour: the default pending, error and not-found screens of `createBasaltRouter` / `basaltRouterOptions` are plain HTML, not Mantine components.** They render at the route that failed — above `BasaltProvider` for a root-level error or a pathless-layout provider — where Mantine threw "MantineProvider was not found". Same copy, "Try again" still calls `reset`; the spinner is an `<output>` (implicit `status`), the error `role="alert"`; the look matches the token look (`--vx-*` with literal fallbacks), not pixel-for-pixel. **What you lose:** theming through `components.Loader` / `components.Button` `defaultProps`, and `.mantine-Loader-root` / `.mantine-Button-root` selectors, no longer reach these screens. **Opt-out:** pass your own `defaultPendingComponent` / `defaultErrorComponent` / `defaultNotFoundComponent` (after the spread) for Mantine screens.

## 2.13.2 — followers draw the cursor dots, a dashed line keeps its key

### Charts — a follower draws the cursor dots, a dashed line keeps its key, one dot mark per `getMarker` series

- **Behaviour: a chart following a sibling's cursor draws the leader's dots by default** (the engine's focus ring on its lines, and the `cursorValue` dots, at the shared x; hidden series and `getMarker` colours respected). It used to paint the crosshair only. Its tooltip stays silent unless `tooltip.onFollow`: the host is hidden, not painted, for a follower, so no tooltip text or live-region announcement. **No opt-out.**
- **Behaviour: the `cursorValue` cursor dot of a `getMarker` series is one mark, coloured per datum.** It was one mark per distinct colour (`<key>-cursor-<slug>`); it is now a single `<key>-cursor` mark whose focused fill is `getMarker(d).color`, so a continuous palette is fine there (always-on markers still cost one mark per distinct paint). **Opt-out: none** — the old key matches nothing; query `<key>-cursor`.
- **Fix: a line series keeps its line swatch in the legend below 480px.** It got a dot there, so a dashed series lost its dashed key. The swatch is now a stroke at both sizes (`LINE_SWATCH` in `legend.tsx`): 8px below 480px (dash `2.5 2`) and 12px from 480px (was 16px; dash `4 3`); a dashed swatch has butt caps so the gap stays open. The line `svg` no longer carries `classes.chip` (it is the `dot` variant below 480px and the `chip` variant above, like the bar swatches), and the swatch is now rendered in `dots` mode. Selectors that expected a `span` dot for a line series, or a 16px svg, match the new `svg`s. Bar and area swatches are unchanged.
- **`legend.maxRows` stays gone.** It was deliberately deprecated in 1.31 and removed in 1.32.0 (the legend fits by measured width and folds overflow into the `All N` chip); not restored.

## 2.13.1

_Nothing to migrate in this release._

## 2.13.0 — router options, search stores, and a theme that reaches no component it configures

### `basaltRouterOptions`, router passthrough, telemetry correctness

- **New: `basaltRouterOptions({ query?, context? })`, and `type BasaltProviderProps`, from `basalt-ui`.** The factory returns everything `createBasaltRouter` set (context with `queryClient`, intent preloading with Query-owned freshness, scroll restoration, the pending/error/not-found components, `defaultOnCatch`, the route view transition); `createBasaltRouter` is now `createRouter({ routeTree, ...basaltRouterOptions(opts) })` plus the brand. A router you build yourself (TanStack Start's `getRouter()`) spreads it and the embedded provider gets `route.error` telemetry and the defaults it used to miss. Named consumer for the adopt-or-delete rule: weatherorb (`scripts/consumers.json`, `basaltRouterOptions`). `BasaltProviderProps` replaces weatherorb's re-declared `Readonly<{ children }>`. Symbol budget: +1 value, +1 type.
- **`route.error` no longer needs `createBasaltRouter`.** The router-scoped hook lives on `context.__basalt` (optional on `BasaltRouterContext`); the provider points it at its emitter. Nothing to change.
- **Compile break: `createBasaltRouter` requires `context` when your context type has required keys.** `context` was always optional and typed loosely; with `context: { auth }` in your root route's type, omitting it (or `basaltRouterOptions()` with no argument) now fails to compile instead of crashing at the first `context.auth` read. **Fix:** pass it, `createBasaltRouter({ routeTree, context: { auth } })`. `queryClient` in `context` is rejected too (basalt's replaces it). `type BasaltRouterOptions<TContext>` is the factory's return type, exported from `basalt-ui`.
- **`createBasaltRouter` accepts `history` and `basepath`.** Every key it owns (`defaultPreload`, `defaultPreloadStaleTime`, `scrollRestoration`, the three default components, `defaultOnCatch`, `defaultViewTransition`) is typed `never`. Tests can pass `createMemoryHistory(...)`.
- **Behaviour: `queries.retry` is now a predicate, and it skips a 4xx.** It was the number `2`; it is now a function: twice, never on a 4xx except the transient 408, 425 and 429 (read from a numeric `status` on the thrown error). Code that reads `client.getDefaultOptions().queries.retry` as a number breaks. **Opt-out:** `query: { defaultOptions: { queries: { retry: 2 } } }` restores the old behaviour.
- **Behaviour: `basalt.query.hash` and `basalt.mutation.key` keep their names but change meaning.** Any dashboard, alert or query keyed on their old values (the raw query hash, the stringified mutation key) matches nothing after this release; group on the new value instead. `mutation.error`'s `basalt.mutation.key` (it was the raw `JSON.stringify` of the key, which embeds ids and slugs) and `query.error`'s `basalt.query.hash` (it was the raw query hash, the same stringified key) are now `groupingId(...)`: a 32-bit djb2 in hex. Events from one key still group together, but a dashboard that matched on key segments must group on the id instead. It is NOT a privacy guarantee: it is non-cryptographic, so a short or guessable key can be recovered by trying candidates. There is no opt-out; the contract says events carry ids and counts, not keys.
- **Behaviour: an unset `telemetry` logs query and mutation failures to the console outside production** (`[basalt] query.error`, attributes only). Production is unchanged: no sink, no events. **Opt-out:** pass any `telemetry` sink; once one is passed the console default is off (a no-op `() => {}` silences it).
- **Behaviour: `unwrap` takes any thenable, and any `error` other than `null`/`undefined` throws.** A non-native thenable (`PromiseLike`) is awaited instead of being read as an envelope, and the result is a real `Promise`. A falsy-but-present `error` (`false`, `0`, `''`) used to resolve with `data` and now throws that value. **Migration:** an envelope that signals success with `error: false` (or `0`, `''`) must map it to `null` first, e.g. `unwrap({ ...res, error: res.error || null })`. The function moved to its own module; the import path `basalt-ui` is unchanged.
- **Behaviour: `route.error` is emitted once a provider has mounted.** The provider binds in an effect, so an error thrown before the first provider effect (a loader failing during the initial load) is not emitted; with no bound handler it falls back to `console.error` in every environment (one line, no event). A router built without `basaltRouterOptions()` or `createBasaltRouter` warns that `route.error` telemetry is off (every bind in dev, once per document in production). `context.__basalt` is the coupling between the factory and the provider; do not read or write it.
- **`basaltRouterOptions` rejects a consumer `queryClient`.** `context` is typed so that `queryClient` and `__basalt` are `never` (basalt's `QueryClient` replaces anything passed at runtime), and `context` is required when your context type has required keys.
- **Recipe, not an export: OTel.** `basalt-ui` has no OTel dependency and ships no adapter; the event-to-span mapping is the `BasaltEvent` JSDoc example, and `init`'s `main.tsx` points at it.

### search stores: a pure server `validateSearch`, an imperative `clear()`

- **`store.validateSearch` and `store.linkSearch` are pure URL ⊳ fallback on the server and while a dehydrated page hydrates.** They no longer merge the localStorage mirror when there is no `window`, or while the router's SSR bootstrap (`window.$_TSR`) is present and no reader has committed yet, so the client's first search equals the server's and a loader keyed on `search` runs with the same deps on hydration. Right after that commit, a reader whose URL still carries the fallback adopts the mirror with a replace-navigation (a deep link naming any other value is never overridden), and later client navigations resolve URL ⊳ mirror ⊳ fallback again. A client-only app (argo, rb: no `$_TSR`) is unchanged. **Visible difference:** on an SSR app the URL briefly holds the fallback before the replace; a loader keyed on `search` runs once more with the adopted value. **Opt-out:** pass the stored value explicitly in the link (`search: store.linkSearch`) — an href built after hydration already carries it.
- **A URL-lane `field.clear()` navigates through the mounted router, not a closure a render left behind.** It works from any event handler while a `use()` of the store is mounted (with several routers mounted it navigates each one that owns the field), judges ownership against the location it is called at, and a discarded/StrictMode render can no longer register a stale closure. With no mounted reader it still clears the mirror only. **Opt-out: none.**
- **`buildSearchStore` is gone.** It was an internal pass-through of `createSearchStore`, never exported from `basalt-ui/state`; nothing public changes. **Opt-out: none needed.**
- **Dev warning:** a URL-lane field read on a route none of whose matched `validateSearch` runs this store (directly or composed) warns once per field — another store or a hand-rolled schema owns the param. **Opt-out: none; wire `validateSearch: store.validateSearch`, or spread it into your own.**

### Stable nav anchors, narrow shell contexts, one PageAside owner

- **Nav links no longer remount on navigation.** Each destination keeps one anchor component for the life of its `defineNav` config, so the sidebar, mobile bar and breadcrumb `<a>` nodes survive a route change and keyboard focus stays on the link you activated. **Requirement:** call `defineNav` at module scope. A `defineNav` inside a component is a new config every render and remounts the links as before. **Opt-out: none** (a test that relied on a fresh node per navigation must re-query).
- **An inline `badges={{ … }}` of numbers or strings is fine.** `useNav` compares badges shallowly per id, so a literal rebuilt every render no longer rebuilds the sections; the "hoist or memoize" guidance is gone. A JSX `ReactNode` badge is a new element every render and still rebuilds them: memoize that one.
- **A second concurrent `PageAside` warns in development.** The newest committed claimant (tree and commit order) owns the region, and the fold is keyed to the claimant, so an outgoing aside releasing no longer resets the fold the incoming one published. Render one `PageAside` per page. **Opt-out: none.**
- **Internal:** `ShellFrame` takes a required `activeCrumb`, and `AppBreadcrumbs` loses its never-produced `parentHref` prop.

### the theme reaches no Mantine component it configures

- **`createBasaltTheme` no longer value-imports the ~45 Mantine components it configures.** No consumer change; the produced theme is byte-identical. An app stops shipping the components the theme only configured (`AppShell*`, `Pagination*`, `Stepper*`, `Timeline*`, `MultiSelect`, `PasswordInput`, `Chip`, `Progress*`, `NavLink`, `Breadcrumbs`, …) — Mantine's `X.extend()` is `identity`, but calling it pulled each component module into every bundle. **Measured:** an embedded `<BasaltProvider spotlight={false}>` with no defines, peers bundled and every chunk counted, dropped from 166959 B to 54735 B gzip; `createBasaltTheme()` alone is 14420 B (`scripts/check-budgets.ts` gates both; the embedded ceiling went 168500 → 55300). **Equivalence:** `createBasaltTheme` was compared against the pre-change tree (0c4aeb1a) across default, density −3/0/+3, radius −5/0/+5 and derive options, invoking every `vars` / `classNames` / `styles` / `variantColorResolver` over sizes × variants × states × schemes: 12 pass, and a one-key mutation of the baseline failed all 12. Re-run it by checking out that commit in a worktree, installing, and importing both `createBasaltTheme`s in one test; `src/theme/plain-theme.test.ts` now snapshots the same resolver outputs. **Opt-out: none.**

## 2.12.0 — the provider bundles only what the app defines; Start wiring accepts a pathless layout

- **`ModalsProvider` is a sibling of the router, not its wrapper, and mounts only once `defineOverlays`, `overlays.open` or `overlays.confirm` asked for it.** `BasaltProvider` no longer imports `@mantine/modals`; the define call registers the mount, so a late call (a lazily loaded route) mounts it beside the app without re-parenting or remounting the tree. `useModals()` / `openContextModal` context is therefore **no longer provided**: a component calling `useModals()` throws "outside of context". **Opt-out: use the imperative `modals.*` / `overlays.*` API. Do NOT mount a second `ModalsProvider` while `defineOverlays` / `overlays` are in use** — Mantine's modals ride a window event bus, so every mounted `ModalsProvider` answers one `modals.open`, and you get two dialogs (pinned in `slots.test.tsx`).
- **`overlays.open` / `overlays.confirm` may wait for the mount.** The first call after the define registers the mount and waits for the provider to commit it: a tick normally, up to 5 s while a `BasaltProvider` is mounted and busy. With no `BasaltProvider` mounted, `confirm` rejects after 500 ms (as before, now delayed) and `open` warns in dev.
- **Spotlight mounts only when the app calls `defineNav` or `defineCommands`.** Nav entries and commands are what the palette lists; an app defining neither ships none of `@mantine/spotlight`. `spotlight={false}` still suppresses the mount. The dev dock's three `dev.*` palette commands now appear only in an app that defines nav or commands. **Opt-out: call `defineNav` or `defineCommands` (even `defineCommands({})`).**
- **Command shortcuts bind through `defineCommands`.** It registers the hotkey binder when any command has a `shortcut`, and rebinds if `defineCommands` runs again; `@tanstack/react-hotkeys` is no longer reachable from `BasaltProvider`, so an app with no shortcuts neither ships nor loads it (it was a ~15 KB gzip dynamic chunk that bundle-graph size bars counted). **Opt-out: none.**
- **Measured:** an embedded `<BasaltProvider spotlight={false}>` with no defines, peers bundled and every chunk counted, dropped from 190544 B to 166834 B gzip (`scripts/check-budgets.ts` gates it).
- **`doctor` accepts the Start provider in a pathless layout.** `<BasaltProvider>` may sit in `__root.tsx` or in `src/routes/_<name>.tsx` / `_<name>/route.tsx` at any depth (a landing kept at 0 JS mounts it in the layout). Exactly one `<BasaltProvider>` tag across the root and the layouts is allowed; a second one, even in the same file, fails naming the file. `router=` on the provider is rejected in a layout file too, as it was in the root. **Opt-out: none.**
- **New `app-wiring` fail: an untyped Start root route.** A root that exports `Route = createRootRoute(` has no `queryClient` in its router context, which the embedded provider reads. Fix: `export const Route = createRootRouteWithContext<BasaltRouterContext>()({ … })` (`import type { BasaltRouterContext } from 'basalt-ui'`) and pass the `QueryClient` in `createRouter({ context })`. A re-export, wrapper or missing `Route` export is not judged. `doctor` exits non-zero on it. **Opt-out: none.**
- **The `src/router.tsx` "never mentions queryClient" warning is gone.** The root route's declared type replaces the text heuristic; delete any `ignore if you build it elsewhere` note you kept for it.
- **Docs: the `motion` peer is `^14.1.0`.** It was exact-pinned at `14.1.0`; any 14.x ≥ 14.1.0 now satisfies it. **Opt-out: none.**

## 2.11.1 — lone points, end labels and axis ticks render cleanly

- **`Lines` draws a lone point.** A series with one finite value (a one-point window, or a value between nulls) drew nothing: a path of one point has no length. It now draws a dot in the series colour, at every isolated finite row (`gaps: 'connect'` bridges the nulls, so only a series with a single finite row is lone there). A point the series' own `getMarker` marks is not doubled. Delete any `getMarker` you added to make a single run visible. **Opt-out: none.**
- **`Lines` end labels never clip.** At the `wide` class a label whose room between its last point and the plot's right edge is too small (a last point on the edge cut "Download" to "Downloa") now ends at the point and sits above it. The room is read through the plot's own x mapping (`xDomain`, else the extent of every datum) against an estimated label width (0.85 em per glyph: it errs towards flipping, so a label of the widest capitals can still run long); a string x has no continuous position and keeps the default. Before the engine has measured the plot (the server HTML, the first client frame) the room is taken from the frame, which is wider by the axis gutters, so a label can start on its first frame and flip on the measured one. A label with room is unchanged. **Opt-out: none.**
- **Every band Date axis now gets bucket-snapped ticks by default.** `BandStrip`, `MirroredBars`, `Bars` and any other band x of Dates labelled every bucket and let the engine thin the collisions, which left an uneven subset that nearly touched ("18:13 18:17 18:21"). Ticks are now the time scale's own round instants, each snapped to the bucket it falls in (so a label may read 18:13, the bucket nearest 18:15); `xTicks` as a number sets the count. A string band x is unchanged. **Opt-out: pass `xTicks` as an array of the bucket dates to label.**
- **The first x tick label no longer sits on the y label.** A tick within 5% of the x domain's start (the first tick of a series whose domain starts on a round instant, or a round tick just inside one that does not) is start-anchored, so at the compact class (gutter y labels) its label stops under the lowest y label instead of centring on the plot's left edge. Later ticks stay centred. **Opt-out: none.**
- **`MirroredBars` bars reach both plot edges.** The panes used the padded band scale `Bars` uses (0.1 of a step of outer padding), so the last bar ended a tenth of a step short of the right edge and the first started that far in — 1.2 px at 30 daily buckets on a 390 px phone (0.8 px at 168 hourly buckets on 1440). Bars now sit flush: the first bar's left and the last bar's right edge are the plot's. The gap between bars is unchanged. `BandStrip` already filled the plot (probed at both widths). **Opt-out: none.**
- **Docs: only the CURSOR dot reads `getMarker` on consumer `marks`.** The 2.11.0 line "a `CartesianChart` with consumer `marks` can colour the dot" means the cursor dot of a `cursorValue` series, and only its `color`. Always-on per-point markers are `Lines`-only: on consumer `marks`, `getMarker` without `cursorValue` is ignored, so draw a persistent dot in `marks` yourself. The `getMarker` JSDoc and the `basalt-charts` skill say so now.

## 2.11.0 — Heatmap cells carry a state, a shared x domain, a self-pooling sparkline, visible reference lines

- **`Heatmap`: a position with no datum is inert.** Hovering before the window or after `now` used to snap to the neighbouring row's cell (a tooltip titled with another day's hour); it now opens no tooltip. Positions that hold a datum are unchanged. **Opt-out: none.**
- **`Heatmap` per-cell state: `getState` + `states`.** A cell whose `getState(d)` names a `states` entry (the `BandStrip` state fields: `key`, `label`, `color`, `fillOpacity`, `note`, `legend`) draws that flat fill instead of the ramp — so "failed" and "not measured" stop being one `null` fill. A stated cell is not a measurement, so it does not stretch the default `[0, max]` domain (pass `domain` to pin it). States are legended after the gradient (`legend={false}` hides both; the legend is concealed, not removed, under a `state` so nothing shifts on arrival), and only when `getState` is set, the tooltip's value row reads the state's label, and a key naming no state throws in dev (the valid set) and paints the plain ramp in production. Unused, the grid is unchanged. **Opt-out: omit both props.**
- **`Heatmap`: `formatLegend` and `tooltip.valueLabel`.** The gradient legend labels its two ends (not every step) and shared `formatValue` with the tooltip; `formatLegend` now formats the ends alone (default `formatValue`, so nothing moves until you pass one — only you know the compact form of a unit-bearing format). `tooltip={{ valueLabel }}` renames the fixed "Value" row. **Opt-out: omit both.**
- **`Heatmap` ramp floor 14% → 28%, absent fill 12% → 8%.** The lowest ramp step sat ΔE ≈ 4 from the flat absent fill on a tuned accent, so a near-baseline hour read as unmeasured; every step is now ≥ 10 ΔE*ab from absent in both schemes (`heatmap-fill.test.ts`, across line/accent/status inks). The ramp spans a narrower opacity range, so low values read darker than before. **Opt-out: none.**
- **`CartesianChart` (and `Lines`, `StackedArea`) take `xDomain: [min, max]`** in `x`'s type (`Date` or number). A time or linear x scale spans the data's own extent by default, so charts of different extents put one instant on different pixel columns under a shared cursor (a run series beside window-spanning buckets: 974 / 1005 / 1042 px at 24 h). Give each the same `xDomain` and they agree to the pixel (layout-probed, ±1 px, crosshair included); rows outside it are clipped by the engine, and `xZones`/`xTicks` read the explicit domain too. A string or band x (`Bars`, `MirroredBars`, `BandStrip`) is categorical and ignores it; a domain that is reversed, flat or not finite falls back to the data extent and warns in dev. **Opt-out: omit the prop.**
- **`Sparkline` pools itself to its measured width**: a line keeps each bucket's min and max (peaks and dips survive) at no more than one point per px, a bar series one bar per 2 px (the value furthest from zero), and the last row always stays so `emphasizeLast` lands on it. A gap (a `null`) is never closed: the finite rows beside it are kept, so it stays at its original indices. A series within its cap draws exactly as before. Only an unmeasured width (`<= 0`) pools nothing: the server HTML and the first client frame both draw at the 640 px initial width (a 3,000-row series is pooled to it, so they match; hydration-tested) and the chart redraws at the measured width. **Delete any consumer pooling you wrote to fit a cell; no new prop.**
- **Reference lines are stronger on the light scheme**: `--vx-good-ref`/`bad-ref`/`warn-ref` are now the status solid at 60% (were 30/30/20%), which lifts the light-scheme `warn` line from 1.25:1 to 2.07:1 against the page and keeps every status at or above 2:1 at the shipped defaults (1.7:1 at the derive-knob extremes; `ref-line-contrast.test.ts`). Dark lines get stronger too. **Opt-out: pass your own `color` (e.g. `alpha(VX.status.warn, 0.3)`) on the `RefLine`.**

## 2.10.0 — preset filters honour `.labels()`

- `NumberFilter` with `options`: a value `.labels()` names (`{ 0: 'Any' }`) now reads as that name in the pill though it is not an option, as the stepper form already did; no `Any` row needed. **Opt-out: none — drop the literal row if you added one.**
- **A `state` chart hides its legend (every kind).** `pending`, `error` and `empty` conceal the legend (`visibility: hidden`, plus `aria-hidden`) instead of listing series over a plot with no marks; its row is kept, so the chart does not shift when the data arrives (layout-probed: `Lines`, `BandStrip`, `MirroredBars`; error and empty on `BandStrip`). **Opt-out: none.**
- **`MirroredBars` takes `absentState`** (a `series` key, as `BandStrip.absentState`): that entry's colour (and `fillOpacity`) fills the absent share and its legend entry labels it; hiding the entry in the legend widens the measured bars to the full cell. Unset, the share stays `--vx-neutral` with no legend entry. A key naming no entry throws in dev and falls back to unset in production.
- **`BandStrip` legend swatches mirror a state's `fillOpacity`** (a state at 0.14 no longer draws a solid swatch over a pale plot).
- **`height` is the frame in every kind** (documented, nothing changes): a `BandStrip` or `MirroredBars` frame is the plot plus the x axis, so a band of a given height is `height` less the axis (about 21 px at the default font and density: a 44 px band is `height: 65`). There is no `plotHeight` prop; `marks` reads the plot area from `plot.plotWidth`/`plot.plotHeight` instead (below).
- **`PlotContext` gains `plotWidth`, `plotHeight` and `data`** (new fields, no new export; `width`/`height` stay the frame). `plotWidth`/`plotHeight` are the plot area in px, so a mark pinned in px is exact: a 3 px rail along the top is `y1: yMax - 3 * (yMax - yMin) / plot.plotHeight`, drawn from `yMax` (layout-probed at 3 px, three sizes). The engine lays the plot out after `marks` runs, so the first pass (server HTML, first client frame) reports the frame and the chart re-renders once with the measured area; a chart whose `marks` never read them pays nothing. `plot.data` is every row of `data` whatever the legend hides, for bucket-level marks (an absent column, a rail: the slot grid must not vanish with its last visible series); series marks still draw `plot.rows(key)` and gate on `plot.visible`. **Opt-out: none needed.** A composed kind (`DualPanel`, `MirroredBars`) reports each pane's own plot the same way.
- **A `cursorValue` series' cursor dot honours `getMarker(d).color`** (the prop `Lines` already has): a `CartesianChart` with consumer `marks` can colour the dot per datum, e.g. the loss colour of the hovered bucket. Each distinct colour is one extra mark, so keep colours a small categorical set. A series whose `getMarker` you already set alongside `cursorValue` now gets those colours on its cursor dot; unset, nothing changes. No opt-out needed for the fleet.
- **`fillOpacity` stays one number per `rect`/`dot` mark** (`@tanstack/charts` 1.1.0 types it `number`, not a channel): an opacity that carries a measurement is bucketed into N marks (round to a step, one mark per bucket). `basalt-charts` shows the pattern; no basalt option.
- **`tooltip.follow` is gone because 2.x anchors every tooltip to the cursor column** (`anchor: 'group-center'`), not because an option is missing: there is no pointer-following mode left to opt out of.

## 2.9.1

_Nothing to migrate in this release._

## 2.9.0 — 1.x compatibility layer removed

2.x carried leftovers of the 1.x line; each one is gone, and each has one replacement. **Opt-out: none — use the replacement.** The 1.x → 2.0 upgrade tooling (`RETIRED_RULE_IDS`, the retired-lint-rules and dropped-subpath fixes, the older `unknown-vx-token` removals) is unchanged.

| Removed                                                                                                                                                                                                                                                                                                              | Replacement                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| the 32 camelCase `--vx-*` aliases: `--vx-goodSolid`, `badSolid`, `warnSolid`, `axisStroke`, `dotStroke`, `tooltipBg/Text/Muted/Border/Shadow`, `legendText`, `accentHover`, `accentFill`, `accentFillHover`, `onAccent`, `surface-panelHover`, `fillHover-<family>` (12), `goodSoft`, `goodRef`, `badRef`, `warnRef` | the kebab name (`--vx-accent-fill`, `--vx-tooltip-bg`, `--vx-fill-hover-gray`, …); `unknown-vx-token` names each one |
| `BuildPaletteOpts.legacyAliases`                                                                                                                                                                                                                                                                                     | delete it (the aliases no longer exist)                                                                              |
| `basalt-ui tokens:css --no-legacy-aliases`                                                                                                                                                                                                                                                                           | delete the flag; it is now an unknown option and exits 1                                                             |
| `VX.line2Dark`                                                                                                                                                                                                                                                                                                       | `VX.line2`                                                                                                           |
| `StatCardTone` (type export from `.`)                                                                                                                                                                                                                                                                                | `Tone` (exported from `.`, identical union)                                                                          |
| `dist/tokens.css` (written by the build, never exported)                                                                                                                                                                                                                                                             | `basalt-ui tokens:css --out <path>`                                                                                  |
| `deprecatedProp` (`common` helper)                                                                                                                                                                                                                                                                                   | none; unused                                                                                                         |
| a bare `theme-allow` (no rule id) waiving every kind on its line                                                                                                                                                                                                                                                     | `theme-allow <id> — <why>`; a bare or prose-only annotation waives nothing and is reported as `theme-allow-unscoped` |
| `exemptRules` bare path segment (`'agent'` matching `src/agent/x.tsx`)                                                                                                                                                                                                                                               | a relative path (`'src/agent'`) or a glob (`'**/agent/**'`)                                                          |
| `exemptRules` kind inheritance (`EXEMPT_RULE_ALIASES`): a `raw-html-layout` exemption no longer covers `hidden-inline-style`; a `raw-surface` exemption no longer covers `surface-shadow-override` or `css-raw-surface`                                                                                              | list each kind explicitly: `{ 'raw-html-layout': [...], 'hidden-inline-style': [...] }`                              |
| `basalt/forms-field-key`'s `field(…)` spread message                                                                                                                                                                                                                                                                 | none; `field` was removed in 1.29.0, an import of it fails to compile                                                |
| `doctor`'s "stale basalt block in CLAUDE.md" warning                                                                                                                                                                                                                                                                 | none; the "CLAUDE.md does not import `@AGENTS.md`" warning stays                                                     |

`rollhook` (`tokens:css --no-legacy-aliases`) must drop the flag when it bumps. The injected token CSS shrinks by 2468 bytes (13280 → 10812; gzip 2710 → 2325).

`Section` anchors (`id`) now clear a shell-less `PageBar`: without `BasaltShell` the scroll-margin adds `--basalt-page-bar-h` to the clearance, so `#anchor` no longer lands under the sticky bar; inside the shell nothing changes.

`Section` takes controlled `open` + `onOpenChange` (Mantine naming) — given `open`, a click only calls `onOpenChange` and the value is mirrored into the local/persisted fold, so dropping `open` keeps what the reader last saw; uncontrolled keeps the persisted fold and `onOpenChange` also fires. Open a section from a URL hash with it instead of reaching for `writePersistedValue`.

`PageBar` placement in 2.x: the primary action renders at the END of row 1 (after the secondaries), not first; `title` leads the one sticky bar when there is no shell.

`basalt-ui/charts` now exports `foldBands(data, cap, merge)`, the fold `BandStrip` and `MirroredBars` run, as 2.0's table promised; `BandTooltipConfig` and `BandTooltipRowContext` never shipped (`ChartTooltipConfig` replaced them). The `absentState` colour must differ from every measured state's colour, not only by alpha.

`llms.txt` gains a `## Types` glossary of the exported literal unions its signatures name (`CalloutKind`, …), lists the full `VX` token tree, and prints the values of literal-only constant maps (`CONTAINER_KEYS`). Docs output only; nothing to migrate.

`NumberFilter`'s stepper pill prints a value `.labels()` names — `createSearchStore(…).labels({ minDuration: { 0: 'Any' } })` reads "Any" at the default (a number field's `options` now lists exactly the labelled values); unlabelled, it prints the number as before — nothing to migrate.

New config key `basalt.shell: false` (default `true`) for an app that never renders `BasaltShell`: `init`/`sync` then place neither `src/lib/nav.tsx` nor `src/routes/__root.tsx` (the root route imports the nav module) and retire a tracked entry with a notice, leaving the file yours; `doctor` warns if the app still renders `<BasaltShell`. Declared, not inferred.

The shipped oxlint preset turns `react(only-export-components)` off under `**/routes/**` and `__root.tsx`: the TanStack router plugin owns fast refresh for route files, and `allowExportNames: ['Route']` alone still warned on the file's local component. Other files keep the warning.

tsconfig: the preset's `exactOptionalPropertyTypes` rejects `x | undefined` for Mantine props typed without `| undefined` (`c`, `td`, `pl`, `style`). Spread conditionally:

```tsx
<Text {...(color !== undefined && { c: color })} {...(style !== undefined && { style })} />
```

lint: the 2.x preset's `react/refs` errors on the render-time `ref.current = value` latest-value pattern. Write it in an effect, or read it through `useEffectEvent`:

```tsx
useEffect(() => {
  latest.current = value
}) // instead of `latest.current = value` in render
const onTick = useEffectEvent(() => handler(value)) // or: no ref at all, call from effects
```

## 2.8.1 — boot paint follows the stored scheme

`basaltAppPlugin` now injects a tiny inline head script that reads Mantine's stored color scheme
(`mantine-color-scheme-value`; `auto` via `prefers-color-scheme`) and keys the anti-FOUC paint off
it, so a user who chose light no longer sees a dark flash on cold load. Nothing to change. A stored
value wins over the build-time `colorScheme` (an app that removes its scheme toggle should clear the
key). Pass `bootScript: false` under a CSP that forbids inline scripts without a nonce
(`html.cspNonce` covers both boot tags) or with a custom `colorSchemeManager` key.

**Mermaid diagrams.** `MermaidDiagram` no longer ships beautiful-mermaid's Google Fonts `@import`
inside the SVG (a broken `family=var(--basalt-font-sans)` request per diagram), and its
`font-family` is the unquoted `var(--basalt-font-sans)` instead of an invalid quoted `'var(…)'`
family. Behaviour fix; nothing to migrate.

**Dev chunks.** A production build no longer emits (or lets a PWA service worker precache) the dev-dock, theme-lab and devtools chunks: `BasaltProvider`'s dock `import()` is now dead code under a literal `process.env.NODE_ENV` read. Nothing to migrate; `check-budgets` gates it.

**Code-routed apps and tokens-only `doctor` (CLI).** An app that calls `createBasaltRouter` (in the
entry or a module it imports, statically or via `import()`) but has no TanStack router plugin, no
`routeTree.gen.*` and an entry that does not import one is code-routed. `init`, `sync` and `doctor`
share that one test: `init` places no `main.tsx`, `nav.tsx` or `__root.tsx` seed, `sync` drops their
manifest entries (the files stay yours) with a one-line notice, and `doctor` `app-wiring` accepts the
tree. `dropped-subpaths` now also runs for `tokens-only` consumers, so a removed
`@import 'basalt-ui/tokens.css'` fails there too. Fix: `basalt-ui tokens:css --out src/tokens.css`
and import that file.

**Code block copy button.** A `CodeBlock` without a `title` now reserves the floating copy button's box above its first line:
`padding-top` goes 10 → 28px (title-less fences are +18px tall), so the button no longer covers line
one on touch or hover. The reserve is `--vx-space-code-block-floating-copy-offset` + the 22px button;
titled fences are unchanged. The inner `pre` margin reset also outranks Prose's block margin now, so
the unhighlighted fallback and the highlighted fence measure the same.

**`TableOfContents` clicks and the end of the scroll.** A clicked entry stays active while its scroll runs and where it settles, until the scroll position moves again or the reader scrolls; the spy marks the first entry when nothing scrolls, and a heading within 80px of the scrollport's top counts as reached (it used to need to cross the top edge) — nothing to migrate.

## 2.8.0 — the fleet probe fixes

Ledger rows 61-67 (`docs/waves/argo-friction.md`), found while the rest of the fleet probed 1.x → 2.x.

- **`doctor` may report new failures (CLI).** `dropped-subpaths` now also scans CSS `@import`s
  (`'…'`, `"…"`, `url(…)`) and fails on `basalt-ui/tokens.css` and `basalt-ui/router-tanstack` even
  when the resolved install is a stale 1.x that still exports them (a `.claude/worktrees` tree
  without its own `node_modules` walks up to the main checkout's). Fix: commit
  `basalt-ui tokens:css --out src/tokens.css` and import that file; import nav symbols from
  `basalt-ui`, stores from `basalt-ui/state`.
- **`doctor` `oxlint-floor` (CLI).** With a `.oxlintrc.json`, oxlint below `1.79.0` fails: older
  versions reject the shipped preset's `react/*` rules. Fix: `bun add -D oxlint@^1.79.0`.
- **`BasaltProvider` embedded mode (shell).** Pass `children` instead of `router` to render inside a
  router the app does not own (TanStack Start): `<BasaltProvider><Outlet /></BasaltProvider>` in the
  root route component, with `getRouter()` putting a `QueryClient` in `context.queryClient`.
  `router=` usage is unchanged. Type-level: `BasaltProviderProps['router']` is now
  `BasaltRouter | undefined`; name `BasaltRouter` directly instead of indexing the prop.
- **Start apps in `init`/`sync`/`doctor` (CLI).** With `@tanstack/react-start` in the app's
  dependencies, `init`/`sync` seed no `src/main.tsx`, `src/lib/nav.tsx` or `src/routes/__root.tsx`,
  and `doctor`'s `app-wiring` checks the root route mounts `<BasaltProvider>` without `router=`.
- **`spotlight={false}` (shell).** `BasaltProvider` gains `spotlight?: boolean` (default `true`);
  `false` mounts no Spotlight and builds no actions, for an app with its own Cmd+K (1.x
  `BasaltOverlays spotlight={false}`).
- **`BandStrip` absent share (charts).** 1.x `BandSpan.absentFraction` returns, with
  `absentState="<states key>"` on the strip: a band's unmeasured share is painted flat in that
  state's color from the band's right edge, legended, with its own tooltip
  row. The absent colour must differ from every measured state's colour, not only by alpha: a
  "clean" state that is also neutral would otherwise be told apart from "not measured" by opacity
  alone. No hatch: `hatchFill`, `HatchPattern` and `hatchSizeFor` stay removed.

## 2.7.3

_Nothing to migrate in this release._

## 2.7.2 — llms.txt props for every subpath

- `llms.txt` now lists a props block under every exported component and hook on every public
  subpath, not just `./table`, `./charts` and `./forms` (argo friction row 57); `PageAside`'s
  `title` and `persistKey` no longer send an agent to `dist/**/*.d.ts`. No API change.
- Documented, not changed: a signed `DualPanel` legend swatch is a split circle below 480px of chart
  width and a split square from 480px, because the legend mode follows the container (friction row
  58).

## 2.7.1 — signed bar legend, DataTableRowAction export

- `DualPanel`'s bar legend entry is a split swatch (`positive` | `negative`) instead of the positive
  colour alone (argo friction row 52) — a visual change on every `DualPanel`, since the bar is
  always sign-coloured. Still one entry and one toggle: the sign halves hide together, because a
  sign is a property of a datum, not a series. No prop changes; plain `Bars` is unaffected.
- `DataTableRowAction<T>` is now actually exported from `basalt-ui/table` (argo friction row 53);
  § 2.7.0 said it was, and it was not (TS2305).

## 2.7.0 — table row actions, checkbox bindings, typed field errors

- `BasaltDataTable` takes `rowActions` (argo friction row 48): typed data in `BarActionItem`'s
  vocabulary — `{ key, label, icon?, onClick(row), danger?, disabled?(row), loading?(row) }`. The table appends a
  trailing, end-pinned, header-less column (sr-only "Actions") and renders an icon button for one
  action with an `icon`, an overflow menu (`Row actions`) otherwise. A click never reaches
  `onRowActivate`. The column renders in the table body only; a `renderCard` card owns its own.
  A disabled or loading action never fires. Each trigger is named per row (`Row N actions`, or
  `rowLabel(row)` when given). Pass a stable `rowActions` reference (module constant or `useMemo`).
  `DataTableRowAction<T>` is exported beside `DataTableFacet` from the module; no value export is added.
- `basalt/control-outside-home` now also flags a Mantine `Menu`/`ActionIcon` inside a column
  `cell`/`display` renderer, and the `basalt-controls` Homes rule names `rowActions`. Existing
  hand-rolled action cells will start to report: move them to `rowActions`, or waive with
  `theme-allow control-outside-home`.
- On notice (adopt-or-delete): named consumers are argo's `strength-tracker/components/workouts-table.tsx`
  (Edit + Delete) and `body-composition/components/skinfold-history-table.tsx` (Delete); neither
  has migrated yet. Their delete icons pass `loading`, which `loading(row)` now models.
- `basalt-ui/forms`: `inputProps(form, path, { type: 'checkbox' })` binds a boolean field to Mantine
  `Checkbox`/`Switch` (`defaultChecked` + `onChange` in the default uncontrolled mode, `checked` under
  `mode: 'controlled'`). It type-checks only on a literal path whose value is a boolean (dot paths,
  array indices, optional/nullable booleans included). Additive.
- `inputProps(...).error` narrowed from `any` to `ReactNode` (the key is always present, `undefined`
  on a clean field). Read a field error there instead of `form.errors.x` (TS4111), and pass it to
  `FormRow error` for a raw control. Code that treated it as `any` (a string method call, a
  `Record` index) now needs a narrowing. The new `InputProps` type is exported from `basalt-ui/forms`.

## 2.6.1 — per-bar legend shades

- `Bars`: a legend swatch now wears the shade its bars draw. It samples `barOpacity(firstRow, key)`,
  else the bar's `fillOpacity`, else the 0.85 default, so a per-series shade ladder (Warm-up / Work /
  Drop in one colour) no longer collapses to one flat swatch. The `dots` legend mode honours the
  opacity too. Visible change: default-opacity bars now show a 0.85 swatch instead of a solid one.
- `EnumFilter` stays internal to `basalt-ui/controls` (no export added): `SelectFilter` is the public
  single-choice filter and `DataTable` facets render `EnumFilter` themselves. No consumer needs the
  bare body (argo's DX trial reached for it from a task prompt, not from an app), so per the
  adopt-or-delete doctrine it is not exported. Its `.d.ts` still ships because `DataTable`'s
  declarations import it.

## 2.6.0 — external-store fields, a live query-fn-unwrap, page shape

- `externalField({ values, fallback, labels, store })` (`basalt-ui/state`) returns a `FieldHandle`
  over a value a foreign store owns (a zustand slice): `ViewTabs`, `SelectFilter` and `EnumFilter`
  take it as `field=` like any store field. No URL, localStorage or memory lane; `store` is the
  non-hook API (`{ get, set, subscribe }` — zustand's `getState`/`setState`/`subscribe`), read at
  definition so `clear()` writes `set(fallback)` mounted or not; `fallback` must be one of `values`. Replaces a raw `SegmentedControl` behind
  `theme-allow control-outside-home, raw-selection-control` (argo `timer-card.tsx`). Rule: `basalt-state`.
- A card BODY is still not a control home. Mount the bound control in the card's header slot
  (`<WidgetHeader actions={<ViewTabs field={timerMode} label="Timer mode" />} />`); no lint change.
- **Lint, may surface new errors:** `basalt/query-fn-unwrap` was dead since 1.29.0 (it only saw the
  removed `basalt-ui/query` import). It now also fires in files importing `basalt-ui`: an inline
  `queryFn` calling `fetch(` must wrap the response in `unwrap()`. A mock `queryFn` returning plain
  data is exempt.
- The `basalt-app` skill's page example is the canonical shell page (`PageBar` only to fill a slot);
  inside a `ChartCard` the card owns `state`, a bare chart kind owns its own.

## 2.5.0 — call-site fallbacks for controls, chat trace headers, axis labels

- `createLocalStore` fields take `withFallback(value)`: the same field (key, setter, `clear()`)
  with a call-site unset value, for `use()` and any filter control as `field=`
  (`<SelectFilter field={store.field.exercise.withFallback(leader)} />`). Never persisted; a reset
  returns to it; `fallback` and `isDefault` on the derived handle report it. Rule: `basalt-state`.
  `createSearchStore` fields do not take it: the URL lane drops a value equal to the definition's
  fallback, so a second default would make one URL mean two things.
- `use({ fallback })` is removed — replaced by `field.withFallback(value).use()`. It existed in
  2.4.0 only and has no known consumers. argo `strength-composite-chart.tsx`: bind
  `store.field.exercise.withFallback(leader)` instead of rebuilding the store per leader.
- A `telemetry` sink may define `startChatTurn(turn)` returning `{ headers?: { traceparent,
  tracestate? }, settle?(end) }`: `aiSdkTransport` sends those headers with that turn's chat
  request (so the API span joins the dashboard trace) and `settle` runs once when the turn ends
  (also on a superseded or failed turn). `Telemetry`, `ChatTurnTrace`, `ChatTurnEnd`,
  `TraceHeaders` are exported. Optional: without the hook nothing changes. A cross-origin chat API
  must allow `traceparent` in CORS.
- Y-axis tick labels sit inside the plot only for a compact chart under the box's short height
  (180 px), across every kind including `DualPanel` and `MirroredBars`; a regular-height chart
  keeps them in the left gutter. Reference-line legend swatches meet the series-swatch contrast in
  light and dark.

## 2.4.0 — chart gaps and legends, local-store fallbacks, the pre-commit hook

All additive; no call site changes. Named consumers are argo `apps/dashboard/src/features/…`.

- `createLocalStore` fields take `use({ fallback })`: a call-site default (e.g. a prop-derived
  leader) that applies only while the field is unset and is never persisted, so a reset returns to
  it. Replace a store rebuilt per prop with it. `createSearchStore` fields do not take it yet.
- The managed lefthook oxlint step passes `--no-error-on-unmatched-pattern`, so a commit whose
  staged files are all in `ignorePatterns` no longer fails; a real lint error still does. Picked up
  through the extended preset.

- `ChartTooltipRow` takes `swatch: 'solid' | 'dashed'`. A series with `dash: 'dashed'` now lists a
  dashed swatch in its own tooltip row on `CartesianChart`, `Lines`, `Bars` and `DualPanel` (it was
  solid while the legend and the line were dashed), and a `tooltip.rows` entry sets it itself. A
  `color` per point needs no new option: `tooltip.rows(d)` already receives the datum, so the row's
  `color` can be a function of it (garmin-health `recovery-trend-chart.tsx`, its `Zone` row). argo:
  `garmin-health/charts/stress-chart.tsx` (the dashed `Overnight` line).
- `RefLine.legend: { label, mark? }` gives a reference line its own legend entry (the line's color,
  dashed as `dashed`, role `reference`; a toggle hides the line, keyed by its index in `refLines`; series keys starting `__ref-` are reserved and throw in dev), so a threshold needs no always-`null`
  series. argo `strength-tracker/charts/weekly-volume-chart.tsx`: delete `LANDMARK_LEGEND` and put
  `legend: { label: 'MEV' }` on the three `refLines`.
- `DualPanelBar.tooltipFormat` and `DualPanelProps.top.tooltipFormat` format the tooltip rows while
  `format` keeps the axis ticks (default: `format`; `formatValue` still wins per row). argo
  `strength-tracker/charts/momentum-chart.tsx`: drop the separate `formatValue` copy of the axis format.
- `ChartSeries.cursorValue: (d) => number | null` gives a series drawn from your own `marks` a cursor
  dot: the y at each datum, shown while the cursor is on that x, in the series color. Pass a series
  with `getValue: () => null` (no tooltip row) and the mark stays yours. argo
  `astro-window/charts/sky-panorama.tsx` (the sun track).
- `ZoneSpec.edge` (`side: 'top' | 'bottom' | 'both'`) and `XZoneSpec.edge` (`'start' | 'end' | 'both'`)
  draw a rule along the band's boundary, with `color`, `dashed` and `width`. A bound at the plot edge
  (infinite, outside the domain, or an omitted x bound) draws none. argo
  `astro-window/charts/night-timeline-chart.tsx`: the shooting-window `rect` + two `ruleX` become one
  `xZones` entry with `edge: { side: 'both', color: VX.accent, width: 2 }`.
- `ChartSeries.gaps: 'break' | 'connect'` (`Lines`; default `'break'`, today's behaviour). `'connect'`
  draws the line, and its `area`, through the series' non-null points only, so a series that is null
  on most shared x values is one continuous line instead of dots and stubs. Markers stay on real
  points; the cursor and tooltip read the value at the hovered x (no value, no row). argo
  `strength-tracker/charts/relative-progression-chart.tsx` and `one-rm-trend-chart.tsx`: set
  `gaps: 'connect'` on each lift's series.
- Not added: a per-datum `fill` for the engine's `rect`. `@tanstack/charts` 1.1.0 types `RectOptions.fill`
  as a `string`; its `color` channel resolves through the chart's own color scale, which `marks` cannot
  reach. Keep one `rect` per fill bucket (argo `astro-window/charts/sky-panorama.tsx`, skyglow).
- The night-timeline lines can use `chartCurve(s.curve ?? 'monotone')` from 2.3.0 unchanged; nothing
  is missing there.

## 2.3.0 — optional-safe chart props, `chartCurve`, zone-coloured area

- Every optional prop of `ChartState`, `ChartSeries`, `AxisConfig`, the tooltip config and the chart
  kinds' own props accepts an explicit `undefined` under `exactOptionalPropertyTypes`, so
  `state={{ empty: rows.length === 0 ? 'No runs' : undefined }}` type-checks where it needed
  `cond ? msg : false`. Widening only: no call site changes.
- `basalt-ui/charts` exports `chartCurve(name)` and the `CurveName` union (`'monotone'`, `'linear'`,
  `'step'`, `'stepAfter'`, `'stepBefore'`). A `CartesianChart` `marks` function passes it to the
  engine mark: `lineY(rows, { x: 'x', y: 'y', curve: chartCurve('monotone') })`. `Lines` already took
  `ChartSeries.curve` (default `'monotone'`); a hand-written `lineY` without `curve` still draws the
  engine's default, so argo's fitness-trends RHR/HRV lines add the option there.
- `ChartSeries.area` takes `'zones'` (`Lines`): the fill is a vertical gradient coloured by the
  chart's `zones` on the series' axis, with hard stops at the zone boundaries and the usual area
  fade strength, light and dark through the zone tokens. Offsets are fractions of the area's own box
  (the engine's gradients use `objectBoundingBox` units, not `userSpaceOnUse`), computed from the
  series' values (the area closes to 0 even when the y domain excludes it), so the boundaries land at
  the zone values on a linear axis. A right-axis series takes the zones with `axisSide: 'right'`
  (and the left ones when the chart has no `y2`, as the zone underlay does). With no zone in reach the
  series-colour fade is kept. On a log axis it throws in dev and keeps the fade in production. argo's stress chart: `area: 'zones'` plus its four zones replaces
  the plain series area and the `thresholds` fill above 75.

## 2.2.0 — `doctor` in a monorepo, sparkline state, heatmap ticks

- `Sparkline` takes the same `state` as the other chart kinds (pending fills its box, error and
  empty show a dash with the label as its name). `StatCard` derives it from `query` and passes it to
  the `sparkline` render prop as `size.state`, so `<Sparkline {...size} />` is the whole call site.
- `StatCardSparklineSize` is exported from `basalt-ui`. The shipped oxlint preset sets
  `react/no-unstable-nested-components` `allowAsProps: true`, so the documented `sparkline` render
  prop no longer warns.
- `Heatmap` strides its x labels to the container class's tick count (6 at `wide`), where it drew
  every column.
- `doctor`'s `subpath-peers` check scans the app package's source and resolves each peer from the app directory (`basalt.app`, or the single workspace package that depends on basalt-ui), so a monorepo with the peers declared in `apps/<app>` no longer reports every peer missing. No action needed.
- `doctor`'s `dropped-subpaths` check likewise scans the app package's source rather than the install root, so a monorepo app's dropped `basalt-ui/<subpath>` imports are found. No action needed.

## 2.1.0 — the rail reaches folded groups, `toAgentError`

- `basalt-ui/agent` exports `toAgentError(error: unknown): AgentError`, the classifier
  `useAgentThreadRuns` uses for `ThreadRunState.error`. A custom transport calls it instead of a
  hand-rolled mapping; for a `Response`, pass `{ statusCode: response.status }`.
- The collapsed rail now shows every row of a `collapsible` section, including one folded by
  `defaultCollapsed` or by the user. Its header is hidden in the rail, so a folded group (argo's
  "Other") used to strand its destinations and their count dots. Expanding the sidebar restores the
  stored fold. No API change.
- `AppShell.Main`'s block padding is published as `--basalt-main-pad-block`; the data table's
  page-sticky offset reads it, replacing a duplicated `sm` media query. No consumer action.

## 2.0.5 — subpath peers

- `doctor` gains `subpath-peers`: when your source imports a basalt-ui subpath whose required peers
  are not installed (e.g. `shiki`, `@shikijs/langs`, `@shikijs/themes` for `basalt-ui/content`) it
  fails with the `bun add` line to run. Without them the build succeeded and the chunk threw
  "Could not resolve" at load. `CodeBlock` also warns once in dev when the highlighter cannot load.

## 2.0.4 — argo table and peer friction

- `BasaltDataTable` `stickyHeader` inside `BasaltShell` now pins flush under the app chrome. The
  header used to stick at `AppShell.Main`'s content edge, one block-padding below the band, so body
  rows scrolled through that strip. The default offset cancels the padding; a `stickyHeaderOffset`
  you pass still wins, so delete a hand-tuned offset that was compensating for the gap.
- A `Badge` in a table cell keeps its whole label (`WORKING` no longer shrinks to `WOR…` beside
  wrapping prose). Narrow numeric headers (`Peak`) clip only if the column is given a `size`
  smaller than its label — that is a column width, not a table default.
- The column-fold toggle column's header cell carries a visually hidden `Details` label instead of
  an empty `aria-hidden` cell.

## 2.0.3 — argo shell and CI friction

- `doctor`'s `app-wiring` follows the entry's relative imports (three deep): `createBasaltRouter`
  may be called in `src/lib/router.ts` (or any module `main.tsx` imports), not only in `main.tsx`.
- The seeded `.github/workflows/check.yml` runs `make check` when the repo's Makefile has a
  `check:` target, after `doctor` and `sync --check` (which always run, so drift is never
  skippable); otherwise it keeps the built-in lint, theme and format steps. `init` decides once, on
  seeding. An already-seeded workflow is yours and unchanged: replace its lint/theme/format steps
  with `- run: make check` to adopt it.
- The collapsed `BasaltShell` rail shows a dot on the icon of any nav item with a count or badge,
  and the link's accessible name carries the count (e.g. "Calendar, 3"). Expanded rendering is
  unchanged.
- `BasaltProvider` takes `navCommandLabel?: (item) => string` to label the Spotlight `nav.<id>`
  entries it generates from the nav (e.g. "Go to …"); default unchanged. A `defineCommands` entry
  with id `nav.<id>` now replaces the generated one instead of showing twice.

## 2.0.2

- `doctor` and `sync` are monorepo-aware. The manifest, `.claude/` and the AGENTS block stay at the
  install root; the app-scoped half (`tsconfig-base`, `app-wiring`, the `src/main.tsx`,
  `src/lib/nav.tsx` and `src/routes/__root.tsx` seeds) targets the app package: `basalt.app`
  (relative path, e.g. `"apps/dashboard"`) in the root package.json, else the one workspace package
  that depends on basalt-ui and has `src/main.tsx` or `index.html`, else the cwd. Two candidates
  fail with a message naming `basalt.app`. `doctor` run inside the app package finds the root
  manifest, and warns about a router seed an earlier `sync` left at the root — delete it.

## 2.0.1

- `doctor` gains `exact-peers`: for each exact-pinned peer of the installed basalt-ui (the three
  `@fontsource-variable/*`, `motion`, `remend`, …) it compares your installed version and prints a
  one-line `bun add <pkg>@<version>` fix on a mismatch. `bun add` accepts the mismatch silently.
  The three font peers now pin `5.3.0`.
- `doctor` gains `config-keys`: a key in the package.json `basalt` object that the config does not
  read fails with its fix. `basalt.chartMissingAriaLabel` is gone with its guard kind; `ariaLabel`
  is required on a chart now, so delete the key.
- Corrected the § 2.0 "Upgrading from 1.x" step 2: delete only the core, notifications and
  spotlight layer imports; extension packages (`@mantine/dates`, `@mantine/schedule`) stay, after
  `basalt-ui/styles.css`.

## 1.41.0 — the managed block moves to AGENTS.md

**Changed: `init` and `sync` splice the `<!-- basalt:begin … -->` block into `AGENTS.md`, not
`CLAUDE.md`.** Claude Code loads a repo-root `AGENTS.md` directly, but any `CLAUDE.md` in or above
the working directory suppresses it — so the block can no longer be the reason a `CLAUDE.md` exists.
The shipped template is renamed `agent/templates/AGENTS-block.md.tpl`, and the manifest key moves
from `CLAUDE.md` to `AGENTS.md`.

**Migration is automatic — run `basalt-ui sync` once.** If `CLAUDE.md` carries a basalt block:

- the block is cut out of `CLAUDE.md` and spliced into `AGENTS.md` (created if missing);
- a `CLAUDE.md` left empty, or holding only `@AGENTS.md`, is deleted; anything else in it is
  yours and stays — move it into `AGENTS.md` and delete the file, or Claude Code keeps loading
  `CLAUDE.md` instead of `AGENTS.md`;
- a hand-edited block is carried over as it is and treated as drift (skipped, reported;
  `sync --force` restores the shipped text) — the same rule every other managed unit follows;
- `sync --check` exits 1 until the move has happened, then 0;
- nothing is discarded silently: if `AGENTS.md` already has a block that differs from the one in
  `CLAUDE.md`, or either file has duplicate or unterminated markers, `sync` and `sync --check` exit 1
  naming the file, and both files stay untouched until you resolve it by hand.

`doctor` now warns (never fails) when a project-root `CLAUDE.md` does not import `@AGENTS.md` — it
suppresses `AGENTS.md` — or still carries a basalt block.

## 1.40.3

No API change, but light-scheme colours moved to clear WCAG AA. A consumer that commits an emitted
token file (`basalt-ui tokens:css`) or pins screenshots sees a diff:

- `--vx-faint` (light) `#737376` → `#69696c`.
- `--mantine-color-anchor` now resolves to `--vx-accent-hover`.
- `--mantine-color-error` reads the `bad` solid pulled toward ink.
- `Badge` light/outline text and inactive `SegmentedControl` labels read darker.

Re-emit the token file and accept the diff; nothing to change in code.

## 1.40.2

_Nothing to migrate in this release._

## 1.40.1

_Nothing to migrate in this release._

## 1.40.0

_Nothing to migrate in this release._

## 1.39.0 — the forms aliases leave

**Added: `BasaltShell headerHeight?: number`** (px, default unchanged — the density-tracking
`appShellHeaderHeight`, 44). One value for both sidebar forms and every width; the navbar and aside
tops, the page-bar band and Main follow it. A native unified-toolbar title bar sets ~52.

**Removed (grace ended — deprecated in 1.36.0, re-dated twice):** the six `basalt-ui/forms`
re-exports below. No autofix: move the import by hand.

| Was (`basalt-ui/forms`)                                                               | Now                                      |
| ------------------------------------------------------------------------------------- | ---------------------------------------- |
| `FormSection`, `FormRow`, `FormGroup`, `FormActions` (+ their `*Props`/`*Slot` types) | the same names from `basalt-ui/controls` |
| `useForm`, `schemaResolver`, `UseFormReturnType`, `UseFormInput`                      | `@mantine/form` directly                 |

`basalt/deprecated-export` keeps the rows as `removed: true`, so an old import still gets a finding
that names the new home. `useBasaltForm`, `inputProps`, `fieldKey`, `useFormSubmit`,
`FormStateProvider`, `useFieldArray`, `FormErrorSummary` and `useFormDraft` are unchanged.
The `public symbols` budget is back to 400.

## 1.38.1 — the content inset

No export changed. Two default numbers moved, both from `sm` up (the phone gutter is untouched):

| Measured, 1440px desktop                                  | Before   | After    |
| --------------------------------------------------------- | -------- | -------- |
| Main's inner box, from the sidebar seam (`appShellInset`) | 20px     | 16px     |
| Main's inner box, under the header / page-bar band        | 12px     | 8px      |
| Header breadcrumb x, expanded / rail                      | 269 / 61 | 272 / 64 |
| Brand mark x (the sidebar's nav-icon column)              | 20px     | 20px     |

The block inset is `stack-sm` from `sm` up and stays `stack-md` (12) on a phone. The breadcrumb
now sits exactly on Main's content edge (it was 7px short of it); the brand mark no longer borrows
the page gutter for its x — it is the nav-icon column (`row-inset-x` twice) on its own, so it stays
at 20 while the gutter is 16.

A consumer that wants the old numbers has no knob for them: the gutter
is a `SPACE_STEP` entry, so retune it through the density level or accept the new default.

## 1.38.0

_Nothing to migrate in this release._

## 1.37.1

_Nothing to migrate in this release._

## 1.37.0

_Nothing to migrate in this release._

## 1.36.1

_Nothing to migrate in this release._

## 1.36.0 — the 1.36.0 minor

### Guards — `unknown-vx-token` is an `error`

The last grace entry leaves the ledger, which is now empty. Its grace ran one minor past 1.35.0 so
the factory throw below stayed out of the shell a11y release. Measured 2026-10-01 on 1.34.x: all
nine consumers — argo, rb, image-gen, image-share, email-gateway, linewatch, obsidian, rollhook,
weatherorb — at 0 findings, basalt's own tree and the playground at 0 too. A finding after
upgrading is a `var(--vx-*)` written since: take the replacement from the finding's remedy (the
removed-name table in § 1.33.0) or a name from `basalt-ui/tokens.css`, or
`theme-allow unknown-vx-token — <reason>`. `groupTokens` / `seriesTokens` now **throw** (dev builds)
on a ref inside a basalt family instead of warning — rename the group (`groupTokens('app', …)`).

### `useSizeClass()` does not flash in a client-rendered app

Its JSDoc claimed the first client paint renders `sizeClassHint`. Only SSR and the `hydrateRoot`
pass do; under `createRoot` the FIRST render already reads `matchMedia` (now pinned by a test). So a
CSR app's page-level swap partnering shell chrome — a panel standing in for the sidebar at
`compact` — is `useSizeClass() === 'compact' ? <A /> : <B />`: one mount, no flash, no waiver. A
`hiddenFrom`/`visibleFrom` pair waived `raw-breakpoint` "so desktop never flashes" can go. No
`<html data-basalt-size-class>` ships: CSS keyed on a JS-stamped attribute is a second viewport
seam outside `shell/`, and it would flash under SSR exactly where the hook does not.

### The form layout moves to `basalt-ui/controls`

`FormRow`/`FormGroup` need no `@mantine/form`, but importing them from `basalt-ui/forms` evaluates
a barrel whose `useBasaltForm` value-imports it — so image-gen added `@mantine/form` only to render
a row, and weatherorb hit the same. Dropping the `useForm`/`schemaResolver` re-export alone would
not fix that, so the four layout pieces moved to `./controls` (it already owns `FilterSet`,
`PanelRow`) and resolve with no `@mantine/form` installed. Named consumers: image-gen drops
`@mantine/form` entirely; argo `explorer-page.tsx` and image-share `routes/public.tsx` move the
import. `FormRow`/`FormGroup` stay law C1's form-row home from either subpath.

| Was (`basalt-ui/forms`)                                                               | Now                                                                 | Removed in |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| `FormSection`, `FormRow`, `FormGroup`, `FormActions` (+ their `*Props`/`*Slot` types) | the same names from `basalt-ui/controls`                            | 1.39.0     |
| `useForm`, `schemaResolver`, `UseFormReturnType`, `UseFormInput`                      | `@mantine/form` directly (zero consumers imported them from basalt) | 1.39.0     |

**Grace:** every old import still resolves in 1.36.x–1.38.x (re-dated twice, from 1.37.0 and again from 1.38.0: consumers still import them). `basalt/deprecated-export` warns on the six
values, but the rows are `fix: false` — the autofix rewrites a specifier inside its own import
statement and cannot change the module — so move the import by hand
(`import { FormRow } from 'basalt-ui/controls'`). Both subpaths are homes for
`control-outside-home`/`raw-selection-control` throughout. The `public symbols` budget runs at 401
during the grace minor; 1.39.0 removes six.

### `useCoarsePointer()` — the pointer class in JS

Exported from `basalt-ui` (it was chart-internal). The JS twin of `--vx-hit`'s `(pointer: coarse)`,
for a branch CSS cannot express — mount a `PinInput` or a digit pad, attach a keydown listener.
Styling stays `@media (pointer: coarse)` in CSS. Server and hydration snapshot `false`; a
`createRoot` app reads the real pointer on first render. Named consumer: rb `lock-screen.tsx`,
whose `useMediaQuery('(pointer: coarse)')` and its `theme-allow raw-breakpoint` can go.

### Design calls closed without new API

Each was parked in the consumer loop pending a second named consumer; measured at 1.34.x:

| Ask                                  | Verdict                                                                                                                                                    | Do instead                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| a container class above `wide`       | none ships — one live site (a 1368px content-fit bar); the others moved to 800                                                                             | § 1.32.1 off-class table: own-name or `basalt-grid` query, no waiver             |
| `ContainerSwap` primitive            | none ships — every hand-roll is the 4-line one-query form, and most query a container declared above the swapped pair, which a component would have to own | § 1.32.1 swap recipe                                                             |
| shell-less top-level nav             | none ships — one app; `BasaltShell` is the one nav projection                                                                                              | `theme-allow control-outside-home — top-level nav, no shell`                     |
| Modal bottom sheet on a fine pointer | keeps keying on the compact SIZE class — the sheet is that class's overlay layout; the pointer axis owns hit size only                                     | nothing — a desktop window under 840px is `compact` and gets the compact overlay |
| `FormRow` `orientation` / width prop | none ships — one consumer                                                                                                                                  | `style={{ width }}` on the row                                                   |

## 1.35.0

Nothing to migrate: shell accessibility fixes only — the signed-out sidebar account row is named
in the collapsed rail, a settings entry can be the current page, a custom sidebar block stays in the
collapsed rail and the mobile drawer, and `raw-selection-control` judges by host-tag nesting instead
of a 12-line window. `unknown-vx-token` stayed `warn` here; it promotes in § 1.36.0.

## 1.34.1 — the AST lane needs a binary

`check-theme`'s "AST lane not enforced" notice and `doctor`'s `oxlint-preset` check now count the
lane as wired only when `.oxlintrc.json` extends the shipped preset AND an `oxlint` bin resolves
(`node_modules/.bin/oxlint`, from the project up to the repo root) — a config with no binary lints
nothing; add `oxlint` as a devDependency (no API change).

## 1.34.0 — the 1.34.0 minor

### `CONTAINER_KEYS` — the `SimpleGrid type="container"` keys ship

`basalt-ui/tokens` exports `CONTAINER_CLASSES` as the CSS lengths `SimpleGrid type="container"`
keys take (`compact` 240px · `regular` 480px · `wide` 800px), so the computed key is one import
instead of a template literal at every call site (argo: 19 sites behind two local `CQ_*` consts).
`micro` has no key — `base` is that class. `basalt/raw-breakpoint` judges theme names only, so the
computed key is green; nothing to waive.

```tsx
import { CONTAINER_KEYS as CQ } from 'basalt-ui/tokens'
;<SimpleGrid type="container" cols={{ base: 1, [CQ.regular]: 2, [CQ.wide]: 3 }}>
  …
</SimpleGrid>
```

| Delete                                                                                        | Replace with               |
| --------------------------------------------------------------------------------------------- | -------------------------- |
| ``[`${CONTAINER_CLASSES.regular}px`]`` (or `.wide` / `.compact`) as a key                     | `[CONTAINER_KEYS.regular]` |
| a local ``CQ_REGULAR = `${CONTAINER_CLASSES.regular}px` `` const (argo's `container-grid.ts`) | the import above           |

`Grid type="container"` is unchanged: `breakpoints={CONTAINER_GRID_BREAKPOINTS}` (§ 1.33.0) stays
its answer, and that map is now built from `CONTAINER_KEYS` — same values.

### `useBreakpoint` — removed from `basalt-ui`

| Was                                         | Now                                                                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useBreakpoint` — removed from `basalt-ui`  | shell chrome: `useSizeClass() !== 'compact'` for `'sm'`, `useSizeClass() === 'expanded'` for `'lg'`; a page's own layout swap: a `type="container"` SimpleGrid/Grid or an `@container` rule (§ 1.32.0 `basalt/raw-breakpoint`) |
| `BreakpointName` — removed from `basalt-ui` | — (no replacement; `SizeClass` is the shell's vocabulary)                                                                                                                                                                      |

On notice since 1.31.0, dated twice (1.31.0 → 1.33.0) and shipped one minor past that date; measured
fleet usage at removal was zero. The fix was never autofixable (the replacement is a different
shape), so `basalt/deprecated-export` keeps its row through 1.34.0 only to say the import is gone
instead of "still resolves".

### Guards — `unknown-vx-token` judges basalt's families in full (`warn`, `error` moves to 1.35.0)

`var(--vx-surface-2, transparent)` rendered transparent in image-gen since the file was written,
and 1.33.0 said nothing: it judged only removed names and bare roots, because `groupTokens` could
emit any name. Now:

- **Judged: every unemitted name inside a basalt-owned family** — the leading lowercase run of the
  name: `accent`, `fill`, `ink`, `line`, `radius`, `shadow`, `space`, `status`, `surface`, `text`,
  `tooltip`, … (the full list is in the finding's remedy, generated from what basalt emits). So
  `--vx-surface-2`, `--vx-ink3`, `--vx-space-gutter` and a bare `--vx-space` are all findings.
- **Not judged: a name in any other family** (argo's `--vx-activity-*`, rb's `--vx-confidence-*`),
  a computed name, and a name the same file declares.
- **`groupTokens` / `seriesTokens` warn** (once per name) on a ref inside a basalt family —
  `groupTokens('surface', …)`, a series key `ink3` — and **throw from 1.35.0**, when the kind
  promotes. That refusal is what makes the guard's judgement sound. Rename the group
  (`groupTokens('app', …)`), and its `buildPaletteCss` `groups` key with it. Measured: no consumer
  names one. `on` is not judged: the theme emits `--vx-on-<color>` for your own colors too.

Widening restarts the grace: `warn` through 1.34.x, `error` at 1.35.0. Measured at ship time:
argo, rb, image-gen, image-share, email-gateway, linewatch, obsidian, weatherorb all at 0
(image-gen's one hit was already fixed by hand in r4).

### `check-theme` says when the AST lane is not wired

When the nearest `.oxlintrc.json` up to the repo root neither extends a shipped preset nor loads
`configs/oxlint-plugin.js` with `basalt/*` rules on (or the target does not resolve), `check-theme`
prints one line — `AST lane not enforced — N basalt/* rule ids unguarded (incl. the promoted
control-outside-home, raw-breakpoint)`. Information only; the exit code is unchanged. `basalt-ui
doctor` names the fix.

### `card-with-border` names its `card-inset` half

Dropping `withBorder` and keeping `padding="md"` satisfied `check-theme` and then failed oxlint's
`basalt/card-inset`. The text-lane remedy now says to fix the inset in the same edit.

### `configs/oxlint-basalt.json` — the guard lane without the generic preset

Wiring `configs/oxlint.json` into a repo with history turns on the generic jsx-a11y / unicorn /
import / promise set alongside the `basalt/*` rules, and email-gateway hit unrelated errors before a
single guard could land. The new guards-only preset is the `basalt/*` plugin rules at their shipped
levels and nothing else:

```json
{ "extends": ["./node_modules/basalt-ui/configs/oxlint-basalt.json"] }
```

Take it first, move to `configs/oxlint.json` when the generic debt is paid. The full preset now
`extends` the guards-only one, so every `basalt/*` level lives in one file; extending the full one
behaves exactly as before. `doctor` and `check-theme` accept either.

The full preset assumes the shipped `tsconfig.react-app.json` base (`lib: ES2023`): its
`unicorn/no-array-sort` warning steers to `toSorted()`, which an older `lib` does not type. Extend
that tsconfig rather than waiving the rule.

## 1.33.0 — the 1.33.0 minor

### `CONTAINER_GRID_BREAKPOINTS` — the `Grid type="container"` map ships

`basalt-ui/tokens` exports the five-key map the 1.32.0 recipe had every consumer hand-write
(`xs` compact 240px · `sm` regular 480px · `md`/`lg`/`xl` wide 800px), derived from
`CONTAINER_CLASSES`. `basalt/raw-breakpoint` trusts it by name: before, it read an IMPORTED map as
unresolvable and flagged every `Grid.Col` span under it, so each route file declared its own
same-file literal (argo: five identical copies).

```tsx
import { CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'
;<Grid type="container" breakpoints={CONTAINER_GRID_BREAKPOINTS}>
  <Grid.Col span={{ base: 12, md: 4 }}>…</Grid.Col>
</Grid>
```

| Delete                                                                               | Replace with                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------- |
| a same-file `const GRID_BREAKPOINTS = { xs: …, sm: …, md: …, lg: …, xl: … }` literal | `breakpoints={CONTAINER_GRID_BREAKPOINTS}`   |
| a shared map you export yourself (flagged when imported)                             | the shipped one, or keep a same-file literal |

The trust is provenance-gated: the import must name `CONTAINER_GRID_BREAKPOINTS` from
`basalt-ui/tokens` (an alias `{ CONTAINER_GRID_BREAKPOINTS as bp }`, a namespace member
`tokens.CONTAINER_GRID_BREAKPOINTS` on `import * as tokens`, and a same-file `const bp = …` of
either all count; a parameter or inner `const` that shadows the name does not). A map of your own
that deviates from it — a 1200px `xl`, say — stays a same-file literal. `SimpleGrid type="container"` is unchanged: its keys
are CSS lengths, so ``[`${CONTAINER_CLASSES.regular}px`]`` stays the form (from 1.34.0:
`[CONTAINER_KEYS.regular]`, § 1.34.0).

### State and controls — `resets: ['page']`, `NumberFilter clearable`

Additive; nothing to change unless you carry one of the two workarounds below.

**`createSearchStore({ …, resets: ['page'] })`** drops the named sibling params — ones the store does
NOT own — in the same navigate as every URL-lane write that moves a value (setter, `clear()`,
`useReset()`); a `url: false` field makes no navigate and keeps the page. The route's own `validateSearch` resolves the default (`page` → 1). An explicit
`set(v, { patch: { page } })` still wins; naming a param the store owns throws at definition.
Store-wide by design: every filter of a list narrows the same list, sort included.

```ts
// before — an effect per page, which also snapped Back/Forward onto page 1
useEffect(() => { if (filtersChanged && search.page !== 1) navigate({ search: (p) => ({ ...p, page: 1 }) }) }, [filterKey])

// after — the store owns it; Back restores filter AND page, because they were one write
export const b2Filters = createSearchStore({ key: 'b2-filters', fields: { … }, resets: ['page'] })
```

**`NumberFilter clearable`** — parity with `SelectFilter`/`EnumFilter`: a `Clear` in the popover that
writes the fallback back, in both the `options` and the stepper form. "No filter" is the FALLBACK,
not a row: with `clearable`, drop an `{ value: 0, label: 'Any …' }` option — the pill reads the
filter's `label` while no preset matches.

### Guards — four ids promote to `error`

The last two twin pairs leave grace together, one law per pair and one promotion for both lanes:

| Law                   | oxlint rule (JSX)             | `check-theme` kind (text/CSS) | In grace since |
| --------------------- | ----------------------------- | ----------------------------- | -------------- |
| C1 — a control's home | `basalt/control-outside-home` | `raw-selection-control`       | 1.26.0         |
| the breakpoint law    | `basalt/raw-breakpoint`       | `raw-media-query`             | 1.31.0         |

Measured before flipping, 2026-10-01: all nine consumers on 1.32.1 — argo, rb, image-gen,
image-share, email-gateway, linewatch, rollhook, obsidian, weatherorb — at 0 for all four ids.
basalt's own tree and the playground are at 0 too, after two reasoned waivers in the package
(`legend-disclosure.tsx` clamps a fixed panel with `window.innerWidth`, a position rather than a
breakpoint; `ArticleGrid`'s `cols` is documented per viewport `lg`, so moving it to container keys
would re-flow every consumer's grid and ships opt-in instead).

If one fires after upgrading, it is code written since the measurement: the remedies are unchanged
(§ 1.31.0 for C1's homes, § 1.32.0 `basalt/raw-breakpoint` for the container recipe), or a
`theme-allow <id> — <why>`. `basalt.severity` still turns a kind down per repo; the shipped oxlint
preset's level can be overridden in your own `.oxlintrc.json`.

### `unknown-vx-token` — a removed `--vx-*` name is a finding (`warn`, `error` at 1.34.0)

A `var(--vx-*)` naming a token basalt does not emit resolves to its fallback — or to nothing — with
no error from tsc, oxlint or the browser. obsidian lost its 44px touch floor that way, to
`var(--vx-space-touch-target)`. `check-theme` now reports it, in every scanned file type. It ships
`warn` for this minor and promotes at 1.34.0. Measured at ship time: all nine consumers at 0.

| Removed name                                  | Replacement                                               |
| --------------------------------------------- | --------------------------------------------------------- |
| `--vx-space-touch-target`                     | `--vx-hit`                                                |
| `--vx-space-touch-control-height`             | `--vx-hit`                                                |
| `--vx-space-app-header-mobile-actions-height` | `--vx-space-sticky-header-clearance`                      |
| `--vx-space-sticky-header-clearance-mobile`   | `--vx-space-sticky-header-clearance`                      |
| `--vx-space-sidebar-brand-inset-top`          | none — the brand row is the header band (§ 1.30.0 Chrome) |

- **Judged: a removed name** (the table) **and a bare family root nothing emits** —
  `var(--vx-surface)`, `var(--vx-space)`, `var(--vx-status)`: basalt only writes `<root>-<key>`,
  and so does `groupTokens`. The live set is exactly `basalt-ui/tokens.css` plus three
  component-scoped names (`--vx-hit-gap`, `--vx-space-icon-size`, `--vx-keyboard-inset`).
- **Not judged: any other unknown name**, even under a basalt prefix. `groupTokens('surface', …)`
  emits `--vx-surface-<key>` from a file a per-file scan cannot see, so `--vx-surface-2` could be
  your group or a typo, and the guard does not guess. Check such a name against
  `basalt-ui/tokens.css` yourself. Your `defineSeries`/`groupTokens` series (argo's `--vx-lp-*`,
  rb's `--vx-confidence-*`), a computed name (`var(--vx-fill-${hue})`) and a name the same file
  declares are never reported.

## 1.32.1 — the 1.32.0 recipe resolves, and the gaps consumers hit upgrading to it

A patch: no new API beyond restoring what 1.31.0/1.32.0 already documented. Eight consumers
upgraded to 1.32.0; this section is what they had to find out by reading source.

### Fixes you can now delete a workaround for

| What                                                                                                                                                                                                                                                                                                                                                                  | Delete                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`SIZE_CLASSES`, `CONTAINER_CLASSES`, `resolveContainerClass`, `ContainerClass` are exported from `basalt-ui/tokens`.** The 1.31.0/1.32.0 sections, the `raw-breakpoint` message and the `BasaltDataTable` JSDoc all named that import; it did not resolve. A test now fails the build when a fenced import in this file names a symbol its subpath does not export. | the local `container-classes.ts` mirror or the literal `'480px'`/`800` — import them                             |
| **`FormRow` / `FormGroup` are control homes in `check-theme` too.** The oxlint plugin already treated them as homes; the text lane's `raw-selection-control` did not, so a correctly migrated form row warned (and would have errored at 1.33.0). A parity test now pins both lanes' home lists to one set.                                                           | every `theme-allow raw-selection-control — … FormRow/FormGroup …` waiver (grep `WORKAROUND: homed in a FormRow`) |
| **`basalt-main` is no longer an accepted `@container` name.** Nothing ever declared it, so a query against it never matched. Declare your own container (`container: <name> / inline-size` on the element) or use `basalt-grid` on the parent.                                                                                                                        | `@container basalt-main …` — rewrite against a container you declare                                             |
| **The `raw-media-query` message no longer over-claims.** Only `basalt-card` and unnamed `@container` queries are judged against the 0/240/480/800 table; any other declared name is accepted at any width. Same behaviour, honest text.                                                                                                                               | —                                                                                                                |
| **`raw-breakpoint` exempts a `tests?/` directory** (e.g. a `tests/setup/dom.ts` `matchMedia` polyfill), not only `*.test.*`/`__tests__`. The message now says `cols={{ base: 3 }}` is just `cols={3}`, and a `(hover: none)` read gets a pointer-tier hint.                                                                                                           | the polyfill's `theme-allow raw-breakpoint`                                                                      |
| **`FormGroup direction="row"` no longer stretches a trailing button** (`align-items: flex-end`).                                                                                                                                                                                                                                                                      | a `style={{ alignSelf: … }}` on the button                                                                       |

**This patch also TIGHTENS two checks — expect NEW warnings after upgrading, still `warn` until
1.33.0:** `raw-breakpoint` now sees a responsive object inside a conditional, logical or
const-resolved prop value (`span={wide ? { base: 12, md: 4 } : 12}` used to slip through), and
`raw-media-query` rejects `@container basalt-main`. (The `FormRow`/`FormGroup` change only removes
warnings.)

**After any guard narrows, audit your waivers:** `basalt-ui check-theme --audit-allows` lists every
`theme-allow` and whether it still suppresses anything. Dead ones (rb carried three
`in-body-page-title`, linewatch one `bound-control-outside-home`) go. Before 1.33.0 the audit also
called an `in-body-page-title` waiver dead when only the oxlint lane still needed it — if deleting
one makes `oxlint` fail, restore it.

**Scope — the breakpoint law is Mantine/CSS-scoped.** `raw-breakpoint` is an oxlint rule over JSX
and `raw-media-query` a `check-theme` kind over `.css`. A tokens-only (Tailwind) consumer has only
the `check-theme` lane; nothing here asks it to adopt `type="container"` grids.

### Container recipes 1.32.0 left implicit

**Swap two children at a container width in ONE query** — narrow default, flip both sides inside
one `min-width` rule. A `max-width: 799.9px` / `min-width: 800px` pair leaves a sub-pixel band where
both or neither render.

```css
.root {
  container: basalt-grid / inline-size;
}
.wide {
  display: none;
}
@container basalt-grid (min-width: 800px) {
  .narrow {
    display: none;
  }
  .wide {
    display: block;
  }
}
```

**A plain Mantine `Table` (not `BasaltDataTable`)** has no column fold or card projection; the
sanctioned remedy is the same CSS module — declare the container on the wrapper and hide columns or
swap to a list inside a `min-width` query. `BasaltDataTable` needs the optional
`@tanstack/react-table` peer; don't add it only to get the fold.

**Layouts that need a step above `wide` (800px).** There is no fifth class; one ships when two named
consumers need the same width. Until then, verified against the 1.32.0 plugin:

| Where                                                                    | Off-class width (e.g. `1200px`)                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SimpleGrid type="container"` px key — `cols={{ base: 1, '1200px': 5 }}` | passes: `raw-breakpoint` does not judge px keys, only theme names (`sm`)                                                                          |
| `Grid type="container"` `breakpoints` map value — `xl: '1200px'`         | passes: the map's values are not judged                                                                                                           |
| `@container basalt-card` or unnamed, in CSS                              | flagged — `theme-allow raw-media-query — <why this layout needs 1200px>`                                                                          |
| `@container <your-own-name>` or `basalt-grid`, in CSS                    | passes — the name is unjudged, so write no waiver (`--audit-allows` reports one dead); a minor that starts judging `basalt-grid` will say so here |

Either way, write the reason next to the width: it is the evidence the fifth class is waiting on.

**`ResponsiveChartHeight` `sm` (768px) → which key.** `wide` (800) is 32px later and keeps the old
step's meaning ("tablet or wider"); `regular` (480) opens 288px earlier. Pick by which side of the old
width the height was for.

### `BasaltDataTable` `renderCard` (1.32.0, undocumented here until now)

The law lives in the prop's JSDoc (`src/data/data-table.tsx`, shipped in `dist/data/table.d.ts`).
The points consumers tripped on:

- Swaps at the table's OWN width `< CONTAINER_CLASSES.regular` (480px), not the viewport.
- Card order is the table's processed order — sort, filter, page. For a domain order, pass
  `initialSorting` or sort `data`; there is no second sort.
- `minWidth` disables the COLUMN fold (it declares a horizontal floor) and is ignored by the card
  list. `stickyHeader` alone keeps the fold; pair it with `maxHeight` to stick at every width.
- Activation is click or **Enter** — not Space (the browser's page scroll on a focused non-button).

### Shell-less apps and the 1.31.0 breakpoint move

1.31.0 moved `sm` from 48em to **52.5em** (840px). What its checklist missed:

- **Re-key your own literals:** grep `.css` for `47.99375em` / `48em` → `52.49375em` / `52.5em`.
- **A shell-less app's gutter / sticky-bar CSS belongs under your own `shell/` directory** at
  52.5em: any `shell/`-pathed CSS may write a width `@media` at a `SIZE_CLASSES` boundary; anywhere
  else it is `raw-media-query`.
- **A consumer-owned Mantine `AppShell`** resolves `navbar.breakpoint` / `aside.breakpoint` through
  `theme.breakpoints`, so `breakpoint: 'sm'` collapses at 840px now, not 768px.
- **In the `medium` class the sidebar defaults to the rail**, and the rail hides a `kind: 'custom'`
  block entirely (a list block keeps a dot only with both `icon` and `count`). Anything a
  `medium`-width user needs must not live only in a custom block.
- **`PageBar` without a shell:** see the shell-less example in its JSDoc — `title` leads the one
  sticky bar, and `classNames.root` is where the gutter bleed goes.

### `useSizeClass()` outside the shell — two sanctioned uses

Layout stays a container decision; an overlay's form (`Drawer` side, sheet vs dialog) and content
paired with a `ViewTabs` option `only: 'sm-down'` may read it. Law and wording:
`agent/rules/basalt-mantine.md` (a shipped rule, placed by `basalt-ui sync`).

## 1.32.0 — `basalt/raw-breakpoint` gets its answer

### The C1 pair (`control-outside-home` / `raw-selection-control`) — `error` at 1.33.0, the last extension

Re-measured 2026-09-30: basalt's own tree 0, the fleet ~33 (image-gen 11, rb 7, image-share 6,
weatherorb 5, email-gateway 4, argo 2). Clear them on 1.32.0 while they still warn — the remedies
are unchanged (§ 1.31.0 below: a `PageBar` home, `basalt-ui/forms` rows, bound `FieldHandle`s, or a
reasoned `theme-allow`). 1.33.0 promotes all four ids — this pair plus `raw-breakpoint` and
`raw-media-query` — together.

### `basalt/raw-breakpoint`

1.31.0 shipped this rule (`warn`) with a message that said "reach for a container query" and named
no primitive, and this file never mentioned it. It flags four shapes; each has a concrete target
now. **Severity: `warn`, promotes to `error` at 1.33.0** (moved from 1.32.0 — this is the first
minor with a documented answer). A `theme-allow raw-breakpoint — <reason>` waives one occurrence.

**Its CSS twin, the `raw-media-query` guard kind** (`basalt-ui check-theme`), enforces the same law
in `.css`: a width `@media` outside `shell/**`, an `@container` name other than `basalt-card` /
`basalt-form` / `basalt-grid` (`basalt-main` was listed here too; dropped in 1.32.1, nothing declared it) or at a width off a `CONTAINER_CLASSES` boundary, and
a pointer query other than `coarse`/`fine`. Same `warn`, and it moved with the rule — **`error` at
1.33.0** (was 1.32.0). `theme-allow raw-media-query — <reason>` waives one line.

**The law.** `useSizeClass()` is for **shell chrome**. A page swapping its OWN layout — a column
count, a table for a card list, a row for a stack — is a **container** decision, keyed on
`CONTAINER_CLASSES` (`basalt-ui/tokens`: compact 240 · regular 480 · wide 800), not the viewport.
The primitive is Mantine 9's own `type="container"` grid. Verified against `@mantine/core` 9.3
source, which is what the rule's exemption is built on:

- `SimpleGrid type="container"` wraps itself in a `container: simple-grid / inline-size` div (no
  ancestor needed) and writes **each key verbatim** into `@container simple-grid (min-width: <key>)`.
  Keys are CSS lengths — `'480px'`, not `480` (unitless is invalid) and not `sm` (never resolved
  through `theme.breakpoints`; emits a dead query). The rule flags `sm`-style keys there.
- `Grid type="container"` only goes container **when it also gets a `breakpoints` map**; without
  one it silently renders viewport media queries (flagged). The map is typed
  `Record<MantineSize, string>` — all five `xs`–`xl`, no custom names — and `Grid.Col` keys resolve
  through it, so `sm` there means whatever width the map gives it (exempt).

| Shape (what it flags)                                                                           | Replace with                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| responsive object on a Mantine prop — `SimpleGrid cols={{ base, sm }}`                          | `SimpleGrid type="container"` with px keys (below)                                                                                                                                                                                        |
| `Grid.Col span={{ base, lg }}`                                                                  | `Grid type="container"` + a `breakpoints` map onto container widths; spans keyed through it                                                                                                                                               |
| `Flex direction={{ base: 'column', sm: 'row' }}`                                                | the container `SimpleGrid` (equal columns); a plain `Group` (wraps by default) for intrinsic-width items; or a CSS module: `container: basalt-grid / inline-size` on the parent, `@container basalt-grid (min-width: 480px)` on the child |
| `visibleFrom`/`hiddenFrom` outside a shell home or a control's C9 swap                          | the same container rule, `display` toggled in the CSS module — or drop the swap                                                                                                                                                           |
| `useMediaQuery`/`useMatches`/`useViewportSize` (`@mantine/*`), `window.matchMedia`/`innerWidth` | shell chrome: `useSizeClass()`; a page's layout: one of the above                                                                                                                                                                         |

```tsx
// before — viewport breakpoints
<SimpleGrid cols={{ base: 1, sm: 3 }}>…</SimpleGrid>
<Grid><Grid.Col span={{ base: 12, lg: 4 }}>…</Grid.Col></Grid>

// after — the grid's own width
import { CONTAINER_KEYS as CQ, CONTAINER_GRID_BREAKPOINTS } from 'basalt-ui/tokens'
// CONTAINER_KEYS ships from 1.34.0; before it, [`${CONTAINER_CLASSES.regular}px`]
<SimpleGrid type="container" cols={{ base: 1, [CQ.regular]: 3 }}>…</SimpleGrid>
// the shipped map (§ 1.33.0); on 1.32.x, a same-file literal of the same five keys
<Grid type="container" breakpoints={CONTAINER_GRID_BREAKPOINTS}>
  <Grid.Col span={{ base: 12, md: 4 }}>…</Grid.Col>
</Grid>
```

Pick the container key by the grid's own width, not by the viewport key it replaces: a grid inside a
page with an aside or a sidebar is narrower than the viewport, which is the point.

### `StatGroup` / `WidgetGrid` — `sm` opens at 800px, container name `basalt-grid`

Both grids now key on the container-class law basalt ships: the `sm` column count opens at the
`wide` class (**800px** of the grid's own width, was 768); the full `cols` count still opens at
1200px. A grid 768–799px wide now renders its base count (StatGroup 2, WidgetGrid 1). The
container they declare is renamed `basalt-stat-group`/`basalt-widget-grid` → **`basalt-grid`** — only
a consumer rule written against the old names needs editing. The `@supports not (container-type)`
viewport fallbacks (these two and `FormRow`'s) are gone: every browser that parses basalt's
`color-mix()` also parses `@container`.

### `useBreakpoint` — removal moved to 1.33.0, and the 1.31.0 replacement line was half wrong

`useBreakpoint('sm')` → `useSizeClass() !== 'compact'` holds for **shell chrome only**. A page
swapping its own layout on it (argo's table ↔ card list) is a container decision — see above. Note
that `useSizeClass()` answers `'compact'` on the first frame (the server snapshot,
`<BasaltProvider sizeClassHint>`) where `useBreakpoint` returned `undefined`, so an
`isLg === true` guard written for that `undefined` can go.

## 1.31.0 — size classes and the pointer tier

`theme.breakpoints` is now derived from `SIZE_CLASSES` (compact < 840, medium 840–1199, expanded
≥ 1200) and **no longer overridable** — `createBasaltTheme` drops a `breakpoints` override and types
it out. Mapping: `xs` = `sm` = 52.5em (medium opens), `md` = `lg` = `xl` = 75em (expanded opens) — the
keys collapse. So `xs` moves 36em → 52.5em, `sm` 48em → 52.5em (an iPad portrait is now bottom-bar chrome), `md`
62em → 75em, `lg` stays 75em and `xl` 88em → 75em. Check every `visibleFrom`/`hiddenFrom`/`useBreakpoint`
on those keys: `xs` no longer differs from `sm`, and `md`/`lg`/`xl` now switch at the same width. Outside a
shell home those props are `basalt/raw-breakpoint` findings — move them to a container grid rather
than re-keying them (see that section above).

| Removed                                                                                                                     | Replacement                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VX.spaceTouchTarget`, `--vx-space-touch-target`                                                                            | `VX.hit`, `--vx-hit` (24px on fine pointers, 44px under `(pointer: coarse)`)                                                                                                          |
| `VX.space.touchControlHeight`, `--vx-space-touch-control-height`                                                            | `VX.hit`; density-exempt, so it no longer tracks the knob                                                                                                                             |
| `DESKTOP_SECONDARY_MAX` (`./controls`)                                                                                      | none — `PageBar` row 1 folds secondary actions by its measured width (icon-only, then into `More`); removed with no grace window because nothing but the row's own count read it      |
| `resolveChartTier`, `chartTierMetrics`, `useChartTier`, `useChartTierMetrics`, `ChartTier`, `ChartTierMetrics` (`./charts`) | none — removed, no grace: zero consumers. Chart chrome sizes follow the measured container class internally; there is no public tier API to read it from                              |
| `VX.phoneChartWidth`                                                                                                        | `CONTAINER_CLASSES.regular` (`basalt-ui/tokens`) — removed, no grace: zero consumers, and the constant no longer drove any resolution                                                 |
| `ResponsiveChartHeight.sm/md/lg`                                                                                            | `regular` / `wide` — removed, no grace: zero consumers                                                                                                                                |
| `legend.mode` (every kind's `ChartLegendConfig`, `ChartFrameLegend`)                                                        | none — the resolver's own 'dots'/'chips' pick is the law; a speculative escape hatch with zero consumers that could silently re-open the plot-eating legend the wave-11 chain removed |
| `BasaltProvider host`                                                                                                       | none — `<html data-basalt-host>` is now always auto-detected (`pwa`/`web`); re-add when a Capacitor/Tauri consumer is named                                                           |

| Changed                                                                                                                   | Notes                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Themed `Modal` is a bottom sheet below the `medium` size class; `./content` hover-reveal affordances are visible on touch | Opt out of the sheet by overriding `classNames.inner`/`content`/`body`. A consumer `attributes` (Switch/Checkbox/Radio) or `closeButtonProps` (Modal) replaces the shipped `data-basalt-hit` shallowly — re-add `'data-basalt-hit': true` where needed. |

`--vx-space-mobile-nav-row-height` is 44px (was 40). A hit overlay is `[data-basalt-hit]` in
`styles.css`; the home controls' overlays now key on `(pointer: coarse)` instead of width.

**A touch press on a chart is now PROVISIONAL, not pinned on contact** (behaviour change; `useChartCursor`'s exported `ChartCursor<T>` type gains a required `onPointerUp` field and widens `onPointerLeave` to take the pointer event — source-compatible for the normal `{...cursor}`/JSX-prop usage every shipped kind and consumer chart uses, but a manual `cursor.onPointerLeave()` call with no argument now throws). `pointerdown` still resolves and shows immediately; `pointerup` for that pointer commits the pin; a `pointercancel`/`pointerleave` before commit (the browser taking the gesture as a scroll) clears the readout instead of leaving it pinned. A pinned tooltip is now also dismissed by a `document` scroll and by Escape from anywhere in the document, not just an overlay that holds focus. A bespoke chart wired directly to `HoverOverlay` (the five declared non-`CartesianChart` shapes, or a consumer's own) needs to pass through the hook's new `onPointerUp`/`onUp` the same way it already passes `onDown`/`onMove`.

**Chart axes economise space at `compact`/`micro` container width** (behaviour change, no API change).
Y labels draw inside the plot over the grid, on a solid background chip (wave 8: was a thin surface
halo stroke, which still let the digits visually blend into a bar's fill — a bar/band chart's first
and last ticks sit directly over drawn ink with no clear region the way a line/area chart's do) and
the left gutter drops to its floor; `micro` drops the y axis and keeps two x terminals; terminal x
labels anchor inward; multi-word x labels wrap before they rotate (rotate only past 2x what fits). A
tick within one line-height of the plot's top edge flips its label below the tick line instead of
above it, so it no longer clips against the chart's own SVG viewBox (wave 8). At every width y labels
over 4 chars compact (`12.5k`, `1.2M`) and the y tick count is one per ~44px of plot height (min 2).
Opt out with explicit props: `margin.left` (keeps y labels outside), `y.format`, `y.ticks`,
`xLabelRotate`.

**`useSizeClass()` (`.`) is added** — `'compact' | 'medium' | 'expanded'`, `useSyncExternalStore`
over one `MediaQueryList` per boundary. Its server snapshot is the new `<BasaltProvider
sizeClassHint>` (default `'compact'`). `PageAside` and `ThreadWorkspace` now read it: the first
server/hydration frame is `compact` unless a hint says otherwise, so an SSR app that used to get the
desktop `PageAside` projection first should pass `sizeClassHint`. `ThreadWorkspace`'s narrow layout
follows the compact class (< 840px, was < `sm` 48em).

**`<html data-basalt-host="web|pwa">`** is set by `BasaltProvider` (`pwa` when
`(display-mode: standalone)` matches, else `web` — always auto-detected; the `host="native"` force
had zero consumers and is removed). The shell's safe-area padding keys on a non-`web` host instead
of a raw `display-mode` query.

**`PageAside`'s `defaultFolded` default now depends on whether the aside can dock.** Where an open
aside would push main (`expanded`, main keeps its floor width) it starts open; everywhere else it
would overlay main, so it starts folded on the rail. An explicit choice — a persisted or toggled fold —
always wins. Opt out with `defaultFolded={false}` (open everywhere) or `defaultFolded` (folded
everywhere).

**The navbar defaults to the rail in the `medium` class** while nothing is persisted under
`storageKey`. Opt out with a controlled `collapsed` prop; a persisted `false` (the user opened it
once) pins it open.

**On notice — `useBreakpoint` (removal moved to 1.33.0).** `@deprecated`, still works. For shell
chrome, replace `useBreakpoint('sm')` with `useSizeClass() !== 'compact'` and `useBreakpoint('lg')`
with `useSizeClass() === 'expanded'`. A page's own layout swap is a container decision, not a
`useSizeClass()` one — corrected after release; see the `basalt/raw-breakpoint` section above.

**Card chrome keys on the card's own width, not the viewport.** `ChartCard`, `StatCard` and `Section`
are now `container: basalt-card / inline-size` (`container-type: inline-size` — layout and inline-size
containment). That has two consequences: a card needs a **definite inline size** (a block child, a
grid `1fr` track or an explicit width — it can no longer shrink-to-fit inside a flex row or an `auto`
grid track, where it would collapse to 0), and it becomes the containing block for `position: fixed`
and absolute descendants. What moved onto the card's width (`CONTAINER_CLASSES`: micro < 240,
compact 240–479, regular 480–799, wide ≥ 800):

- **Under 480px, or under 280px of the card's own HEIGHT regardless of width (wave 8), `subtitle`
  folds into the info glyph** and the visible line is hidden. A card with a `subtitle` and no `info`
  now renders a `More information` button (hidden past both floors); with both, the one glyph's
  bubble reads `info`, then `subtitle`. A test asserting the subtitle is visible in a narrow OR short
  card, or that no `More information` button exists without `info`, needs updating. The height half
  is JS-measured (`ChartCard` only, via a `data-basalt-card-short` attribute it sets from its own
  rendered height) rather than a `@container` size query — `container-type: size` collapses an
  auto-height card to 0, so there is no CSS-only way to query a card's own height without an
  explicit size. `StatCard`/`Section` do not (yet) set the attribute, so only `ChartCard` folds by
  height today.
- **From 480px (was 800px in 1.30.x — wave 8), `value` + `delta` sit on the title row**, before
  `actions`, instead of on their own row. The KPI value never ellipsizes any more: it shrinks with
  the card (`cqi`, `kpi` → 16px) and breaks a pathological string rather than clipping it. A short
  `ChartCard` (see above) also shrinks the value to the `lg` step and trims the header's own top
  inset, so a short-but-wide chart card's header stays at or under a fifth of the card's height.
- **`StatCard` `sparklinePlacement="right"` collapses to the stacked layout** when the card is under
  480px wide (it keyed to the viewport's `sm` before). Two-up cards on a
  desktop that kept the sparkline beside the value now stack when the card itself is narrow.
- **`StatGroup` is one column under 260px** of its own width, with no leading rail hairline.
- `ChartCard` is a flex column (`display: flex`, body `flex: 1 1 auto`): in a stretched grid row the
  spare height goes to the body.
- **The chart tier is the measured container class** (`micro`/`compact` < 480px keep the old phone
  metrics; `regular`/`wide` the desktop ones). **Hard removal, no grace window: `resolveChartTier`,
  `chartTierMetrics`, `useChartTier`, `useChartTierMetrics`, `ChartTier`, `ChartTierMetrics` and
  `VX.phoneChartWidth`.** Zero consumers, so these ship straight to removed rather than carrying a
  deprecated forwarder for one more minor — there is no replacement export; chart chrome sizes
  follow the measured container class internally, with no public tier API to read it from.
  `ChartTierMetrics.legendMaxRows` (the field a stated `legend.maxRows` could never actually reach,
  since the tier no longer caps a legend) goes with the type; state a cap with `legend.maxRows`
  directly where one is wanted. **Before the first measurement the class follows the viewport**
  (`<BasaltProvider sizeClassHint>`, default `compact`), so an unmeasured first frame is
  phone-shaped unless a hint says otherwise. With no `BasaltProvider` at all (a charts-only
  consumer) it is `regular`, never phone chrome.
- **`ResponsiveChartHeight` keys are `base` / `regular` / `wide`** (from 480 / 800px of the frame's
  measured width). **Hard removal, no grace window: the `sm`/`md`/`lg` aliases.** Zero consumers, so
  the old keys are gone outright rather than warning for a minor first — `sm` was `regular` (768 →
  480px), `md`/`lg` were `wide` (992/1200 → 800px, one step). A `height={{ sm: … }}` object now
  fails `tsc` on the unknown key; rename to `regular`/`wide` and re-check any object that relied on
  the old widths. **On notice (adopt-or-delete): the whole object form.** Nothing under
  `~/SourceRoot` uses `{ base, regular, wide }` over a plain number — the derived height law
  (`ChartFrame` with no `height`, next bullet) already covers the common case a per-step height
  existed for. A future minor may drop it for a plain number plus an explicit override, unless a
  consumer names a need for it first.
- **`ChartFrame` with no `height` derives one** from its measured width (≈0.62 / 0.5 / 0.4 × width by
  class, clamped 160–420, and to 0.45 × viewport height on a coarse pointer) instead of 240. A
  numeric `height` is an override and warns once in dev when it leaves the plot under
  `VX.minPlotHeight`. Inside a `ChartCard` the height is a minimum: the frame grows into a taller
  card body.
- **The legend fits by measured width, and `legend.maxRows` is `@deprecated`** (dev-warns once,
  removed in 1.32.0; an explicit value still wins this release, as an entry count). Overflow folds
  into an **`All N`** chip (was `+N more` / `Show less`) that opens every entry, toggles included, in
  a popover on a fine pointer and a bottom sheet on a coarse one — it never grows the band. A legend
  never rolls up fewer than 2 entries and left-aligns (was centred) with a 6px row gap. Inside a
  `ChartCard` with a header the legend now renders in the header slot instead of under the plot; a
  frame under 240px (micro) draws no legend. The phone tier no longer caps a legend at two entries
  by default.
- **Hard removal, no grace window: `legend.mode`.** A speculative escape hatch back to labels for a
  chart in a short card, added with zero consumers — the resolver's own `'dots'`/`'chips'` pick is
  now the only law, with no override.
- **Selectors and text matching the old rollup move.** Anything matching `+N more` / `Show less`
  (tests, e2e selectors, screenshots' text) now matches the `All N` chip and the disclosure it opens
  (`role="dialog"`, name `Legend`, `data-basalt-legend-disclosure`); there is no in-place expand.
- **Standalone `ChartLegend` no longer applies a tier entry cap.** It renders every entry unless
  `maxRows` is passed; only `ChartFrame` derives a cap (from the measured fit).

**`BasaltDataTable` folds low-priority columns instead of only scrolling, once the table no
longer fits its wrapper (behaviour change, no API change beyond the new `meta.priority`).** The
same measured fit `stickyHeader` already used (`useMeasuredContainment`) now also drives an
analytic fold: the lowest-priority data columns move into a per-row disclosure (a chevron toggle
in a new leading cell, revealing the folded columns as label/value pairs directly under the row)
until the rest fit, rather than forcing `Table.ScrollContainer` into horizontal scroll. **With no
`meta.priority` set anywhere — every existing `<BasaltDataTable data columns />` — the LAST
declared column folds first**, so a table that already fit its container renders exactly as
before; only a table that would otherwise have scrolled changes. Order it explicitly via
`meta.priority` on a column (a higher number folds before a lower one). Never engages beside an
explicit `maxHeight`/`minWidth` (a declared scroll box), and never folds the selection column.

**`Composer` pins itself above the on-screen keyboard, and its root is now a wrapper (behaviour
change, no API change).** `className`, `style` and `classNames.root` land on an outer wrapper that
also holds a keyboard-inset spacer (`--vx-keyboard-inset`, 0px when no keyboard is open), and the
input row plus actions sit in an inner stack. Padding, margin, border and background on the root
behave as before; a flex/`gap` override on the root no longer reaches the input row. Style the row
through `classNames.actions` or wrap the Composer instead.

## 1.30.2 — the `legendWins` collapse, and two things `ChartFrame` never said out loud

**A patch. Nothing is added, renamed or removed.** One rendering regression 1.30.1 shipped is
fixed; the other two entries correct documentation, not behaviour.

### Charts — a stated `legend.maxRows` no longer costs a `fill` chart its whole plot

1.30.1's `legendWins` drops `resolvePlotRect`'s `VX.minPlotHeight` floor so the caller's cap is
paid for out of the frame's own cell. `ChartFrame` measures its OWN node, and under `fill` its
`height: 100%` resolves to `auto` in a parent that states no height — so with the floor gone the
sequence has a fixpoint at zero: plot 0 → the legend is the only content → the box IS the legend
band → 0 again, forever. MEASURED in headless Chrome: a 7-entry `fill` chart at `maxRows: 3` in an
unsized parent rendered a 29.375px frame and **no plot svg at all**; with nothing stated the same
chart rendered a 120px plot in a 149.375px frame.

The floor now stands while the frame measures exactly its own legend band and nothing else, which
is the signature of a box nothing else sized. From there the frame is 120px + the band, the box has
room, and `legendWins` applies normally.

- **In the documented `fill` shape — a parent that states a height — nothing changes.** The plot
  still yields the cell to a stated cap, below `VX.minPlotHeight` and down to 0 when the legend
  band is taller than the cell. That is still the caller's arithmetic, made visible.
- **`fill` in a parent that states no height is not a supported shape** and never was: the frame
  has no external height to fill, so it settles on the plot floor. State a height on the parent
  cell, or use `height` / `aspectRatio` instead of `fill`.
- Pinned by `tests/layout/charts.layout.test.ts` INVARIANT 7 (both halves) — happy-dom cannot
  observe a `ResizeObserver` fixpoint at all.

### `ChartFrame` warns in dev when `height` or `aspectRatio` is passed with `fill`

`fill` always won and the other two were never read; the JSDoc said so and nothing else did. Both
now `console.error` once in dev through `common/errors.ts`' new `ignoredProp` builder. **No
rendering moves** — the props were already ignored. A consumer carrying `height` alongside `fill`
will see one message per prop and can delete the dead constants behind it. A mutually-exclusive
union prop is the stronger fix and is deliberately not in a patch.

### `legend.maxRows` counts ENTRIES, not rows — a documentation correction

`ChartLegend` slices `entries.slice(0, cap)`. `maxRows: 3` on a 7-entry legend renders three
entries and a `+4 more` chip, on ONE row at any width they fit. This is unchanged behaviour and
matches `ChartLegend`'s own JSDoc; § 1.30.1's "takes the rows it asked for" and the name itself
(plus `ChartTierMetrics.legendMaxRows`) said otherwise. **Nothing is renamed** — a public prop
rename is not a patch, and the value you pass keeps meaning exactly what it always meant.

## 1.30.1 — finishing 1.30.0

**A patch. Nothing is added, renamed or removed — three things 1.30.0 shipped are made to work, and
one number it published is corrected.** If you are on 1.29.x, read § 1.30.0 first and this second;
if you are already on 1.30.0, this section is the whole delta.

### Charts — the responsive `height` reaches the kinds it was written for

`ResponsiveChartHeight` (`{ base, sm?, md?, lg? }`) landed at 1.30.0 on `ChartFrame.height` alone.
`CartesianChart` and all nine kinds still declared `height?: number` and merely spread the value
through — and `basalt/hand-rolled-plot` forbids composing `ChartFrame` directly for a single-plot
cartesian chart, so the feature could not be reached from any compliant call site.
`MultiLine height={{ base: 200, sm: 260 }}` was a `tsc` error over a value that would have resolved
correctly at runtime.

Ten declarations are widened to `number | ResponsiveChartHeight` — `CartesianChart`, `MultiLine`,
`Bars`, `StackedArea`, `ZonedLine`, `BandStrip`, `MirroredBars`, `Heatmap`, `DualPanel`, `Donut` —
and `ResponsiveChartHeight` is exported from `./charts` so a consumer can name the type.
**Type-only, additive, no rendering moves**: a plain `number` behaves exactly as before, and the steps resolve
against the MEASURED container width (the same width the chart tier reads), never the viewport.

### Charts — `legend.maxRows` wins under `fill` too, and the plot yields

**This one MOVES RENDERING for a chart that already sets `legend.maxRows` inside a `fill` frame.**
1.30.0 promised an explicit `maxRows` "WINS OUTRIGHT" and delivered half of it: the tier default
stopped trimming the number, but `legendEntryCap`'s measured fit then ran `Math.min(fitted, caller)`
on top. In a docked panel — where `fill` is the norm and the row height sits near
`VX.minPlotHeight` — the fit is the binding constraint, so the documented escape was inert in
exactly the case it was restored for. Measured: a 7-entry legend in a 92–150px row rendered 2
entries at `maxRows` 3, 6 **and** 99, with five series drawn in colours nothing named.

The fit now resolves an ABSENT cap only. When a caller states a number on a `fill` band, the legend
takes the ENTRIES it asked for (`maxRows` counts entries, not rows — see § 1.30.1) and
**`VX.minPlotHeight` stops being a floor** — the plot yields the height instead. Both things that used to trim the number are framework DEFAULTS (the tier's cap,
and a floor about the plot); the stated number is the only intent in the room.

- **Expect a taller legend and a shorter plot** anywhere you set `maxRows` on a docked/`fill` chart.
  A number too large for the box now costs the plot visibly, in the frame you sized, rather than
  being silently rolled back up.
- **Opt-out: drop `maxRows`.** With nothing stated the measured fit applies exactly as it did at
  1.30.0, bounded by the tier's default. That is the same setting as before this change.
- **Fixed-height frames are unaffected** — they grow around their legend and never entered the fit.

### This file — the release-time rename is a script now

The `## Unreleased` → `## <version>` swap and its index column are performed by
`packages/basalt-ui/scripts/release-migrating.ts` in `prepareCmd`, committed through the same
`@semantic-release/git` assets list that keeps `llms.txt` current, gated by `--check` in the release
wrapper's preflight, and covered by tests. See this file's preamble for why the previous revision's
claim to have already done this was false. **Consumer-visible consequence:** the newest section in
an installed tarball carries its own version number. If it says `Unreleased`, file it.

**§ 1.30.0 § Guards carries a corrected number**, restated here because a published measurement
moved: weatherorb is 5 `control-outside-home` incumbents, not 0, and the fleet total is 34, not 29 — the
zero was a failed `npx --no-install oxlint` invocation read as "no findings". The four promotions to
`error` are unaffected and stand as shipped; only the extended C1 pair's count changed.

## 1.30.0 — the chrome wave

**Mostly CHROME, which removes and renames nothing: eight spacing numbers move, the mobile More
surface becomes a compact popover instead of a bottom sheet, and the aside's phone pill takes the
aside's own title.** Read § Chrome for the table and the opt-outs before you diff a screenshot.

**The one thing that can fail your build: four guard rules promote from `warn` to `error`** — and
all four were measured at ZERO incumbents across every consumer in the fleet before the promotion,
so the expected cost is nothing. § Guards has the measurement and the one rule that did NOT
promote.

### Chrome — the spacing pass, the More popover, and the aside's pill

**A VISUAL change, shipping as a plain `feat:` on the 1.x line.** Nothing is removed, nothing is
renamed and no call site has to change — but eight spacing numbers, the mobile More surface and one
pill label all move, so an app pinned to a screenshot will see a diff. Majors are banned here
(`feat!:` and `BREAKING CHANGE:` footers are forbidden), so the version number cannot carry that
warning and this section is it. Each behaviour change below names its opt-out.

**Eight spacing numbers** — six moved, two new, all level-0 values and all density-tracked
(`tokens/palette.ts`; every entry carries its own reasoning, and `theme/spacing.test.ts`'s file
header carries the wave's). One report drove all eight: the sidebar and header band read as small
controls floating in dead air while the page content sat too close to the seam.

| Token                    | Was     | Now | What it sizes                                                                                                      |
| ------------------------ | ------- | --- | ------------------------------------------------------------------------------------------------------------------ |
| `controlHeightCtl`       | 30      | 32  | the `ctl` tier — the whole chrome tier lands on ONE number now                                                     |
| `appShellHeaderHeight`   | 48      | 44  | the app-header band, one token tall at every viewport                                                              |
| `pageBarRowHeight`       | 40      | 36  | `PageBar` row 2's band — the secondary band stays a clear step under the primary                                   |
| `sidebarSectionGap`      | 12      | 16  | between nav sections                                                                                               |
| `sidebarSectionLabelGap` | 2       | 6   | a section label to its own list. The proximity pair was INVERTED, so every label read as heading the list ABOVE it |
| `sidebarRegionGap`       | 10      | 12  | between the sidebar's regions — now visibly bigger than the gaps inside one                                        |
| `appShellInset`          | _(new)_ | 20  | the page gutter from `sm` up, replacing the `SPACE_SCALE.sm` (13) the main column used to borrow                   |
| `appShellInsetMobile`    | _(new)_ | 8   | the page gutter below `sm` — at 13 a phone spent 6.7% of a 390px viewport on margin before a card was drawn        |

Both new entries ARE emitted as CSS variables — `--vx-space-app-shell-inset` /
`--vx-space-app-shell-inset-mobile`, unlike their JS-only `appShell*` neighbours. **The page gutter
is now RESPONSIVE**: `BasaltShell` hands Mantine `padding={{ base: 8, sm: 20 }}` and gives
`AppShell.Header` the same pair, both stepping at `theme.breakpoints.sm`, so the breadcrumb's left
edge, the global actions' right edge and the page's first column share one gutter at every width —
and above `sm` they land on the vertical line the sidebar's nav icons already sat on.

**The opt-out, and its one sharp edge.** These are structural theme tokens, so the lever is
`createBasaltTheme(overrides, { density })` — an integer level that moves the whole scale by the
law — never a per-token override. Re-declaring `--vx-space-app-shell-inset` in your own CSS restyles
whatever READS that var, but NOT the shell's own gutter: that value reaches Mantine as a JS number
through `useBasaltSpacing()`, deliberately — a Mantine spacing KEY would resolve back to
`var(--mantine-spacing-sm)` and hand the gutter straight back to the 13 this replaces.

- **`useBasaltSpacing` is on the root barrel** (`basalt-ui`) — the derived spacing objects behind
  those numbers, for a consumer computing geometry that has to track `density` rather than pinning a
  literal. Additive; it was already the shell's own reader.

**READING the gutter is the other direction, and it is a different variable.** The paragraph above
states the WRITE consequence; the read one caught a consumer. `--vx-space-app-shell-inset` is a
single value (20) with no phone twin in the same var, while the shell's real gutter reaches Mantine
as the JS pair and lands in **`--app-shell-padding`**, which Mantine emits per breakpoint. So
full-bleed math (`margin-inline: calc(var(--…) * -1)`, a height budget subtracting the page inset)
must read `--app-shell-padding` — grepping for the basalt-prefixed token gets a number that is
correct by coincidence from `sm` up and wrong on a phone (20 against the real 8). Inside a
`BasaltShell`, read Mantine's var.

**Shell-less, the two `--vx-*` gutter vars ARE your lever**, and that is the case they were emitted
for — nothing else in the framework reads them, which is why they are the exception among the
JS-only `appShell*` entries. A provider-only app that had a hand-maintained `Container px` pair and a
matching negative-margin `.bleed` pair, restating the same two numbers in two files behind two media
queries, deletes both and reads `--vx-space-app-shell-inset{,-mobile}` instead. Only `BasaltShell`'s
own gutter is unreachable that way.

**The mobile More surface is a compact POPOVER, not a bottom sheet**, and `MOBILE_MENU_MAX_DEFAULT`
rises 6 → 12. `projectMobileNav` is unchanged in shape — the surface is still INFERRED from row
count (0 drops the slot, 1 is a plain link, ≤ `menuMax` is a `menu`, past it a `sheet`) — but a
7-to-12-row slot now lands on `menu` where it used to raise a full-width Drawer. **The
never-below-the-fold guarantee moved off the constant and onto CSS**: the dropdown declares
`max-height: min(72dvh, 560px)` with `overflow-y: auto`, which binds at ANY row count, so the
constant is a taste bound on how tall one popover may get rather than the arithmetic it claimed to
be (that arithmetic — "6 × 44px against 415px of headroom" — was stale in nearly every term; the
rows are 40px). `menuMax` survives for the nav that has genuinely outgrown a popover. **Opt-out:
`mobileNav.menuMax`**, the unchanged prop — set it to `6` to restore the old cut-off, and it still
moves the line in both directions.

Riding along on the bar, all visible with no code change:

- **The bar paints `--vx-surface-panel`.** It used to resolve to `--vx-surface-bg` — the exact fill
  the scrollport above it paints — so the only thing separating the bar from the page was the region
  seam's 9%-alpha hairline, which is invisible on a phone. No new token, no shadow, no `withBorder`.
- **The dead taps.** Re-tapping the active tab scrolls to top and now REPORTS whether anything
  actually scrolled, so an already-at-top retap navigates instead of doing nothing; `menuRow` and
  `sheetRow` adopt the link row's activation rule (`aria-current`, the disabled guard) instead of
  each answering it differently; a disabled row no longer sets `pointer-events: none`, which
  swallowed the tap with no press state; the More tab is a real toggle, so a second tap closes it;
  and a sheet's overlay stops being hit-testable over the other tabs after `onClose`.

**`PageBar`'s phone aside pill carries the aside's own `title`**, not the literal word `Panel`
(`docs/ASIDE-SPEC.md` §0 — the title names the CONTENT, never the region, which is the rule the
desktop header already obeyed). The separate `ariaLabel` went with it: it existed only to put the
real title back for a screen reader, and once the visible label IS the title the two said the same
thing twice. No opt-out and none is needed — the pill takes no label prop — but a test asserting the
string `Panel` now reads whatever your `PageAside` names itself. Still no count: an aside's children
are not a `FilterSet`, so unlike `Filters (n)` there is no census to derive one from.

- **One new dev warning, no behaviour change.** Below `sm` a `PageAside` can only project into
  `PageBar` row 2, and that row exists ONLY when the bar has `tabs`, `filters` or a non-empty
  `filtersEnd`. A page whose bar carries `actions` alone therefore renders the aside in flow at the
  bottom of the page — deliberate, pinned by tests, and invisible on the desktop it was authored
  on, so `PageAside` now says it once in dev. The remedy is to give that bar a row 2.

### Dashboard — `StatGroup` and `WidgetGrid` key on the CONTAINER, and `cols={4}` goes 2-up at `sm`

**This is the item in 1.30.0 that can silently change a production layout, and the previous revision
of this section did not mention it at all.** Neither export changed shape; both changed where their
column law reads its width from.

- **The law now keys on the CONTAINER, not the viewport.** Each primitive renders its own
  `container-type: inline-size` box around the grid, so the counts follow the width the row
  ACTUALLY has. The shell moves that width with the viewport held still — a `PageAside` claiming its
  300px, the sidebar collapsing 256px → its 48px rail, your own split pane — and `@media` sees none
  of it. Measured: a `PageAside` on a 1512px desktop left a KPI row ~956px wide, `@media` still
  resolved `lg`, and four cells of 239px truncated their own values mid-word. **If you mount either
  primitive inside an aside, a split pane or beside a collapsible sidebar, expect a column count to
  drop where it used to overflow.** The old viewport law survives verbatim under
  `@supports not (container-type: inline-size)` for pre-2023 browsers, so there are two laws in the
  file and exactly one is ever live.
- **`StatGroup cols={4}` now takes TWO columns at `sm`, not three.** The general rule is still
  `min(cols, 3)`; `4` is the exception, because three columns leave a four-KPI row as 3 + 1 — one
  orphan cell against two thirds of empty track. `2`, `3` and `5` are unchanged. The full law is
  `base 2 → sm min(cols, 3), except 4 → 2 → lg cols`.
- **No opt-out, and none is offered**: `cols` is the DESKTOP count and a responsive object is
  deliberately not forwarded (that seam is what let five call sites in one app disagree). If you
  need a different law, you are outside these primitives.

Worth checking while you are here: `WidgetGrid` and `StatGroup` exist to own exactly the
`SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}` a dashboard hand-writes per page, and the container
fix only reaches the rows that adopted them. In the reference consumer, five KPI rows still
hand-roll the law over raw Mantine `Card` and no guard names it — a `SimpleGrid` of card-shaped
children is invisible to every rule. Grep for `SimpleGrid` before concluding the wave reached you.

### Charts — a responsive `height`, and the legend escape 1.30.0 promised

Both of these landed in 1.30.0 with no row here, and both were only partly reachable. **Read this
section against 1.30.1, not 1.30.0** — the § 1.30.1 entries above are what makes them usable.

- **`height` accepts `{ base, sm?, md?, lg? }`** as well as a plain number, resolved against the
  chart's MEASURED container width (the same width the tier reads), not the viewport. In 1.30.0 the
  widened type reached `ChartFrame` alone, while `CartesianChart` and all nine kinds still declared
  `height?: number` and merely spread it through — and `basalt/hand-rolled-plot` forbids composing
  `ChartFrame` directly for a single-plot cartesian chart, so the feature was unreachable from any
  compliant call site. It was type-only: the object always resolved correctly at runtime.
- **An explicit `legend={{ maxRows: n }}` beats the phone tier's default cap.** The tier keys on the
  measured box, so a 380px inspector panel on a 1440px desktop IS "a phone" and its two-row default
  rolled a six-series legend up to `+4 more` with no way to say no. `margin` and `xLabelRotate`
  always had that escape; the legend did not. Under `fill` a measured cap still applies on top — see
  § 1.30.1 for what that actually costs, because "can still roll up FURTHER" understated it.

### Toolchain — the shipped lefthook preset's `check-theme`, and what it does NOT fix

**The one item in this release with a known-broken incumbent state, and it had no row at all.** The
preset is `extends:`-ed, which means it auto-updates unread — so if you hand-patched around the
1.29.0 breakage, nothing else will tell you to re-examine that patch.

**What broke in 1.29.0** (two things, in one release): the CLI resolver stopped ascending to a
config-carrying ancestor — since then it is `BASALT_CWD`, else the invocation cwd, and it infers
nothing — while the preset's default bin was `bunx --no-install basalt-ui`, which resolves to
nothing at a repo root under bun's isolated linker. Lefthook runs commands at the REPO ROOT, so for
every consumer whose `basalt` config is not at the repo root the hook was a hard `0 files scanned`
failure. (It keys on where the **config** lives, not where the app lives: an app at `apps/web` with
its `basalt` block, manifest and `lefthook.yml` at the root was never affected.)

**What 1.30.0 fixes is ONE of the two.** The default bin is now
`${BASALT_BIN:-${BASALT_CWD:+$BASALT_CWD/}node_modules/.bin/basalt-ui}` — the local bin of the
package the guard runs FOR, failing with the path it looked for instead of a resolver error — and
the preset gained `root:` in its list of merging seams plus a monorepo recipe at the bottom of the
file. **The resolver is untouched.** So:

- **If you set `BASALT_CWD`, keep it.** Deleting the `env:` block is the natural reading of "the
  preset's `check-theme` was fixed" and it silently un-gates the hook again: with no `BASALT_CWD`
  the guard is back to scanning a config-less root. Only the `BASALT_BIN` half may now be redundant.
- **If you set `BASALT_BIN` alone**, it still wins outright and nothing changes.
- **If you spell the commands out with `root: '<pkg>/'`** rather than extending the preset — the
  sanctioned monorepo recipe — the new default never runs and this is a no-op for you.
- **`basalt-ui doctor` reads the MERGED config** (`lefthook dump`), so it is what tells you whether
  the result actually gates. The file's own comments are accurate; check against them, not against
  a summary.

### Guards — four rules promote to `error`, and the C1 pair does not

Every one of these six entries said in its own `why` that this release "is when the incumbent count
across argo, linewatch, image-share, rb, image-gen and the playground is re-measured" (law C16).
That measurement was taken 2026-09-09, with all seven consumers freshly migrated to 1.29.2 and
basalt built from `master`, by running `npx oxlint .` in each repo and counting by rule id — a
method that failed open in one of them, see the correction under the table:

| Rule                                                              | argo | image-gen | image-share | rb  | linewatch | weatherorb | obsidian | playground | Verdict      |
| ----------------------------------------------------------------- | ---- | --------- | ----------- | --- | --------- | ---------- | -------- | ---------- | ------------ |
| `basalt/provider-above-router`                                    | 0    | 0         | 0           | 0   | 0         | 0          | 0        | 0          | → `error`    |
| `basalt/forms-field-key`                                          | 0    | 0         | 0           | 0   | 0         | 0          | 0        | 0          | → `error`    |
| `basalt/query-fn-unwrap`                                          | 0    | 0         | 0           | 0   | 0         | 0          | 0        | 0          | → `error`    |
| `basalt/bound-control-outside-home`                               | 0    | 0         | 0           | 0   | 0         | 0          | 0        | 0          | → `error`    |
| `basalt/control-outside-home` + `raw-selection-control` (one law) | 2    | 10        | 6           | 8   | 0         | 5          | 0        | 3          | stays `warn` |

**Corrected at 1.30.1: weatherorb is 5, not 0 — the fleet total is 34, not 29.** The zero published at
1.30.0 was an artifact: weatherorb has no local oxlint binary, so `npx --no-install oxlint` failed there
with a package error and the counting pipeline read that failure as "no findings" — the same
silent-zero shape this file already warns about for `check-theme`'s fabricated roots, arrived at from the other side. The
five are real (`display-controls.tsx:258`, `stack-editor.tsx:301/323/337`, `forecast-tab.tsx:151`),
and re-measuring with a guaranteed-present binary is what found them. **The DECISION is unchanged**:
all four promoted rules re-measured at zero in every repo including weatherorb, so those four promotions
stand exactly as shipped — only the extended pair's count moved. A count taken through a repo's own
`lint` script rather than a bare oxlint invocation is not a measurement; weatherorb's `lint` is
`basalt-ui check-theme` alone and never runs oxlint at all.

**The four promotions cost nothing to take.** They were measured at zero, in every consumer, before
being flipped — which is the entire point of a grace window: it is a period in which the count is
allowed to fall to zero on its own, not a timer that fires regardless. If one of them fires in your
app, it is finding something none of the fleet had, and the message names the remedy.

**The C1 pair is extended to 1.31.0, and the reason is not the count.** The argument is that
**until this release, one class of consumer had no reachable home at all.** Every home both messages
listed was a shell slot — `PageBar` / `Section` / `WidgetHeader` — so an app mounting
`BasaltProvider` and no `BasaltShell` was being told to move a control somewhere it could not
render one. This release adds the missing sentence to both messages: a `PageBar` outside a shell
renders in flow, sticky, with its own `title`, which is what `PageBar` has always actually done.
Promoting a rule to `error` in the same minor that first makes it satisfiable hands you zero minors
to act on the answer.

**What that sentence does and does not buy, measured rather than assumed** — the 1.30.0 revision of
this paragraph rested the extension on "image-gen is a Tauri window with a hand-rolled header and
carries 10 of the 29 by itself" (the count as
published), implying a shell-less `PageBar` addresses those 10. It addresses
**zero** of them. image-gen's header `SegmentedControl` was already waived and is not in the count;
the real 10 are labelled `Select`/`SegmentedControl` form fields, a `Chip.Group` role tagger and a
canvas preview-mode switch. The remedy that moves that number is **`basalt-ui/forms`** — `FormRow`
and `FormGroup` both silence the rule, verified against a bare labelled `Select` — and adopting it
is a nine-site change that moves each label off the input onto the row. The extension still stands;
the reason is this:

- **A shell-less SINGLE-page app is closed by `PageBar`** — one page, so every control is a page
  control and row 2 is the honest home. That is the whole of linewatch.
- **A shell-less app whose switcher is primary NAVIGATION is not.** `PageBar`'s `tabs` models a
  page's sub-views; basalt models top-level nav only through `BasaltShell`, and `BasaltShell` is
  all-or-nothing — sidebar plus header plus scrollport — which a 100vh Tauri window with per-view
  keep-alive scrollports cannot take. The missing primitive there is a shell-less top-level nav,
  not a page bar.
- **A shell-FUL app was never blocked on reachability at all**, and 14 of the 34 are in one (rb and
  image-share both mount `BasaltShell`). Their blocker is law C1's other half: `PageBar.filters`
  accepts `FilterSet` descendants only, so the honest fix is porting hand-rolled `value`/`onChange`
  clusters onto bound `FieldHandle`s plus a `createSearchStore` — a page-shape change per page, and
  the 1.30.0 sentence made it no cheaper.

**1.31.0 is when the 34 are re-measured — with a bare oxlint invocation in every repo, and split by
whether the app mounts a shell.** The raw count is the wrong number to promote on; "how many are in
an app that already had a home" is the one that says what an `error` would cost.

Riding along, and the reason a single waiver now works: `control-outside-home` (the AST lane) and
`raw-selection-control` (the text lane) are one law with two rule ids, and until now
`theme-allow control-outside-home` parsed in the text lane and waived nothing there. A waiver naming
either id now covers both, at line scope and at `theme-allow-file` scope, in both directions.

## 1.29.2 — `unwrap` over a union-typed Eden response

A patch, one export's TYPE only. Nothing renamed, nothing removed.

- **`unwrap` strips `null`/`undefined` from a union-typed Eden response again** — the single
  conditional signature 1.29.1 landed still inferred `TData` off `Envelope<infer TData>`, and an Eden
  Treaty response is a UNION of envelopes (`{ data: T; error: null } | { data: null; error:
  EdenFetchError }`), not one envelope with a nullable `data`; inferring through the wrapper type
  read `T | null` at every Eden call site. `UnwrapResult` now infers the raw `data` field and wraps
  it in `NonNullable`, which distributes over a union `R` — `unwrap(await api.x.get())` resolves to
  `T` again, with no `| null`. Runtime unchanged.

## 1.29.1 — the DevDock router prop, `unwrap` as a callback, one retired guard

A patch. Two type corrections to exports 1.29.0 introduced, and one lint rule retired
because 1.29.0 made its premise unreachable — see § Guards below.

- **`BasaltDevDock`'s `router` prop now accepts a real TanStack `Router` instance with no cast** —
  the prior structural stand-in rejected a class instance under TS weak-type detection (no property
  overlap, no index signature), forcing `router={router as never}`. It is now `router?: object`:
  any non-null object is assignable, and the devtools panel remains the only reader.
- **`unwrap` collapses to ONE generic signature with a conditional return**, replacing the two
  overloads 1.29.0 introduced. The overload pair resolved `unwrap` to `unknown` whenever it
  was passed as a bare callback (`api.threads.get().then(unwrap)`) — `.then()` reads the declared
  type of the reference rather than applying an overload, and TS cannot propagate generic inference
  across an overload set the way it can for a single signature. `.then(unwrap)` now infers `TData`
  again, alongside `unwrap(await p)` and `unwrap(p)` — nothing about the runtime behaviour changed.

### Guards — `basalt/query-dual-import` removed

**Retired, not merely relaxed** — its `RETIRED_RULE_IDS` entry (kept recognized, so an existing
`theme-allow query-dual-import` still reads as a dead waiver rather than a typo) and its
`PLUGIN_RULE_GRACE` ledger row are both deleted. Its whole premise — a raw `@tanstack/react-query`
import beside `basalt-ui/query` — went unreachable the moment `./query` dropped (see § Consolidation
in 1.29.0 below): a consumer now MUST import `@tanstack/react-query` directly, and the rule warned on every
one of those imports instead of the drift it was written to catch (90+ false positives on a single
consumer). `query-fn-unwrap` is unaffected — it is a different rule, still `warn` (grace → 1.30.0).

## 1.29.0 — the consolidation: three subpaths dropped, every shim deleted, the CLI narrowed

**The removal minor.** Three published subpaths dropped, every `@deprecated` shim in the package
deleted at once, and the CLI narrowed to what a consumer actually runs — plus one additive wave (C5)
whose whole point is code you get to delete. Two of the three most expensive findings in the 1.25.0
→ 1.29.2 fleet migration came out of this minor and neither had a row of its own: the CLI resolver
change (§ CLI below) and the `field` deletion breaking this file's own `--fix` recipe
(§ Consolidation below). Both have one now.

### Consolidation — three subpaths dropped, every `@deprecated` shim deleted

**Dropped subpaths — three, all folded into `.`/`./provider`, none deleted outright.**

<!-- C1 symbol list -->

- `./query` — dropped. `createBasaltQueryClient`, `unwrap`, `BasaltQueryDevtools`,
  `toErrorMessage`, `errorStatus` now on `.` (root barrel) — import from `basalt-ui` instead of
  `basalt-ui/query`. The nine raw TanStack re-exports it carried (`QueryClientProvider`,
  `QueryErrorResetBoundary`, `useQueryErrorResetBoundary`, `useQuery`, `useSuspenseQuery`,
  `useMutation`, `useQueryClient`, `useInfiniteQuery`, `queryOptions`) are gone from basalt entirely —
  import them from `@tanstack/react-query`, which the root entry already requires.
- `./data/table` — **narrowed, not dropped**: `BasaltDataTable`, its types and `createColumnHelper`
  stay; the TanStack pass-throughs (`useReactTable`, `flexRender`, `getCoreRowModel`,
  `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`, `ColumnDef`, `SortingState`,
  `ColumnHelper`, `PaginationState`, `ColumnPinningState`, `RowSelectionState`, `ColumnFiltersState`)
  are imported from `@tanstack/react-table` directly.
- `./connectivity` — dropped. `ConnectivityProvider` (auto-mounted by `BasaltProvider`, no
  consumer-side import needed), `useConnectivity`, `ConnectivityIndicator` now on `.`.
- `./data` (bare) — dropped. It never carried its own exports beyond re-exporting `./data/table`
  and `./data/virtual` — import the narrow subpath you need directly; nothing renamed.
- `./controls-dates` — **unaffected**, stays a separate subpath (inlining it into `./controls`
  would pull `@mantine/dates` into a subpath that must resolve without it).

**Deleted `@deprecated` shims** (every one slated for 1.29.0 removal in an earlier minor's
deprecation row — see that minor's own `MIGRATING.md` section for the original `@deprecated`
annotation and rationale):

- `state.ts`'s legacy connectivity export — use `./provider`'s `useConnectivity` instead.
- `BasaltProvider`'s flat `sseUrl` / `healthUrl` / `healthIntervalMs` props — use
  `connectivity={{ sseUrl, healthUrl, healthIntervalMs }}`.
- `QueryStateVariant` and the `variant` prop on `QueryState`/`LoadingState`/`ErrorState`/`EmptyState`
  — use `QueryStateTier` and `tier`. **Identical values, identical branch behaviour**, verified by
  diffing `src/dashboard/query-state.tsx` at `v1.25.0` against 1.29.2: the union is `'page' |
  'section'` in both, and `'section'` takes the same bare/compact branch in both. A pure rename, so a
  `variant="section"` becomes `tier="section"` with nothing to eyeball afterwards.
  `QueryStateTier`'s own JSDoc says "`'section'` meant two different things across the two
  spellings" — that is the NAMING rationale for picking `tier` (audit B #19), not a behaviour
  warning, and it has been read as one twice: once by a fleet audit that told consumers to "eyeball
  the rendered tier once after the change", once by a migration agent that stopped to diff the
  sources. It does not describe a value-semantics change.
- `createSearchParamStore` / `createMultiSearchParamStore` (`basalt-ui/router-tanstack`) and the
  legacy branches they kept alive in the field vocabulary — use `createSearchStore` with
  `field.enum` / `field.multi`.
- `field` on `basalt-ui/forms` — use `inputProps(form, path)` + `fieldKey(form, path)`.
  **The two-pass `oxlint --fix` recipe in 1.28.0's § `inputProps` DOES NOT WORK if you land here.**
  Pass 1 (`basalt/deprecated-export` autofixing `field` → `inputProps as field`) never fires: the
  row leaves `DEPRECATED_EXPORTS` in the same minor the export does, so at 1.29.x there is nothing
  deprecated to nudge. Pass 2 (`basalt/forms-field-key`) reports the `field(` spread but does not
  autofix it — its fixer only handles an `inputProps(` spread missing a `key`. So: **coming from
  1.28.x the recipe holds; coming from 1.27.x or earlier, every call site is a hand edit.** It is
  two edits per field, and `field` at least fails to compile, unlike the `key` half:

  ```tsx
  /* 1.27 */ <TextInput {...field(form, 'email')} />
  /* 1.29 */ <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} />
  ```

  Find them all: `rg -n '\bfield\(\s*\w*[Ff]orm\b' --type ts` (`--type ts` covers `.tsx`).

- `BasaltNotifications` / `BasaltNotificationsProps` (`basalt-ui/notifications`) — mount
  `<BasaltOverlays notifications />` from `basalt-ui/commands` instead. **Doctrine exception,
  recorded**: this one never carried a `deprecated-export` row; it was superseded in 1.2x and its own
  JSDoc warned against mounting it next to `BasaltOverlays`, so it leaves in the same minor as the
  other shims. The `duplicate-notifications-mount` lint rule that only existed to catch the
  double-mount is retired with it.
- `ConnectivityIndicatorProps` stays on the root barrel (it is `BasaltProps`).

- `ZonedLine`/`Bars`' `ZoneSpec` aliases — use the canonical `AxisConfig`-scoped zone type each
  kind now exports directly.
- `inputProps`'s `key` return field (already shape-changed in 1.28.0 — see § `inputProps` no longer
  returns `key` there) — fully removed this minor; use `fieldKey(form, name)` alongside
  `inputProps(form, name)`.

**On notice for 1.30.0** — a public export with exactly one consumer (the playground) as of this
audit. Adopt-or-delete: gains a real consumer by 1.30.0 or is removed. Not a promise either way;
say so in an issue if you pick one up.

- **Threads/agent-chat composite tier**: `ThreadWorkspace`, `ThreadFeed`, `ThreadFeedRow`,
  `ThreadDetailPanel`, `ThreadOutcomeCard`, `ThreadsStoreAdapter`, `createThreadsStore`,
  `createAdapterThreadsStore`, `threadsStoreAdapterContract`, `threadPartRenderers`,
  `definePartRenderers`.
- **Chart kind**: `Heatmap` only — `DualPanel` has an argo consumer and `MirroredBars`/`BandStrip`
  are consumed by linewatch, so those three are NOT on notice.
- **Nav/shell**: `PageAside`, `PanelRow`, `SettingsRow` (playground-only as of this audit).
- **Controls**: `SliderControl`, `SearchFilter`, `ToggleFilter`, `CompareFilter`, `OverflowMenu`,
  `ControlGroup`.

**The common primitives, as a unit.** `src/common` (shipped from the maturation round) is now the
one place the base prop / error / ref vocabulary lives: `BasaltProps`, `SlotStylesProps`, `cx`,
`mergeRefs`/`assignRef`, the prefixed `errors.ts` table (`toErrorMessage`/`errorStatus`),
`useValidateProps`, `assertRequiredProps`. Every basalt component extends `BasaltProps` for its own
prop type rather than redeclaring `className`/`style`; a consumer composing over a basalt component
should do the same.

### Additions — what C5 lets a consumer delete

C5 consolidation — every item below names the argo lines it lets a consumer delete
(`.claude/maturation/consolidation-plan.md` §C5, `audit-f-argo-consumer.md`). All additive; nothing
in this block removes or renames an existing export. **Additive is not the same as ignorable**: two
of these REPLACE code a consumer is already hand-rolling — see § `basalt-ui/format` below, and
`PageTitle`, which is the answer to the `in-body-page-title` waiver a shell-less page needed.

- **`basalt-ui/format`** — new subpath, Mantine-free and React-free: `money`, `percent`, `integer`,
  `compact`, `deltaPct`, `duration` (seconds → `"1h 02m"`; `{ unit: 'minutes' }` for a
  minutes-based input), `durationClock` (`"1:02:03"`), `clock`, `relativeTime`, `weekday`, `km`,
  `kcal` — plus the original chart-formatter names (`fmtCompact`/`fmtPercent`/`fmtCurrency`/
  `fmtInt`/`fmtAxisDate`/`fmtTooltipDate`/`NON_FINITE`/`formatters`), now re-exported from here;
  `./charts`' `utils/format.ts` is an internal re-export shim, not a second implementation.
- **`ChartState.empty`** widens to `boolean | string` — a string is both truthy and the label
  `ChartEmpty` paints. `ChartCard` gains `state?: ChartState`, `placeholderHeight?: number`
  (default 240) and `stateAction?: ReactNode`, and `children` is now optional so a title-less
  pending card can be a route's own `<Suspense fallback>`. Resolution order is the same
  `resolveChartState` precedence every kind already has — pending → error → empty — and
  `state={{}}`/omitting `state` renders `children` unchanged. `ChartCenter`'s `width` widens to
  `number | string` (`'100%'` for a non-measured block body).
- **`DualPanel`'s `fillBetween` gains `aboveFill?: string`** — the above-side fill color; omitted,
  both sides keep sharing `fill` (unchanged behaviour). **`AxisBottomNumeric`** exported from
  `./charts` — the numeric twin of `AxisLeftNumeric`, for a bespoke continuous-x plot.
- **`useBreakpoint(name, edge?, options?)`** on the root barrel — SSR/hydration-safe media query
  over `theme.breakpoints`, built on `useSyncExternalStore` (not `@mantine/hooks`' `useMediaQuery`,
  which mismatches during hydration). `edge` is `'min'` (default, "at least this wide") or `'max'`.
  `page-aside.tsx` now composes this hook's own internals instead of a private duplicate.
- **`--vx-space-touch-target` / `VX.spaceTouchTarget`** — the WCAG touch-target floor (44px),
  density-exempt. The one `SPACE_FIXED` member that IS emitted as a CSS var (every other one stays
  JS-only) — a consumer's own `@media (pointer: coarse)` CSS-module rule reads it directly.
- **`SettingsMenuItem.active?: boolean`** — renders a trailing check glyph and `aria-current` in
  every projection (the sidebar's flat rows and gear menu, the mobile More sheet).
- **`basalt-ui/commands` gains imperative shell handles**: `setColorScheme(scheme)` and
  `toggleSidebar()`, wired automatically — `BasaltProvider` registers the Mantine color-scheme
  setter, `BasaltShell` registers the collapse toggle, so a command's `run` calls either with zero
  `__root.tsx` bridge wiring (unlike the hand-rolled `color-scheme-bridge.ts`/`sidebar-bridge.ts`
  shape this seeds from). `Slot<K, Constraint>` (`register.ts`) changed its internal resolution
  from a whole-interface mapped-type match to an indexed-access form — same public behaviour,
  fixes the commands↔overlays same-file type cycle a command calling `overlays.open(...)` used to
  hit while `defineCommands`'s own type was still being inferred.
- **`BasaltDevDock`** on the root barrel — a fixed, dev-only bottom drawer hosting TanStack Router
  devtools, TanStack Query devtools and the theme lab, each peer lazy-loaded. New optional peer:
  `@tanstack/react-router-devtools`.
- **`BasaltErrorBoundaryProps`** is now exported; `onError` is optional (defaults to the same
  console-warn-in-dev fallback `BasaltProvider`'s own top-level `onError` uses); an omitted
  `fallback` now renders a minimal built-in default (a `PageTitle` + reload button) instead of
  `null` — pass `fallback={null}` explicitly for the old swallow-it behaviour. **`PageTitle`** is a
  new shell-less page-title primitive on the root barrel (a plain `<h1>`, not Mantine's `<Title>`,
  so it needs no `in-body-page-title` waiver) — the remedy for the `in-body-page-title` waiver a
  shell-less error/auth page used to need.
- **`unwrap` gains a second overload** — the original took only a `Promise` of the `{ data, error }`
  envelope; it now also accepts the ALREADY-RESOLVED envelope directly (`unwrap(await api.x.get())`,
  or as a bare `.then(unwrap)` callback), inferring which overload from whether the argument IS a
  `Promise`. The absence guard also now throws on `undefined` data, not just `null`.

### CLI — one resolver, and six checks `doctor` stopped running

**Read this one if your app is not at the repo root.** A consumer migration reported it costing
more debugging than any of the five export removals in this minor, and until now it was one clause
inside a bullet.

**The resolver stopped relocating.** Every project-scoped command (`check-theme`, `doctor`, `sync`)
used to descend two levels and ascend to the nearest ancestor looking for a `basalt` config. It now
resolves ONE way — `BASALT_CWD` when set, else the invocation cwd — plus a declared `basalt.roots`,
and infers nothing from siblings or parents (`resolveProjectDir`, `src/cli/index.ts`). That is the
right call (the ascend existed to paper over `check-theme` FABRICATING `roots: ["src"]`), and it is
a silent break for every workspace consumer:

| Where you run it                 | Before 1.29.0                       | 1.29.0+                                                          |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| repo root, config in `apps/web`  | relocated to `apps/web` and said so | reads the root, finds no config, **`✖ 0 files scanned`, exit 1** |
| `apps/web`                       | unchanged                           | unchanged                                                        |
| repo root, `BASALT_CWD=apps/web` | unchanged                           | unchanged — this is now the only way                             |

**The consequence nobody wrote down: the SHIPPED lefthook preset broke itself.** Lefthook runs every
command at the repo root, so a monorepo consumer who did nothing but bump the version got a
pre-commit hook that scanned zero files and failed — from a preset they cannot override the `run:`
of. Its default `BASALT_BIN` fallback (`bunx --no-install basalt-ui`) also resolves to nothing at
the root under bun's isolated linker, which puts basalt beside the package that depends on it.
Two fixes, either one enough:

```yaml
# <repo>/lefthook.yml — the one line that fixes the guard
pre-commit:
  commands:
    check-theme:
      env: { BASALT_CWD: apps/web }
```

or run the whole hook inside the package (`root: 'apps/web/'` per command — it merges, the preset
does not define it). `configs/lefthook.yml` now carries both as a MONOREPO RECIPE block and derives
its default bin from `BASALT_CWD`; a consumer on 1.29.x writes the `env:` block by hand.

**`doctor` lost six of its ten checks.** At 1.25.0 it printed ten lines; it prints four. Verified
against the shipped `dist/cli/doctor.js` — the code is deleted, not skipped, so nothing reports a
skip either:

| Check                                                        | 1.25.0         | 1.29.x            | What you lose                                                                    |
| ------------------------------------------------------------ | -------------- | ----------------- | -------------------------------------------------------------------------------- |
| `.basalt/manifest.json` exists                               | ✓              | ✓                 | —                                                                                |
| `basalt-ui` resolves from here, and at which version         | ✓              | **gone**          | the "you are silently running a `bunx`-downloaded copy" answer                   |
| installed `basalt-ui` matches the manifest's `basaltVersion` | ✓              | **gone**          | the install/manifest skew a CI `doctor` step existed to catch — now a no-op      |
| spacing scale matches the last `sync`                        | ✓              | **gone**          | the token layer moving under a consumer between minors                           |
| running CLI version matches the installed package            | ✓              | **gone**          | the 1.20.0-cache-against-a-1.22.0-pin failure `basaltBinCommand` was written for |
| `guard-scan`: `basalt.roots` resolves to > 0 files           | ✓              | **gone**          | **the check that made a silently-scanning-nothing `check-theme` impossible**     |
| `basaltAppPlugin({ icons })` files exist                     | ✓              | **gone**          | a manifest referencing icons that were never added                               |
| oxlint preset extended                                       | ✓              | ✓                 | —                                                                                |
| lefthook preset wired                                        | ✓              | ✓                 | —                                                                                |
| `ai` major parity                                            | workspace-wide | this package only | skew between two workspace packages                                              |

The `guard-scan` row and the resolver change are the same failure from two directions: 1.29.0
deleted the ascend that used to find your config AND the check that would have told you it hadn't.
**If your CI runs `basalt-ui doctor` as a version-skew gate, that step no longer gates** — assert
the version yourself, or keep `check-theme` (which still fails loudly on zero roots) as the gate.

**Two commands are gone**: `info` (it graded a consumer's `vite.config.ts` by parsing it and nobody
read the output — no replacement) and `check-coverage` (repo-internal, now
`bun scripts/check-coverage.ts` inside this repo; it never had a consumer meaning). A consumer's own
docs or CI naming either will fail on an unknown command, which the CLI reports by name.

### `basalt-ui/format` — the subpath that deletes your hand-rolled formatters

**An addition, but a MIGRATION**, and the reason it gets a row: it does not add a capability, it
replaces one every consumer already hand-rolled. Nobody greps a migration file for a thing that was
not taken away, so it is written down here as well as in § Additions.

```tsx
/* before */ <Text>${(cents / 100).toFixed(2)}</Text>
/* after  */ <Text>{money(cents / 100)}</Text>          // import { money } from 'basalt-ui/format'
```

`money`, `percent`, `integer`, `compact`, `deltaPct`, `duration`, `durationClock`, `clock`,
`relativeTime`, `weekday`, `km`, `kcal` — all `Intl`-backed with an explicit `locale` defaulting to
the runtime's, all returning an em dash for non-finite input instead of `NaN`/`∞`. Mantine-free and
React-free, so a chart axis, a table cell and a server-rendered string share one implementation. The
chart formatters (`fmtCompact`/`fmtPercent`/`fmtCurrency`/`fmtInt`/`fmtAxisDate`/`fmtTooltipDate`)
are re-exported from here and `./charts`' `utils/format.ts` is a shim over them, not a second copy —
so there is no "which one do I import" question to get wrong.

Find your call sites: `rg -n 'toFixed\(|toLocaleString\(|Intl\.NumberFormat' --type ts`

## 1.28.0 — the aside, the shell scrollport, the form layer, and `inputProps` without `key`

**Nothing removed, and ONE thing changed shape: `inputProps` no longer returns `key`** — a silent
behaviour change at every field call site, caught by the new `basalt/forms-field-key` and described
in its own § below. Read that one before upgrading; the rest of the export delta is additive. Six
new oxlint rule ids ship at `warn`; **nothing is promoted to `error` in this minor** — the five
oxlint rules and one guard kind that went `error` were 1.27.0's, see § Guards there. Every level
honours the `theme-allow` grammar unchanged.

**And one silent DELETION that no compiler, linter or test reports: the brand left the sidebar.**
If your app suppresses the header region, it also lost its brand and its sidebar collapse toggle the
moment it bumped — see § Shell — the brand moved into the header (below).

**One behaviour change with a blast radius past this package: `AppShell.Main` is now the
scrollport, and the WINDOW no longer scrolls inside a `BasaltShell`.** Nothing was removed or
renamed, but four things a consumer may be doing stop working, and all four have a one-line remedy —
see § The shell scrollport below.

What is new, one line each — nothing here renames or removes anything:

- **`scrollParentOf` / `SCROLLPORT_ATTRIBUTE`** (`basalt-ui`) — resolve which box actually scrolls an
  element (`null` = the document). The seam behind the shell scrollport change below.
- **`PageAside`** (`basalt-ui`) — the right-hand aside REGION a route claims, with the panel filter
  surface in its body and a mobile projection into `PageBar` row 2 (`docs/ASIDE-SPEC.md`).
- **`PanelRow`** (`basalt-ui/controls`) — the aside's inspector/facet row: label above, control
  below, `end` for a control that rides the label line. Every bound control renders one on the
  `panel` surface.
- **`SliderControl`** (`basalt-ui/controls`) — a `field.number`-bound track for a weight or a
  threshold. It always renders a `PanelRow`, so unlike the pill filters a `Section` body is a
  legitimate home for it and `basalt/bound-control-outside-home` does not police it.
- **`MultiSelectFilter.counts` / `.max`** — per-option counts (a mono number plus a proportional
  bar) and the panel facet cut-off before the `Show more` fold. Both optional; omitted is today's
  rendering.
- **`field.number({ step })`** — the declared grain, republished on the handle. `field.number`
  resolves `1` for an `int: true` field that declared none, so `NumberFilter` and `SliderControl`
  cannot answer it differently.
- **`basalt/bound-control-outside-home`** — a NEW rule id at `warn` (grace to 1.30.0): a bound
  basalt control written into a `Section` body or a page stack renders as a stray pill.
  `control-outside-home` matches raw Mantine tags only, so this half of law C1 was unguarded. Homes
  are the slot props plus the `FilterSet` / `PageAside` / `PanelRow` subtrees; the escape is
  `theme-allow bound-control-outside-home — <why>`.
- **The chart phone tier** (`basalt-ui/charts`) — `resolveChartTier` / `chartTierMetrics` /
  `useChartTier` / `useChartTierMetrics`, plus `VX.phoneChartWidth` (480). Below that MEASURED
  container width (never a media query — a chart in a narrow grid cell on a desktop is as narrow as
  one on a phone) a chart drops the legend and tick fonts one type step, tightens the `VX.margin`
  FLOORS to 0.75×, shrinks the crosshair dot, narrows the tooltip 140 → 110, and caps the legend at
  two entries with a `+N more` rollup. **This moves rendering, but only below 480px of measured
  width** — nothing at desktop width changes. Opt back out per chart with an explicit
  `legend.maxRows` / `margin` override. `docs/archive/CHARTS-SPEC.md` §8.
- **`xLabelRotate` accepts `0`**, and left UNSET now auto-rotates to 45 at the phone tier when the
  measured labels cannot fit three ticks side by side. `0` is the documented opt-out. Also on every
  rotated axis, at every width: the LEFT margin now clears the rotated label's leftward projection
  (`width × cos(angle)`), which previously ran the first label off the plot, and `smartTicks` drops
  the grid tick before an appended final one when the two would overlap. Both are corrections to
  §1's measured-gutter law, so a rotated or a densely-labelled axis will lay out slightly
  differently; an explicit `margin` / `xTicks` / `xTickValues` still wins.
- **`SeriesStyle.curve`** (`basalt-ui/charts`) — `'monotone' | 'linear' | 'step' | 'stepAfter' |
  'stepBefore'`, plus the `curveFor` mapper and the newly re-exported `curveStep`/`curveStepBefore`.
  Default `'monotone'`, which is what every kind hard-coded, so an omitted `curve` moves nothing.
  Honoured by `MultiLine`, `DualPanel`, `ZonedLine`, `StackedArea` and `BarsLine.curve`. Two of
  those read ONE curve for a whole shape rather than one per series: `ZonedLine` takes the PRIMARY
  series' (its band, area and line are one reading), and `StackedArea` takes the TOPMOST VISIBLE
  band that declares one — the last such entry in your `series` array (`AreaStack`'s bands share
  their boundaries, so two curves would leave gaps between them). A hidden band's curve is ignored
  either way, so a legend toggle can hand a stack to the next declarer down.
- **Single-series legend suppressed by default** (`basalt-ui/charts`) — since commit `5e0ade1`, a
  chart with exactly one visible series and no `legend` prop renders no legend. Pass `legend={{}}`
  (or any explicit config) to keep it.
- **`Bars`' baseline is now the axis' domain floor**, not `yScale(0)` — previously a y domain that
  did not reach 0 drew the bar off the bottom of the plot; now it stops at the domain's own floor,
  which also makes a log y-axis usable on `Bars`. A domain that includes 0 is unchanged.
- **Number formatters** (`basalt-ui/charts`) — `fmtCompact`, `fmtPercent`, `fmtCurrency`, `fmtInt`
  and the `formatters` bundle, all `Intl`-backed with an explicit `locale` defaulting to the
  runtime's. `utils/format.ts` shipped only two DATE formatters, so every call site hand-rolled
  `` `$${v}k` ``. **Every formatter — the two date ones included — now returns an em dash for
  non-finite input** (`NaN`, `±Infinity`, an `Invalid Date`) instead of `Intl`'s own `NaN` / `∞`.
  A collapsed domain therefore stops painting its arithmetic accident as a tick label.
- **`ChartEmpty` / `ChartError` / `state` / `resolveChartState`** (`basalt-ui/charts`) — the chart
  layer's own three-state placeholder set. `state?: { pending?, error?, empty? }` on
  `CartesianChart` / `ChartFrame` / every kind resolves pending → error → empty, so a consumer no
  longer needs the Mantine-coupled `QueryState` (unreachable from `./charts`) to tell a 500 apart
  from an empty result. **`isPending` still works and is not deprecated** — it is an alias for
  `state={{ pending: true }}`. `ChartError` announces as `role="alert"`; `ChartPending` and
  `ChartEmpty` as `role="status"`, so a screen reader hears the resolution and not only the failure.
- **`BasaltProps` on every exported chart component** — `className` and `style` now reach the root
  element of every kind, sparkline and primitive; `ChartCard` also takes
  `classNames={{ root, header, body }}`. Additive: a component that ignored `className` now honours
  it, so a stylesheet that previously had no effect starts having one.
- **`ChartTooltipFloat` server-renders.** It was the one `renderToString` casualty in the package
  (an unconditional `createPortal`); it now emits nothing on the server and is unchanged in the
  browser. Consumers carrying an SSR workaround around a chart tooltip can drop it.
- **`BREAKPOINTS`** (`basalt-ui/tokens`) — `{ article: 1200 }`. The one `@media` literal in the
  package that was not derived from anything now has a named, testable counterpart; a `@media`
  condition cannot read a custom property, so the literal stays and a test holds the two together.
- **`theme-lab/boot.ts`** — `applyOverrides`/`loadOverrides`/`readVar` moved into their own
  Mantine-free, SSR-safe module (no-op / empty result with no `document`, instead of throwing).
  `basalt-ui/theme-lab` still resolves all three, unchanged, alongside `ThemeLabControls` and
  `DeriveControls` — nothing renamed or removed, and no new subpath was added.
- **`basalt/raw-size-literal` / `basalt/no-raw-font-size`** — no longer exempt a consumer's own
  `src/tokens/` directory. The exemption was basalt-internal (the derive engine's own hardcoded
  scale values) and leaked to any package with a same-named directory. Consumers with raw sizes
  there move them to `--vx-*` tokens, or add a `theme-allow` waiver.
- **`BasaltProvider connectivity` prop** — `Omit<ConnectivityProviderProps, 'children'>`, threaded
  straight through to the auto-mounted `ConnectivityProvider`. Reaches `override` for the first
  time (the only prior route was mounting a second, shadowing `ConnectivityProvider`) — see
  § BasaltProvider below.
- **Six new oxlint rule ids, all `warn`** — `basalt/provider-above-router`,
  `basalt/duplicate-notifications-mount`, `basalt/query-dual-import`, `basalt/query-fn-unwrap`,
  `basalt/forms-field-key` (grace to 1.30.0) and `basalt/deprecated-export` (permanently
  advisory). `forms-field-key` is the one that matters most in this minor — it is the only thing
  that reports the `inputProps` call sites below, which a compiler cannot see; see § `inputProps`.
  The first four guard
  four doctrines that shipped stated-but-unguarded under a `not guarded:` banner — the provider/
  router mount order, the `BasaltOverlays` XOR `BasaltNotifications` double-mount, the
  `basalt-ui/query` import seam, and `queryFn` wrapping in `unwrap()`. Each is honest about its
  reach in its own message and its grace entry: all four read ONE file, and the two query rules
  carry a documented text heuristic. Escape with `theme-allow <rule> — <why>` as usual. Nothing
  fails a build: every one is `warn` in the shipped preset.
- **`basalt/deprecated-export`** — nudges an import or a prop basalt has deprecated but still ships,
  reading the `DEPRECATED_EXPORTS` ledger beside the plugin. Today that is `field` from
  `basalt-ui/forms` (autofixed to `inputProps as field`, so no call site moves) and the three
  flattened `BasaltProvider` connectivity props. Permanently `warn` — a deprecation is a schedule,
  not a defect. **On the `field` row, take the two fixes in order**: that rename lands the new
  `inputProps` shape, which has no `key`, and `basalt/forms-field-key` then reports the same line
  and inserts the `key`. Two `--fix` passes, or one manual edit writing both. **This works only
  while `field` is still deprecated-but-shipped, i.e. on 1.28.x** — 1.29.0 deletes both the export
  and its ledger row, and with them pass 1.
- **Dev-only duplicate-mount warnings** — `BasaltProvider` now warns when a second instance mounts
  while the first is still mounted; `<BasaltOverlays notifications />` and `<BasaltNotifications />`
  now warn when BOTH are mounted at once (previously prose-only in both cases). Both are
  `console.warn`, dev builds only, no behavior change.
- **`WidgetGrid` + `WidgetGrid.Item` and `StatGroup`** (`basalt-ui`) — the dashboard column law,
  owned once. `cols` is the DESKTOP count and the only number you state: `WidgetGrid` resolves
  `base 1 → sm min(cols, 2) → lg cols`; `StatGroup` (the KPI row) resolves
  `base 2 → sm min(cols, 3) → lg cols`. `<WidgetGrid.Item span={2}>` widens one cell and is clamped
  to the live count at each breakpoint. `StatGroup divided` swaps the column gap for a hairline rail. **These two are the only
  place `lg` exists in the package** — `sm` remains the only breakpoint a consumer writes
  (`docs/CONTROLS-SPEC.md` §2). Replaces hand-written `SimpleGrid cols={{ base, md }}` /
  `Grid.Col span={{ base: 12, md: 8 }}`; Mantine's responsive `cols` object is deliberately not a
  prop.
- **`StatCard.query`** — `QueryStateLike`, the same structural subset `QueryState` takes. Supplied,
  the card renders its pending / error / empty branch through `QueryState` at the `'section'` tier
  INSIDE the body, directly under the header, which stays put. Omitted, nothing changes. `value` is
  still yours to format — pass a placeholder while the query is pending.
- **`WidgetHeaderTitleProps` / `WidgetHeaderMetricProps` / `WidgetHeaderDeltaProps`** (`basalt-ui`)
  — the named `Pick` slices of `WidgetHeaderProps` its composers share, cut along the three rows the
  header paints. `StatCardProps` and `SettingsSectionProps` now compose them instead of re-declaring
  props one at a time; **both gained props as a result** — `SettingsSection`/`DangerZone` now accept
  and FORWARD `icon` and `info`. Nothing was removed from either (pinned by
  `src/dashboard/stat-card-props.test.ts`). `Section` and `ChartCard` still cut their own subsets.
- **`tier` replaces `variant` on `QueryState` / `LoadingState` / `ErrorState` / `EmptyState`** —
  `tier` is the package's word for "how loud is this" (`WidgetHeader`, `CtlSlot`), and `'section'`
  meant two different things across the two spellings. `variant` is `@deprecated` and still
  honoured; resolution is `tier ?? variant ?? 'page'`, so nothing moves until you change the prop.
  `QueryStateTier` is the new type name; `QueryStateVariant` stayed exported as an alias through
  1.28.x and is **removed in 1.29.0** together with the `variant` prop (see § Consolidation).
- **`WidgetHeader` and `QueryState` gained slot classes** — `classNames={{ root, title, metric,
  icon }}` on the first, `classNames={{ root }}` on the second (the branch that is live). Additive.
  `Section` now OMITS `classNames` from the `WidgetHeaderProps` it re-publishes, so its slot union
  stays exactly `root | header | body` — a `<Section classNames={{ metric: … }}>` that used to
  type-check (and do nothing) is now a compile error. Reach the header's own slots on a
  `WidgetHeader`.
- **`Callout` extends `BasaltProps`** — `className`/`style` were already accepted and are now the
  shared members, so `exactOptionalPropertyTypes` consumers can forward an `string | undefined`
  through. No rendering change.
- **`PageAside` throws on a missing `title`** — it is both the header text and the region's
  `aria-label`, so an omitted one shipped a nameless landmark rather than a crash. Now
  `[basalt] PageAside: prop "title" is required — …`, in every build. `title` was never optional in
  the type; this only reaches untyped JS and runtime-built props objects.
- **`BasaltDataTable` warns (dev only) when `stickyHeaderOffset` meets `maxHeight`/`minWidth`** —
  the offset has always been DROPPED there (the sticky `<thead>` anchors to the scroll container's
  own top edge, not the window). The behaviour is unchanged; it just says so now.
- **`query` on `Section`, `BasaltDataTable` and `BasaltVirtualList`** — law C3's uniform container
  contract. Pass a `QueryStateLike` (a TanStack `UseQueryResult` is one) and the container resolves
  the body: pending → its own placeholder (`QueryState`'s section-tier spinner / the table's
  skeleton rows / the list's skeleton rows), error with no data → an `ErrorState` with the query's
  own `refetch` behind Retry, anything else → the content, or the empty branch. **The table and the
  list had NO error branch at all**, so a 500 rendered _No data to display._ / a blank box — the
  false claim `QueryState` exists to delete. Additive: omit `query` and nothing changes.
  `Section` also gains `empty?: QueryEmptyCopy` (copy for that branch, `QueryState`'s own type) and
  `BasaltVirtualList` gains `emptyState?: ReactNode` (which works with or without `query`).
  `isLoading` still works on both containers and is NOT deprecated; passing it beside `query` lets
  `query` win and warns once in dev. The chrome stays drawn through every branch — a table keeps its
  `<thead>`, toolbar and pagination bar, a `Section` keeps its header, chevron and `summary` — which
  is why this is not `QueryState` wrapped around the container. A refetch that fails over rows
  already on screen keeps the rows with no banner; compose `QueryState` AROUND the container for
  that.
- **`BasaltDataTable.onRowActivate`** — `(row: T) => void`, fired by a click on the row and by Enter
  on a focused one. The row → detail hook that pairs with `PageAside`. The row keeps its native
  `<tr>` semantics and takes `tabIndex=0` + `data-activatable` rather than `role="button"` (a role
  swap costs the column-header announcement that is the reason the data is in a table); the cursor
  and focus ring come from a module class. A click originating inside the selection checkbox does
  not activate.
- **`BasaltDataTable` row selection** — `enableRowSelection` prepends a checkbox column (header =
  select-all on the page) and arms TanStack's row-selection feature; `rowSelection` /
  `onRowSelectionChange` are the controlled pair over TanStack's own `RowSelectionState` (re-exported
  from `basalt-ui/data/table` in 1.28.x; from 1.29.0 import it from `@tanstack/react-table`), and `getRowId` makes a selection
  survive a re-sort or a refetch (the default id is the row INDEX). `bulkActions` renders a bar
  above the table while ≥1 row is selected — the count, then the actions, through the SAME
  `BarAction[]` vocabulary `PageBar` uses, so the ≤3-inline fold and the mobile kebab are basalt's
  here too. **Its signature is `(rows: T[]) => BarAction[]`, a function and not a bare array**, and
  deliberately: `BarActionItem.onClick` stays `() => void` (one unforked vocabulary across every
  home), so the selected rows reach a handler through the closure you write — and an UNCONTROLLED
  table can offer bulk actions at all, since the selection lives inside it.
- **`Section.actions` and `BasaltDataTable.actions` accept `BarAction[] | ReactNode`** — law C15.
  Handed typed data, basalt owns the C6 budget and the C7 overflow fold (≤3 inline, the rest behind
  `More`, one kebab below `sm`) exactly as `PageBar` does; handed a node, rendering is byte-for-byte
  what it was. Every entry lands in `secondary` — a `BarAction[]` carries no primary marker, and C6's
  "exactly one primary" stays the page bar's rule. `Section`'s ≤3 dev warning now counts an array
  EXACTLY (`Children.count` read one as a single child). Both slots were `ReactNode` before, so no
  call site moves.
- **`overlays.confirm` / `overlays.confirmDelete`** (`basalt-ui/commands`) — the two-button dialog
  every consumer was registering as a `defineOverlays` entry with its own button pair, now
  registry-free: `confirm({ title, body?, confirmLabel?, cancelLabel?, danger?, onConfirm,
  onCancel? })` resolves `true`/`false` and fires exactly one callback, whichever exit the user takes
  (cancel, escape, click-outside and the close button all count as `false`). `danger` paints the
  confirm button in the theme's derived destructive family. `confirmDelete({ subject, count?,
  onConfirm })` is the counted one-liner over it ("Delete 3 items?"). Both REJECT with a named
  `[basalt] overlays.confirm: …` error when the `@mantine/modals` peer is absent, or when no
  `ModalsProvider` is live — previously either returned a promise nothing would ever settle, because
  the imperative API is a window event bus with nothing subscribed. `@mantine/modals` stays lazily
  imported, so the peer is still optional. Additive: `defineOverlays` and `overlays.open` are
  unchanged.
- **`registerModalsProvider()`** (`basalt-ui/commands`) — how a consumer who mounts
  `<ModalsProvider>` THEMSELVES (with `<BasaltOverlays modals={false}>`, or with no `BasaltOverlays`
  at all) tells `overlays.confirm` the layer is up. `<BasaltOverlays>` registers its own provider, so
  the default path needs nothing. Call it from an effect and return its result as the cleanup:

  ```tsx
  useEffect(() => registerModalsProvider(), [])
  ```

  Availability is a COUNTER of live providers, not a flag, so two overlapping mounts (a route swap
  mounting the next shell before unmounting the last) never report "no layer" while one is serving.
  There is no way to detect the provider from outside React — its context is only readable through
  `useModals()`, and `confirm` is an imperative call with no component to read it from — so the
  registration is explicit and unregistered is indistinguishable from absent.

- **`notifyUndo` / `notifyUndoable`** (`basalt-ui/notifications`) — an undo window on top of the
  existing toast machinery: `notifyUndo({ message, onUndo, window = 6000, onExpire })` shows a toast
  carrying an `Undo` button and returns `{ id, dismiss() }`. The affordance and the grace period are
  ONE number (`autoClose === window`), and exactly one of `onUndo` / `onExpire` runs, exactly once —
  `onExpire` is where the optimistic mutation COMMITS. `dismiss()` settles the window immediately
  (running `onExpire`), so a dismissed toast can never strand an uncommitted change.
  `notifyUndoable(mutate, undo, opts)` is the same thing spelled for the optimistic shape. No new
  store — the toast is recorded to the notification history like any other.
- **`NotifyOptions.historyMessage`** — what the persisted history records when `message` is a
  composed ReactNode the store cannot stringify (`String(<Group/>)` is `[object Object]`). Defaults
  to today's `String(message)`, so nothing moves unless you pass it. `notifyUndo` uses it.
- **`missingLayer`** (`basalt-ui`) — a message builder beside `requiredProp`/`oneOf`/`duplicateMount`
  for "this call needs a layer that is not mounted or not installed". Additive.
- **`emit`'s payload now narrows per kind** (`basalt-ui/notifications`) — `NotificationSpec<P>` and
  `NotificationAction<P>` are generic, `P` inferred from `toMessage`/`action.run`'s parameter, the
  same mechanism `Overlay<P>` uses for `render`. Annotate the payload shape and `emit('kind', …)`
  requires it, a wrong shape is a tsc error. A kind that annotates neither function keeps today's
  `payload?: unknown` — additive, no existing `defineNotifications` call needs a change.
- **The form layer** (`basalt-ui/forms`) — `./forms` was an adapter with no layout, no submit
  lifecycle, no array helper and no disabled propagation (audit B #5). Seven new exports, all
  additive; `useBasaltForm`, `FormErrorSummary` and `useFormDraft`'s existing signature are
  untouched. `inputProps` is the one exception, and it is not additive — see § `inputProps` no
  longer returns `key` below.
  - **`FormSection` / `FormRow` / `FormGroup` / `FormActions`** — the layout. `FormRow` IS law C1's
    third home, the form row: label left / control right, label above below `sm`, the swap in CSS
    (law C9). It does NOT replace `SettingsRow` — that stays the settings-page variant, and both
    keep Mantine's `md` tier rather than mounting a `CtlSlot`. `FormActions` takes the same
    `BarAction[] | ReactNode` union law C15 gave `Section.actions`.
  - **`useFormSubmit(form, handler, options?)`** — `{ submit, isSubmitting, submitError, reset }`.
    Catches the handler's throw and decodes it through `toErrorMessage` (override with `mapError`),
    routes a thrown `{ fieldErrors }` envelope onto the fields via `form.setErrors`, and focuses the
    first errored field on BOTH failure paths. `isSubmitting` is Mantine's own `form.submitting`,
    not a second flag beside it.
  - **`options.validateAsync`** — the async validation rule `useBasaltForm` has no room for:
    `schemaResolver(schema, { sync: true })` is still hard-coded, so `validate()`/`isValid()` stay
    synchronous, and the async rule runs at submit time after the schema and before the handler.
  - **`FormStateProvider` / `useFormState`** — `{ disabled, submitting }`. The layout primitives
    read it and disable their control region through a native `<fieldset disabled>`, so nothing has
    to be threaded to each input and no child is cloned. Nesting ORs; it cannot re-enable.
  - **`useFieldArray(form, path)`** — `{ items, append, remove, move, key }` over
    `insertListItem`/`removeListItem`/`reorderListItem` + `form.key`. `key(index)` is POSITIONAL
    (Mantine's list actions do not rotate the form key generation) — a user-reorderable list still
    wants an id on the item.
  - **`useFormDraft(form, { autosave })`** — `true`, or `{ debounceMs }`. The hook now owns its own
    `form.watch` subscription, replacing the documented `saveDraftRef` + `onValuesChange` dance. It
    is OFF by default and READ ONCE at mount (the watch set is a hook count), so every existing call
    site behaves exactly as before. `DEFAULT_AUTOSAVE_DEBOUNCE_MS` is exported.
  - **Still subpath-only.** The root barrel re-exports none of this, so a consumer without
    `@mantine/form` is unaffected by importing `basalt-ui`.
- **Mobile "More" sheet rows now 40px with the sidebar's own insets** — `--vx-space-mobile-nav-row-
  height` 44 → 40 (WCAG 2.5.5 AA touch floor, not the AAA figure the bar's own `mobileNavBarHeight`
  still holds to). The rows themselves no longer force a bespoke touch padding over the theme's
  `NavLink` styling; they now render with the SAME `--vx-space-row-inset-y`/`-x` padding and
  `VX.text.md` the desktop sidebar row does. A nested (child) row gains the sidebar's own child
  indent — a 1px `--vx-divider` left guide. Purely visual; no prop, export or behaviour changed.
- **`NotificationCenter` defaults to `width: '100%'`, not a hardcoded `320`** — it now sizes to its
  host instead of assuming it always sits inside its own 320px popover. `NotificationBell` fixes the
  320px width at the `Popover` itself (`<Popover width={320}>`) instead, so nothing changes for that
  call path; a consumer mounting `NotificationCenter` directly (a Drawer, an inline card) now gets a
  component that shrinks to its container rather than overflowing it. `style` still merges over the
  default, so `style={{ width: 280 }}` still wins.

### `inputProps` no longer returns `key` — pair it with the new `fieldKey`

**This is the one thing in the minor that needs a code change at every call site, and the compiler
will not tell you about a single one of them.** It is a one-line-per-field edit:

```tsx
/* before (1.27) */ <TextInput {...inputProps(form, 'email')} />
/* after          */ <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} />
```

**Exactly what changed.** In 1.27 `inputProps(form, path)` returned `form.getInputProps(path)` **and
`key`** in one object, so a single spread covered both. It now returns `form.getInputProps(path)`
and nothing else; `fieldKey(form, path)` is the other half, written as a real JSX `key` attribute.
The bundle was basalt's own invention, and React 19 logs `A props object containing a "key" prop is
being spread into JSX` on every render of it — three fields, three warnings per page.
`key={form.key(path)} {...form.getInputProps(path)}` is Mantine's own documented idiom; `fieldKey` +
`inputProps` is that idiom with basalt's names.

**What breaks if you only upgrade and do nothing.** Nothing type-checks differently, nothing throws
and no warning is logged — the 1.27 call site is still a valid spread of a valid object. The element
simply has no `key` any more, so React reuses the DOM node and an uncontrolled input keeps its old
text through `form.reset()`, `form.setValues()` and a removed list row. That is the entire failure
mode: a form that stops resetting, with no signal anywhere.

**What catches it: `basalt/forms-field-key`**, new in this minor at `warn` (grace to 1.30.0). It
reports every `{...inputProps(…)}` spread whose element carries no sibling `key`, and it
**autofixes** — inserting `key={fieldKey(<same args>)}` and adding `fieldKey` to the existing
`basalt-ui/forms` import. Run `oxlint --fix` over the app and read the diff; the escape hatch for an
element genuinely remounted by its parent is `theme-allow forms-field-key — <why>`. **Scope the
`--fix` to the paths you are migrating** (`oxlint --fix src/features/settings`): the shipped preset
enables autofixable stylistic rules, so a bare `oxlint --fix .` rewrites untouched files in the same
commit.

> **If you are landing on 1.29.x, not 1.28.x, the two-pass recipe below does not apply** — `field`
> is deleted there, so pass 1 has nothing to fix and the edit is manual. See 1.29.0 § Consolidation,
> the `field` row.

**The deprecated `field` alias did NOT follow `inputProps` here.** It is no longer
`export const field = inputProps`: it keeps the 1.27 return shape, `key` included, so
`{...field(form, 'x')}` behaves in 1.28.0 byte for byte as it did in 1.27 — including the React 19
key-spread warning. An alias would have changed what every existing call site DOES without changing
whether it compiles, and a deprecation is a schedule, not a behaviour change. `forms-field-key`
reports the `field(` spread too, with its own message pointing here; the alias itself is removed in
`1.29.0`.

### `BasaltDataTable` — the root is a `<div>`, not a Fragment

**One structural change, no prop change.** The component returned a Fragment, so the header row, the
table (or its scroll container) and the pagination bar were DIRECT CHILDREN of whatever the caller
rendered it into. It now always renders a wrapper:

```html
<div class="{classNames.root} {className}" style="{style}">
  …header row… …table / Table.ScrollContainer… …pagination bar…
</div>
```

A `className` needs a root to live on (`common/props.ts`), and a Fragment has none — so the wrapper
is what `className`, `style` and `classNames.root` all resolve against. It is unconditional: a table
with no title, no toolbar and no pagination still renders it.

**What breaks:** any CSS or test selector written against the OLD flat structure. A
`.page-grid > table`, a `:first-child` rule aimed at the table, an `:nth-child` counting the header
row and the pagination bar as siblings of your own content, or a flex/grid parent that laid those
three boxes out itself — all now see one child. Target the wrapper instead, and give it the layout:

```css
/* before */ .page-grid > table { … }
/* after  */ .page-grid > div > table { … }   /* or: <BasaltDataTable classNames={{ root: 'my-table' }} /> */
```

Pinned by `src/data/data-table.test.tsx` ("the root is one div carrying classNames.root, wrapping
the table and the pagination bar"), so it cannot revert silently.

### BasaltProvider — a `connectivity` object replaces three flattened props

`sseUrl` / `healthUrl` / `healthIntervalMs` on `BasaltProvider` are now `@deprecated` aliases for
the corresponding fields on the new `connectivity` prop — **removed in 1.29.0**. `connectivity`
wins WHOLESALE once supplied, not per-key: passing `connectivity` at all makes basalt ignore the
three deprecated props entirely, even ones `connectivity` itself leaves unset. Supplying both logs a
dev-only warning. Move every deprecated field to `connectivity` in one pass, not one field at a time.

| Removed / deprecated                      | Replacement                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `<BasaltProvider sseUrl={…} />`           | `<BasaltProvider connectivity={{ sseUrl: … }} />` — `@deprecated`, removed 1.29.0                                                   |
| `<BasaltProvider healthUrl={…} />`        | `<BasaltProvider connectivity={{ healthUrl: … }} />` — `@deprecated`, removed 1.29.0                                                |
| `<BasaltProvider healthIntervalMs={…} />` | `<BasaltProvider connectivity={{ healthIntervalMs: … }} />` — `@deprecated`, removed 1.29.0                                         |
| (unreachable before this minor)           | `<BasaltProvider connectivity={{ override: {…} }} />` — simulate a signal for testing/demo, no second `ConnectivityProvider` needed |

**`cssVariablesResolver` can no longer reach `BasaltProvider` through the passthrough
`MantineProviderProps` rest** — it was silently spreadable and would override basalt's own resolver
(the one thing the provider exists to install). `Omit`ted from the accepted prop type; pass any
palette customization through `createBasaltTheme(overrides, { derive, fonts, radius, density })`
instead.

### `basalt-ui/connectivity` — `queryOnline` narrowed to `boolean`

`ConnectivitySnapshot['details'].queryOnline` and `ConnectivityOverride.queryOnline` drop the
`| null` arm. The JSDoc used to claim null meant "QueryClient not mounted", but `onlineManager` is a
module-level singleton read with no such check — the only null this field ever carried was the
pre-hydration SSR snapshot, which now reports an optimistic `true` (matching `browserOnline`'s own
SSR default) instead. Code branching on `queryOnline === null` was already dead; delete it.

### `basalt-ui/state` — eight internal symbols dropped from the barrel

| Removed / renamed                                                                                                | Replacement | Note                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createStoreCore`, `resolveFieldCodec` (`basalt-ui/state`)                                                       | none        | Both were `@internal` — the seam `createSearchStore` is built on, not a consumer API — and were never meant to be a public contract. No replacement needed.           |
| `FieldCodec`, `StoreEntry`, `StoreCoreOptions`, `StoreCore`, `FieldUse`, `FieldWrite` (types, `basalt-ui/state`) | none        | Also `@internal` — the supporting types behind `createStoreCore`/`resolveFieldCodec`, dropped alongside the two functions for the same reason. No replacement needed. |

### `basalt-ui/forms` — `field` renamed to `inputProps`

Two unrelated exports shared the name `field`: the forms adapter's `getInputProps`+`key` bundler and
the `field.enum/multi/range/number/boolean/string` store-field builder in `basalt-ui/state` and
`basalt-ui/router-tanstack`. A page combining a form and a filter store had to alias one on import.

| Removed / renamed           | Replacement  | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field` (`basalt-ui/forms`) | `inputProps` | Same signature — `inputProps(form, path)`. `field` still resolves from `basalt-ui/forms` as a `@deprecated` alias in 1.28.x, so nothing breaks here; **it is deleted in 1.29.0** (see that minor's § Consolidation, which also explains why the `--fix` recipe stops working there). **In 1.28.0 the two are no longer the same function**: `inputProps` dropped `key` from its return and `field` did not — see § `inputProps` no longer returns `key`. |

The `field.*` store builder (`basalt-ui/state`, `basalt-ui/router-tanstack`) is untouched.

### Shell — region seams, and what moved with them

**Every `AppShell` region now ends in a real, themed 1px `--vx-divider` line on its Main-facing
edge, with no opt-out** (`docs/MANTINE-THEMING.md` § Chrome integration): sidebar|main
(full height, under `layout="alt"` it owns the top-left corner), header|main (main column only),
main|aside (full height, absent when the aside is unclaimed), main|mobile-nav (below `sm`). Mantine
draws all four itself through `[data-with-border]`; the colour is one theme var,
`AppShell.extend({ vars: () => ({ root: { '--app-shell-border-color': 'var(--vx-divider)' } }) })`.
The aside's shell-form header also carries its own `border-bottom: 1px solid var(--vx-divider)`, so
the top belt's seam closes across the panel instead of dead-ending at the aside column.
**Delete any hand-drawn twin**: a `border-left` on your own aside-shaped panel, a `border-bottom`
under `PageBar` via `className`, a `withBorder` or a `--app-shell-border-color` override on your own
`AppShell` sections — the theme only pins the COLOUR; `withBorder` still adds or removes the edge
per section (Mantine gates the border CSS on `[data-with-border]`), so a leftover `withBorder={false}`
still suppresses the seam and must be deleted to get it, and a leftover `withBorder={true}` is
redundant (Mantine's own default).

- **`--vx-divider` moved.** Light is now `rgba(<derived ink>, 0.09)` (was
  `color-mix(in srgb, #e5e5e5 65%, transparent)`) — visibly darker on light, tracks a non-default
  `neutral`/`lightLevel` where the old hex did not, and never flips polarity at `lightLevel <= -3`
  the way the fixed hex did. Dark moved too: `color-mix(in srgb, #ffffff 6%, transparent)` →
  `rgba(255, 255, 255, 0.08)`.
- **The header's horizontal inset moved from `md` to `sm`**, so the breadcrumb's left edge and the
  global actions' right edge land on the card column's edges. The sidebar brand row and the aside's
  header now sit at the SAME `appShellHeaderHeight` band, so their centrelines meet the header's
  across the seams. `SPACE_STEP.sidebarBrandInsetTop` / `--vx-space-sidebar-brand-inset-top` are
  deleted with no replacement — the row IS the band now, not an inset inside it.
  `PageAside`'s title renders the head-font `--vx-text-md`/550/ink title treatment, not the old mono
  micro-label.
- **[S2] `PageBar` row 2 below `sm`** is two declared lines — the tabs, then the pill row — instead
  of one overflowing `nowrap` line. `--basalt-page-bar-h` grows to match, and the `className` JSDoc
  no longer suggests drawing a hairline under the bar.
- **[S3] `DeltaBadge.polarity` and `deltaPolarity`** on `WidgetHeader`/`StatCard`/`ChartCard` —
  `'up-good'` (default, today's tone), `'up-bad'`, `'neutral'`. And `WidgetHeader tier="group"` — a
  `Section` mounted inside `PageAside` now resolves it automatically and renders a mono micro-label
  `h3` with a zero-gap row body; outside an aside nothing changes.
- **[S4] `AxisConfig.scale: 'log'`** on `CartesianChart` — 1-2-5 mantissa ticks, `autoMinCeil`
  ignored on a log axis. Honoured by every kind whose domain isn't anchored at zero (`MultiLine`,
  `ZonedLine`, un-stacked `Bars`); `StackedArea` and stacked `Bars` install a domain function with a
  hard `0` floor and their marks anchor at the baseline, so a log scale on either yields `NaN`
  geometry — don't opt in there. Additive; omitted stays linear.

### `basalt-ui/data` — a typed facet id, and a required `getItemKey`

**`BasaltDataTable`: a mistyped `facets[].columnId` used to render no pill, silently — `if
(!column) return null`.** It now throws in dev, naming the id and every known column id
(`facet columnId "…" matches no column`); production still degrades to no pill for that one facet.
`DataTableFacet` also gained a type parameter — `DataTableFacet<T = unknown>` — so `columnId` is
typed off the row shape wherever TanStack's `accessor`/manual `id` inference allows it
(`Extract<keyof T, string> | (string & {})`); the default keeps a bare `DataTableFacet[]`
compiling unchanged. `BasaltDataTableProps.facets` is now `DataTableFacet<T>[]`, and
`initialColumnPinning` moved from TanStack's own `ColumnPinningState` to a new, `T`-derived
`DataTableColumnPinning<T>` (structurally assignable to `ColumnPinningState`, so no cast is
needed at either end). Both are additive for existing call sites — an id that was already a real
column keeps compiling and rendering exactly as before.

**`BasaltVirtualList.getItemKey` is now required.** The index fallback hid stale rows across a
mutation: an insert/delete shifts every index below it, so the OLD item kept rendering at each
shifted index until an unrelated re-render happened to catch it up — in the one component whose
job is a long mutable list. Pass a real per-item key (`(item) => item.id`); there is no
replacement for the index fallback.

**`BasaltVirtualList` gained a ref.** `ref?: Ref<BasaltVirtualListHandle>` exposes
`scrollToIndex`/`scrollToOffset`/`scrollToEnd` (delegating to the internal
`@tanstack/react-virtual` instance) plus `getVirtualizer()` as the full escape hatch — mirrors
`./data/table`'s `useReactTable` re-export as the table's own. Additive; omitting `ref` changes
nothing.

### `basalt-ui/commands` — `BasaltOverlays` no longer WRAPS your app in `ModalsProvider`

**Same props, same imperative API, one structural change: every layer — `ModalsProvider`
included — now renders as a SIBLING of `children` instead of an ancestor.** The old shape put the
whole app under a `React.lazy` Suspense boundary (`<Suspense fallback={<>{app}</>}>
<LazyModalsProvider>{app}</LazyModalsProvider></Suspense>`), and `React.lazy` suspends on its first
render even when the module is already warm. Two consequences, both real: the app's FIRST COMMIT was
deferred past a microtask — long enough for TanStack Router's async `loadMatches` to `setState` onto
a not-yet-mounted fiber ("Can't perform a React state update on a component that hasn't mounted
yet", once per full page load) — and the app tree mounted TWICE, once inside the fallback and once
resolved, so every effect in the app ran twice on boot.

Nothing to change for the overlay APIs. `modals.open` / `modals.openConfirmModal` (and so basalt's
own `overlays.open` / `overlays.close`) go through `@mantine/modals`' window CustomEvent bus, which
`ModalsProvider` subscribes to — being inside it was never a requirement, and the provider renders
its own managed `Modal` regardless of where it sits.

**The one thing a sibling cannot serve is React CONTEXT**: `useModals()` from `@mantine/modals`
called inside your app now throws its "was called outside of context" error. If you use it (or
`openContextModal`, which needs the provider's `modals` map that `BasaltOverlays` never passed
anyway), mount your own provider and turn basalt's off — two providers would both answer the event
bus and open every modal twice:

```tsx
<BasaltOverlays modals={false}>
  <ModalsProvider modals={CONTEXT_MODALS}>
    <App />
  </ModalsProvider>
</BasaltOverlays>
```

### `basalt-ui/controls` — the mobile `Filters (n)` sheet renders panel rows, not its own list

**The sheet's `SheetOptionList` (44px rows, a hairline between them, one per option) is gone.**
`useFilterSurface() === 'sheet'` now resolves to the SAME `PanelRow`/`PanelChoice`/facet-list body
`'panel'` already renders (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a Drawer") — label
above, full-width control below, folding past `PANEL_TRACK_MAX` (3, a `Select`) or `max` (a
`MultiSelectFilter`'s `Show N more`) the same way the aside already did. A set with many options no
longer grows the sheet to a full column of option rows. `RangeFilter`'s sheet form is the panel's one
`Select` (presets plus a `Custom range…` row revealing the injected picker) instead of a
`SheetOptionList` with the picker behind a separate disclosure row.

Also fixed in the same pass: a `fullWidth` `SegmentedControl` (`PanelChoice`'s ≤3-option form, and
`ViewTabs`) now splits its options EVENLY — Mantine's own `.control` carries no `min-width`
override, so the initial `auto` floored each option at its content width and a `fullWidth` track
split unevenly; a long label now ellipsizes inside its equal share instead of forcing the column
wide. The active segment's fill is a second ink-mix step
(`color-mix(in srgb, var(--vx-ink) 12%, var(--vx-surface-panel))`), not a flat `--vx-surface-panel`,
so it stays visible against its own track when the whole control sits on a panel-coloured surface (a
`PanelRow`), where a flat panel fill read as barely-there next to the 6%-tinted track around it.

| Removed                                                                                                                      | Replacement                                                 | Note                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetOptionList`, `SheetField`, `SheetDisclosure` (`basalt-ui/controls`)                                                    | `PanelRow` / `PanelChoice` (already exported)               | Were never part of the public `./controls` barrel — internal to `filter-sheet.tsx` — so this only breaks a consumer test that imported them directly out of `basalt-ui/controls/filter-sheet` or hooked a `role="radio"` `<fieldset>` DOM shape inside the sheet (now a `PanelChoice` `SegmentedControl`, `role="radiogroup"`, or a `Select`). |
| `SheetRow`, `sheetRowClassNames` (`basalt-ui/controls`)                                                                      | none                                                        | Also internal-only. `ToggleFilter`'s sheet form is now a `PanelRow` whose `Switch` rides the label line, the same shape the panel surface always used.                                                                                                                                                                                         |
| `.sheetOption` / `.sheetList` / `.sheetField` / `.sheetRow` / `.sheetDisclosureBody` / `.sheetLabel` (`controls.module.css`) | `panel-row.module.css`'s `.row`/`.head`/`.control`/`.label` | CSS-module classes were never a public contract; named for a consumer that vendored a copy of the sheet's old CSS.                                                                                                                                                                                                                             |

### The shell scrollport — Main scrolls, not the window

`BasaltShell` dropped Mantine's `layout="alt"` (the header now spans the full viewport width, above
the sidebar and the aside, instead of being inset beside the sidebar) and gave `AppShell.Main` a
bounded height with `overflow: auto`. Main is therefore THE scrolling element: the document's
`scrollHeight` equals the viewport height, the browser scrollbar sits on Main's own right edge
(inside the aside, where the content is) instead of at the far edge of the window, and
`window.scrollY` is pinned at 0.

Main carries two handles: `data-basalt-scrollport` (basalt's own, and what `scrollParentOf` looks
for) and `data-scroll-restoration-id="basalt-main"` (the attribute `@tanstack/router-core`'s scroll
restoration reads, so a router-driven app restores this element rather than the window).

What to change in a consumer:

| If your app…                                                        | Do this                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reads `window.scrollY` / listens for `scroll` on `window`           | `const port = scrollParentOf(el)` and read `port.scrollTop` / listen on `port` — `null` still means the window, so shell-less code is unchanged                                                             |
| scrolls with `window.scrollTo` / `document.scrollingElement`        | target `document.querySelector('[data-basalt-scrollport]')` first, with the document as the fallback                                                                                                        |
| uses window-based scroll restoration                                | point it at `[data-scroll-restoration-id="basalt-main"]`; TanStack Router picks it up with no config                                                                                                        |
| overrides `--vx-space-sticky-header-clearance`                      | the token NO LONGER includes the app-shell header height — it is `anchors.stackMd` (12px at level 0), pure breathing room, because BOTH the header and the page-bar band are regions outside the scrollport |
| passes `BasaltDataTable stickyHeaderOffset` inside a shell          | drop it entirely. Nothing overhangs the scrollport any more, so a sticky table head wants `top: 0`, which is the default                                                                                    |
| computes a viewport-filling body from `--basalt-page-bar-h`         | inside a shell that is just `100%` now — the band is outside Main rather than scrolling with it. The var is still published                                                                                 |
| passes `mobileNav.getScrollElement` only to reach the page scroller | you can drop it — the default resolves the scrollport now                                                                                                                                                   |

Two more rendering changes ride along, both visible without any code change (the third,
the brand relocation, is NOT always visible — it has its own § below):

- **`PageBar` row 2 is a shell-owned BAND**, not a row in the page: it portals into an outlet
  `BasaltShell` renders between the header and the scrollport, exactly as row 1 portals into the
  header. It spans Main's width, carries `--vx-surface-bg` and one `--vx-divider` hairline, and is a
  zero-height, seam-less box on a route with no `PageBar`. It is no longer sticky and no longer
  depends on where you wrote `<PageBar>` — nested in a `Stack` or written as Main's direct child now
  produce identical geometry. Its padding-block tightened from `--vx-space-stack-sm` to
  `--vx-space-stack-xs`, so the bar is 8px shorter.
- **`BasaltDataTable` contains itself horizontally by default.** A table with neither `maxHeight`
  nor `minWidth` used to render a bare `<table>`, which sizes to its own min-content — a five-column
  table measured 448px inside a 390px viewport and dragged the whole page sideways. Every table now
  renders inside `Table.ScrollContainer type="native"` (`minWidth: 0` when you set none), so a wide
  table scrolls inside its own card. `stickyHeader` with neither prop cannot take that container —
  an `overflow-x` box computes `overflow-y` to `auto` and becomes the header's scrollport, and with
  no height cap it has no scroll range, so the header would go inert — so it takes a wrapper whose
  overflow is **measured** instead: while the table fits its container the wrapper declares no
  overflow at all and the page-sticky header sticks exactly as before; once the table is wider the
  wrapper flips to `overflow-x: auto`, the columns stay reachable, and the header is inert at that
  width. The flip is a live `ResizeObserver` reading in both directions, so the wrapper goes back to
  bare when the space returns (the window widened, the sidebar collapsed, the aside closed), and it
  publishes `data-contained="true|false"`. The dev warning on that shape now states the trade rather
  than a defect and points at `maxHeight` for a table that must both scroll and stick. Pinning takes
  the same wrapper: the `overflow-x: auto` `Box` a pinned, uncapped, sticky table used to get is
  gone, because it was the inert-header shape it was meant to avoid. **The TOOLBAR was the other
  half of the same defect and is fixed with it**: the toolbar `Group` is the header row's flex item
  (`CtlSlot` between them is `display: contents`) and carried `flex: 0 0 auto`, so a 220px search
  beside a 230px facet pill row was an unshrinkable 461px box in a 302px column — `AppShell.Main`
  measured `scrollWidth` 505 against `clientWidth` 390 at 390x844. It is now `flex: 0 1 auto` with
  `min-width: 0`, and the search's `w={220}` became a flex BASIS (`flex: 0 1 220px`, floored at
  `12ch`, capped at `100%`). The field still resolves to 220px wherever 220 fits and still never
  grows with the table; below that the search and the pills wrap onto their own lines.

### Shell — the brand moved into the header, and that can DELETE it

**This one is filed separately because "visible without any code change" is exactly what it is
not.** The header now spans the full viewport width, so the sidebar's `appShellHeaderHeight` brand
row was painting a SECOND band under the header seam. The brand is the header's leading zone
instead — `--app-shell-navbar-offset` wide, so it still tracks the rail collapse and still ends on
the sidebar\|main seam — and the sidebar column starts at `SidebarSearch`. `brand`, `brand.menu` and
the collapse toggle are unchanged; only the markup's home moved.

**If your app suppresses the header, the brand and the sidebar collapse toggle are now GONE.**
Nothing type-checks differently, nothing lints, no test fails: the app simply boots without them.
A phone-first consumer that zeroes the header (`--app-shell-header-height: 0`,
`--app-shell-header-offset: 0`, or `display: none` on the region) hit exactly this, and found it by
looking at the app. There is currently no supported way to suppress a shell region and no signal
when a region's contents move underneath you — **so if you have ever styled a `mantine-AppShell-*`
region away, re-check it against every minor that touches the shell.** The remedy is to stop
suppressing the header (it is one token tall) or to render your own brand where the header used to
be.

**Two more consequences, for a consumer mounting `AppSidebar` DIRECTLY** rather than through
`BasaltShell` (which is the supported path): it no longer paints a brand row, and its
`onToggleCollapse` prop is no longer read there — `BasaltShell` feeds it to the header instead. Both
are silent in the same way.

Find out whether this reaches you: `rg -n "app-shell-(header|navbar)-(height|offset)|AppShell-header"`

## 1.27.0 — the number lane, `StatCard`'s breakdown, and five promotions

**Nothing removed. Two exports added (`NumberFilter`, and three members on the number handle),
one member added to every `FieldHandle` (`clear()`), four `StatCard` props added, and enforcement
tightened: five oxlint rules plus one guard kind became `error`.** The store half of this minor also
fixed four inference and notification defects consumers hit while porting, plus two ways a fallback
got pinned into localStorage — see § Stores below. Every level change honours the `theme-allow`
grammar unchanged; only the severity of an unwaived finding moves.

### Stores — the `custom` flag, patched writes, lazy fallbacks, derived windows

**Additive, except one type that got narrower on purpose.** `field.range({ presets, fallback })`
written INLINE inside `createSearchStore({ fields })` used to infer `custom` as `boolean` — the
contextual `AnyField` return type won over the argument — so every value and search type carried a
`'custom'` preset the field itself rejects at runtime, and `RangeFilter field={…}` needed a cast or
an explicit `custom: false`. `field.range` is now three overloads: an omitted or `false` flag is
`false`, a literal `true` is `true`, a value typed `boolean` stays widened.

- **Delete the workaround, not the field.** An explicit `custom: false` still works (same
  overload); a cast on `<RangeFilter field={…} />` can go, and `RangeFilterProps<P, C>` is generic
  over the flag so a preset-only handle binds directly.
- **What can newly type-error:** code that read `'custom'` out of a range whose field never declared
  it — `if (search.range === 'custom')` on a preset-only field, or a `RangeValue<P | 'custom'>`
  annotation over one. That branch was always dead at runtime; the type just stopped pretending.
- **…and one more, in a consumer's own WRAPPER.** A prop typed `FieldHandle<RangeField<P>>` — `C`
  defaulting to `boolean` — no longer accepts a handle from a `field.range` without `custom: true`,
  because that handle's setter is now `RangeValue<P>`-typed and a setter is contravariant. Pin
  `FieldHandle<RangeField<P, false>>` for the preset-only shape, `RangeField<P, true>` for a
  picker-backed one, or make the wrapper generic over the flag
  (`<P extends string, C extends boolean>` + `FieldHandle<RangeField<P, C>>`), which is what
  `RangeFilter` does. An existing `as FieldHandle<RangeField<P>>` cast keeps compiling.

**`toWindow()` resolves derived presets.** `field.range({ window: { '3m': (now) => ({ from, to }) } })`
makes `toWindow({ preset: '3m' })` return `{ from, to }` (ISO dates, resolved at call time with the
current `Date`) while `3m` stays one preset in the URL. A preset with no resolver keeps
`{ window: preset }`, in the same field — which is what retires the last hand-rolled
`presetToParams` a consumer kept beside the store for `3m` / `6m` / `1y` / `ytd`.

**The resolved presets are gone from the return TYPE too**, which is the half that decides whether
the switch is deleted or the cast just moves: the field now carries its resolver keys (`RangeField`'s
fifth type parameter, inferred from `window`), and `toWindow` returns
`{ window: Exclude<P, W> } | { from; to }`. A `resolveWindow` whose target is
`{ window: '7d' | '30d' | '90d' | 'all' } | { from; to }` becomes a one-line delegation with no
`as`. One guard survives on a `custom: true` field: a `'custom'` preset that arrives WITHOUT dates
resolves to `{ window: 'custom' }`, so `'custom'` stays in the union by construction.

**A field setter takes an optional second argument.** `set(next, { patch })` merges extra search
params into the SAME navigate — URL lane only, for keys the store does not own (`{ patch: {
detailDate: undefined } }` clears a sibling param the page put there). The field's own params always
win over the patch, so it cannot corrupt the value being set. A local/memory-lane write has no
navigate to merge into and ignores it.

Two limits are now enforced rather than documented. A patch key **another field of the same store
owns** is refused — it would reach the URL while the store's own write path never touched the mirror,
so the next paramless visit and every `linkSearch` link resolve the OLD value: `createSearchStore`
throws in dev, and in production keeps the write and logs it once. Write that field through its own
setter instead. And a patched write **from a route that does not validate the field** persists (A1)
but drops the patch with it — there is no navigate to merge into — which now warns once per field in
dev instead of doing nothing.

**A fallback may be a thunk.** `field.*({ fallback: () => T })` (every kind — `field.number`'s codec
froze its thunk at store definition in the first cut of this minor and does not now) is resolved at
READ time and re-resolved while nothing is written, and is never persisted on its own — a write
stores what the control produced, as before. **Local and memory lanes only:** `createSearchStore` now
THROWS at definition for a thunk on a URL-lane field, because `validateSearch` would evaluate it on
every navigation and pin the result into the URL. Move the field off the URL lane (`{ url: false }`,
or `createLocalStore`) or pass a value.

**`FieldHandle` gained `clear()`, and a reset now UNSETS.** `useReset()` used to write
`entry.codec.fallback` into the mirror for every persisted field, and every control's reset called
`setValue(field.fallback)` — both of which pin a RESOLVED thunk: pressing `Reset all` over
`field.string({ fallback: () => todayIso() }, { url: false })` stored today's date, so tomorrow the
field read a value nobody chose and counted as active in `Filters (n)`. Both paths now delete the
key instead (the memory lane always did), and `clear()` is the per-field door: the persist lane
deletes its key, the memory lane drops its value, the URL lane navigates back to the fallback
params.

Nothing to change at a call site — every shipped control's reset calls it. A consumer that
hand-rolled a reset should swap `setValue(field.fallback)` for `field.clear()`; a hand-built
`FieldHandle` (a facet column, a test double) must add the member, which is the one type-error this
adds.

**`createPersistedState` notifies across instances (bug fix).** Two instances over one key — a
page's store and a widget's own state naming the same key, or a store re-exported from two modules —
kept per-instance listener sets, so a write through one left the other's components rendering the
stale value **in the same tab** while the cross-tab `storage` path worked. Subscribers are now
registered per storage key. No API change; if you were re-rendering something by hand to work around
this, delete it.

**`RangeFilter` warns once in dev** when the field declares `custom: true` and no `customPicker` was
injected: the custom window is then unreachable (no popover picker, no `Custom range…` row in the
sheet). Preset-only remains a legal configuration — the picker is injected precisely because
`@mantine/dates` may be absent — so this is a warning, not a type error.

### Controls — `NumberFilter`, the `field.number` lane

**One export added, nothing removed.** `field.number` has existed since the store landed and had no
control, so both consumers that needed one wrote around it in opposite directions: linewatch kept a
raw `SegmentedControl` over `minDuration` (a `control-outside-home` warn, law C1), and argo widened
`nights` into a string enum — which puts `'3'` in the URL and makes every downstream comparison a
parse.

```tsx
import { NumberFilter } from 'basalt-ui/controls'

// A preset set — a pill plus a radio list, the same body every enum filter renders.
<NumberFilter field={booking.field.nights} label="Nights"
  options={[{ value: 1, label: '1 night' }, { value: 7, label: 'A week' }]} />

// No `options` → a pill whose popover holds a `ctl` NumberInput; the sheet renders it full-width.
<NumberFilter field={lines.field.minDuration} label="Min duration" step={30} />
```

Three properties worth knowing before porting a call site:

- **The URL keeps a NUMBER.** `options` takes `{ value: number; label: string }`, and a numeral
  STRING there is a type error — the whole reason to stop widening a threshold into an enum.
- **The stepper applies on blur or Enter, never per keystroke.** A number is typed digit by digit, so
  a live write would navigate on `4`, `42`, `420` — three loader runs for one intended threshold,
  two of them values nobody meant. `SearchFilter` debounces; a number has an explicit commit point.
- **`min`/`max`/`int` come off the HANDLE, not the call site.** They are deliberately not props: the
  field is what validates the URL, and a second copy at the call site is a second answer to the same
  question. The number handle republishes all three (see § Stores — the number handle below), so the
  stepper stops at the field's limit and an `int` field refuses decimals outright. A TYPED value is
  clamped to those bounds when it commits, so the box reads what the store holds even when the store
  does not move — a second out-of-range `9999` against `max: 600` over a stored `600` writes nothing,
  and the readout still corrects itself to `600`. The codec's clamp stays the backstop for a value
  that never came through the box at all — a hand-typed URL, a stale deep link.

### Stores — the number handle republishes its bounds

**Three members added to `FieldHandle<NumberField>`, nothing removed.** `min`, `max` and `int` now
sit on the handle, filled from the field declaration (`NumberHandleExtras`, the shape
`RangeHandleExtras`/`toWindow` already had). A control never sees the field descriptor — only the
handle — so before this the only way one could learn its own limits was for the call site to pass
them a second time.

```ts
const nights = store.field.nights // field.number({ fallback: 2, min: 1, max: 14, int: true })
nights.min // 1        — `undefined` when the field declared none
nights.max // 14
nights.int // true     — `false`, never `undefined`, on a number handle
```

Non-number handles carry all three as `undefined`, the same way `toWindow` is `undefined` off a
range handle. That is a type-level fact, not just a runtime one, and it matters for one collision in
particular: `StringField` has its own `max`, which is NOT republished — a string handle's `max` is
`undefined`.

Nothing about the clamp changed. The codec has always clamped a number to the declared bounds on
write, and still does; the handle is a readout of that law, which is what lets `NumberFilter` bound
its stepper instead of letting the user watch the correction happen.

### `StatCard` — `unit`, `breakdown` and the delta's own format

**Four props added, nothing removed or renamed; every one defaults to today's rendering when
omitted.**
`value` is a pre-formatted `string`, so a card had exactly one text channel under the hero row
(`subtitle`) and three consumers wanting a unit AND a basis AND a split hand-rolled the card instead
— which is the fork `shadow-basalt-export` reports as a `HeroCard`.

| Prop          | Type                                                               | Renders                                                                       |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `unit`        | `string`                                                           | after the value on the hero row — muted, mono, `--vx-text-sm`                 |
| `breakdown`   | `readonly { label: string; value: string; tone?: StatCardTone }[]` | compact rows under the hero, one `controlHeightTag` line each                 |
| `deltaFormat` | `(delta: number) => string`                                        | the delta chip's label. Default unchanged: `Math.abs(delta).toFixed(1) + '%'` |
| `deltaGlyph`  | `boolean`                                                          | the chip's ▲/▼. Default `true`; a zero delta never shows one                  |

`unit` is forwarded to `WidgetHeader`, which gained the same prop, so `ChartCard` and `Section`
headers get it too. It is NOT the basis: `412` + `TSS` is the pair, and `7-day rolling` is still
`subtitle`. A thousands separator, a currency symbol or a `%` still belong in `value`.

`breakdown` draws **no hairlines** — §2.1 puts a horizontal rule between OPTION rows and nowhere
else, and `theme/divider-law.test.ts` inventories every one basalt draws. The rows separate by
weight (muted label, mono ink value) instead. Keep it to two or three: past that the card is a
table, and a table is `BasaltDataTable` in a `Section`. A row's `tone` reads the same per-scheme
`--vx-status-*` solid the card's own rail does, and omitting it is untinted, never `'good'`.

`deltaFormat` exists because **a delta is not always a percentage, and `StatCard` claimed it was**:
`delta={0.3}` on a pace or speed card rendered `▲0.3%`, a wrong unit on a KPI — worse than no chip —
so the one consumer that needed it kept the card hand-rolled and took the `shadow-basalt-export` warn
instead. `DeltaBadge` had `format` all along; neither `WidgetHeader` nor `StatCard` forwarded it. Both now do.
`ChartCard`/`Section` are unchanged: each declares its own header props and forwards them one by
one, so a delta-bearing `ChartCard` or `Section` still prints the percentage — ask if you need it
there.

```tsx
// A percentage, unchanged — no prop, no move.
<StatCard title="Volume" value="1,204" delta={4.2} deltaPeriod="WoW" />

// An absolute delta. The formatter gets the SIGNED number, so it may print the sign itself;
// `deltaGlyph={false}` then stops the ▼ saying the same thing twice. No `deltaLabel` prop exists —
// the function IS the escape hatch, and `delta` stays the number that drives the tone.
<StatCard title="Pace" value="5:31" unit="/km" delta={-12} deltaGlyph={false}
  deltaFormat={(s) => `${s < 0 ? '−' : '+'}0:${String(Math.abs(s)).padStart(2, '0')} /km`} />
```

### Guards — the 1.27.0 promotions, one narrowing and one new exemption

**Five plugin rules and one guard kind became `error` in the shipped preset.** Their
`PLUGIN_RULE_GRACE` / `GRACE_PERIOD_KINDS` entries are deleted, which IS the promotion (C16). A
`theme-allow` written against any of them still works unchanged; only the severity of an UNWAIVED
finding moves.

| Promoted to `error`              | Waiver, if the finding is deliberate                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `basalt/control-size-literal`    | `theme-allow control-size-literal — <why>` above the node, or `theme-allow-file` for the file |
| `basalt/in-body-page-title`      | `theme-allow in-body-page-title — <why>` — ONE id, so it waives the guard kind's lane too     |
| `in-body-page-title` (kind)      | the same annotation; the two lanes share the id by construction                               |
| `basalt/responsive-twin`         | `theme-allow responsive-twin — <why>`; the real fix is deleting one mount                     |
| `basalt/search-literal-link`     | `theme-allow search-literal-link — <why>`; the real fix is `search: <store>.linkSearch`       |
| `basalt/use-search-from-literal` | `theme-allow use-search-from-literal — <why>`; the real fix is the param as a prop            |

The commonest in-body-title case that is NOT a defect: **a shell-less surface naming itself** — an
auth gate, an error boundary, a print view. There is no breadcrumb to carry the name, so write
`theme-allow in-body-page-title — shell-less surface`.

**`control-size-literal` also gained one exemption in the same minor, and it removes a waiver rather
than adding one: a slot owned by `ChartCard` no longer reports.** `ChartCard` lives inside the
Mantine-free chart layer, so its `actions` slot writes `data-basalt-tier` by hand and cannot mount
the tier theme at all — a `Switch` there with no `size` renders at Mantine's default, not at `ctl`.
The rule's message ("the HOME sets the tier, drop the prop") was simply false in that one slot, and
because the rule fires on the `size` ATTRIBUTE it could not tell a correct `size="ctl"` from the
`size="xs"` it exists to catch. Every other home still reports, and the owner test reads the
IMPORTED name so `ChartCard as Card` is exempt too. `hand-rolled-filter` is deliberately NOT
exempted there: a raw `Select` in `ChartCard.actions` is still a filter that should take a `field`.
A HOISTED binding is exempt only when EVERY basalt home it was handed to is `ChartCard` — one
`const acts = <Button size="xs"/>` given to both `<ChartCard actions>` and `<Section actions>` still
renders in a tiered slot, and keying the exemption on a single owner made the verdict depend on which
attribute came later in the file.

**`basalt/control-outside-home` and `raw-selection-control` did NOT promote. They are re-dated to
1.30.0, and the reason is a measurement rather than caution:** the wave-7 consumer run left 9 warns
in argo, and every one is a control inside a modal/form module whose `<Modal>` is rendered by the
PARENT route — law C1's cross-file case, which is advisory by declaration because no scan of one
file can see it. Both lanes now exempt a file whose BASENAME matches
`*-{modal,drawer,popover,panel,form}.tsx`, which is the convention those nine already follow.
Outside the convention, an overlay body declares itself:
`theme-allow-file control-outside-home — overlay`. The trade is stated plainly: a whole file goes
unscanned on a naming convention, so a `Select` that genuinely belongs in a page bar goes unreported
if it lives in `filters-panel.tsx` — the same bargain the `@mantine/form` exemption already buys,
and a smaller one than promoting a rule with 9 known false positives.

**`basalt/shadow-basalt-export` narrowed, and it stays a permanent advisory `warn`.** An ALIAS hit is
now skipped when the file imports the basalt export it renames **and REFERENCES that binding as a
value**: a `HeroCard` that composes `StatCard` is a wrapper, not a fork, and it was already following
the advice the message gives. Composition, not import — three shapes stay reported, and they are the
ones a fork actually writes: a type-only `import type { StatCard }` (or an inline `type` specifier)
feeding `ComponentProps<typeof StatCard>`, a VALUE import used only in a type position, and a dead
import left behind after the body was re-rolled. None of them render anything. A reference does not
have to be a JSX tag — `component={StatCard}` and `createElement(StatCard)` compose it too. The
provenance test reads the IMPORTED name, so `import { StatCard as Base }` counts. The name-COLLISION
half is deliberately NOT exempted the same way — a local `StatCard` beside an
`import { StatCard as Base }` kept the name AND a piece of the original, which is the fork shape this
rule most wants to see.

## 1.26.0 — the control tier, the page bar and the store

**One export removed and two deprecated — see § Stores below; two shell PROPS removed — see
§ Sidebar. Two other behaviour changes: the grace ledgers changed shape, and nine
long-stale entries (D4, `docs/archive/CONTROLS-SYNTHESIS.md`) are promoted.** C16
(`docs/CONTROLS-SPEC.md` §1) is the new law behind both: a grace entry now carries `{ since,
promote, why }` (semver strings) instead of a bare promotion-note string, and a version-gated test
fails the build once `package.json`'s version reaches an entry's `promote` while the entry is still
in the ledger — and `make release` refuses to cut a release whose COMPUTED version has reached one,
which is the half that fires before the release rather than one minor after it. That is what stops a
rule sitting at `warn` for five minors with nothing tracking the promise, which is exactly what
happened to the nine rows below.

**`PLUGIN_RULE_GRACE`** (`configs/oxlint-plugin.js`) **and `GRACE_PERIOD_KINDS`**
(`src/guard/index.ts`) no longer carry any PRE-EXISTING entry — every one either promoted to `error`
(the table below) or moved to the new, permanent `PLUGIN_RULE_ADVISORY` ledger
(`shadow-basalt-export`). Both ledgers now hold only the wave-6 control guards listed under
§ Guards — six plugin rules and two guard kinds, each `{ since: '1.26.0', promote: '1.27.0' }` —
which the C16 gate forced to promote or be deleted at 1.27.0. Five rules and one kind promoted there;
the C1 pair was re-dated to 1.30.0 against a measurement (see 1.27.0 § Guards above). A theme-allow escape written against
any of these still works unchanged; only the SEVERITY of an unwaived finding moves from `warn` to
`error`.

| Rule / kind (promoted)                 | What now errors                                                                                                                                                  | Escape hatch                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt/hand-rolled-plot`              | An unwaived chart-assembly node (`AxisLeftNumeric`, `AxisRightNumeric`, `AxisBottomDate`, `HoverOverlay`, `Crosshair`) outside a file composing `CartesianChart` | `theme-allow hand-rolled-plot — <why>` per node, or `theme-allow-file hand-rolled-plot — <why>` for a declared exception                    |
| `basalt/chart-legend-literal`          | A hand-written array literal passed to `ChartLegend`'s `items`                                                                                                   | Derive the legend from `series` (`deriveLegend`, or let `ChartFrame`/`CartesianChart` do it), or `theme-allow chart-legend-literal — <why>` |
| `basalt/hand-rolled-shell`             | A hand-rolled app-shell assembly node instead of `BasaltShell`                                                                                                   | `theme-allow hand-rolled-shell — <why>`, or `theme-allow-file` for the whole file                                                           |
| `theme-allow-unscoped` (guard kind)    | A bare `// theme-allow` with no rule id                                                                                                                          | Name the kind(s): `theme-allow <kind> — <why>`                                                                                              |
| `surface-shadow-override` (guard kind) | A hand-composed `boxShadow` reaching a `--vx-*` token                                                                                                            | Use the shipped shadow tokens, or waive with a reason                                                                                       |
| `css-raw-surface` (guard kind)         | A raw surface color in kebab CSS (`.module.css`)                                                                                                                 | Same remedy as the JS/TSX form — a `--vx-*` var, or waive                                                                                   |
| `inline-font-size` (guard kind)        | A hardcoded numeric font size in an inline `style` object                                                                                                        | `VX.text.*` / `--vx-text-*`, or waive                                                                                                       |
| `hidden-inline-style` (guard kind)     | A style object defined once and spread into `style={...}` (evades the guard's inline-object scan)                                                                | Inline the object at the call site, or waive                                                                                                |

**`basalt/shadow-basalt-export` is unaffected** — it moves ledgers (`PLUGIN_RULE_GRACE` →
`PLUGIN_RULE_ADVISORY`), not severity. It stays `warn` in the shipped preset, permanently, and is
never subject to the C16 gate: see "Lint and guard rules that tightened" below for why.

Consumers who never overrode `basalt.severity` for any of the eight kinds/rules above and never
waived them see these findings for the first time as `error`; measure against the shipped preset
before upgrading if that's a concern (`basalt-ui check-theme --audit-allows`, `oxlint .`).

- **`AgentTransport.stream`'s third param** (`basalt-ui/agent`) — `ctx?: { messageId: string }`;
  `aiSdkTransport` and `useAgentThreadRuns.start()`/`retry()` now share ONE id per turn instead of two.
- **`useAgentThreadRuns({ onError })`** (`basalt-ui/agent`) — a genuine (non-abort) stream failure
  per thread, for a toast without wrapping the transport.
- **`useAgentThreadRuns` re-sweeps when `store.hydrated` flips true** (`basalt-ui/agent`) —
  resume-after-reload now works for an async `createAdapterThreadsStore`; no API change.
- **`ThreadFeedRow` gains `title`/`summary`/`headerLeft`/`headerRight`/`messages`/`classNames`**
  (`basalt-ui/agent-chat`) — header and transcript overrides plus slot classes for a server-titled row.
- **`ThreadFeedRow.height` no longer requires `virtualize`** (`basalt-ui/agent-chat`) — a bounded,
  auto-scrolling body via `BasaltStickToBottom`.
- **`ThreadFeed.anchor`** (`basalt-ui/agent-chat`) — `'end'` for a bottom-anchored chat feed.

### Composers — WidgetHeader-backed renames (docs/CONTROLS-SPEC.md §2.2)

`StatCard`, `ChartCard`, `Section` (new), `SettingsSection`/`DangerZone` and `BasaltDataTable` now
each compose the wave-1 `WidgetHeader` primitive for their title row instead of hand-rolling one —
several props renamed or were added to line up with it.

| Component                        | Removed / renamed                                          | Replacement                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatCard`                       | `label`                                                    | `title`                                                                                                                                                                                                                                                                                  |
| `StatCard`                       | `menu`                                                     | `actions` (wrapped in `CtlSlot`)                                                                                                                                                                                                                                                         |
| `StatCard`                       | —                                                          | adds `icon`, `info`, `subtitle` (forwarded to the composed `WidgetHeader` — the info glyph beside the title, the muted unit line under the hero row), `sparklinePlacement?: 'bleed' \| 'right'` (default `'bleed'`, collapses to it below `sm`)                                          |
| `ChartCard`                      | `tooltip`                                                  | `info`                                                                                                                                                                                                                                                                                   |
| `ChartCard`                      | `extra`                                                    | `actions` (carries `data-basalt-tier="widget"`, no `CtlSlot` — `./charts` stays Mantine-free)                                                                                                                                                                                            |
| `ChartCard`                      | `title: string` (required)                                 | `title?: string` — the header now renders only when title/info/value/actions/icon/count is set                                                                                                                                                                                           |
| `ChartCard`                      | —                                                          | adds `icon`, `value`, `delta`, `deltaPeriod`, `count`                                                                                                                                                                                                                                    |
| `SettingsSection` / `DangerZone` | `description`                                              | `subtitle`                                                                                                                                                                                                                                                                               |
| `SettingsSection` / `DangerZone` | —                                                          | adds `actions` (wrapped in `CtlSlot`)                                                                                                                                                                                                                                                    |
| `BasaltDataTable`                | `toolbarActions`                                           | `actions?: ReactNode` — the toolbar (search + facets + `actions`) is now wrapped in `CtlSlot`. Typed `ReactNode`, not `BarAction[]` — a table toolbar is not a `PageBar`/`Section`, and `ActionGroup`'s shell-extras semantics (primary/secondary, mobile folding) must not leak into it |
| `BasaltDataTable`                | fixed `w={220/200/180/110}` on toolbar/pagination controls | removed — the controls size by content                                                                                                                                                                                                                                                   |
| `BasaltDataTable`                | —                                                          | adds `title`, `icon`, `subtitle` — when `title` is set, renders `WidgetHeader tier="widget"` above the toolbar, `count` always `table.getRowCount()` (C11)                                                                                                                               |
| `BasaltDataTable`                | `facets` rendered as raw `Select`/`MultiSelect`            | rendered as `EnumFilter`/`MultiSelectFilter` pills inside a `FilterSet` (`docs/CONTROLS-SPEC.md` §3) — a synthetic `"All"` option stands in for a single-select facet's cleared state, since a closed enum field has no member for "unset"                                               |

New export: **`Section`** (`.`, Mantine-coupled) — `WidgetHeaderProps` minus `tier`, plus `tabs?`,
`collapsible?`, `persistKey?`, `defaultOpen?`, `summary?`, `id?`, `children`. No `variant`, no
border/background — one shaded container level per page belongs to the cards inside a `Section`, not
to `Section` itself. Fold state persists at `basalt:section:<persistKey>` via `createPersistedState`
when `persistKey` is given, else local `useState`; the header stays drawn when collapsed, only the
body unmounts. `defaultOpen` (default `true`) picks the state a FIRST visit lands on and is outranked
by a persisted value, so a section the reader closed stays closed. `summary` renders under the header
and survives a collapse — a folded section still states its headline figures, which is what makes
folding it a real option rather than a way to lose the numbers.

### Homes — `PageBar` replaces the page-action portal

**Three exports removed with no deprecation window, one prop retyped, three tokens and one CSS
class deleted.** `PageActions` gave a page a `ReactNode` slot in the header and nothing else: no
second row, no overflow policy, no mobile projection. Every consumer then hand-rolled the rest —
a sticky filter row measured into a `--lw-header-h`, a horizontally scrolling action strip, a
responsive twin under `visibleFrom`/`hiddenFrom`. `PageBar` is that whole shape, typed
(`docs/CONTROLS-SPEC.md` §2.1).

| Removed / changed                                                                                  | Replacement                                                                                                |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PageActions`                                                                                      | `<PageBar actions={{ primary, secondary }} sync={…} tabs={…} filters={…} filtersEnd={…} />`                |
| `PageActionsOutlet`                                                                                | none — the outlet is internal to `BasaltShell` now                                                         |
| `PageHeaderProvider`                                                                               | none — the provider is internal to `BasaltShell` now                                                       |
| `BasaltShellProps.globalActions: ReactNode`                                                        | `GlobalAction[]` — `{ key, node, mobile?: 'bar' \| 'more' \| 'hidden' }`; the first two default to `'bar'` |
| tokens `appShellHeaderMobileHeight`, `appHeaderMobileActionsHeight`, `stickyHeaderClearanceMobile` | `appShellHeaderHeight` / `stickyHeaderClearance` — one value at every viewport                             |
| vars `--vx-space-app-header-mobile-actions-height`, `--vx-space-sticky-header-clearance-mobile`    | `--vx-space-sticky-header-clearance`                                                                       |
| CSS `.pageActions` (`shell/app-header.module.css`) and its `nowrap` override                       | none — the portal target no longer scrolls; overflow folds into `ActionGroup`'s `More`/kebab               |

What changes at runtime even if you only rename:

- **The app-shell header is 48px on a phone too.** It used to wrap to two rows (97px) and reserve
  the second one on every route, empty or not (law C14). A page-level filter/tab row now renders
  in the page FLOW, sticky under the header, so a route with no filters is 49px shorter on mobile.
- **The header never scrolls sideways.** Actions past three fold into a `More` menu on desktop and
  into one kebab below `sm` — computed from `BarAction[]`, which is why the slot had to become data
  (law C7). There is exactly ONE kebab per header, and `PageBar`'s ROW 1 owns it: the shell's
  `mobile: 'more'` global actions land there, and so do `filtersEnd`'s items (row 2 shows those on
  desktop only — below `sm` row 2 is tabs + the first pill + `Filters (n)`, per spec §2.1). A route
  with no `PageBar` row-1 actions gets the kebab from the shell instead. An `ActionGroup` you mount
  yourself — in a `Section` or `ChartCard` `actions` slot — never inherits the global rows.
- **`--basalt-page-bar-h` is published on `documentElement`** (ResizeObserver where available,
  `height > 0` guard)
  whenever a row 2 renders, and removed when it unmounts. It is written in the LAYOUT phase, so it
  exists at the first paint — a cold load of `/page#anchor` lands below the bar rather than under
  it. A `100dvh` body becomes
  `calc(100dvh - var(--app-shell-header-height) - var(--basalt-page-bar-h, 0px))` — delete any
  hand-rolled measure-and-publish effect and any hardcoded header-height fallback.
- **A shell-less app reads `title`/`icon`.** Inside a `BasaltShell` the breadcrumb names the page
  and both are ignored; outside one they lead row 1, and the whole bar sticks at `top: 0`.
- **`className` lands on the bar ROOT in both forms** — the shell-less
  `[data-basalt-page-bar="standalone"]`, or row 2's sticky wrapper `[data-basalt-page-bar="shell"]`.
  It is the seam for the two things only the consumer's own layout knows: bleeding the sticky bar
  across a container's gutters, and a hairline under it. Scope that CSS through the class; a global
  `[data-basalt-page-bar]` rule reaches every page in the app, including the ones wanting neither.

`ActionGroup`, `OverflowMenu` and `SyncButton` ship on the new `basalt-ui/controls` subpath; only
the TYPES a `PageBar`/`BasaltShell` prop mentions (`BarAction`, `ActionGroupProps`, `GlobalAction`)
are re-exported from the root.

### Stores — `createSearchStore` replaces the enum-only pair

`createSearchParamStore` and `createMultiSearchParamStore` still work: both are now `@deprecated`
thin wrappers over `createSearchStore`, returning the same four members
(`validateSearch`, `useStore`, `readStored`, `linkSearch`) with the same signatures and reading the
same single-value localStorage envelope. **They are removed in 1.29.0.**

| Removed / deprecated                                       | Replacement                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `createSearchParamStore({ key, param, values, fallback })` | `createSearchStore({ key, fields: { <param>: field.enum(values, fallback) } })` — `@deprecated`, removed 1.29.0  |
| `createMultiSearchParamStore({ key, param, values })`      | `createSearchStore({ key, fields: { <param>: field.multi(values, fallback) } })` — `@deprecated`, removed 1.29.0 |
| `<store>.useStore()`                                       | `<store>.field.<name>.use()` — reads the URL FIRST, then the mirror; writes both lanes                           |
| `useOnlineStatus` (`.` and `./state`)                      | `useConnectivity()` (`.`, auto-mounted by `BasaltProvider`) — **removed, not deprecated** (A12)                  |
| `createSearchSchemaStore`                                  | never shipped; `createSearchStore` is what those "planned" paragraphs were waiting for                           |

New on `./router-tanstack`: `createSearchStore`, `field` (`enum` / `multi` / `range` / `number` /
`boolean` / `string`), and the `FieldHandle` / `AnyField` / `FieldValue` / `RangeValue` / lane types.
New on `./state` (router-free, same field vocabulary): `createLocalStore`, `field`, those same types.
`FieldHandle` is what every 1.26.0 control takes instead of `value`/`onChange`
(`docs/CONTROLS-SPEC.md` §3–§4).

Three things to know when you migrate a real store:

- **A deep link now wins over the mirror.** `?range=7d` reads back `7d` even when localStorage says
  `30d`. The old `useStore` read localStorage, so a shared link opened on the wrong window — the bug
  three consumers shipped (A8). If you were compensating for that by hand, delete the compensation.
- **The storage layout changed for the NEW factory only.** `createSearchStore` keeps one entry per
  STORE (`basalt:<key>` = `{ fieldName: value }`); the old factories kept one bare value per param.
  A store migrated from a wrapper to `createSearchStore` therefore ignores whatever the browser
  already had for that key and starts on its fallback once. The wrappers themselves keep the old
  layout byte-for-byte, so an un-migrated consumer sees no reset — including a stored EMPTY multi
  selection, which still reads back as empty: "an empty array means absent" is a URL rule in the
  deprecated store, never a storage rule, so a deliberately cleared filter stays cleared.
- **A write from outside the owning route persists only** — it no longer needs a hand-rolled
  `navigate` beside it, and it no longer silently writes a param the route does not validate.
  `validateSearch` picks the persisted value up on the next visit (A1). The one combination with
  nowhere to go — a `persist: false` field written from a route that does not validate it — warns
  once per field in dev rather than dropping the write silently.

**Every navigate a store issues carries `resetScroll: false`** — a field write and `useReset`
alike. A filter lives halfway down a page as often as it lives in the bar, and the router treats a
same-route search write as a navigation, so the default scrolled the reader back to the top on every
change. Delete any `resetScroll: false` you were passing beside a hand-rolled `navigate`.

Lanes are declared once per field: `{ url: false }` is the local-only lane (per-chart selects, a
compact toggle — or use `createLocalStore`), `{ persist: false }` the URL-only lane (pagination, a
deliberately unpersisted threshold), `{ history: 'push' }` opts one field into a history entry.
**`{ url: false, persist: false }` is the IN-MEMORY lane** rather than the one combination that
dropped its write: shared across every mount of that store for the session, gone on reload, never
written to or read from localStorage. It behaves identically in both factories — `createSearchStore`
counts such a field in `useActiveCount()` and clears it in `useReset()`, and it never appears in
`useValues()`/`validateSearch`, which are the URL lane by definition. In a `createLocalStore` the
`url` flag is ignored, so `{ persist: false }` alone lands there. The dev warning about a write with
nowhere to go now fires only for its remaining real case: a `{ persist: false }` field that IS on the
URL lane, written from a route that does not validate the param. `createLocalStore` also carries **`labels()`**,
chainable and identical to `createSearchStore`'s, so `SelectFilter`/`ViewTabs` read option labels off
a local store too.
A `field.range` keeps THREE URL params (preset + `from` + `to`, renamable via `params`), so existing
deep links and loaders keep their shape, and `field.<name>.toWindow(v)` replaces a hand-rolled
`presetToParams`.

### Sidebar — `sidebarBlocks` replaces the two `ReactNode` extras

**Two props removed with no deprecation window, and two widened.** `sidebarNavExtra` and
`mobileNav.moreExtra` were the same gap solved twice and badly: the first rendered on desktop only
and vanished in the collapsed rail, the second was one anonymous row at the bottom of the More
surface, and neither could be projected because basalt could not see inside a `ReactNode`. Every
consumer that wanted an "Awaiting action" list therefore wrote it twice, once per prop, and got no
rail badge either way. `SidebarBlock[]` is that whole shape as data (law C13,
`docs/CONTROLS-SPEC.md` §2.3).

| Removed / changed                  | Replacement                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BasaltShellProps.sidebarNavExtra` | `sidebarBlocks={[{ kind: 'custom', key, node }]}` — same DOM position (last child of the nav scroll region), same CSS-only hiding in the rail, still desktop-only                      |
| `AppSidebarProps.navExtra`         | `blocks={[{ kind: 'custom', key, node }]}`                                                                                                                                             |
| `MobileNavConfig.moreExtra`        | `sidebarBlocks={[{ kind: 'list', key, label, items }]}` — one More-sheet row (`Awaiting action · 3`) opening a nested sheet of its items, instead of one unlabelled row of raw content |
| `useNav(NAV, { moreExtra })`       | drop the option; declare the block on `BasaltShell`                                                                                                                                    |
| `BasaltShellProps.brand`           | widened to `BrandConfig & { menu?: AccountMenuItem[] }` — additive; `menu` makes the brand row a `Name ▾` workspace switcher                                                           |
| `BasaltShellProps.search`          | widened to `SidebarSearchConfig & { actions?: SidebarSearchActions }` — additive; one or two icon-only buttons right of the ⌘K row                                                     |

What changes at runtime even if you declare no blocks at all:

- **Nav-section folds are now PERSISTED**, at `basalt:sidebar-section:<label-slug>` (e.g.
  `basalt:sidebar-section:tools`). They were a `useState` keyed by label, so every reload re-opened
  a section the user had closed. `defaultCollapsed` is now the SEED for that key rather than a value
  that overrides the user on every mount. Block folds live at `basalt:sidebar-block:<key>`; both are
  the standard `createPersistedState` envelope (`{ v: 1, value: boolean }`), readable with
  `readPersistedValue` from `basalt-ui/state`. A "Show more" toggle is deliberately NOT persisted.
- **`settingsMenuItems` renders FLAT at three entries or fewer** — one link row each, instead of a
  gear "Settings" menu you had to open to see two rows. Four or more keeps the menu. `brand.version`
  rides the flat rows as a faint label and the dropdown as a `Menu.Label`, as before. New
  `BasaltShellProps.settingsMenu?: 'auto' | 'flat' | 'menu'` (`AppSidebarProps` too, default
  `'auto'` = that count rule) forces the form: pass `'menu'` when the three rows are CONTROLS rather
  than destinations — a theme radio group and a devtools switch read as a widget pile flat, and the
  count cannot tell them from three links.
- **The footer is one wrapper deeper.** `settingsMenuItems` without `account` used to render its
  `Group` as the footer element itself; both now sit inside one footer `Stack` alongside any
  `placement: 'bottom'` block. No visual change — relevant only to a stylesheet reaching in by
  structure.
- **`useNav` now marks exactly one destination `active`** — the deepest matching route wins, instead
  of every prefix-matching row (a parent AND its child) reading active at once. A parent on the
  winner's path gets the new `SidebarItem.ancestor` instead: never active, never `aria-current`, only
  a `data-ancestor` hook for CSS. A consumer that styled off two simultaneously-active rows will now
  see one.

New types on `.`: `SidebarBlock`, `SidebarListBlock`, `SidebarProgressBlock`, `SidebarCustomBlock`,
`SidebarBlockItem`, `SidebarBlockTone`, `SidebarSearchActions`. `SidebarItem` gained `ancestor?:
boolean`.

### `DeltaBadge` — plain-element DOM, same props

Nothing removed or renamed — a DOM contract change only, ahead of `WidgetHeader`
(`docs/CONTROLS-SPEC.md` §2.2) composing it Mantine-free.

| Component    | What changed                                                                            | Why it matters                                                                                       |
| ------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DeltaBadge` | Renders a plain `<span>`, no `mantine-Badge-root`/`mantine-Badge-label` classes anymore | Same props, tone and format API — but a selector or snapshot keyed on Mantine's Badge classes breaks |

### Controls — `ArticleFilterBar` replaced by store-bound controls

Two new subpaths, `basalt-ui/controls` and `basalt-ui/controls-dates`, and ONE removal. The removed
component was controlled (`value`/`onChange`, its own `visibleFrom`/`hiddenFrom` twin); its
replacements take a `FieldHandle` and own the URL write, the localStorage mirror and the responsive
swap themselves (`docs/CONTROLS-SPEC.md` §3, laws C2/C9).

| Removed                 | Replacement                                                           | Import                                                       |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `ArticleFilterBar`      | `FilterSet` + `ViewTabs` (category axis) + `MultiSelectFilter` (tags) | `basalt-ui/controls`, and unchanged from `basalt-ui/content` |
| `ArticleFilterBarProps` | `FilterSetProps` / `ViewTabsProps` / `MultiSelectFilterProps`         | same                                                         |

All three replacements are re-exported from `basalt-ui/content` as well, so a content-only consumer
changes the component names and the props, not the import path.

Porting one call site:

```tsx
// before — the page owned the state, the labels and the mobile swap
const [category, setCategory] = useState('all')
<ArticleFilterBar categories={CATEGORIES} category={category} onCategoryChange={setCategory}
                  tags={ARTICLE_TAGS} selectedTags={tags} onTagsChange={setTags} />

// after — one store, two controls, no useState and no responsive branch
const articles = createSearchStore({
  key: 'articles',
  fields: { category: field.enum(CATEGORY_VALUES, 'all'), tags: field.multi(ARTICLE_TAGS, []) },
}).labels({ category: CATEGORY_LABELS })

<ViewTabs field={articles.field.category} />
<FilterSet>
  <MultiSelectFilter field={articles.field.tags} label="All tags" />
</FilterSet>
```

New on `basalt-ui/controls`: `FilterSet`, `RangeFilter`, `CompareFilter`, `SelectFilter`,
`MultiSelectFilter`, `SearchFilter`, `ToggleFilter`, `ViewTabs`, `COMPARE_VALUES`, and the
action/sync family. New on `basalt-ui/controls-dates`: `DateRangePicker`.

**`SyncButton`'s `scope` now decides the SHAPE, not only where you mount it.** `scope: 'global'`
renders icon-only at every viewport (an `ActionIcon` with the spinning glyph, age and error in the
tooltip, `label` as the accessible name) — the shell header shares 48px with the breadcrumb and
`PageBar` row 1, and a labelled button there is what pushes a page's own actions into the kebab.
`scope: 'page'` is unchanged on desktop (labelled, age inline) and drops to icon-only below `sm`,
which is what `docs/CONTROLS-SPEC.md` §3 always specified. One mount either way, CSS-only swap (law
C9). Consequence to know: the accessible name is now `aria-label` in BOTH forms, so a test asserting
the name as `Sync 2m ago` (the age used to land in it) now reads `Sync`. Nothing to change at a call
site.

**`SelectFilter` and `MultiSelectFilter` take `options?: readonly FilterOption[]`** — a runtime
catalogue (`{ value, label, disabled? }`) that OVERRIDES `field.options` whole rather than merging,
so a value the catalogue has dropped loses its row. It is what a label carrying live data needs
(`EUR · 1.08`), and on `SelectFilter` it also opens a second field shape: a `FieldHandle<StringField>`
is legal WITH `options` — an id set no enum can close over, a project picker fed from a query — and
a type error without it. `FilterOption` is new on `basalt-ui/controls`. Additive; nothing to change.

**`FilterSet` renders the mobile `Filters (n)` pill only when a child is actually folded.** With
every child inside the `inline` budget (one filter at the default `inline: 1`) the sheet would hold a
copy of what is already on screen, so neither the trigger nor the drawer mounts. Nothing to change —
but a mobile test asserting the pill exists on a one-filter page now has to fold something
(`inline={0}`) or drop the assertion. `RangeFilter.label` (default `'Range'`) names the sheet heading
and the preset track's aria name; the pill itself still reads the VALUE.

**`data-numeric` is now a package-wide law, not a per-component rule.** `basalt-ui/styles.css`
declares `[data-numeric] { font-family: var(--basalt-font-mono); font-variant-numeric: tabular-nums }`
inside `@layer basalt`, so the attribute works on ANY element — `<Text data-numeric>`, a table cell,
a count tag — and not only on a `SegmentedControl`, where it was previously a module-scoped rule that
made the attribute look broken everywhere else. Nothing to change: adding the attribute is opt-in,
and the two module rules that also set a component `font-size` still apply on top. This retires the
per-consumer `theme-allow` + inline `fontFamily`/`fontSize` hack for numeric labels.

**`@mantine/dates` is a new OPTIONAL peer, and only `basalt-ui/controls-dates` needs it.**
`basalt-ui/controls` resolves and renders without it — proven from the packed tarball by
`scripts/pack-test.sh`. Pass the picker into `RangeFilter` rather than importing it from a shared
module:

```tsx
import { DateRangePicker } from 'basalt-ui/controls-dates'
;<RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
```

A consumer that uses `DateRangePicker` installs `@mantine/dates` and imports
`@mantine/dates/styles.layer.css` with the other Mantine layer bundles, before `basalt-ui/styles.css`.

### Guards — the control rules (docs/CONTROLS-SPEC.md §6)

**Nothing removed. Eight new oxlint rules and two new guard kinds. `Ships` below is the level as of
THIS minor** — eight land `error`, and the C1 pair (`control-outside-home` and its text lane) is the
only grace left, re-dated to 1.30.0 on a measurement (see § Guards — the promotions).\*\* Every one honours `theme-allow <id> — <why>` on the
node and `theme-allow-file <id> — <why>` on the file, the same grammar as the rest.

| Rule / kind                          | Fires on                                                                                                                                                                                                                                                                                                           | Ships         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `basalt/hand-rolled-filter`          | A raw Mantine `Select`/`SegmentedControl`/… handed to a TIERED home slot (`actions`/`filters`/`tabs`/`sync`/`filtersEnd` on `PageBar`/`Section`/`WidgetHeader`/`ChartCard`/`StatCard`/`BasaltDataTable`/`SettingsSection`/`FilterSet`)                                                                             | error         |
| `basalt/page-bar-budget`             | A second `PageBar` in the SAME returned tree, >4 `actions.secondary`, >3 `Section` actions, a second filled `Button`/`ActionIcon` in one slot (outside an overlay)                                                                                                                                                 | error         |
| `basalt/control-outside-home`        | The same raw control with no home at all — exempt under a settings row / overlay / composer, in an `@mantine/form` file, in a file that DEFINES a basalt control (and imports no `basalt-ui`), or in a file basenamed `*-{modal,drawer,popover,panel,form}.tsx` / `<Subject>{Modal,Drawer,Popover,Panel,Form}.tsx` | warn → 1.30.0 |
| `basalt/control-size-literal`        | `size`/`w`/`fullWidth`/`visibleFrom`/`hiddenFrom` on anything inside a home slot (the slot sets the tier)                                                                                                                                                                                                          | **error**     |
| `basalt/in-body-page-title`          | `<Title order={1\|2}>` outside prose/overlay context and outside a `content/` path                                                                                                                                                                                                                                 | **error**     |
| `basalt/responsive-twin`             | The same control mounted twice, one `visibleFrom="X"` and one `hiddenFrom="X"`                                                                                                                                                                                                                                     | **error**     |
| `basalt/search-literal-link`         | A `search:` object literal in a `linkOptions()` inside `defineNav()`/`navGroup()`                                                                                                                                                                                                                                  | **error**     |
| `basalt/use-search-from-literal`     | `useSearch({ from: '<route>' })`                                                                                                                                                                                                                                                                                   | **error**     |
| `in-body-page-title` (guard kind)    | The text lane of the same law — SAME id, so one annotation waives both lanes                                                                                                                                                                                                                                       | **error**     |
| `raw-selection-control` (guard kind) | The text lane of `control-outside-home`, approximated by a 12-line host-tag window, plus the same overlay-basename exemption                                                                                                                                                                                       | warn → 1.30.0 |

**A `SettingsRow`'s `control` is not a tiered slot, so nothing in this table fires inside one.**
It is law C1's third home — the form row — and a form keeps Mantine's `md` tier
(`controlHeight` 42, unchanged). A raw `Select`/`Switch`/`Button` bound to a setting is correct
there, and its `size` prop is what holds the row at the form tier, so neither `hand-rolled-filter`
nor `control-size-literal` reaches into it; `control-outside-home` treats a settings row as a home
and stays silent as well. Consumer settings pages need no change.

**Three scoping facts, because each one is a rule NOT firing on code you already have.** The home
tag must resolve to a component imported from `basalt-ui` (or a basalt subpath) — your own
`Section`, `PageBar` or `StatCard` is not a tiered home, and nothing in this table reads it as one;
the one accepted gap is basalt's `Section` re-exported through your own barrel, which the rules
cannot see. An OVERLAY colocated in a slot (`Modal`, `Drawer`, `Popover.Dropdown`, `Menu.Dropdown`,
`SettingsRow`) is exempt — a `New` button beside the `<Modal>` it opens is how both are written, and
the overlay's own controls are not in the bar. And `control-size-literal` only reaches what the
slot's theme actually re-tiers: the raw filters, the basalt controls, and Mantine's
`Button`/`ActionIcon`/`Input`/`TextInput`/`Select`/`MultiSelect`/`SegmentedControl`/`NativeSelect` —
an icon's `size`, a count `Badge`, a `Loader`, an `Avatar` or a `Modal size="lg"` never report.

**Two existing rules widened, neither with a new id.** `basalt/raw-scroll-container` now also fires
on `overflowX: 'auto' \| 'scroll'` and on `<ScrollArea scrollbars="x">` **inside a home SLOT**
(`actions`/`filters`/`tabs`/`sync`/`filtersEnd`) — law C7, overflow folds into a `More` menu or a
`Filters (n)` sheet rather than scrolling sideways. A home's BODY is out of scope: a wide table, a
pinned-column grid or a horizontally scrolling code block in a `Section`/`ChartCard` is page
content, not a sideways-scrolling row of controls, and outside a slot `overflowX` is still not
policed at all.
oxlint severities are per rule ID, not per branch, so this widening inherits the rule's existing
`error` level with no grace runway of its own — the honest limitation, and the reason it is scoped to
homes rather than shipped repo-wide. `basalt/shadow-basalt-export` gains a rename table
(`PageHeader`/`FilterBar` → `PageBar`, `WindowSelector`/`RangeSelector`/`DateFilter` →
`RangeFilter`, `PageSection`/`SectionTitle`/`SectionHeading` → `Section`, `ViewSwitch`/`ViewToggle`
→ `ViewTabs`, `RefreshButton`/`SyncControl`/`SyncStatusButton` → `SyncButton`, `HeroCard`/`HeroStats`
→ `StatCard`), so a fork that RENAMED the export is visible too. It stays a permanent advisory
`warn`.

**`profile: 'tokens-only'` now disables 16 kinds** — Mantine-coupled kinds, count as of this write (drifts release to release; `TOKENS_ONLY_DISABLED_KINDS.size` in `src/guard/index.ts` is ground truth, this table isn't).

**`SURFACES` gains `pluginRules`** (`src/surfaces.ts`, internal — not a published subpath): every
doctrine surface names the oxlint rules that enforce it, every registered rule maps to exactly one
surface, every guard KIND maps to at least one, and `basalt-ui check-coverage` asserts all three —
so a generated coverage header can neither over- nor under-report its lane. `check-coverage` also
takes `--write` / `--check` for the generated `<!-- basalt:coverage -->` header of each
`agent/rules/*.md` file; a rule file with no block yet is reported, not failed.

### Controls — the pill reads the VALUE, and four defaults moved

**A filter pill's TEXT is now always the selected option's label, at the field's default value too.**
It used to fall back to the filter's NAME while `field.isDefault(value)` held, which is how a bar
could read `Compare` over a field holding `'previous'` while the popover showed `Previous period`
selected. `label` is the popover/sheet heading and the accessible name; it is never printed on the
pill. Affects `SelectFilter`, `CompareFilter` and every control built on the shared enum body;
`RangeFilter` already read its value, and `MultiSelectFilter` keeps its own law (the group label
while the selection is empty or complete, `N <noun>` otherwise).

**Nothing to change at a call site.** What changes is the string a test or a screenshot sees: a
`SelectFilter field={currency} label="Currency"` at fallback `USD` now reads `USD`, not `Currency`.
If a bar reads badly at rest, the fix is the OPTION label (`store.labels()`), not the filter's name.

| Component / prop                                  | Was                                         | Now                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CompareFilter` option labels                     | the raw values until `store.labels()`       | `No comparison` / `Previous period` / `Same period last year`, exported as `COMPARE_LABELS`. A label a consumer set (`label !== value`) still wins.                      |
| `BasaltDataTable` → `withTableBorder`             | `true`                                      | `false`. Pass `true` for a table that needs a frame. The head rule and the between-row rules are untouched; the LAST row's rule is now dropped (it was an outer border). |
| `BasaltDataTable` single-select facet's "all" row | `All`                                       | `Any <facet.label lowercased>` — the pill now reads it, and three facets all reading `All` said nothing.                                                                 |
| `ViewTabs` phone `Select` (past 3 options)        | greedy (216px measured, truncating a title) | capped at 9rem                                                                                                                                                           |

**New: `ControlGroup`** (`basalt-ui/controls`) — joins adjacent controls that act on ONE thing
(`‹ Today ›`, `− 1 +`) into a single box: no gap, one shared hairline per pair, radius on the outer
ends only. `gap?: 'none' | 'tight'`. `BarActionItem` gains `group?: true`, and a run of adjacent
`group: true` actions in an `ActionGroup` renders as one `ControlGroup`; a joined member that ships an
`icon` renders ICON-ONLY with its label demoted to the accessible name. `ActionGroup` also joins
adjacent ICON-ONLY entries on the mobile bar with no flag. `basalt/shadow-basalt-export` now names
`ButtonGroup` / `ButtonRow` / `JoinedButtons` as renamed forks of it.

### The `ctl` tier now covers Radio, Checkbox and Switch

All three defaulted to Mantine's `sm` — a 20px indicator beside the tier's 13.5px option label — in
every filter popover and in the mobile sheet. They are now in `CTL_THEME` (with their `.Group`s) and
`cssVariablesResolver` declares their `-ctl` vars: 16px indicator, 18×30 switch.

**One consequence worth knowing.** Mantine resolves a Radio's size as `props.size ? props.size :
ctx.size`, and a theme `defaultProps.size` is indistinguishable from an explicit prop to that check
— so inside a `<CtlSlot>` (any home's slot) a `<Radio.Group size="lg">` no longer sizes its children;
they stay `ctl`. A group that genuinely needs another size belongs in a BODY, which no slot wraps.

`basalt/control-size-literal` widened to cover the six new tags, so a `size` on a Radio/Checkbox/
Switch inside a home slot now reports. It is still `warn` on its 1.26.0 → 1.27.0 runway (it has never
shipped at any level, so widening it restarts nothing).

### Icons — one box, no call-site geometry

Every `icon` prop in the framework (`BarAction`, the filter pills and their trailing affordance,
`WidgetHeader`/`StatCard`, `SyncButton`, sidebar-block rows, the overflow fold's own glyphs) now
renders through ONE internal slot: a fixed `--vx-space-icon-size` (16px default) square that restates
the glyph's `width`/`height` at 100% and takes it off the text baseline. **No API change** — but a
consumer's `<svg width="24">` that used to set a control's row height now renders at 16px, and an
`<svg>` with no `width`/`viewBox` at all no longer paints at 300×150. Per-tier sizes come from the
box var (`WidgetHeader` sets 14px at `tier="widget"`), never from a prop.

### Mobile nav — at most ONE slot is active

A slot's activeness now reads exactly the destinations it COVERS. It used to roll up over `children`
unconditionally while an item slot covered only its own key, so at `/dashboard/sessions` the
`Dashboard` tab lit through the rollup and the `More` tab lit for `Sessions` sitting in its overflow
— two `aria-current="page"` tabs at once. A SECTION tab still lights for a nested destination (it
covers its whole tree); an ITEM tab with children no longer does, and the overflow slot that can
actually reach the open route lights instead.

`useNav`'s anchors now pass `activeOptions: { exact: true }` to TanStack's `Link`. A `Link` spreads
`{ 'data-status': 'active', 'aria-current': 'page' }` last — after `activeProps` and after every
caller prop — so its own fuzzy match could not be overridden from outside and re-created the very
double-highlight `useNav`'s resolver exists to prevent. basalt's own law is unchanged: an item whose
exact route is never visited still lights on a descendant route.

### Layout — two collisions and a gap

- **The app header**: exactly one side of row 1 is elastic, and it is the breadcrumb (the side whose
  content can ellipsize). The control side is `flex: 0 0 auto` with no `min-width: 0` below it. Both
  sides were shrinkable, and at 390px the sync button overflowed 30px INTO the page title, because a
  `justify-content: flex-end` flex container overflows towards its start.
- **`WidgetHeader`'s hero row**: the value → `DeltaBadge` gap is the 8px rhythm step
  (`--vx-space-stack-sm`), not 4px, and the badge is centred on the value rather than baseline-aligned
  to it.
- **`WidgetHeader`'s title row** wraps below `sm`, so an `actions` slot too wide to sit beside the
  title takes its own line instead of squeezing the heading to an ellipsis. A 30px kebab still fits
  and still sits on the row. **Its metric row wraps too**: in a 2-up card grid at 390px
  `$1294.9k ▲18.9%` rendered as `$129… ▲18.9%`, and truncating the number to protect the delta about
  that number is the wrong way round. A short value still keeps its badge on the line.
- **`StatCard`'s `actions` slot is the 24px tier now, not 30px.** `CtlSlot` gained `tier?: 'ctl' |
  'widget'` (default `'ctl'`, so no existing call site changes), and `StatCard` mounts its header slot
  at `'widget'` — the `size="icon"` step `--vx-space-control-height-widget` has always named as
  "`WidgetHeader tier="widget"` actions". A raw `ActionIcon` there rendered at the 30px `ctl` tier
  inside a 28px header row and grew it to 30, so a KPI card WITH a kebab sat 2px below the card
  beside it and every number in it with it. A consumer passing `<ActionIcon size="ctl">` explicitly
  still gets 30px — and its card is 2px taller than its neighbours again, which is now visible rather
  than accidental. The slot's `data-basalt-tier` marker reads `widget` there, the same value
  `ChartCard` already writes by hand.
- **The breadcrumb's ANCESTOR crumbs are hidden below `sm`** — only the page crumb renders. At 390px
  the elastic side truncated `Overview / Dashboard` to `O… / D…`: two ellipses and a separator in
  place of the one word that says where the reader is. CSS-only (law C9), so no flash and no hook.
  `AppBreadcrumbs` gained one wrapper element around those crumbs; its props are unchanged.

### Cursor — the shared cursor now partitions by x-domain kind, automatically

Nothing removed. `CursorState` gained one field.

| Component     | What changed                     | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CursorState` | gains `kind: DomainKind \| null` | No consumer action needed. The shared cursor now classifies each chart's x-domain (`'time' \| 'linear' \| 'band'`, derived from its own keys) and a broadcast whose kind differs from a chart's own is invisible to it — a categorical chart can no longer be mistaken for a time chart. `ChartCursorScope` is no longer required to keep a categorical chart from following a time chart; it still isolates two charts that share the same domain kind but are semantically unrelated. |

## 1.24.0 — `QueryState`, table body chrome, four false greens

**Nothing removed or renamed. Twelve new runtime exports on `.`/`./query`, plus table props.** Every
API entry is additive; the behaviour changes are in the guard and the CLI, listed after them.

### `QueryState` — the branch precedence, shipped as a component

`QueryState`, `LoadingState`, `ErrorState` (+ `QueryStateProps`, `QueryStateLike`,
`QueryStateVariant`, `QueryEmptyCopy`, `LoadingStateProps`, `ErrorStateProps`) on the root barrel,
beside `EmptyState`. `toErrorMessage` and `errorStatus` on `basalt-ui/query`.

basalt owned both ends of this file — `EmptyState` and `toErrorMessage` — and nothing in between, so
a consumer wrote the four-way switch and got it wrong in the direction the shape suggested:
image-share's library rendered `No images` on a **500** and a share detail rendered
`Share not found` on a dropped connection, until 204 hand-rolled lines stopped it. Open since round
4, re-reported in round 6.

- **A component, not a hook** — the product IS the precedence, and a hook returns the same four-way
  switch to every call site.
- **It lives under `src/dashboard/`, not `src/query/`**: `check-dist-layering.mjs` asserts
  `dist/query/index.js` reaches no `@mantine/*`, and this renders Mantine. `query` is typed as a
  five-field structural subset (`QueryStateLike`), so basalt couples to no query-library version and
  a hand-composed object is legal. The subset gives up the compiler, so the shape is asserted at
  **runtime**: a missing `isError` throws naming the field, because a missing `isError` is precisely
  the "500 renders _No images_" bug.
- `errorTitle` / `errorFallback` / `errorAction` apply to the no-cached-data error branch only; the
  error-with-cached-data branch renders a fixed section banner above `children`.
- **`EmptyState.description` is now optional.** Five argo features wrapped the component solely
  because a compact panel had to invent a second sentence. Existing calls are unaffected.
- `toErrorMessage(err, fallback?)` and `errorStatus(err)` had two live bugs the port found: an
  opaque envelope rendered the literal `"{}"`, and `toErrorMessage(undefined)` returned the
  `undefined` VALUE despite a `string` return type. Both fixed; a status is folded into the fallback
  when the body decodes to nothing readable. Split into `src/query/error-message.ts` so the
  dashboard decodes without importing the peer.

**Port result:** image-share, all 10 call sites plus a standalone `ErrorState`, **by changing one
import line each** — no renames, no prop changes, no casts. Total 2467 → 2221; code-only 2056 →
1882, **−174**; `query-state.tsx` 204 → 0.

### `BasaltDataTable` body chrome — and the honest number

New: `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `verticalSpacing`,
`horizontalSpacing`, `withRowBorders`, `withTableBorder`, per-column `meta.align` and
`meta.numeral`; `striped` widens from `boolean` to `boolean | 'odd' | 'even'`. `withTableBorder`
defaults to `true` in basalt, overriding Mantine's `false`; every other one is a conditional
pass-through, so omitting it keeps Mantine's default.

**Porting argo's three tables onto them made them 341 → 370–379 lines. 29–38 LONGER.** argo named these
props as the reason the tables stayed hand-rolled, and adding them shortened nothing: column defs
cost more than JSX rows when every cell is bespoke — eight accessor blocks at 4–6 lines each against
an eight-`<Table.Td>` row at ~3. **The ask was mis-specified.** Adopt them for what they buy —
the `type="native"` footgun, alignment stated once instead of on both `th` and `td` six times in one
file, and sorting/filtering/pagination no longer consumer-owned — not for a line count. This is the
counterexample to the band kinds, and the reason the port-before-shipping rule earns its keep.

- `maxHeight` (or `minWidth`) renders **`Table.ScrollContainer type="native"`**, and
  `agent/rules/basalt-data.md` now prescribes that same node for a bespoke table — so the blessed
  lane and the escape cannot contradict, and `type="scrollarea"`, which breaks a sticky `thead`, is
  unreachable through the props. (The prop's JSDoc claimed the docs already sanctioned it; they had
  never named `Table.ScrollContainer` at all.)
- `meta.align` is a `ColumnMeta` module augmentation: a typo'd key is a tsc error, a wrong value
  throws naming the column. `meta.numeral` is read only as `!== false` — an opt-OUT of the
  mono-numeral cell style, never an opt-in.
- **Not shipped, known:** `emptyState` renders inside a `<td colSpan>` so the header row survives an
  empty table — there is no `emptyState="replace"` mode. No per-column `enableSorting` of basalt's
  own; TanStack's `ColumnDef.enableSorting` still reaches `getCanSort()` and works.

### Four false greens

1. **`check-theme` fabricated a config on the ascend path and passed silently.** From a package with
   no `basalt` key it invented `roots: ["src"]` and reported the invention back under the name
   `basalt.roots`. In `basalt-ui-obsidian`, run from `apps/demo`, that scanned **22 of 44** guarded
   files and made `--audit-allows` report **0 live waivers in a repo carrying 1** — exit 0, no note.
   The audit exists so `0 dead` cannot read as `0 dead anywhere`, and it could be made to say zero
   by standing in the wrong directory. `resolveProjectDir` now ascends to the nearest ancestor
   carrying a basalt project, bounded by the repo root, and announces it in the sentence descend
   already used. **No `.git` above cwd means no ascend**, so a standalone consumer keeps the
   built-in defaults exactly as before. After: 44 files, the real 1.
2. **`tokens:css --check` stopped verifying the regeneration command.** 1.23.1 blanked all of line 2
   so a version bump would stop forcing a no-op commit — but line 2 also carries the exact
   invocation line 1 tells the reader to regenerate with. Rewriting `--only core` to `--only all` in
   that line **passed clean**. Only the version token is neutralized now; a line that does not parse
   as a provenance line is compared verbatim, so a deleted or reworded header fails. The success
   message also **parses** the versions instead of asserting them — it used to claim the file "still
   names an older basalt-ui" without reading it, so `0.0.1-nonsense` earned the same sentence.
3. **`doctor`'s icons check was unreachable from the only directory where `doctor` exits 0.** On a
   monorepo the root run omitted it with no `⊘ SKIPPED` line — the exact failure mode `SKIPPED` was
   introduced to eliminate — while the app-package run failed on artefacts of standing in a
   non-install package. It resolves the app package off `basalt.roots` now. No `basaltAppPlugin(`
   anywhere and no `public/` is a pass that says so; a plugin call with no `public/` beside it is a
   `⊘ SKIPPED`, which exits non-zero on its own.
4. **`SCANNABLE_EXT` gained `.astro`, `.jsx` and `.vue`.** rollhook's marketing site is Astro and its
   two `.astro` templates are its entire markup layer — unguarded, while `check-theme` reported a
   clean 4-file scan. It scans 6 now.

**Behaviour change to name: `sync` ascends too.** It shares the resolver, so from a sub-package it
relocates to the parent install and refreshes it — announced — rather than refusing. It still cannot
scaffold a second consumer: the refusal is keyed on the RESOLVED project and runs before the
`basalt.roots` backfill.

### Guard changes the widening exposed

- **`raw-hex` no longer matches inside an HTML numeric character reference.** `&#123;` — the escaped
  brace a template writes to show a literal `${…}` in prose — read as the hex colour `#123`. The
  hole was in the KIND, not the extension: the same string produced the same findings in `.html`,
  `.tsx`, `.css` and `.vue`, so `.astro` only walked into it first. The fix is precise, not blanket:
  `HEX` rejects a full reference (`&#`, digits, `;`), so **`color: red&#fff` still flags** and
  nothing is exempted by file type. Every neighbouring raw-text kind was checked and structurally
  cannot share the blind spot — a character reference contains no `(`, and the rest anchor on a
  property name, `var(`, or a JSX `=`.
- **A fourth guard syntax, `sfc`, for `.astro`/`.vue`.** They used to fall through to the `ts`
  dialect, so `<!-- … -->` was never stripped: a `theme-allow` written in an HTML comment waived
  nothing and a colour inside a commented-out block still reported. `sfc` strips both regions —
  markup first, so an HTML comment holding an unterminated `/*` cannot open one that runs to EOF —
  and keeps the **full 25-kind set**. A `markup` classification would have dropped 22 of them: an
  `.astro` template is JSX-shaped and a `.vue` `<script setup>` is real TS. `.jsx` needs no branch.
  Both the scan and `--audit-allows` now share one `stripGuardComments`, so they cannot disagree
  about what a comment is.
- **Two limits, asserted rather than left ambiguous, both false-negative-only:** `css-raw-surface`
  does not fire inside a `<style>` fence, and stripping is region-blind, so a `<!--` inside a script
  string over-strips.
- **A known non-fix, deliberate:** an all-hex URL fragment or SVG reference (`href="#cafe"`,
  `fill="url(#abcdef)"`) still reports. It is text-indistinguishable from a colour, so a fix would
  cost real findings; `theme-allow` is the escape.
- **The widening ships at `error` with no `GRACE_PERIOD_KINDS` entry, and that table cannot express
  it.** The table is keyed per KIND; widening `SCANNABLE_EXT` widens the file set for all 25 at
  once. An entry for `raw-hex` — the kind that actually fired — would demote basalt's most
  load-bearing kind to `warn` across every `.tsx` and `.css` in all seven consumers to buy runway on
  a file type one consumer has. Measured: rollhook's marketing site scans 6 files with 0 findings,
  and no other consumer holds a single `.astro`, `.vue` or `.jsx` file, so grace would have covered
  zero incumbent violations.

## 1.25.0 — `manualPagination` imposes a contract

**Nothing removed or renamed — a behaviour change, additive props only.** `manualPagination` made
`data` one server page but left every other client-side control armed: sorting reordered that page
under a header chevron while "Showing 1–25 of 412" presented it as a sort of all 412 — a plausible,
wrong answer with nothing on screen to give it away. argo found it on 1.24.0 and worked around it
with an explicit `enableSorting={false}`.

Adopting `manualPagination` now imposes a contract, checked from props at render:

| With `manualPagination`   | Resolve it with                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------ |
| the pagination bar itself | `enablePagination` (without it `manualPagination` is inert) + `rowCount`/`pageCount` |
| sorting                   | the new `manualSorting` + sort in `onSortingChange`, or `enableSorting={false}`      |
| `enableGlobalFilter`      | the new `manualFiltering` + filter in `onGlobalFilterChange`                         |
| `facets`                  | `manualFiltering` + the new `onColumnFiltersChange`                                  |

Unresolved, it **throws in dev** naming every breach at once; a production bundle degrades instead —
no sort headers, no filter controls, no "of N" it cannot stand behind, plus one `console.error`. A
bare `<BasaltDataTable data columns />` (no `manualPagination`) is byte-identical — no opt-out
needed for a client-side table.

Sibling defect fixed with it: the empty-state branch keyed off `data.length`, so a search or page
index matching nothing left `data` non-empty and rendered a `<tbody>` with no rows AND no message.
It now keys off the rendered row model.

## 1.23.1 — the band-state throw, the tag gate, a CLI that answers

**One type widened, nothing removed or renamed.** `BandStripSeries.formatValue` is now
`(d: T) => string | null`. `null` renders an em dash — an absent READING — which `''` never could:
`''` is a state whose label is the whole row. Every existing `(d) => string` still typechecks.

**A typo'd `BandSpan.state` no longer renders as absence.** A state naming no `series` entry used to
be skipped, so the band was simply not drawn — and on a measured/not-measured strip a missing band
is a claim about the data, not an "unknown". A misspelling asserted a reading nobody took, in a mark
indistinguishable from a real one.

| Key comes off                                                 | Dev                                      | Production                                                               |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| the DATUM — `BandSpan.state`, `marker.state`                  | throws, naming the key and the valid set | a dashed neutral outline band + an `Unknown state` / `<key>` tooltip row |
| a PROP — `absentState`, `MirroredBars`' `up.key` / `down.key` | throws                                   | throws                                                                   |

The split is the whole design. `state` comes off data, so a feed that grows a state basalt has never
seen must degrade rather than take a dashboard down — while a typo, which is the same input, still
fails loudly wherever it is being written. The dashed neutral outline belongs to no legend entry and
no state fill, so it cannot read as data. Pane keys are props, never data-driven, so `assertPaneKey`
throws in every environment: an unresolvable `up.key` used to hide the pane AND its axis, which
reads as "that half measured zero" — the one thing `MirroredBars` exists to keep apart from absence.

**`chart-missing-aria-label` and `unframed-chart` are gated on where the tag came from.** Both key
on a JSX tag NAME, so a consumer's own 235-line `MirroredBars` — sharing nothing with the shipped
kind but the name — was told to pass an `ariaLabel` prop it does not accept, by a rule that presents
as a correctness finding. A tag is now skipped only when the file DEFINES a component of that name
and does not also import it from `basalt-ui`. Deliberately one-directional: a tag imported from
basalt-ui, one imported from a consumer barrel that re-exports it, and one the scan cannot attribute
at all still all fire. Verified old-vs-new over **945 source files across six repos: 0 findings
lost, 0 gained.**

**CLI: `--version` exists, and no subcommand fails open on a flag.** `--version` / `-v` / `version`
print one bare greppable line and exit 0, resolved BEFORE dispatch so it can never run a command to
answer "which basalt-ui is this". Six consumer reports reached for it in one round; all six fell
back to `info --json`.

The larger fix sits underneath it. **Every subcommand validates its flags** and exits 1 naming the
one it does not accept — `doctor --json` used to run doctor and exit **0**, and `check-theme
--audit-allow` scanned and reported success. An unknown COMMAND now says so above the usage block
instead of dumping help and letting the dump read like a choice.

- **`doctor` reads `basaltAppPlugin({ icons })`** out of the consumer's vite config instead of
  hardcoding six filenames, so adopting 1.23.0's icons array stops producing a warning to generate
  five files you deliberately lack. A named array is checked against itself (an icon missing from
  `public/` still warns); an unparseable or absent config falls back to the six-filename check. It
  can only narrow, never blind.
- **`doctor` and `sync` share one sentence about a parent install** (`parentInstallAdvice`). Run
  from a package whose install is above it, `doctor` now names the parent and says `basalt-ui init`
  is NOT the fix. Following its old advice literally scaffolded the second consumer that 1.22.0
  exists to prevent.
- **Every seeded invocation resolves the local bin** (`basaltBinCommand`, overridable via
  `BASALT_BIN`): the `lint` script, the CI steps, the `.claude` PreToolUse hook and doctor's own
  advice all render `./node_modules/.bin/basalt-ui`. `bunx` does not re-resolve a package it has
  cached — that is what made a round-7 report file a P0 against a 1.20.0 cache while believing it
  was on 1.22.0, and the seed was shipping `bunx` into consumer CI in ten places.
  `configs/lefthook.yml`'s `${BASALT_BIN:-bunx --no-install basalt-ui}` default is unchanged and
  deliberate: `--no-install` fails loudly instead of downloading a stranger.
- **`tokens:css --check` blanks the provenance line (line 2) before comparing**, so a version bump
  alone no longer forces a no-op commit in a tokens-only consumer, where the gate is byte-equality.
  A stale provenance line is now a note on an otherwise-passing check. The `@generated` header is
  still emitted byte-identical — the line stays, it just stops gating. **Superseded at 1.26.0:
  blanking the WHOLE line also stopped gating the regeneration command it carries. Only the version
  token is neutralized now.**

### Corrections to the record

- **All six round-8 reports said `basalt-ui --version` "exits 0 printing usage". It exited 1, to
  stderr** — the dispatcher's `default:` branch has always been `console.error(USAGE); return 1`.
  The real fail-open was an unknown FLAG, which no report tested, and the misdiagnosis was relayed
  verbatim into the fix brief. Report the symptom you measured, not the one you inferred from it.
- **`cb4e5b7`'s message is wrong** (`b9b99a6` on `origin/feat/round-7-band-kinds` is the same commit
  pre-merge), and it is on `master` where it cannot be rewritten. It claims it taught
  `unframed-chart` the two new kinds; it widened `CHART_ENTRY_POINT_TAG`, which only
  `chart-missing-aria-label` reads. `unframed-chart` keys on `<ChartLegend items={[` and carries no
  kind list at all — there was never an asymmetric pair to fix.
- **Open question, not a plan.** The import gate does not make `CHART_ENTRY_POINT_TAG` or the oxlint
  plugin's `CHART_TAGS` redundant: that list still answers _which_ tags owe an `ariaLabel`. The gate
  only converts a kind missing from the list from a false positive into an under-report. Collapsing
  the two lists is a separate, larger change and has not been made.

## 1.23.0 — two band kinds, an x-tick seam, CLI resolution

**No export removed or renamed; six new runtime exports and nine new types.** Nothing you wrote
changed. Every entry is additive, and the batch runs the other way from the last three: those made
the guard stricter, this one makes the framework more expressive.

**Two chart kinds `CartesianChart` structurally could not host.** It renders `AxisLeftNumeric`
unconditionally and builds x as `scalePoint` — positions, no widths. `BandStrip` has no y dimension
to axis; `MirroredBars` has two, and needs band widths. Both compose `ChartFrame` directly and
declare themselves with `theme-allow-file hand-rolled-plot`, alongside `DualPanel`.

| New on `basalt-ui/charts`                                       | Note                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BandStrip` (+ `BandStripProps`, `BandStripSeries`, `BandSpan`) | 1-D categorical bands. `getBand(d) => { state, fill?, absentFraction?, marker? }`; `series` IS the state set, so a strip cannot name a state it does not draw. `cursorResolution` defaults `'leading'`                                                    |
| `MirroredBars` (+ `MirroredBarsProps`, `MirroredBarPane`)       | two bar panes, one x scale, one baseline, independent domains. `up`/`down` take `{ key, max?, autoMaxFloor?, ticks?, format }`; plus `upFraction` (the up pane's share of the band height, where the baseline sits), `getAbsentFraction`, `getBarOpacity` |
| `foldBands(data, cap, merge)` (+ `BandFold`)                    | the width-driven fold both kinds run (`cap` = `floor(width / minBandPx)`), exported so a consumer can test their `merge` against the real grouping                                                                                                        |
| `HatchPattern`, `hatchFill`, `hatchSizeFor`                     | the absence fill                                                                                                                                                                                                                                          |

The shared choreography lives in an internal `useBandPlot` — **not exported**, deliberately: it is
the kinds' contract with each other, not a public seam.

**`MirroredBars` reverses a recorded decision, and the recorded reason for it was wrong.** The old
entry in `docs/archive/CHARTS-SPEC.md` read _"no two-bar-pane kind with independent per-pane scales"_, with
_"a second consumer asks"_ as its trigger. That trigger never fired. Round 4 framed the blocker as
independent SCALES; `DualPanel` already had `topYDomain`/`bottomYDomain`, so that was never it. The
real blockers are that `DualPanel`'s top pane is a LINE pane and its bottom takes one SIGNED
`getBar` over a symmetric domain. A decision recorded against the wrong blocker outlives its own
refutation.

**`xTickValues?: (keys, xMax) => readonly string[]` on `CartesianChart`**, forwarded by `Bars`,
`MultiLine`, `StackedArea`, `ZonedLine` and both band kinds. It resolves AHEAD of `xTicks`, which is
unchanged and still works; omit both and ticks are chosen to fit (`smartTicks`), exactly as before.
Reach for it on a dense time axis: the tick choosers append the final key unconditionally, so a
COUNT that does not land on the last index paints two labels on top of each other at the right edge
— at every count, not at an unlucky one. On the consumer that reported it, the local tick helper
went 200 → 170 lines; it shrinks, it does not disappear. (The promise was 160. The 10-line miss is
docblock — the port's own JSDoc grew, because the helper stopped being a fallback and became the one
seam every chart on the page passes through.)

**`basaltAppPlugin`'s `icons` takes an array now.**

```ts
icons?: false | { dir?: string } | readonly BasaltAppIcon[]
// BasaltAppIcon = { src, sizes?, type?, purpose?, rel? }
icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
```

Every entry becomes a manifest icon; an entry reaches the head only when it names a `rel` (`'icon' |
'shortcut icon' | 'apple-touch-icon' | 'mask-icon'`) — which is what lets an app whose `index.html`
already links its favicon take the generated manifest without a duplicate tag. An empty array reads
as `false`, i.e. no `icons` member rather than an empty one. `{ dir }` and the default are
byte-identical to before. **If you kept a hand-written `manifest.webmanifest` because the plugin
could not name your icon, you can delete it now** — with its permanent `theme-allow-file` — the
generated manifest reproduces it member for member, plus an `id` a hand-written copy usually lacks.

**CLI: a repo root with no `workspaces` field was invisible to everything.** With the install one
level down and nothing declaring it, `check-theme` printed "no off-palette colors" having scanned
**zero files** and `doctor` inferred `tokens-only` for a full Mantine consumer. `resolveProjectDir`
now falls back to a bounded two-level layout scan when there is nothing declared to read; a declared
`workspaces` still wins, and 2+ candidates stays ambiguous. `BASALT_CWD` is honoured by all three
commands now, not two.

- **`sync` is profile-aware.** A `"basalt": { "profile": "tokens-only" }` consumer has no scaffold
  to reconcile, so `sync` prints `n/a` and exits 0 — `sync --check` is now wirable into a
  tokens-only repo's CI. It used to refuse and prescribe `basalt-ui init`, the one command that
  would have written a competing install.
- **`DESIGN.md` version rot is healed, not re-stamped.** The stamp was never a constant: `DESIGN.md`
  is a **seed**, written once and never reconciled, so the same line read 1.0.0 / 1.9.0 / 1.21.0 /
  1.22.0 under one install. Reported as four doc bugs over three rounds; it was one. The template
  names no version and `sync` rewrites openers already written.

**The `theme-allow` shape grid is enumerated, not collected.** The reported fifth hole was three:
the closer-alone-on-its-line shape that got reported, a `MAX_COMMENT_BLOCK_LINES = 8` budget
truncating the walk inside a ~12-line docblock (not a JSX shape at all), and the plugin requiring
the annotation's comment to be the LAST one above the node — so a reason wrapped onto a second `//`,
a shape argo writes, reported under oxlint while the guard waived it. The grid now runs the four
axes that vary (comment style × token position × where the closer falls × what follows), pinned row
for row in `src/guard/check-source.test.ts` (37 supported + 8 asserted-unsupported) and
`configs/oxlint-plugin.test.ts` (32 + 8; the guard's extra five rows are CSS/HTML/JSON dialects
oxlint never sees). Zero disagreements, down from five — **and no waiver tally moved in any of the
seven consumer repos.**

Asserting the unsupported cells is the point: it stops "unsupported" and "silently broken" reading
the same. What does NOT waive, in both halves:

| Shape                                                                                                            | Why                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| a blank line between annotation and code — after `//`, after `{/* */}`, or after a `{/*` whose closer sits alone | a blank line is how you say "this comment is not about the next statement"                |
| the token mid-sentence in a line comment, a docblock gutter, or a JSX expression comment                         | prose that MENTIONS the token is not an annotation — the reason it must START its comment |
| the token inside a string literal                                                                                | same                                                                                      |
| above a multi-line OPENING tag, with the finding on a later attribute line                                       | a waiver reaches the first line below its comment, not an arbitrary line further down     |

**Corrected consumer findings.** _"`sync` scaffolds 19–20 files into a consumer root"_ **did not
reproduce** — those runs used a stale `bunx` cache of 1.20.0, and `bunx` does not re-resolve a
package it already has. Check an upgrade against the local bin. Round 6's _"`doctor` exits 0 on hard
failures"_ was a pipe artifact (`$?` read after `| tail`) and was already withdrawn.

## 1.22.0 — the toolchain stops overclaiming

**No export removed or renamed; four added.** Nothing you wrote changed. Every entry below is a
check that reported an answer it had not earned, so a green CI on 1.21.0 was, for several of them,
green over an empty set.

**`sync` refuses where it used to scaffold.** Run from a sub-package that depends on basalt-ui but
holds no `.basalt/manifest.json` — `apps/dashboard`, `apps/web` — it printed `0 updated, 20
recreated`, wrote a second `basalt` key, and stood up a complete competing install beside the real
one at the repo root. argo and rb both reverted it by hand. It now resolves its project exactly as
`check-theme` and `doctor` do, and **exits 1** when the resolved project has no manifest, naming the
install it found above instead. The refusal runs before the `basalt.roots` backfill, which was half
the damage. Two ways to unblock it:

```bash
cd <the package holding .basalt/manifest.json> && ./node_modules/.bin/basalt-ui sync
BASALT_CWD=<that package> ./node_modules/.bin/basalt-ui sync   # or from anywhere
```

The summary line gained a `created` counter. **`recreated` now means what it always claimed** — the
ledger placed that file once and it went missing. Twenty first-time writes were never that.

**`--audit-allows` judges plugin-rule annotations.** They used to print "not a check-theme kind" and
drop out of the exit-1 gate, so the gate covered an empty set wherever the waivers were plugin
rules: argo's whole tally was `0 live, 0 dead, 8 outside reach`, and 11 of linewatch's 14 went the
same way. Each is now probed by re-running oxlint over that one file with the annotation
neutralized. Judged now: argo 8 of 8, linewatch 14 of 14, basalt's own tree 23 of 23.

**It requires oxlint to be reachable.** The probe writes one neutralized sibling file and re-runs
oxlint over it (oxlint has no stdin mode), removing it in a `finally`. Where oxlint cannot run, the
annotation is reported as **"cannot judge"**, never as dead. The report now also prints the scope it
audited — `0 dead` over `basalt.roots` was reading as `0 dead anywhere`.

**`doctor`'s `lefthook-preset` check asks a different question.** It tested whether the config text
contained the `extends` string. It now asks whether the gate EXISTS, via `lefthook dump`, which
resolves `extends`, `include` and per-command `root:`. linewatch wires all three jobs with
`root: 'web/'` precisely because `extends` merges commands _without_ their working directory — it
was correctly configured, got warned, and the old advice would have broken it. Three outcomes: a
broken `extends` target is still a hard fail, a provably absent gate is a warn, and where
`lefthook dump` could not run you get an advisory warning naming what it could not see.

**`basalt/shadow-basalt-export` narrowed twice.** It now gates on `isBasaltScopedFile` like every
other rule in the file, and needs a component-SHAPED declaration — a function, an arrow, a
`memo`/`forwardRef` wrapper, or a class extending one. It had been firing on a `SlugTracker` class
in a React-free package carrying no basalt-ui dependency, telling it to import from basalt-ui. The
stated limit is unchanged: exact-name-only, a tripwire, not coverage.

**`basaltAppPlugin({ icons: false })` now omits the manifest's `icons` member too.** It skipped the
head `<link>` icons and emitted the two PNG manifest entries anyway, so `{ manifest: true, icons:
false }` shipped an installable app pointing at two 404s. The manifest is now **honest** about
icons — it is not yet **sufficient**. If you went hybrid over the 404s, dropping the hand-written
half here costs you every icon unless your `public/` matches basalt's six filenames: at this
release `icons` was still `false | { dir?: string }` over those six, so an app whose icon is
`favicon.svg` could pick between a manifest naming two PNGs it never builds and a manifest with no
`icons` member at all. The array form that fixes it is in `## 1.26.0`. The option's JSDoc said
"skips the head `<link>` icons"; it now says what the option does.

**Two `theme-allow` comment shapes were silently broken and now work.** Plainly: this is the fourth
hole found in this one contract in three rounds. A thirteen-shape matrix — every shape a consumer
had been SEEN to write — is pinned in both halves, `src/guard/check-source.test.ts` and
`configs/oxlint-plugin.test.ts`. **The claim that followed it here, that the two parsers could
therefore no longer disagree, was false when it was written**: a list of collected anecdotes cannot
close a contract. Three more holes were open at this release. See `## 1.26.0`.

| Shape                                         | What it did                                                                                                                | Now                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `/** theme-allow <id> — <why> */` on one line | waived under oxlint, reported under `check-theme`                                                                          | both halves honour it                   |
| `{/*` + token on the next line + `*/}`        | comment-stripping left a bare `}`, so the line read as CODE and the annotation was classified trailing — scoped to a brace | scoped to the node below it, as written |

**linewatch writes that wrapped shape for every hand-composed chart axis**, so any _guard_ kind
annotated that way was silently unwaivable. It only appeared to work because the rules it names
(`hand-rolled-plot`) live in the oxlint plugin, whose placement test is comment-node-based and never
saw the brace.

**New, additive — `./guard` gains four runtime exports**, the reader half of the audit:

| Export                                       | Note                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `findAllowAnnotations(text, relPath, cfg)`   | every annotation as written, ids split into `guardKinds` / `pluginRules` / `unknownRules`. Shares `collectAllowAnnotations` with `checkSource`, so it cannot list a line the scan does not honour |
| `neutralizeAllowAnnotation(text, line, cfg)` | one annotation rewritten to the token below, every other left intact — the probe half of an audit                                                                                                 |
| `NEUTRALIZED_ALLOW_TOKEN`                    | so a guard probe and an oxlint probe neutralize identically                                                                                                                                       |
| `PLUGIN_RULE_IDS`                            | the ids only oxlint can judge                                                                                                                                                                     |

The `AllowAnnotationSite` type ships alongside them.

**Known gaps, reported and not fixed:** `--audit-allows` says nothing about `basalt.exempt` — a
whole file removed from the scan, the broadest exception the config surface has — and its
`scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`.

## 1.21.0 — the `theme-allow` grammar

**No export removed or renamed.** One break, and it is in the escape hatch itself: **file scope must
now be spelled `theme-allow-file`.** At 1.20.0 an annotation that named a rule and gave a reason —
the exact shape the rule's own message asks for — was promoted to a whole-file declaration, which is
why per-node scoping never actually shipped. The two forms are now distinct:

```text
theme-allow                                  → this node/line, EVERY rule   (reports theme-allow-unscoped)
theme-allow <id>[, <id>…] [— <why>]          → this node/line, those rules
theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those rules; a bare one waives NOTHING
"basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON / .webmanifest
```

**The migration is one word per file declaration.** Measured across the consumer sweep: linewatch
0 → 11 findings, argo 0 → 6, rb 0 → 0 — all `warn`, so **no build changes colour**.

```diff
-// theme-allow hand-rolled-plot — two panes over one x scale
+// theme-allow-file hand-rolled-plot — two panes over one x scale
```

**An annotation must now START its comment** — after `//`, `/*`, `<!--`, a block-comment gutter `*`,
or nothing but whitespace. Both parsers used a bare substring search, so a comment that merely
_mentioned_ the token parsed as the legacy blanket form and switched every rule off on the line
below. linewatch documented its own waivers in a docblock and thereby disarmed the file — a false
NEGATIVE, and the reason this ships as a break rather than a grace period. Every annotation anyone
actually writes still qualifies; a sentence about the escape hatch no longer waives anything.

**A comment-only annotation now reaches the first CODE line below it**, walking through the rest of
its own comment block. Before, a reason that wrapped onto a second line, or a docblock's `*/`,
absorbed the waiver and the natural shape silently waived nothing — argo hit that three times in one
upgrade. A blank line still ends the block.

**`.json` / `.webmanifest` finally have a waiver.** They have been scanned since 1.20.0 and cannot
hold a comment, so their findings were unwaivable and the printed remedy prescribed something
impossible; both consumers fell back to a blanket `exemptRules`. Use a member key — but for a
manifest, `basaltAppPlugin` is the first remedy, since a hand-copied hex drifts from the palette:

```json
{ "basalt:theme-allow-file": "raw-hex — a PWA manifest theme_color must be a literal hex" }
```

**Two API-shaped fixes worth acting on:**

| Change                                                                     | What to do                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSearchParamStore` / `createMultiSearchParamStore` gain `linkSearch` | replace every nav link's `search: { <param>: '<literal>' }` with `search: <store>.linkSearch`, passed BY REFERENCE. A module-scope literal pins the fallback on every click — argo's reader had ZERO call sites, so "remember my window" had never worked |
| `BasaltShell` collapse moves to `createPersistedState`                     | the key is now `basalt:<storageKey>` holding `{ v, value }`; read it with `readPersistedValue(storageKey, 1)`. A one-time migration adopts the raw pre-1.21.0 value, so the sidebar does not re-expand on upgrade                                         |

**New, additive:**

| Surface                                              | Note                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-theme --audit-allows`                         | every waiver and every `exemptRules` entry with what it still suppresses, proved by re-running the guard with that one occurrence neutralized. Exits 1 on a dead waiver — wire it into CI                                                     |
| `basalt.exemptRules` takes paths, globs and a reason | relative paths and directory prefixes (`public/site.webmanifest`, `src/agent`), globs (`*` stops at `/`, `**` does not, a slash-free glob also matches the basename), and `{ paths, reason }`. Entries that suppress nothing are now reported |
| `doctor` → `lefthook-preset`                         | hard-fails a broken `extends` target. lefthook merges a missing target into ZERO commands and exits 0, so a stale path leaves a repo with no pre-commit gate and a clean `lefthook dump`. `sync` reports the same seam                        |
| `basaltAppPlugin({ colorScheme })`                   | `'dark'` (default) / `'light'` / `'auto'` / `false`. Set it to whatever the app passes as `defaultColorScheme` — before this, a light-scheme consumer got dark native controls permanently                                                    |
| `VX.text.nano` (10px) + `VX.text.display` (30px)     | the two rungs `inline-font-size` could previously only be waived for. A 20px rung was rejected: 21/20 = 1.05 is below the ladder's 1.06×–1.17× band, so `h2` is the remedy                                                                    |
| `sync` backfills `basalt.roots`                      | only `init` wrote it, so every existing consumer sat on the undeclared `src` default while `guard-scan` passed. A declared value is never overwritten                                                                                         |
| `basalt/shadow-basalt-export` reads all nine barrels | the charts layer included. Still exact-name-only — a **tripwire, not coverage**                                                                                                                                                               |

Also: `check-theme`'s `inline-spacing` no longer reads a unitless number in a plain options bag as
CSS (`fitBounds({ padding: 48 })` stops reporting); the shipped `oxfmt` pre-commit job drops back to
`*.{ts,tsx,js,jsx,css}` and gains `--no-error-on-unmatched-pattern`; `tokens:css` emits `0.1` rather
than `0.10`, so a committed sheet stops failing prettier — re-run the command to pick it up.

**The lefthook preset overrides YOU, not the other way round.** An `extends` target wins on a
colliding key: declare `pre-commit.commands.oxfmt.run` (or `glob:`) in your own file and **yours**
is the one silently discarded. Only keys the preset does not define merge in. The guard job runs
`${BASALT_BIN:-bunx --no-install basalt-ui}`; that shell default is the sanctioned seam, set via
`env:`, which does merge.

## 1.20.0 — enforcement

**No export removed or renamed.** The whole delta is that things which used to pass now report. If
your build goes red on this upgrade, that is the release working. Every new **kind** and **rule**
lands `warn` — but two other changes in this release do fail a build: `basalt/raw-size-literal`
promotes to `error`, and the widened markup scan reads `index.html` / `.webmanifest`, where a raw
hex is an `error`-severity colour kind. Two consumers exited 1 on exactly that.

| Change                                                           | What you'll see                                                                                                 | What to do                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `basalt/raw-size-literal` `warn` → **`error`**                   | CSS-length strings on `size`/`fz`/`fontSize` now fail lint                                                      | use a token (`size="sm"`); `warn` since 1.7.0, zero violations across all seven consumers |
| Five new guard kinds (`warn`)                                    | `theme-allow-unscoped`, `surface-shadow-override`, `css-raw-surface`, `inline-font-size`, `hidden-inline-style` | see below; promotion is tracked in `GRACE_PERIOD_KINDS`                                   |
| Two new oxlint rules (`warn`)                                    | `basalt/shadow-basalt-export`, `basalt/hand-rolled-shell`                                                       | import the shipped component instead of the fork                                          |
| `basalt/hand-rolled-plot`, `basalt/chart-legend-literal` widened | more sites report; both stay `warn`                                                                             | a widened rule does not promote in the minor that widens it                               |
| `doctor` `SKIPPED` exits non-zero, + 3 new hard checks           | doctor goes red where it was green                                                                              | that is the finding — see below                                                           |

**`theme-allow` has a new contract, and one comment shape stops waiving.** A bare `theme-allow`
still waives every kind, but now reports `theme-allow-unscoped`. Rescope it — and spell the id
right, because a word in the id slot that names no rule now waives NOTHING rather than degrading to
the blanket form:

```diff
-// theme-allow
+// theme-allow raw-surface — third-party widget needs a literal corner
```

**The break: a reason with no separator introducing it.** `// theme-allow legacy vendor asset` used
to waive the line; it now waives nothing and the un-suppressed finding reports at its own severity
(`error` for `raw-hex`). The first word after the token is read as a rule id, and an id that names
no rule fails closed — that is the whole point, since the alternative is one mistyped character
silently widening a scoped waiver into a blanket one. No annotation in any of the seven consumer
repos writes that shape; every one of them introduces its reason with `—`, `–`, `-` or `:`. Add a
separator, or an id:

```diff
-// theme-allow legacy vendor asset
+// theme-allow raw-hex — legacy vendor asset
```

Prose AFTER a resolved id is safe and needs no separator —
`// theme-allow raw-surface sub-scale legend corner` waives `raw-surface` and reports nothing. Only
a comma keeps the id list open past the first id.

Two placements that used to fail now work, both matching what the oxlint plugin always did: a
comment-ONLY line directly above the reported line (the only form JSX can express — the reported
line is usually a multi-line opening tag or a `{expr}` child), and in CSS a trailing annotation
reaching back over the declaration it terminates, which is what survives the shipped `oxfmt`
reflowing a long `background-color` so the hex lands above the comment.

**`basalt/hand-rolled-plot` waivers must now be written deliberately.** Every assembly node is
reported individually, and a waiver is no longer picked up off whatever comment happened to sit on
the file's first assembly node — it needs a written declaration naming the rule and giving a reason,
anywhere in the file: `// theme-allow hand-rolled-plot — two panes over one x scale`.

**But the waiver is still whole-file, and per-node scoping is not expressible at 1.20.0.** Naming
the rule AND giving a reason is what `hasFileDeclaration` matches, at any line — so a comment
intended for one node silences the file. Dropping the reason keeps it node-scoped in the oxlint
plugin, but then `check-theme` reports `theme-allow-unscoped ("no reason")`. The two halves of the
contract intersect at exactly one legal shape and that shape is whole-file. Write the declaration in
the component's docblock, where it reads as the file-level decision it is. **Fixed in 1.21.0** —
see that section; the declaration moves to `theme-allow-file`.

**`doctor` will go red.** `SKIPPED` is a third outcome beside pass/warn/fail and exits non-zero on
its own — "All checks passed" is only printable when every check RAN. Three new hard checks:
`basalt-resolves` (walks cwd → ancestors → workspace packages), `guard-scan` (would `check-theme`
cover more than zero files?), `oxlint-preset` (does `.oxlintrc.json` really extend the shipped
preset? JSONC is parsed, not rejected — `init` keeps an existing config, so one repo ran five minors
with the whole lint half off).

**New, additive:**

| Surface                                                          | Note                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt.profile: 'tokens-only'` / `--tokens-only`                | disables the 16 kinds whose remedy is a Mantine component, prop or the React theme factory. `check-theme` requires it DECLARED; `doctor` infers it, because its profile only changes advice, never enforcement                                                                                                                                                                                                                               |
| `basalt.include: [...]`                                          | scan a named file outside `roots` — and the only route to a `.json`, which is never blanket-scanned                                                                                                                                                                                                                                                                                                                                          |
| `basalt.roots` + a `lint:basalt` script                          | written by `init` from the real layout; `init` on an existing app is a lint-debt event, not a no-op                                                                                                                                                                                                                                                                                                                                          |
| `tokens:css --check`, `--selector-class <c>` (+ `--light-class`) | drift gate; the Tailwind `<html class="dark">` convention. There is no `scheme: { class }` API — the class form is CLI-only                                                                                                                                                                                                                                                                                                                  |
| `fonts:css [--out] [--check]`                                    | the shipped `--basalt-font-*` stacks as plain CSS, read out of `styles.css` — the only route to basalt's typefaces without the Mantine-coupled `styles.css`                                                                                                                                                                                                                                                                                  |
| `__APP_VERSION__` ambient declaration                            | ships via `src/register.ts`, re-exported by the root barrel: delete your hand-written ambient block. A subpath-only consumer does not get it                                                                                                                                                                                                                                                                                                 |
| `BASALT_CWD`                                                     | `check-theme`/`doctor` honour it, and relocate to the single workspace package carrying a basalt config when invoked from a root that has none                                                                                                                                                                                                                                                                                               |
| `@generated basalt-ui` header                                    | `tokens:css`/`fonts:css` output carries it on line 1, the version + invocation line on line 2, and `check-theme`, in a `.css` file with that exact header, skips the LINES that are basalt custom properties, selectors, `}` or self-closing comments — this is what fixed 116 violations reported inside the stylesheet `tokens:css` had just written. Committed output emitted by 1.19.1 has no header: re-run the command to get the skip |

`check-theme` also resolves `.html` / `.webmanifest` / `.json` as markup (colour kinds only), and
each root's PARENT now contributes its `index.html` and `public/` tree.

## 1.19.0 — nav

| Removed / renamed                                                 | Replacement                                                                                                                      | Note                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavLinkRenderer` (type)                                          | `defineNav` + `{...useNav(NAV)}` (`basalt-ui/router-tanstack`), or `SidebarItem.Anchor`                                          | basalt now paints every nav pixel                                                                                                                           |
| `BasaltShellProps.renderNavLink`, `AppSidebarProps.renderNavLink` | same                                                                                                                             |                                                                                                                                                             |
| `BreadcrumbLinkRenderer` (type)                                   | `AppBreadcrumbs.parentAnchor`                                                                                                    |                                                                                                                                                             |
| `BasaltShellProps.renderBreadcrumbLink`                           | same                                                                                                                             |                                                                                                                                                             |
| `BasaltShellProps.sidebarFooterExtra`                             | `mobileNav.moreExtra`                                                                                                            | its only host was the mobile drawer; it rendered nowhere on desktop                                                                                         |
| `AppSidebarProps.footerExtra`, `AppSidebarProps.onClose`          | —                                                                                                                                | the full-height mobile sidebar drawer is deleted                                                                                                            |
| `MobileNavItem` (type)                                            | `MobileNavSlot`                                                                                                                  |                                                                                                                                                             |
| `MobileNavSection` (type)                                         | `MobileNavGroup`                                                                                                                 |                                                                                                                                                             |
| `MobileNavLinkRenderer` (type)                                    | `MobileNavModel`                                                                                                                 |                                                                                                                                                             |
| `SidebarSection.mobileTab`                                        | `SidebarSection.mobile?: false \| NavSectionMobile` — an OBJECT (`{ tab: true, label?, icon? }`), or `false` to hide the section | `'tab' \| 'more' \| 'hidden'` is `SidebarItem.mobile` (`NavMobilePlacement`, `true` ≡ `'tab'`, `false` ≡ `'hidden'`) — a different prop on a different type |

A consumer with no router needs no migration — `href` + `onClick` still work.

**Expect new type errors, and read them.** `renderNavLink` took `to` as an opaque value, which is
why consumers reached for `to={target.to as never}`. `defineNav` types it, so a destination missing
a required `search` now fails to compile — in one repo that surfaced two nav links that had been
shipping without required params. Fix with a click-time thunk (`search: () => Schema.parse({})`),
never `search: true`.

## 1.17.0 — behaviour only, no export removed

| Changed                                              | Effect                                                       | Opt out                          |
| ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `resolveAxisDomain` clamps before padding, not after | the axis top moves on any chart with an `autoMaxFloor`       | lower the floor, or pin `domain` |
| `ChartFrame` `role="img"` → `role="group"`           | `role="img"` pruned the keyboard slider out of the a11y tree | —                                |

## 1.15.0 — chart layer rebuilt

The largest delta in the 1.x line. No shims were shipped.

| Removed / renamed                                                                                                                                                    | Replacement                                                                                                                                                | Note                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChartHoverSync`, `ChartHoverSyncProps`                                                                                                                              | `globalCursorStore` / `createCursorStore` / `useChartCursor` / `useCursorState` — **no provider**                                                          | `ChartCursorScope` now _isolates_ a subtree; it is the inverse of the old provider, not a rename                                                                                                                                             |
| `HoverContext`, `HoverCtx`, `useHoverSync`, `DEFAULT_NO_OP_SET_HOVER`                                                                                                | `useChartCursor`, `useCursorState`, `CursorState`, `CursorStore`                                                                                           | context → `useSyncExternalStore`                                                                                                                                                                                                             |
| `ResponsiveChart`, `ResponsiveChartProps`                                                                                                                            | `CartesianChart` / `CartesianChartProps` (+ `autoMargin`, `PlotContext`, `PlotRect`)                                                                       | now mandatory for every single-plot cartesian chart, enforced by `basalt/hand-rolled-plot`                                                                                                                                                   |
| `ChartTooltip` (tip-based), `useChartTooltip`, `useTooltipStyles`                                                                                                    | `ChartTooltipFloat` + the `tooltip: CartesianTooltipConfig` prop                                                                                           | portal / flip / clamp done once                                                                                                                                                                                                              |
| `BarsAxisConfig`                                                                                                                                                     | `AxisConfig` + `resolveAxisDomain`                                                                                                                         |                                                                                                                                                                                                                                              |
| `ZonedLineTooltipLabel`                                                                                                                                              | `tooltip` config on the kind                                                                                                                               |                                                                                                                                                                                                                                              |
| `ZonedLine`/`MultiLine`: `yDomain`, `yAutoPad`, `yAutoMaxFloor`, `yAutoMinCeil`, `numTicksY`, `formatYTick`                                                          | one `y?: AxisConfig<T>`                                                                                                                                    | `y` is **optional** where `yDomain` was required                                                                                                                                                                                             |
| `ZonedLine`/`MultiLine`: `tooltipLabel`, `renderExtraTooltipRows`                                                                                                    | `tooltip.label`, `tooltip.extraRows` (`CartesianTooltipConfig`)                                                                                            | there is no `appendRows`; the field is `extraRows`                                                                                                                                                                                           |
| `ZonedLine`/`MultiLine`: `formatValue`                                                                                                                               | **`y.format`** — or per-series `ChartSeries.formatValue` for one row                                                                                       | `CartesianTooltipConfig` has no value formatter: the axis format IS the tooltip value format                                                                                                                                                 |
| `ZonedLine`/`MultiLine`: `numTicksX`                                                                                                                                 | `xTicks`                                                                                                                                                   | `xZones` added alongside                                                                                                                                                                                                                     |
| `Bars`: `formatValue`, `hideBarTooltipRows`, `leftAxis`, `rightAxis`, `marginLeft`, `numTicksX`, `tooltipLabel`, `renderExtraTooltipRows`, `renderPrefixTooltipRows` | `y` / `y2` (`AxisConfig`), `xTicks`, `tooltip.{label,extraRows,prependRows}`, per-bar `BarsBar.formatValue` / `.tooltip`, measured `autoMargin` + `margin` | passing `y2` is what makes a chart dual-axis. `chartMargin({ rightAxis })` is **not** removed — it is still exported from `basalt-ui` and `basalt-ui/charts`; it is simply no longer needed, since the right gutter follows from measurement |
| `StackedArea`: `formatValue`, `numTicksX`, `numTicksY`, `yAutoMaxFloor`, `yLabel`                                                                                    | `y` (incl. `y.format`), `xTicks`; per-series `ChartSeries.formatValue`                                                                                     | `StackedAreaProps` has **no** `tooltip` prop — its tooltip is entirely derived from `series`                                                                                                                                                 |
| `Heatmap.width`                                                                                                                                                      | measures itself; takes `height` / `aspectRatio` / `fill`                                                                                                   |                                                                                                                                                                                                                                              |

## 1.12.0 — agent-chat, behaviour only

| Changed                                                                    | Effect                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `streaming` no longer selects the image allowlist                          | **security-relevant.** Model output must now pass `contentTrust="untrusted"`; leaving it unset silently reopens prompt-injection image exfiltration |
| consumer `rehypePlugins` output is now sanitized, `clobberPrefix` is empty | a consumer injecting non-default elements must pass a matching `sanitizeSchema`                                                                     |

## 1.11.0 — agent parts

Semver-breaking in a minor; the commit body says so.

| Removed / renamed                                        | Replacement                                                                                           | Note                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `ToolCallPart` flat `{ type, toolName, input, output? }` | `ToolCallPart` as a 7-arm union discriminated on `state` (`input-streaming` … `output-error`)         | mirrors the AI SDK v7 lifecycle                                                             |
| the error field named `error`                            | `errorText`                                                                                           | the SDK union has no `error`                                                                |
| flattened approval fields                                | nested `approval: ToolApproval`, carried verbatim                                                     | flattening dropped `isAutomatic` / `signature`                                              |
| —                                                        | every `AgentPart` now extends `PartBase` with a **required `id`**; `withPartIds` mints them on drafts | a 1.10-shaped part rehydrated from localStorage no longer throws, but id-less parts collide |
| `ToolChip` threw `assertNever` on an unknown state       | now falls back instead of throwing                                                                    |                                                                                             |

## 1.0.0 — the Mantine pivot

| Removed / renamed                                                                             | Replacement                                                               | Note                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `./css` subpath (877 lines: 307 custom props, 19 utilities, a reset, the Tailwind entrypoint) | `basalt-ui tokens:css` / `basalt-ui/tokens.css` — **but only from 1.3.0** | between 1.0.0 and 1.2.x the only CSS door was `styles.css` + `buildPaletteCss()` |
| `./starlight` subpath                                                                         | —                                                                         | no replacement                                                                   |
| the OKLCH foundation palette, ShadCN/Tremor/Starlight doctrine                                | the three-tier `--vx-*` system                                            | see `docs/FRAMEWORK-FREE.md` for the token-only route                            |

Names that have no 1.x equivalent: the `--chart-blue-1..8` sequential ramp (1.x is categorical
`--vx-fill-*` only), the default font stacks as a token (they live in `styles.css`), `purple` as a
text color, `black`, `blue-400`/`green-400`.

**The typefaces changed at 1.0, not just their delivery.** 0.4.2 shipped Instrument Sans; 1.x ships
Nunito Sans (body) + Hubot Sans (condensed headings), mono unchanged at JetBrains Mono. `fonts:css`
emits the 1.x stacks — for a 0.4.2 migrant that is a **rebrand**, not a restoration. It also emits
`--basalt-font-head-stretch: 88%`, tuned for Hubot Sans specifically; pointed at another face it
silently condenses it.

## 1.0.1 — CLI binary renamed

`basalt` → **`basalt-ui`**. Never `bunx basalt`.

---

## Lint and guard rules that tightened

Two independent mechanisms, each with its own ledger — read the ledger, not this table, for what is
in grace TODAY. `GuardKind` severities (`basalt-ui check-theme`) default to `error` and are
downgraded only by `GRACE_PERIOD_KINDS` (`src/guard/index.ts`). `basalt/*` oxlint rule severities
live in `configs/oxlint.json`, and since 1.20.0 their grace is tracked by `PLUGIN_RULE_GRACE`, a
named export beside the plugin — a test asserts it against the shipped preset in both directions, so
deleting an entry forces the level flip in the same commit.

| Rule                                   | Landed           | Became `error`                                                                              |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `mantine-shade-index` (guard kind)     | 1.7.0 as `warn`  | **1.11.0**                                                                                  |
| `basalt/raw-scroll-container`          | ≤1.2.0 as `off`  | `warn` 1.10.0 → **`error` 1.13.0**                                                          |
| `basalt/ai-sdk-major`                  | 1.10.0 as `warn` | **1.13.0**                                                                                  |
| `basalt/agent-no-raw-usechat`          | 1.10.0 as `warn` | **1.13.0**                                                                                  |
| `basalt/agent-resume-guard`            | 1.10.0 as `warn` | **1.13.0**                                                                                  |
| `basalt/raw-size-literal`              | 1.7.0 as `warn`  | **1.20.0**                                                                                  |
| `basalt/hand-rolled-plot`              | 1.21.0 as `warn` | **1.26.0** (grace had restarted at the 1.21.0 widening)                                     |
| `basalt/chart-legend-literal`          | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `basalt/shadow-basalt-export`          | 1.20.0 as `warn` | ADVISORY — permanent `warn`, see below, never subject to the C16 gate                       |
| `basalt/hand-rolled-shell`             | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `theme-allow-unscoped` (guard kind)    | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `surface-shadow-override` (guard kind) | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `css-raw-surface` (guard kind)         | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `inline-font-size` (guard kind)        | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `hidden-inline-style` (guard kind)     | 1.20.0 as `warn` | **1.26.0**                                                                                  |
| `basalt/control-size-literal`          | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/in-body-page-title`            | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `in-body-page-title` (guard kind)      | 1.26.0 as `warn` | **1.27.0** — same id as the rule above, so one waiver covers both                           |
| `basalt/responsive-twin`               | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/search-literal-link`           | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/use-search-from-literal`       | 1.26.0 as `warn` | **1.27.0**                                                                                  |
| `basalt/control-outside-home`          | 1.26.0 as `warn` | still `warn`, `promote: '1.30.0'` — re-dated on 9 measured cross-file overlay warns in argo |
| `raw-selection-control` (guard kind)   | 1.26.0 as `warn` | still `warn`, `promote: '1.30.0'` — the text lane of the row above                          |

`card-with-border`, `inline-display`, `raw-html-layout`, `raw-form-control`, `raw-font-family` and
the other original guard kinds have been `error` since before 1.2.0 — they never had a grace minor.
Guard findings only gained a severity field at all in 1.4.0; before that every finding was fatal.

**Both ledgers changed shape at 1.26.0 (C16, `docs/CONTROLS-SPEC.md` §1).** An entry
used to be a bare promotion-note string with no expiry a machine could check — which is exactly how
the nine rows above sat at `warn` for five minors although the doctrine below says "one minor". Both
`PLUGIN_RULE_GRACE` (`configs/oxlint-plugin.js`) and `GRACE_PERIOD_KINDS` (`src/guard/index.ts`) now
hold `{ since, promote, why }` (semver strings), and a version-gated test fails the build once
`package.json`'s version reaches an entry's `promote` while the entry is still there — see
"1.26.0" above for the full change. `shadow-basalt-export` moved to a sibling ledger,
`PLUGIN_RULE_ADVISORY`, which the gate never checks: it was already documented as a possible
permanent `warn`, and the version-gate doctrine only fits an entry that has an honest promotion
date.

**Rule-id rename at 1.1.0:** `basalt/import-boundary` split into `basalt/visx-boundary`,
`basalt/visx-tooltip` and `basalt/token-layer-boundary` (the last is repo-local and deliberately not
in the shipped preset). A config still naming `import-boundary` after 1.1.0 disables nothing.

## Not verified

- Props declared inline on a component (`function X({ a }: { a: string })`) rather than on an
  exported type are outside the diff method used here. Spot checks on the shell and charts modules
  found none, but the negative is unproven.
- The 0.4.2 `./css` line counts in the 1.0.0 table (877 lines / 307 custom props / 19 utilities) come
  from the removal commit, not from a re-read of the 0.4.2 tarball.

`AppBreadcrumbs.parentAnchor` was listed here through 1.20.0 and is now verified: it is declared on
the shipped `dist/shell/app-breadcrumbs.d.ts` (`parentAnchor?: NavAnchor`, with `parentHref` as the
no-router fallback). The type is inline on the component rather than an exported `AppBreadcrumbsProps`,
which is why the export-surface diff never saw it.
