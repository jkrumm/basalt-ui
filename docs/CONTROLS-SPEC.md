# Controls Spec — homes, stores, tiers, mobile, guards

Ground truth from 1.26.0 for every interactive control: filters, view tabs, refresh/sync, actions,
widget/section headers, sidebar blocks, their persistence binding, size tier, mobile policy and
guards. Supersedes `MANTINE-THEMING.md` §"page header" (A1), the root `CLAUDE.md` "Search Param
Persistence" block, and the placement prose in `basalt-router.md` / `basalt-state.md`. Evidence and
the ledger live in `docs/archive/CONTROLS-SYNTHESIS.md`; ids (A1..D16) are cited, not restated.
Verified against `packages/basalt-ui/src` at 1.25.0 and the installed `@mantine/core` 9.3.0; new
exports are marked _(new)_.

## 1. Laws

One sentence each; the right column names the plugin rule, guard kind, type or test that enforces
it — `advisory` means the generated coverage header lists it under `not guarded`.

| #   | Law                                                                                                                                                                                                      | Enforced by                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | A control lives in exactly one of three homes — the page bar, a section/widget header, or a form row — and a home is entered only through a slot prop (`actions`, `filters`, `tabs`, `sync`, `control`). | `basalt/hand-rolled-filter` (slot-scoped), `basalt/control-outside-home` (advisory-warn)                                                   |
| C2  | A basalt filter or tab has no `value`/`onChange`; it takes `field` (a `FieldHandle`) and owns both the URL write and the localStorage mirror.                                                            | TypeScript — the props do not exist                                                                                                        |
| C3  | Tab and filter state never lives in `useState`; it derives from a store field on the URL lane or the local lane.                                                                                         | C2 + `basalt/hand-rolled-filter`                                                                                                           |
| C4  | Every field declares its lanes once at definition — `{ url, persist }` — and resolves URL ⊳ localStorage ⊳ fallback, uniformly for every field kind.                                                     | `createSearchStore` types + `search-store.test.ts`                                                                                         |
| C5  | A home sets the size tier (`ctl` = 30px); an element inside a home slot carries no `size`, `w`, `fullWidth`, `visibleFrom` or `hiddenFrom`.                                                              | `basalt/control-size-literal`                                                                                                              |
| C6  | A page has one `PageBar`; its `actions` hold ≤5 entries and exactly one `primary`; a `Section` holds ≤3 actions.                                                                                         | `basalt/page-bar-budget` + `ActionGroupProps.primary` singular                                                                             |
| C7  | A home never scrolls horizontally and never wraps; overflow folds into a `More` menu (actions) or a `Filters (n)` sheet (filters), computed by basalt from typed data.                                   | `raw-scroll-container` (widened) + typed `BarAction[]`                                                                                     |
| C8  | Every section, card or table title is a `WidgetHeader`; the page title is the breadcrumb (`staticData.title`) or `PageBar.title` in shell-less apps; an in-body `<Title order={1\|2}>` is an error.      | `basalt/in-body-page-title` (order-1/2 branch); hand-rolled section headings are `advisory` + `shadow-basalt-export` on the name `Section` |
| C9  | A responsive swap belongs to the control; rendering the same control twice under `visibleFrom`/`hiddenFrom` is an error.                                                                                 | `basalt/responsive-twin` (deep search for the same control tag in both halves)                                                             |
| C10 | A nav link carrying a store field passes `store.linkSearch` by reference; a `search:` object literal inside `defineNav`/`navGroup` is an error; `useSearch({ from: '<literal>' })` is an error.          | `basalt/search-literal-link`, `basalt/use-search-from-literal`                                                                             |
| C11 | Every table or list inside a section states its count in its header.                                                                                                                                     | `BasaltDataTable` passes `getRowCount()` to its own `WidgetHeader`; `Section.count` advisory                                               |
| C12 | Refresh/sync has one shape, `SyncButton`, whose `scope` picks the home (`global` → shell header, `page` → `PageBar.sync`).                                                                               | `shadow-basalt-export` alias table (advisory)                                                                                              |
| C13 | Sidebar blocks are declared data (`SidebarBlock[]`), never `ReactNode` slots, so rail and More-sheet projection are basalt's.                                                                            | tsc — `sidebarNavExtra` / `mobileNav.moreExtra` removed                                                                                    |
| C14 | An empty home renders nothing, so no route pays for a reserved row.                                                                                                                                      | `shell/index.test.tsx` height assertion; `appShellHeaderMobileHeight` deleted                                                              |
| C15 | Every touch target inside a home is ≥36px below `sm` (floor 30 at density −3); sheet rows are 44px.                                                                                                      | `density-relations.test.ts` floor test on `touchControlHeight`                                                                             |
| C16 | A new guard lands `warn` with a dated `promote` version; the build fails when `package.json` ≥ `promote` and the rule is still `warn`.                                                                   | `oxlint-plugin.test.ts` + `guard-hook.test.ts` (D4 becomes a test)                                                                         |

C1 resolves A1/A5/A7; C2–C4 resolve A3/A4/A8/A11/A13; C10 resolves A2/A9; C9 resolves linewatch's
three doubled controls; C16 resolves D4.

## 2. Homes

`sm` stays the only breakpoint. Mobile below means `< sm`; there is no `pointer: coarse` axis.

### 2.1 `PageBar` — tier 1 _(new, `src/shell/page-bar.tsx`, root barrel)_

```ts
export type BarAction =
  | {
      key: string
      label: string
      icon?: ReactNode
      onClick?: () => void
      link?: AnyNavLink
      Anchor?: NavAnchor
      disabled?: boolean
      loading?: boolean
      danger?: boolean
      mobile?: 'bar' | 'more' | 'hidden'
    } // default: primary 'bar', others 'more'
  | { key: string; kind: 'menu'; label: string; icon?: ReactNode; items: BarAction[] }
  | { key: string; kind: 'custom'; node: ReactNode; mobile?: 'bar' | 'more' | 'hidden' }

export type ActionGroupProps = { primary?: BarAction; secondary?: BarAction[] } // one primary by type

export type PageBarProps = {
  /** Read only when no BasaltShell outlet exists (linewatch). Inside a shell the breadcrumb names the page. */
  title?: string
  icon?: ReactNode
  actions?: ActionGroupProps
  sync?: Omit<SyncButtonProps, 'scope'>
  filters?: ReactNode // <FilterSet> descendants only (C1)
  filtersEnd?: BarAction[] // "Manage metrics"
  tabs?: ReactNode // one <ViewTabs>
}
export function PageBar(props: PageBarProps): ReactNode
```

Rendering is decided by context, not by prop. **Inside `BasaltShell`** row 1 (`actions`, `sync`)
portals into the existing 48px header through the mechanism `PageActions` uses today
(`shell/page-header.tsx`), replacing it; the breadcrumb stays the lead. Row 2 (`tabs`, `filters`,
`filtersEnd`) renders **in-flow, sticky** under the header at `top: var(--app-shell-header-height)`
and publishes its measured height as `--basalt-page-bar-h` on `documentElement` (ResizeObserver,
`height > 0` guard — linewatch's `page-header.tsx:73-111` becomes framework behaviour). The AppShell
header therefore stays a token, 48px on every viewport: `appShellHeaderMobileHeight` (97, B12) and
the always-reserved 52px row (`palette.ts:586`, gap #5) are deleted, and no header height is React
state. **Without a shell** the bar renders both rows in-flow, sticky at `top: 0`, with `title` +
`icon` leading row 1.

Desktop: row 1 = lead · `primary` filled + ≤3 secondaries as `default` buttons/icons + `More`
(`kind: 'menu'` and any secondary past three) · `sync` · shell `globalActions`. Row 2 = `tabs` ·
filter pills · `filtersEnd` right-aligned. `wrap: nowrap`; pills past the width fold into a `+N`
menu pill.

Mobile: row 1 = breadcrumb · `primary` as an icon button · kebab `Menu` holding every
`mobile: 'more'` action and the `globalActions` marked `more` · ≤2 `globalActions` marked `bar`.
Row 2 = `ViewTabs` full-width (≤3 options) · the first `FilterSet` pill inline · one `Filters (n)`
pill opening a bottom `Drawer` where every filter renders full-width (44px rows, apply immediately,
`filtersEnd` folded into the row-1 kebab so a header has exactly one kebab — row 2 shows it from `sm` up;
`Reset all` footer); `n` = `store.useActiveCount()`. Filter-less pages render no row 2 (C14).

### 2.2 `WidgetHeader` — tiers 2 and 3 _(new, `src/widget-header/`, Mantine-free)_

```ts
export type WidgetHeaderProps = {
  tier: 'section' | 'widget' // section: 30px ctl, h2 · widget: 24px icon tier, h3, display-only
  title: string
  icon?: ReactNode
  subtitle?: string
  info?: string
  value?: string
  delta?: number
  deltaPeriod?: string
  sparkline?: ReactNode
  count?: number // mono count tag after the title (C11)
  actions?: ReactNode // margin-inline-start: auto; the home slot for C1/C5
}
export function WidgetHeader(props: WidgetHeaderProps): ReactNode
```

Plain elements, `--vx-*` vars, one CSS module, no `@mantine/*` — so `ChartCard` (inside the
`charts/` boundary) can compose it and `check-dist-layering.mjs` keeps passing. **`DeltaBadge` is
rewritten Mantine-free in the same wave** (today it imports `Badge`, `dashboard/delta-badge.tsx:16`),
props unchanged. The head-font 88%/550 literal (eleven copies) becomes one declaration.

Composers, each rendering `WidgetHeader` and nothing else above its body:

| Component                        | Mapping                                                                                                                                                                                                                                                                                          | Removed            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `StatCard`                       | `label`→`title`; `menu`→`actions`; adds `icon`, `sparklinePlacement?: 'bleed' \| 'right'` (reference: right); keeps `value/delta/deltaPeriod/sparkline/tone`                                                                                                                                     | `label`, `menu`    |
| `ChartCard`                      | `tooltip`→`info?`; `extra`→`actions`; adds `icon`, `value`, `delta`, `count`; header renders only when any of title/info/value/actions is set (ends linewatch's `''` sentinel, `compact.ts:61-69`)                                                                                               | `tooltip`, `extra` |
| `Section` _(new)_                | `WidgetHeaderProps` minus `tier` + `tabs?: ReactNode` + `collapsible?: boolean` + `persistKey?: string` + `id?: string` (anchor, `scrollMarginTop: calc(var(--app-shell-header-height, 0px) + var(--basalt-page-bar-h, 0px))`) + `children`                                                      | —                  |
| `SettingsSection` / `DangerZone` | `description`→`subtitle`; adds `actions`                                                                                                                                                                                                                                                         | `description`      |
| `BasaltDataTable`                | adds `title`, `icon`, `subtitle`, `actions: ReactNode` (a plain slot — `ActionGroup`'s header semantics never reach a table); `count` always `table.getRowCount()`; `facets` render as `FilterPill`s inside a `FilterSet`; the four `w={220/200/180/110}` literals (`data-table.tsx:923-999`) go | `toolbarActions`   |

The export is spelled **`Section`**, not `PageSection`, so the existing `shadow-basalt-export` rule
fires today on argo's six `function Section` copies with zero new rule code. Section fold state
persists through `createPersistedState('basalt:section:<persistKey>')`; the header stays drawn when
closed; `tabs` hide while collapsed. `Section` has no `variant` — one shaded container level per
page, the card is `ChartCard`/`StatCard`.

Mobile: `tier: 'section'` keeps title · count · one inline action, the rest in a kebab; `tabs`
past 3 options become a `Select`. `tier: 'widget'` keeps value + delta wrapping under the title,
sparkline `right` drops to `bleed`, one `⋯` at 30px with a 36px hit area.

### 2.3 Sidebar blocks _(shell)_

```ts
export type SidebarBlock =
  | { kind: 'list'; key: string; label: string; icon?: ReactNode; count?: number; max?: number   // 'Show more' past max
      items: { key: string; label: string; meta?: string; icon?: ReactNode; tone?: StatCardTone
               Anchor?: NavAnchor; href?: string; onClick?: () => void }[]
      placement?: 'nav' | 'bottom'; collapsible?: boolean; rail?: 'dot' | 'hidden'; mobile?: 'more' | 'hidden' }
  | { kind: 'progress'; key: string; label: string; value: number; total: number; onClick?: () => void
      placement?: 'bottom'; rail?: 'ring' | 'hidden'; mobile?: 'more' | 'hidden' }
  | { kind: 'custom'; key: string; node: ReactNode; placement?: 'nav' | 'bottom' }   // desktop only, was sidebarNavExtra

// BasaltShellProps changes
brand: BrandConfig & { menu?: AccountMenuItem[] }       // present → `Name ▾` workspace-switcher row
search?: SidebarSearchConfig & { actions?: [BarAction] | [BarAction, BarAction] }   // the ⌘K row's icon buttons
sidebarBlocks?: SidebarBlock[]                          // 'nav' → after sections; 'bottom' → above settings footer
globalActions?: GlobalAction[]                          // was ReactNode
export type GlobalAction = { key: string; node: ReactNode; mobile?: 'bar' | 'more' | 'hidden' }  // default: first two 'bar'
```

Defaults: `list.mobile = 'more'`, `progress.mobile = 'hidden'`, `rail = 'dot'` for a list with
`count`, `'ring'` for progress on the settings row. Block folds persist at
`basalt:sidebar-block:<key>` (replaces the `useState` keyed by label, `app-sidebar.tsx:364-366`,
gap #8). Footer link rows (Settings / Integrations / Invite) are `settingsMenuItems` rendered flat
when ≤3 — no new prop. On mobile a block projects to one More-sheet row (`Awaiting action · 3`)
opening a sheet of its items, counted by a `blockRowCount` sibling of `accountRowCount`.
`sidebarNavExtra`, `mobileNav.moreExtra` and `SectionLabel`'s dead non-flush branch (B14) are
deleted.

## 3. Controls — `basalt-ui/controls` _(new subpath, Mantine-coupled)_

Every control takes a `FieldHandle` (§4) and renders `size="ctl"` internally; none takes
`value`/`onChange`/`size`. Every filter renders a `FilterPill` (bordered chip, icon · label · ⇅).

| Export              | Signature                                                                                                                                       | Store binding                                                      | Mobile                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `FilterSet`         | `{ children: ReactNode; inline?: number /* default 1 */ }`                                                                                      | —                                                                  | keeps `inline` pills; folds the rest into `Filters (n)`                                              |
| `RangeFilter`       | `{ field: FieldHandle<RangeField<P>>; icon?: ReactNode; customPicker?: ComponentType<RangeCustomPickerProps> }`                                 | `field.range` — three URL params (`window`/`from`/`to`, renamable) | sheet: presets as vertical `SegmentedControl` (>4) + the custom picker                               |
| `CompareFilter`     | `{ field: FieldHandle<EnumField<'none' \| 'previous' \| 'year'>>; label?: string }`                                                             | `field.enum`                                                       | sheet: radio list                                                                                    |
| `SelectFilter`      | `{ field: FieldHandle<EnumField<T>>; label: string; icon?: ReactNode; clearable?: boolean }`                                                    | `field.enum`; option labels from `store.labels()`                  | sheet: radio list                                                                                    |
| `MultiSelectFilter` | `{ field: FieldHandle<MultiField<T>>; label: string; icon?: ReactNode }`                                                                        | `field.multi`; pill reads `All channels` / `3 channels`            | sheet: checkbox list                                                                                 |
| `SearchFilter`      | `{ field: FieldHandle<StringField>; placeholder?: string }`                                                                                     | `field.string` (`history: 'replace'`)                              | full-width row                                                                                       |
| `ToggleFilter`      | `{ field: FieldHandle<BooleanField>; label: string }`                                                                                           | `field.boolean`                                                    | `Switch` row                                                                                         |
| `ViewTabs`          | `{ field: FieldHandle<EnumField<T>>; options?: readonly { value: T; label: string; only?: 'sm-up' \| 'sm-down' }[] }`                           | `field.enum`                                                       | ≤3 options `SegmentedControl fullWidth`; more → `Select`; `only: 'sm-down'` absorbs argo's Train tab |
| `SyncButton`        | `{ syncing: boolean; lastCompletedAt?: number \| Date \| null; onSync: () => void; scope: 'page' \| 'global'; label?: string; error?: string }` | —                                                                  | icon-only, age in tooltip                                                                            |
| `ActionGroup`       | `ActionGroupProps`                                                                                                                              | —                                                                  | primary icon + kebab                                                                                 |
| `OverflowMenu`      | `{ actions: readonly BarAction[] }`                                                                                                             | —                                                                  | 44px rows                                                                                            |

Numeric segment labels read mono `VX.text.xs` via `data-numeric`, retiring the per-consumer
`theme-allow` (`DashboardDateFilter.tsx:13-16`, C7). Swaps are CSS (`visibleFrom`/`hiddenFrom`
inside the control, one mount each), never a JS media query.

`basalt-ui/controls-dates` _(new subpath, optional peer `@mantine/dates`)_ exports
`DateRangePicker: ComponentType<RangeCustomPickerProps>`. It is injected through
`RangeFilter.customPicker`, never dynamically imported from a shared entry — linewatch has no
`@mantine/dates`, and `basaltViteConfig`'s `optimizeDeps.include` for `@mantine/*` would break on
an absent peer. `ArticleFilterBar` is deleted; `./content` re-exports `FilterSet`, `ViewTabs`,
`MultiSelectFilter`.

## 4. Stores — `basalt-ui/router-tanstack`

One factory over typed fields replaces the enum-only pair (gap #2). The URL is the truth; the
localStorage mirror is a fallback under it.

```ts
export type FieldLane = { url?: boolean; persist?: boolean; history?: 'push' | 'replace' }
// defaults: url true, persist true, history 'replace'

export const field: {
  enum<const T extends string>(values: readonly T[], fallback: T, lane?: FieldLane): EnumField<T>
  multi<const T extends string>(
    values: readonly T[],
    fallback?: readonly T[],
    lane?: FieldLane,
  ): MultiField<T>
  range<const P extends string>(
    o: {
      presets: readonly P[]
      fallback: P
      custom?: boolean
      params?: { preset?: string; from?: string; to?: string }
    },
    lane?: FieldLane,
  ): RangeField<P>
  number(
    o: { fallback: number; min?: number; max?: number; int?: boolean },
    lane?: FieldLane,
  ): NumberField
  boolean(fallback: boolean, lane?: FieldLane): BooleanField
  string(o?: { fallback?: string; max?: number }, lane?: FieldLane): StringField
}
export type RangeValue<P extends string> = { preset: P; from?: string; to?: string }

export type FieldHandle<F extends AnyField> = {
  // declared in `basalt-ui/state` (headless)
  readonly kind: F['kind']
  readonly fallback: FieldValue<F>
  readonly options: readonly { value: string; label: string }[] // enum/multi; from labels()
  /** Read + write. Reads `useSearch({ strict: false })` when the field is on the URL lane, else storage,
   *  else fallback. Writes `navigate({ to: '.', search: prev => ({ ...prev, ...encoded }), replace })`
   *  when the matched route validates the param, then persists when `persist`. */
  use(): readonly [FieldValue<F>, (next: FieldValue<F>) => void]
  isDefault(v: FieldValue<F>): boolean
  toWindow?: (v: RangeValue<P>) => { window: P } | { from: string; to: string } // range only
}

export function createSearchStore<const S extends Record<string, AnyField>>(o: {
  key: string
  fields: S
  version?: number
}): SearchStore<S>
export type SearchStore<S> = {
  validateSearch(raw: Record<string, unknown>): SearchValues<S> // url:true fields only
  linkSearch(): SearchValues<S> // by reference in defineNav
  readStored(): Partial<SearchValues<S>>
  field: { [K in keyof S]: FieldHandle<S[K]> }
  labels(map: Partial<{ [K in keyof S]: Record<string, string> }>): SearchStore<S> // once, at definition
  useValues(): SearchValues<S>
  useActiveCount(): number // fields !== fallback → `Filters (n)`
  useReset(): () => void
}
export function createLocalStore<const S>(o: {
  key: string
  fields: S
}): Pick<SearchStore<S>, 'field' | 'readStored'> // `basalt-ui/state`, no router
```

`useSearch({ strict: false })` reads the merged search of every matched route, so a control renders
on a sibling or child route without `from` (A3). `url: false` is the local-only lane (linewatch
`compact`, argo's five per-chart selects, `Section` views); `persist: false` is the URL-only lane
(pagination, linewatch's deliberately unpersisted `minDuration`, argo's strength `tab`).
`RangeField` keeps three URL params so argo's loaders and deep links do not change shape;
`toWindow()` replaces argo's three `presetToParams`. Writing a field from outside the owning route
persists only; `validateSearch` picks it up on the next visit (A1). Cross-field defaults are
composition over `store.validateSearch(raw)`. `warnLinkPinsFallback` moves over unchanged.

`createSearchParamStore` and `createMultiSearchParamStore` become `@deprecated` six-line wrappers
returning the old `{ validateSearch, useStore, readStored, linkSearch }` shape (`basalt-ui-obsidian`
is a two-hop consumer), removed in 1.29.0. `createSearchSchemaStore` is struck from `STATUS.md:358`,
`CLAUDE.md:282-285` and `basalt-router.md:74-78` — `createSearchStore` is what those paragraphs were
waiting for. `useOnlineStatus` (A12) is deleted with the same MIGRATING row.

## 5. Sizing tokens

A 4px ladder with four rungs, density-tracked through `deriveSpacing`'s multiplier, emitted as
`--vx-space-*` like `inputHeight`:

| Anchor (`SPACE_ANCHORS_BASE`) | Level 0 | Floor | Mantine size                     | Home                                                |
| ----------------------------- | ------- | ----- | -------------------------------- | --------------------------------------------------- |
| `controlHeightTag` _(new)_    | 20      | 18    | `Badge` count tag                | inline chip, table cell                             |
| `controlHeightWidget` _(new)_ | 24      | 22    | `size="icon"` ActionIcon         | `WidgetHeader tier="widget"` actions                |
| `controlHeightCtl` _(new)_    | 30      | 28    | `size="ctl"`                     | `PageBar`, `Section`, table toolbar, sidebar blocks |
| `touchControlHeight` _(new)_  | 36      | 30    | hit area (`::before`) below `sm` | every home                                          |
| `controlHeight` (exists)      | 42      | —     | `size="md"`                      | forms — unchanged                                   |

Steps: `pageBarRowHeight 40`, `sectionHeaderHeight 36`, `widgetHeaderHeight 28`,
`sidebarBlockRowHeight 32`, `controlGap 6`, `sheetRowHeight 44`. Deleted:
`appHeaderMobileActionsHeight`, `appShellHeaderMobileHeight`, `stickyHeaderClearanceMobile`,
`--vx-space-app-header-mobile-actions-height`. `stickyHeaderClearance` = `appShellHeaderHeight +
stackMd` on every viewport. Palantir's 20/24/30/40 lands as 20/24/30/42 because 42 is Mantine's
own `md` and the existing anchor.

Mechanism — the tier reaches Mantine through its own size system, verified in 9.3.0
(`getSize('ctl', 'button-height')` → `var(--button-height-ctl)`, `core/utils/get-size`).
`cssVariablesResolver` declares the **full** `-ctl` and `-icon` var sets: `--button-height-ctl`,
`--button-padding-x-ctl`, `--input-height-ctl`, `--input-padding-y-ctl`, `--ai-size-ctl`,
`--sc-padding-ctl`, `--combobox-option-padding-ctl`, `--combobox-chevron-size-ctl`,
`--mantine-font-size-ctl` (= `VX.text.sm`) — plus `--ai-size-icon`. `theme/spacing.test.ts` gains
a case that greps every `getSize(size, '<prefix>')` / `getFontSize(size)` call in
`@mantine/core/esm/components/{Button,ActionIcon,Input,SegmentedControl,Combobox}` and asserts each
prefix has a `-ctl` declaration, so a missing var (the `--button-padding-x-ctl` every draft
omitted) fails the build. Each home wraps its **slot** — never its body — in a hoisted
`<MantineThemeProvider inherit theme={CTL_THEME}>` whose `components` set
`defaultProps: { size: 'ctl' }` for Button/ActionIcon/Input/TextInput/Select/MultiSelect/
SegmentedControl/NativeSelect (Menu has no `size` prop), and a `data-basalt-tier` attribute; `mergeMantineTheme` deep-merges, so the
base `Button.extend` vars survive. A raw `Button` dropped into `PageBar.actions` is 30px with no
prop; a `size="xs"` typed there is C5. `ChartCard` lives inside the Mantine-free `charts/` boundary and therefore cannot mount `CtlSlot`: its `actions` slot carries only `data-basalt-tier="widget"`, and the basalt controls placed there size themselves (`size="ctl"` internally) — a raw Mantine element in that one slot is not auto-tiered, which `control-size-literal` and `hand-rolled-filter` are what catch. Mantine's own `sm`/`xs` sizes are **not** re-pointed —
every `size="sm"` in a modal or form keeps Mantine's 36px. `SegmentedControl` gets `size: 'ctl'`
vars and the mono numeric-label rule in its module CSS. Inputs keep the 16px iOS floor
(`styles.css` `!important`); the 36px touch height accommodates it.

## 6. Guards

All AST rules live in `configs/oxlint-plugin.js`, ids added to `KNOWN_RULE_IDS`, each honouring
`theme-allow` / `theme-allow-file`. Ancestry is a **new** `node.parent` walk (the only existing walk
is `isInStyleContext`; `hand-rolled-plot` is file-scoped) that stops at a **slot attribute** — a
`JSXAttribute` named `actions | filters | tabs | sync | filtersEnd` whose owning element
is `PageBar | Section | WidgetHeader | ChartCard | StatCard | BasaltDataTable | SettingsSection |
FilterSet` — never at the element itself, so a body form under a `Section` never fires. Identifier
resolution: a `const x = <JSX/>` binding used as a slot attribute value in the same file counts as
inside that slot (argo's hoisted `headerExtra`, `cost-over-time.tsx:54-68`).

`RAW_FILTER_TAGS = { SegmentedControl, Select, MultiSelect, NativeSelect, DatePickerInput,
DateInput, TagsInput, Chip.Group }` (binding imported from `@mantine/*`);
`BOUND_TAGS = { RangeFilter, CompareFilter, SelectFilter, MultiSelectFilter, SearchFilter,
ToggleFilter, ViewTabs }`.

`SettingsRow.control` is the form-row home: Mantine `md`, raw inputs allowed, no filter/size rule
applies; `control-outside-home` treats it as a home.

| Rule id                           | Law     | AST pattern                                                                                                                                                                                                                                                                                                                                                      | Escape                                   | Severity                                                                         |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `basalt/hand-rolled-filter`       | C1, C3  | `JSXOpeningElement` ∈ RAW_FILTER_TAGS inside a slot attribute (direct or via hoisted binding)                                                                                                                                                                                                                                                                    | `theme-allow hand-rolled-filter — <why>` | **error 1.26.0** (no incumbents once the migrations land)                        |
| `basalt/control-outside-home`     | C1      | ∈ RAW_FILTER_TAGS with no slot ancestor, not under `SettingsRow \| Modal \| Drawer \| Popover.Dropdown \| Menu.Dropdown \| Composer`, file does not import `@mantine/form`, file does not define a basalt control (owner exemption, same shape as `hand-rolled-plot`'s `notesOwnerDefinition`)                                                                   | same                                     | warn, `promote: '1.28.0'`; collapses to advisory if the allowlist passes 15 tags |
| `basalt/control-size-literal`     | C5      | `JSXAttribute` ∈ `{ size, w, fullWidth, visibleFrom, hiddenFrom }` on any element inside a slot attribute                                                                                                                                                                                                                                                        | same                                     | warn, `promote: '1.27.0'`                                                        |
| `basalt/page-bar-budget`          | C6      | >1 `PageBar` per file; `actions.secondary` `ArrayExpression` >4 elements; `Section actions` >3; a second `variant="filled"` inside one slot                                                                                                                                                                                                                      | same                                     | **error 1.26.0**                                                                 |
| `basalt/in-body-page-title`       | C8      | `Title` with `order` literal 1 or 2 outside a `content/` path segment and not under `Prose \| ArticleLayout \| Modal \| Drawer`                                                                                                                                                                                                                                  | same                                     | warn, `promote: '1.27.0'` (playground has 6)                                     |
| `basalt/responsive-twin`          | C9      | two sibling `JSXElement`s where one carries `visibleFrom="X"` and the other `hiddenFrom="X"` **and** both subtrees contain the same tag ∈ RAW_FILTER_TAGS ∪ BOUND_TAGS; exempt when the file defines a basalt control                                                                                                                                            | same                                     | warn, `promote: '1.27.0'`                                                        |
| `basalt/search-literal-link`      | C10     | `ObjectExpression` as the `search` property of a `linkOptions()` call inside a `defineNav()`/`navGroup()` argument (fires on argo `nav.tsx:132`)                                                                                                                                                                                                                 | same                                     | warn, `promote: '1.27.0'`                                                        |
| `basalt/use-search-from-literal`  | C10     | `useSearch({ from: <StringLiteral> })` anywhere                                                                                                                                                                                                                                                                                                                  | same                                     | warn, `promote: '1.27.0'`                                                        |
| `raw-scroll-container` (widened)  | C7      | existing `Property` visitor adds: `overflowX: 'auto' \| 'scroll'` or `ScrollArea scrollbars="x"` inside a slot attribute or under `Section \| ChartCard`                                                                                                                                                                                                         | existing                                 | warn for the widening, `promote: '1.27.0'`                                       |
| `shadow-basalt-export` (extended) | C8, C12 | existing barrel collision plus `SHADOW_ALIASES`: `Section ← { PageSection, SectionTitle, SectionHeading }`, `RangeFilter ← { WindowSelector, RangeSelector, DateFilter }`, `ViewTabs ← { ViewSwitch, ViewToggle }`, `SyncButton ← { RefreshButton, SyncControl, SyncStatusButton }`, `PageBar ← { PageHeader, FilterBar }`, `StatCard ← { HeroCard, HeroStats }` | rename                                   | permanent advisory (`ADVISORY` set)                                              |

Text-level guard kinds (`src/guard`, for the PreToolUse hook lane): `in-body-page-title`
(`<Title order={1|2}` in consumer `src/**`) and `raw-selection-control` (a RAW_FILTER_TAG on a line
outside a `SettingsRow`/`Modal` window) — both `warn`, `promote: '1.27.0'`.

Infrastructure in the same wave: `DoctrineSpec` gains `pluginRules: readonly PluginRuleId[]`
(the literal union of the plugin's `rules` keys, asserted equal by `oxlint-plugin.test.ts`);
`./controls` is a real doctrine surface (`rule: 'controls'`, `layer: 'mantine-coupled'`) carrying
the ids above; `hand-rolled-shell` moves onto `.`'s `pluginRules`; `basalt-ui check-coverage`
asserts every registered plugin id maps to exactly one surface. `PLUGIN_RULE_GRACE` and
`GRACE_PERIOD_KINDS` become `{ since: string; promote: string; why: string }`; the tests fail when
`package.json` version ≥ `promote` and the rule is still `warn` (C16). The 1.26.0 commit promotes
the nine stale entries (four plugin rules, five kinds — D4) to `error` except
`shadow-basalt-export`, which enters `ADVISORY`. Promotion of any new rule is additionally gated
on running the shipped preset against argo, linewatch, image-share, rb, image-gen and the
playground with ≤3 total waivers.

Honest coverage: C1 as a cross-file law, hand-rolled section headings (argo's copies are
`<Text fw={600} size="sm">` + `{children}`, which no AST heuristic matches without false positives)
and C11/C12 are `advisory` in the generated header. Claiming otherwise is D8 again.

## 7. Agent layer

13 rules / 4,177 lines become 6 / ≤1,050. Every rule header is a generated
`<!-- basalt:coverage -->` block from `SURFACES` (`backed by: <guardKinds> · <pluginRules>` /
`not guarded: …`), diffed by `check-coverage`, which also fails CI over budget.

| File                                           | Budget | `paths:`                         | Content                                                                                                                                 |
| ---------------------------------------------- | ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt-tokens.md`                             | 160    | `src/**`                         | identity ×1, `theme-allow` grammar ×1, no hex/px literals (C13), surface token set from code (C12)                                      |
| `basalt-mantine.md`                            | 180    | `src/**`                         | provider, shell props, `GlobalAction`, sidebar blocks, breadcrumb, overlays via `BasaltOverlays` ×1 (D1); B1–B13 rewritten against code |
| `basalt-charts.md`                             | 140    | `**/charts/**`                   | CartesianChart law, five declared exceptions (D2), series-derived legends; API → `llms.txt`                                             |
| `basalt-state.md` (absorbs `basalt-router.md`) | 160    | `src/**`, `apps/**/src/**` (A10) | `createSearchStore`, lanes, `FieldHandle`, `linkSearch`, `defineNav`/`useNav`, `createPersistedState`; `useOnlineStatus` gone (A12)     |
| `basalt-controls.md` _(new)_                   | 160    | `src/**`                         | C1–C16, the homes table, the tier, the mobile table, sidebar blocks, the store-binding recipe                                           |
| `basalt-batteries.md`                          | 220    | `src/**`                         | query, forms, notifications, commands, data, content, agent, app — ≤25 lines each, Eden footguns once (D6), overlay mount stated once   |

Deleted: `basalt-router.md`, `basalt-query.md`, `basalt-forms.md`, `basalt-notifications.md`,
`basalt-commands.md`, `basalt-data.md`, `basalt-content.md`, `basalt-agent.md`, `basalt-app.md`.
`RuleName` shrinks to the six; every `SURFACES[*].rule` remaps; the set-equality test drives the
rename. Skills ≤100 lines each, procedures only (D5, D7 collapse to one statement in
`CLAUDE-block.md.tpl`). `CLAUDE-block.md.tpl` 40 lines, `DESIGN.md.tpl` 45 with the skill names
fixed (D3). Package `CLAUDE.md` ≈400: invariants + footguns; CLI and plugin mechanics move to
JSDoc and `llms.txt`.

Ledger disposition. **A1–A14**: die with `basalt-router.md` and the root `CLAUDE.md` block;
`basalt-state.md` + `basalt-controls.md` become the only placement/persistence doctrine; the
100-line recipe JSDoc in `search-param-store.ts` becomes a pointer to this spec; A9 is moot
(`linkSearch` required by type). **B1–B14**: B5/B6/B12/B13/B14 are code deletions in wave 3; the
rest are prose corrections in `basalt-mantine.md` and the package `CLAUDE.md`. **C1–C13**:
C1/C2/C4/C5/C12/C13 corrected from `palette.ts`/`tokens/index.ts`; C3 fixes `ChartCard`'s rem
fallbacks; C6 collapses when `DeltaBadge` reads `VX.text.xs`; C7 retires with `data-numeric`;
C8–C11 corrected in `DESIGN-SPEC.md`, `STATUS.md`, `stat-card.tsx`. **D1–D16**: D1–D3, D5–D10 die
with the merge and generated headers; D4 becomes C16; D11/D12 fixed in the store tests; D13/D14 are
`STATUS.md`/`ARGO-MIGRATION-LEARNINGS.md` rows in wave 6; D15/D16 are wave-7 deletions.

## 8. Migration

`packages/basalt-ui/MIGRATING.md` gets one `## 1.26.0` section per wave with a row per removed or
renamed export and its replacement.

**Removed / renamed exports (MIGRATING rows):** `PageActions`, `PageActionsOutlet`,
`PageHeaderProvider` → `PageBar` (provider stays internal); `BasaltShellProps.globalActions:
ReactNode` → `GlobalAction[]`; `sidebarNavExtra` / `mobileNav.moreExtra` → `sidebarBlocks`;
`StatCard.label` → `title`, `StatCard.menu` → `actions`; `ChartCard.tooltip` → `info`,
`ChartCard.extra` → `actions`; `SettingsSection.description` → `subtitle`;
`BasaltDataTable.toolbarActions` → `actions`; `ArticleFilterBar` → `FilterSet` + `ViewTabs` +
`MultiSelectFilter`; `createSearchParamStore` / `createMultiSearchParamStore` → `createSearchStore`
(deprecated wrappers until 1.29.0); `useOnlineStatus` → `useConnectivity`; tokens
`appHeaderMobileActionsHeight`, `appShellHeaderMobileHeight`, `stickyHeaderClearanceMobile`; CSS
`.pageActions` and its `nowrap` override (`app-header.module.css:27-43,63-72`).

**Playground** (gates every promotion): `demo/dashboard-range-store.ts` → `createSearchStore`
with `field.range`; `demo/DashboardDateFilter.tsx` deleted; `routes/dashboard.tsx` renders
`<PageBar filters={<FilterSet><RangeFilter/></FilterSet>} actions={…}/>` with one
`kind: 'custom'` row-1 node dogfooded; `demo/nav-model.tsx:58,230` thunks → `store.linkSearch`;
`routes/index.tsx` redirect uses `search: store.linkSearch()`; the six `<Title order={1|2}>` → breadcrumb
titles; the six in-body ephemeral control rows → `Section tabs`; a phone route demo exercising the
`Filters (n)` sheet, `stickyHeader` tables under `--basalt-page-bar-h`, and a sidebar with all
three block kinds.

**argo** (`apps/dashboard`, ≈ −700 lines):

1. `lib/window-stores.ts` → three `createSearchStore`s with `field.range({ presets, fallback,
custom: true })`; strength adds `tab: field.enum(…, { persist: false })`, `exercises:
field.multi(…)`; usage adds `range/grain/workspace/billing`, astro `tab/site/nights`, calendar
   `view`, walking `window`. Routes: `validateSearch: store.validateSearch` (the Zod +
   `readStored` splice in `garmin-health.tsx:54-58` ×3 goes); `presetToParams` ×3 →
   `field.range.toWindow`.
2. Delete `window-selector.tsx` ×4, `view-tabs.tsx` ×2 + the calendar `SegmentedControl`,
   `filter-bar.tsx`; each page renders `<PageBar filters={<FilterSet><RangeFilter
field={…} customPicker={DateRangePicker}/></FilterSet>} tabs={<ViewTabs field={…}/>}/>`; the four
   navigate handlers in `strength-tracker.tsx:132-198` and the astro/usage/calendar equivalents go.
3. `lib/nav.tsx:132` literal → `walkingStore.linkSearch`; `:110` strength thunk →
   `strengthStore.linkSearch`.
4. `section.tsx` ×6 → `Section`; `hero-stats.tsx` ×5 → `StatCard`; `session-history.tsx` /
   `top-projects.tsx` wrappers → `BasaltDataTable title`.
5. `RefreshButton` (`timer-nav.tsx`), `sync-control.tsx`, reading `SyncButton`, m365 `ActionIcon`
   → `SyncButton` (the global one in `globalActions` with `mobile: 'bar'`).
6. `__root.tsx:110-118` → `GlobalAction[]`: timer + bell `bar`, Hermes voice/widget + `ThemeToggle`
   `more`; theme rows stay only in `settingsMenuItems`.
7. Five in-chart `useState` selects (`momentum-chart.tsx:100`, …) → `field.enum(…, { url: false })`
   on a per-feature `createLocalStore`, bound through `ChartCard.actions={<SelectFilter/>}`.
8. `PageActions` ×8 → `PageBar`; `reading.tsx`/`hermes-chat.tsx` lose the empty row for free;
   calendar `100dvh - 100px` → `calc(100dvh - var(--app-shell-header-height) - var(--basalt-page-bar-h, 0px))`.

**linewatch** (`web`, no shell, ≈ −300 lines):

1. `lib/range.ts` + the `minDuration` Zod spread + `lib/compact.ts` + `section.tsx:100` `useState`
   → one `createSearchStore({ range: field.enum(RANGE_OPTIONS, '24h'), minDuration:
field.number({ fallback }, { persist: false }), compact: field.boolean(false, { url: false }) })`
   plus `createLocalStore` per section for `view`. The six compact content gates stay in linewatch
   — they are content decisions, not spacing.
2. `components/page-header.tsx` → `<PageBar title="linewatch" filters={<FilterSet><RangeFilter
field={…}/></FilterSet>} actions={{ secondary: [{ kind: 'custom', node: <LiveChip/> },
compactToggle, theme] }}/>`; the `--lw-header-h` effect, the `96px` fallback and both
   responsive twins (`page-header.tsx:125-158`, `section.tsx:216-234`) are deleted;
   `range-selector.tsx` deleted.
3. `components/section.tsx` → `Section id collapsible persistKey tabs={<ViewTabs/>}`; the `useRef`
   mirror (`:107-110`) goes; `useCardTitle` and the `''` sentinel go; `compact.contract.test.ts`
   deleted; `StatusBar` keeps its verdict rail but its headings become `WidgetHeader tier="widget"`;
   D16 dead references removed.

## 9. Implementation waves

Each wave is one `feat:` minor, independently shippable, with disjoint file groups so
implementers can run in parallel inside a wave. Waves 1 and 2 are mutually disjoint and may ship
as one release.

| Wave                       | Release | File group                                                                                                                                                                                                                                                                                                          | Delivers                                                                                                                                                                                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 Foundations**          | 1.26.0  | `src/tokens/palette.ts`, `src/tokens/index.ts`, `src/theme/index.ts`, `src/theme/*.test.ts`, `src/dashboard/delta-badge.tsx`, `src/widget-header/**` _(new)_, `src/guard/index.ts` + `configs/oxlint-plugin.js` (grace ledger shape only)                                                                           | anchors + steps, `ctl`/`icon` var sets + coverage test, slot `CTL_THEME`, `SegmentedControl` theming, Mantine-free `DeltaBadge` + `WidgetHeader`, `{ since, promote, why }` ledger + version-gated tests, nine stale entries promoted |
| **2 Stores**               | 1.26.0  | `src/router-tanstack/**`, `src/state.ts`, `src/index.ts` (state lines only)                                                                                                                                                                                                                                         | `createSearchStore`, `field.*`, `FieldHandle` in `./state`, `createLocalStore`, deprecated wrappers, `useOnlineStatus` removed, D11/D12 tests                                                                                         |
| **3 Homes**                | 1.27.0  | `src/shell/index.tsx`, `src/shell/page-bar.tsx` _(new, replaces `page-header.tsx`)_, `src/shell/app-header.module.css`, `src/shell/index.test.tsx`, `src/dashboard/stat-card.tsx`, `src/dashboard/settings-section.tsx`, `src/charts/primitives/ChartCard.tsx`, `src/section/**` _(new)_, `src/data/data-table.tsx` | `PageBar` (portal row 1, sticky row 2, `--basalt-page-bar-h`), `GlobalAction[]`, header 48 everywhere, composers on `WidgetHeader`, `Section`, table title/count                                                                      |
| **4 Controls**             | 1.27.0  | `src/controls/**` _(new)_, `src/controls-dates/**` _(new)_, `src/content/article-filter-bar.tsx` (delete) + `src/content/index.ts`, `package.json` exports, `src/surfaces.ts` (two surface entries), `scripts/pack-test.sh`                                                                                         | every control in §3, `FilterSet` + mobile sheet, `SyncButton`, `ViewTabs`, `DateRangePicker` behind the peer, pack-test step for `./controls-dates` without `@mantine/dates`                                                          |
| **5 Sidebar blocks**       | 1.28.0  | `src/shell/app-sidebar.tsx`, `src/shell/app-sidebar.module.css`, `src/shell/app-mobile-nav.tsx`, `src/shell/mobile-nav-model.ts`, `src/nav/types.ts`, `src/shell/index.tsx` (props only, after wave 3)                                                                                                              | `SidebarBlock` union, `brand.menu`, `search.actions`, persisted folds, rail dot/ring, More projection, `sidebarNavExtra`/`moreExtra`/B14 deleted                                                                                      |
| **6 Guards + agent layer** | 1.28.0  | `configs/oxlint-plugin.js`, `configs/oxlint-plugin.test.ts`, `src/guard/**`, `src/surfaces.ts` (`pluginRules`), `src/cli/**` (`check-coverage`), `agent/**`, `CLAUDE.md`, `MIGRATING.md`, `STATUS.md`, `docs/*.md` corrections                                                                                      | the ten rules of §6, two guard kinds, generated coverage headers, 13→6 rules, ledger dispositions of §7                                                                                                                               |
| **7 Dogfood + consumers**  | —       | `apps/playground/**`; then argo and linewatch PRs                                                                                                                                                                                                                                                                   | the playground gate, then the two migrations of §8; promotion of every wave-6 `warn` rule is blocked until this wave is green with ≤3 waivers                                                                                         |

Wave 3 must land the playground `stickyHeader` table and a calendar-style `100dvh` layout under
row 2 before argo moves — the sticky in-flow row is the one behaviour no consumer has run yet.

## 10. Consumer example

```tsx
// src/routes/analytics.tsx — every size, placement and persistence decision is basalt's
import { createFileRoute } from '@tanstack/react-router'
import { SimpleGrid, Stack } from '@mantine/core'
import { IconChartBar, IconSettings, IconUsers } from '@tabler/icons-react'
import { PageBar, Section, StatCard } from 'basalt-ui'
import {
  FilterSet,
  RangeFilter,
  CompareFilter,
  SelectFilter,
  MultiSelectFilter,
} from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'
import { ChartCard, MultiLine, BarSparkline } from 'basalt-ui/charts'
import { BasaltDataTable } from 'basalt-ui/data/table'
import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { useAnalytics, CHANNELS, channelColumns } from '../lib/queries/analytics'
import { openAccounts, openMetrics, saveReport } from '../lib/commands'

export const analytics = createSearchStore({
  key: 'analytics',
  fields: {
    range: field.range({ presets: ['7d', '30d', '90d', 'ytd'], fallback: '30d', custom: true }),
    compare: field.enum(['none', 'previous', 'year'], 'none'),
    currency: field.enum(['USD', 'EUR'], 'USD'),
    channels: field.multi(CHANNELS, []),
  },
}).labels({
  range: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', ytd: 'Year to date' },
})

export const Route = createFileRoute('/analytics')({
  staticData: { title: 'Analytics', icon: <IconChartBar size={16} /> }, // the breadcrumb names the page
  validateSearch: analytics.validateSearch,
  loaderDeps: ({ search }) => search,
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const search = analytics.useValues()
  const { data, isFetching, dataUpdatedAt, refetch } = useAnalytics(search)
  return (
    <Stack gap="md">
      <PageBar
        actions={{
          primary: { key: 'save', label: 'Save as report', onClick: saveReport },
          secondary: [
            {
              key: 'accounts',
              label: 'Accounts',
              icon: <IconUsers size={16} />,
              onClick: openAccounts,
            },
          ],
        }}
        sync={{ syncing: isFetching, lastCompletedAt: dataUpdatedAt, onSync: refetch }}
        filters={
          <FilterSet>
            <RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
            <CompareFilter field={analytics.field.compare} />
            <SelectFilter field={analytics.field.currency} label="Currency" />
            <MultiSelectFilter field={analytics.field.channels} label="All channels" />
          </FilterSet>
        }
        filtersEnd={[
          {
            key: 'metrics',
            label: 'Manage metrics',
            icon: <IconSettings size={16} />,
            onClick: openMetrics,
          },
        ]}
      />
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {data.kpis.map((k) => (
          <StatCard
            key={k.key}
            icon={k.icon}
            title={k.title}
            value={k.value}
            delta={k.delta}
            sparklinePlacement="right"
            sparkline={
              <BarSparkline
                data={k.history}
                width={72}
                height={28}
                ariaLabel={`${k.title} trend`}
              />
            }
          />
        ))}
      </SimpleGrid>
      <Section title="Revenue" icon={<IconChartBar size={16} />} count={data.channels.length}>
        <ChartCard
          title="Revenue over time"
          info="Net revenue per day against the prior window"
          value={data.revenue.total}
          delta={data.revenue.delta}
        >
          <MultiLine
            data={data.revenue.points}
            series={data.revenue.series}
            ariaLabel="Revenue over time"
          />
        </ChartCard>
      </Section>
      <BasaltDataTable
        title="Top pages"
        data={data.topPages}
        columns={channelColumns}
        enableGlobalFilter
        enablePagination
      />
    </Stack>
  )
}
```
