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

| #   | Law                                                                                                                                                                                                                                                                                                                                                                                             | Enforced by                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | A control lives in exactly one of three homes — the page bar, a section/widget header, or a form row — and a home is entered only through a slot prop (`actions`, `filters`, `tabs`, `sync`, `control`), or, for a `PageAside` body and a `PanelRow`, through the `'panel'` surface those two mount rather than through a slot prop.                                                            | `basalt/hand-rolled-filter` (slot-scoped), `basalt/control-outside-home` + `basalt/bound-control-outside-home` (advisory-warn)                      |
| C2  | A basalt filter or tab has no `value`/`onChange`; it takes `field` (a `FieldHandle`) and owns both the URL write and the localStorage mirror.                                                                                                                                                                                                                                                   | TypeScript — the props do not exist                                                                                                                 |
| C3  | Tab and filter state never lives in `useState`; it derives from a store field on the URL lane or the local lane.                                                                                                                                                                                                                                                                                | C2 + `basalt/hand-rolled-filter`                                                                                                                    |
| C4  | Every field declares its lanes once at definition — `{ url, persist }` — and resolves URL ⊳ localStorage ⊳ fallback, uniformly for every field kind.                                                                                                                                                                                                                                            | `createSearchStore` types + `search-store.test.ts`                                                                                                  |
| C5  | A home sets the size tier (`ctl` = 30px); an element inside a home slot carries no `size`, `w`, `fullWidth`, `visibleFrom` or `hiddenFrom`.                                                                                                                                                                                                                                                     | `basalt/control-size-literal`                                                                                                                       |
| C6  | A page has one `PageBar`; its `actions` hold ≤5 entries and exactly one `primary`; a `Section` holds ≤3 actions.                                                                                                                                                                                                                                                                                | `basalt/page-bar-budget` + `ActionGroupProps.primary` singular                                                                                      |
| C7  | A home never scrolls horizontally and never wraps; overflow folds into a `More` menu (actions) or a `Filters (n)` sheet (filters), computed by basalt from typed data (a declared second LINE below `sm` is a control's phone form — C9 — not a wrap; row 2 of `PageBar` is the one home that has one).                                                                                         | `raw-scroll-container` (widened) + typed `BarAction[]`                                                                                              |
| C8  | Every section, card or table title is a `WidgetHeader`; the page title is the breadcrumb (`staticData.title`) or `PageBar.title` in shell-less apps; an in-body `<Title order={1\|2}>` is an error.                                                                                                                                                                                             | `basalt/in-body-page-title` (order-1/2 branch); hand-rolled section headings are `advisory` + `shadow-basalt-export` on the name `Section`          |
| C9  | A responsive swap belongs to the control; rendering the same control twice under `visibleFrom`/`hiddenFrom` is an error. **`PageAside` is the one declared exception** (`docs/ASIDE-SPEC.md` §0): its two projections are two portal targets under two filter surfaces, so it reads the viewport in JS to mount ONE stateful subtree instead of a CSS twin that would mount the children twice. | `basalt/responsive-twin` (deep search for the same control tag in both halves); the exception is pinned by `tests/layout/page-aside.layout.test.ts` |
| C10 | A nav link carrying a store field passes `store.linkSearch` by reference; a `search:` object literal inside `defineNav`/`navGroup` is an error; `useSearch({ from: '<literal>' })` is an error.                                                                                                                                                                                                 | `basalt/search-literal-link`, `basalt/use-search-from-literal`                                                                                      |
| C11 | Every table or list inside a section states its count in its header.                                                                                                                                                                                                                                                                                                                            | `BasaltDataTable` passes `getRowCount()` to its own `WidgetHeader`; `Section.count` advisory                                                        |
| C12 | Refresh/sync has one shape, `SyncButton`, whose `scope` picks the home (`global` → shell header, `page` → `PageBar.sync`).                                                                                                                                                                                                                                                                      | `shadow-basalt-export` alias table (advisory)                                                                                                       |
| C13 | Sidebar blocks are declared data (`SidebarBlock[]`), never `ReactNode` slots, so rail and More-sheet projection are basalt's.                                                                                                                                                                                                                                                                   | tsc — `sidebarNavExtra` / `mobileNav.moreExtra` removed                                                                                             |
| C14 | An empty home renders nothing, so no route pays for a reserved row.                                                                                                                                                                                                                                                                                                                             | `shell/index.test.tsx` height assertion; `appShellHeaderMobileHeight` deleted                                                                       |
| C15 | Every touch target inside a home is ≥36px below `sm` (floor 30 at density −3); sheet rows are 44px.                                                                                                                                                                                                                                                                                             | `density-relations.test.ts` floor test on `touchControlHeight`                                                                                      |
| C16 | A new guard lands `warn` with a dated `promote` version; the build fails when `package.json` ≥ `promote` and the rule is still `warn`, and `make release` refuses a release whose COMPUTED version has reached one.                                                                                                                                                                             | `oxlint-plugin.test.ts` + `guard-hook.test.ts` (D4 becomes a test); `scripts/check-grace.ts`, run by `scripts/release.sh` on the dry run's version  |

C1 resolves A1/A5/A7; C2–C4 resolve A3/A4/A8/A11/A13; C10 resolves A2/A9; C9 resolves linewatch's
three doubled controls; C16 resolves D4.

## 2. Homes

`sm` stays the only breakpoint a CONSUMER writes. Mobile below means `< sm`; there is no
`pointer: coarse` axis. The two dashboard grid primitives are the sanctioned exception and the only
place `lg` (75em) exists in the package: `WidgetGrid` and `StatGroup` own the multi-breakpoint
column law INTERNALLY — `base 1 → sm min(cols,2) → lg cols` and `base 2 → sm min(cols,3) → lg cols`
respectively — so a page states one desktop count and never a responsive object. That is the point:
five playground call sites reached for `md`/`lg` with three different breakpoint sets because no
primitive owned the law (audit B #6/#7).

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
  className?: string // on the bar ROOT (both forms) — bleed across a container gutter
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
`icon` leading row 1. The height lands in the LAYOUT phase (`useLayoutEffect`, plain ref), so a cold
`#anchor` load clears the bar rather than scrolling under it. Each root carries
`data-basalt-page-bar` (`"standalone"` / `"shell"`) and `className`; scope container-gutter bleed
through the class, not through a global attribute selector — a seam under the bar is not the
consumer's to draw (`docs/DESIGN-SPEC.md` §5 "Region seams").

Desktop: row 1 = lead · custom chips · ≤3 secondaries as `default` buttons + `More` (`kind: 'menu'`
and any secondary past three) · `sync` · `primary` filled, RIGHTMOST of the page group · then the shell
`globalActions` after a gap. Every control in the header is `ctl` (30px), globals included. Row 2 = `tabs` ·
filter pills · `filtersEnd` right-aligned. `wrap: nowrap`; pills past the width fold into a `+N`
menu pill.

Mobile: row 1 = breadcrumb · `primary` as an icon button · kebab `Menu` holding every
`mobile: 'more'` action and the `globalActions` marked `more` · ≤2 `globalActions` marked `bar`.
Row 2 is two declared lines: line 1 = `ViewTabs` full-width (a `Select` past three options); line 2
= the first `FilterSet` pill inline · one `Filters (n)` pill (funnel glyph, count only when n > 0)
opening a bottom `Drawer` where every filter renders as a LIST — 44px rows, label left, check glyph
right, hairline between rows only, a mono micro group label per filter, `Reset all` in the sheet
header, the custom range picker collapsed behind a "Custom range…" row; never a `SegmentedControl`
in the sheet (apply immediately, `filtersEnd` folded into the row-1 kebab so a header has exactly
one kebab — row 2 shows it from `sm` up; `Reset all` footer) · the aside's `Panel` pill when a
`PageAside` claims it (`docs/ASIDE-SPEC.md` §3); `n` = `store.useActiveCount()`. A line exists only
when its content is mounted (C14) — filter-less, tab-less pages render no row 2 at all.

### 2.2 `WidgetHeader` — tiers 2 and 3 _(new, `src/widget-header/`, Mantine-free)_

```ts
export type WidgetHeaderProps = {
  tier: 'section' | 'widget' | 'group' // section: 30px ctl, h2 · widget: 24px icon tier, h3, display-only · group: aside/inspector label, h3, mono micro uppercase faint, quietest rank
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

| Component                        | Mapping                                                                                                                                                                                                                                                                                                                                                                                                | Removed            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `StatCard`                       | `label`→`title`; `menu`→`actions`; adds `icon`, `info`, `subtitle` (both forwarded to `WidgetHeader` — the method behind the glyph and the unit line, neither expressible in a `string` `value`), `sparklinePlacement?: 'bleed' \| 'right'` (reference: right); keeps `value/delta/deltaPeriod/sparkline/tone`                                                                                         | `label`, `menu`    |
| `ChartCard`                      | `tooltip`→`info?`; `extra`→`actions`; adds `icon`, `value`, `delta`, `count`; header renders only when any of title/info/value/actions is set (ends linewatch's `''` sentinel, `compact.ts:61-69`)                                                                                                                                                                                                     | `tooltip`, `extra` |
| `Section` _(new)_                | `WidgetHeaderProps` minus `tier` + `tabs?: ReactNode` + `collapsible?: boolean` + `persistKey?: string` + `defaultOpen?: boolean` (default `true`, respected only while nothing is persisted) + `summary?: ReactNode` (under the header, visible collapsed or not) + `id?: string` (anchor, `scrollMarginTop: calc(var(--app-shell-header-height, 0px) + var(--basalt-page-bar-h, 0px))`) + `children` | —                  |
| `SettingsSection` / `DangerZone` | `description`→`subtitle`; adds `actions`                                                                                                                                                                                                                                                                                                                                                               | `description`      |
| `BasaltDataTable`                | adds `title`, `icon`, `subtitle`, `actions: ReactNode` (a plain slot — `ActionGroup`'s header semantics never reach a table); `count` always `table.getRowCount()`; `facets` render as `FilterPill`s inside a `FilterSet`; the four `w={220/200/180/110}` literals (`data-table.tsx:923-999`) go                                                                                                       | `toolbarActions`   |

The export is spelled **`Section`**, not `PageSection`, so the existing `shadow-basalt-export` rule
fires today on argo's six `function Section` copies with zero new rule code. Section fold state
persists through `createPersistedState('basalt:section:<persistKey>')`; the header stays drawn when
closed; `tabs` hide while collapsed. `Section` has no `variant` — one shaded container level per
page, the card is `ChartCard`/`StatCard`.

Mobile: `tier: 'section'` keeps title · count · one inline action, the rest in a kebab; `tabs`
past 3 options become a `Select`. `tier: 'widget'` keeps value + delta wrapping under the title,
sparkline `right` drops to `bleed`, one `⋯` at 30px with a 36px hit area.

| Tier      | Component                     | Heading | Style                                                      | Row height            | Icon |
| --------- | ----------------------------- | ------- | ---------------------------------------------------------- | --------------------- | ---- |
| `section` | `WidgetHeader tier="section"` | `h2`    | head-font 88%/550, ink                                     | `sectionHeaderHeight` | 16px |
| `widget`  | `WidgetHeader tier="widget"`  | `h3`    | head-font, display-only, icon-tier                         | `widgetHeaderHeight`  | 14px |
| `group`   | `WidgetHeader tier="group"`   | `h3`    | mono micro uppercase faint — the quietest rank on the page | `widgetHeaderHeight`  | 14px |

`Section` resolves `group` under any NON-PILL filter surface — `panel` (inside a `PageAside`) or
`sheet` (the aside's mobile projection), read via `useFilterSurface() !== 'pill'` — and `section`
everywhere else, no call-site prop. An aside never hosts a `section`-tier heading; a group-tier body
has zero gap because its `PanelRow`s own their own inset and hairline.

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
settingsMenu?: 'auto' | 'flat' | 'menu'                 // 'auto' = the ≤3 → flat count rule
globalActions?: GlobalAction[]                          // was ReactNode
export type GlobalAction = { key: string; node: ReactNode; mobile?: 'bar' | 'more' | 'hidden' }  // default: first two 'bar'
```

Defaults: `list.mobile = 'more'`, `progress.mobile = 'hidden'`, `rail = 'dot'` for a list with
`count`, `'ring'` for progress on the settings row. Block folds persist at
`basalt:sidebar-block:<key>` (replaces the `useState` keyed by label, `app-sidebar.tsx:364-366`,
gap #8). Footer link rows (Settings / Integrations / Invite) are `settingsMenuItems` rendered flat
when ≤3; `settingsMenu?: 'auto' | 'flat' | 'menu'` (default `'auto'` = that count rule) forces the
form for what the count cannot see — three rows that are each a CONTROL (a theme radio group, a
devtools switch) read as a widget pile flat, and four short destinations may be worth their height.
On mobile a block projects to one More-sheet row (`Awaiting action · 3`) opening a sheet of its
items, counted by a `blockRowCount` sibling of `accountRowCount`.
`sidebarNavExtra`, `mobileNav.moreExtra` and `SectionLabel`'s dead non-flush branch (B14) are
deleted.

## 3. Controls — `basalt-ui/controls` _(new subpath, Mantine-coupled)_

Every control takes a `FieldHandle` (§4) and renders `size="ctl"` internally; none takes
`value`/`onChange`/`size`. Every filter renders a `FilterPill` (bordered chip, icon · label · ⇅),
and every `icon` — in any control in this table — renders through the one `IconSlot`, a fixed
`--vx-space-icon-size` (16px) square that restates the glyph's own `width`/`height` and takes it off
the text baseline. A consumer's `<svg width="24">` therefore cannot set a control's row height.

**A filter pill's TEXT is always the selected option's label**, at the field's default value too;
`label` is the popover/sheet heading and the accessible name and is never printed on the pill. The
one exception is `MultiSelectFilter`, whose selection carries no information when it is empty or
complete — it reads the group label there and `N <noun>` otherwise.

`ControlGroup` is the only member of this table that is not `FieldHandle`-bound: it joins adjacent
controls that act on ONE thing (`‹ Today ›`, `− 1 +`) into a single box. A row of INDEPENDENT
actions is `ActionGroup`, and joining it would claim a relationship that is not there.

| Export              | Signature                                                                                                                                                                                 | Store binding                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Mobile                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FilterSet`         | `{ children: ReactNode; inline?: number /* default 1 */ }`                                                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | keeps `inline` pills; folds the rest into `Filters (n)` — no pill when nothing folds                                                                                                                                                                        |
| `RangeFilter`       | `{ field: FieldHandle<RangeField<P, C>>; icon?: ReactNode; customPicker?: ComponentType<RangeCustomPickerProps>; label?: string /* heading + aria name, default 'Range' */ }`             | `field.range` — three URL params (`window`/`from`/`to`, renamable)                                                                                                                                                                                                                                                                                                                                                                                                           | sheet: presets as vertical `SegmentedControl` (>4) + the custom picker                                                                                                                                                                                      |
| `CompareFilter`     | `{ field: FieldHandle<EnumField<'none' \| 'previous' \| 'year'>>; label?: string }`                                                                                                       | `field.enum`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | sheet: radio list                                                                                                                                                                                                                                           |
| `SelectFilter`      | `{ field: FieldHandle<EnumField<T>> \| FieldHandle<StringField>; label: string; icon?: ReactNode; clearable?: boolean; options?: readonly FilterOption[] }`                               | `field.enum` / `field.string`; labels from `store.labels()`, or from `options` — a runtime catalogue that OVERRIDES `field.options` whole, and the reason a `StringField` handle (an id set no enum can close over) is legal at all: WITHOUT `options` it is a type error                                                                                                                                                                                                    | sheet: radio list                                                                                                                                                                                                                                           |
| `MultiSelectFilter` | `{ field: FieldHandle<MultiField<T>>; label: string; icon?: ReactNode; options?: readonly FilterOption[]; noun?: string; counts?: Record<string, number>; max?: number /* default 6 */ }` | `field.multi`; pill reads `All channels` / `3 channels` (`noun` sets the plural read, default the lowercased `label`); `options` overrides the rows at render — it relabels a closed set, never opens it                                                                                                                                                                                                                                                                     | sheet: checkbox list                                                                                                                                                                                                                                        |
| `NumberFilter`      | `{ field: FieldHandle<NumberField>; label: string; icon?: ReactNode; options?: readonly { value: number; label: string }[]; step?: number /* default `field.step` */ }`                   | `field.number`; WITH `options` it is the same radio body every enum filter renders (through `EnumFilter`'s `ChoiceHandle`) and the URL still holds a NUMBER; WITHOUT, a `ctl` `NumberInput` that applies on blur/Enter, never per keystroke. `min`/`max`/`int` come off the HANDLE (`NumberHandleExtras`), so the stepper stops at the field's limit and an `int` field refuses decimals; the codec's clamp stays the backstop for a value that did not come through the box | with `options`: radio list. Without: the input as a full-width row                                                                                                                                                                                          |
| `SearchFilter`      | `{ field: FieldHandle<StringField>; placeholder?: string }`                                                                                                                               | `field.string` (`history: 'replace'`)                                                                                                                                                                                                                                                                                                                                                                                                                                        | full-width row                                                                                                                                                                                                                                              |
| `ToggleFilter`      | `{ field: FieldHandle<BooleanField>; label: string }`                                                                                                                                     | `field.boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `Switch` row                                                                                                                                                                                                                                                |
| `ViewTabs`          | `{ field: FieldHandle<EnumField<T>>; options?: readonly { value: T; label: string; only?: 'sm-up' \| 'sm-down' }[] }`                                                                     | `field.enum`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ≤3 options `SegmentedControl fullWidth`; more → `Select`; `only: 'sm-down'` absorbs argo's Train tab                                                                                                                                                        |
| `SyncButton`        | `{ syncing: boolean; lastCompletedAt?: number \| Date \| null; onSync: () => void; scope: 'page' \| 'global'; label?: string; error?: string }`                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `scope: 'page'` is labelled with the age inline above `sm` and icon-only below it; `scope: 'global'` is icon-only at EVERY width (the shell header shares 48px with the breadcrumb and row 1), age and error in the tooltip, `label` as the accessible name |
| `ActionGroup`       | `ActionGroupProps`                                                                                                                                                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | primary icon + kebab                                                                                                                                                                                                                                        |
| `ControlGroup`      | `{ children: ReactNode; gap?: 'none' \| 'tight' /* default 'none' */ }`                                                                                                                   | — (presentational; no `role`, no label — each child keeps its own accessible name)                                                                                                                                                                                                                                                                                                                                                                                           | unchanged — a joined set is one unit at every width; `ActionGroup` additionally joins ADJACENT icon-only entries on the mobile bar, where two 30px squares with a gap cost three boxes' worth of border                                                     |
| `OverflowMenu`      | `{ actions: readonly BarAction[] }`                                                                                                                                                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 44px rows                                                                                                                                                                                                                                                   |

**Surfaces.** A control has ONE form per mount and it is picked by the HOME, never by a prop or a
media query — `useFilterSurface()` reads it off the scope the home provides. `pill` is the default
and the `PageBar` row's (and the desktop `+N` fold's): a bordered chip whose text is the selected
value. `sheet` is the mobile `Filters (n)` drawer's, provided by `FilterSet`: 44px full-width rows,
a check at the trailing edge. `panel` is a `PageAside` body's, provided by `PageAside`
(`docs/ASIDE-SPEC.md` §3): a two-line inspector ROW — label above at `xs`/550, control below at
full width, a mono readout right-aligned on the label line — because a chip in a 300px column reads
as a stray button and a label beside its control leaves the control ~90px. `PanelRow` is that row,
and it IS a home (it wraps its slots in `CtlSlot`), so nothing inside it carries a `size` (C5).
`ToggleFilter` is the one panel row whose control rides the label line; `SliderControl` is a row on
every surface, having no pill form at all, and is not a filter (no registration, no `Reset all`).
The panel surface owns no census: there is no `Filters (n)` and no `Reset all` in an aside.

Numeric segment labels read mono `VX.text.xs` via `data-numeric`, retiring the per-consumer
`theme-allow` (`DashboardDateFilter.tsx:13-16`, C7). Swaps are CSS (`visibleFrom`/`hiddenFrom`
inside the control, one mount each), never a JS media query.

`basalt-ui/controls-dates` _(new subpath, optional peer `@mantine/dates`)_ exports
`DateRangePicker: ComponentType<RangeCustomPickerProps>`. It is injected through
`RangeFilter.customPicker`, never dynamically imported from a shared entry — linewatch has no
`@mantine/dates`, and `basaltViteConfig`'s `optimizeDeps.include` for `@mantine/*` would break on
an absent peer. `ArticleFilterBar` is deleted; `./content` re-exports `FilterSet`, `ViewTabs`,
`MultiSelectFilter`. `FilterOption` is `{ value: string; label: string; disabled?: boolean }` — one
member wider than the store's `FieldOption`, since a live catalogue expresses "archived" by
disabling a row rather than by omitting it (the URL may already point at that value).

## 4. Stores — `basalt-ui/router-tanstack`

One factory over typed fields replaces the enum-only pair (gap #2). The URL is the truth; the
localStorage mirror is a fallback under it.

```ts
export type FieldLane = { url?: boolean; persist?: boolean; history?: 'push' | 'replace' }
// defaults: url true, persist true, history 'replace'

// Every `fallback` below also takes a THUNK — `FieldFallback<T> = T | (() => T)`, resolved at read
// time and re-resolved while nothing is written. Local and memory lanes only: `createSearchStore`
// throws at definition for a thunk on a URL-lane field (`validateSearch` would pin the computed
// value into the URL on every navigation).
export const field: {
  enum<const T extends string>(
    values: readonly T[],
    fallback: FieldFallback<T>,
    lane?: FieldLane,
  ): EnumField<T>
  multi<const T extends string>(
    values: readonly T[],
    fallback?: FieldFallback<readonly T[]>,
    lane?: FieldLane,
  ): MultiField<T>
  // THREE overloads, one per `custom` shape (omitted/`false` → `false`, literal `true` → `true`,
  // a widened `boolean` → `boolean`). A single `custom?: C` signature is inferred against
  // `AnyField` when the call sits inline in `createSearchStore({ fields })`: the contextual return
  // type wins, `C` widens, and every value type gains a `'custom'` preset the field rejects.
  // `W` is inferred from `window`'s KEYS and carried on the field, which is what lets `toWindow`
  // exclude the resolved presets from its `{ window }` branch (below).
  range<const P extends string, const C extends boolean, const W extends P>(
    o: {
      presets: readonly P[]
      fallback: FieldFallback<P>
      custom?: C
      params?: { preset?: string; from?: string; to?: string }
      /** Per-preset window resolvers — the presets `toWindow()` answers with `{ from, to }`. */
      window?: Partial<Record<W, (now: Date) => { from: string; to: string }>>
    },
    lane?: FieldLane,
  ): RangeField<P, C, RangeParams, ResolvedLane, W>
  number(
    o: { fallback: FieldFallback<number>; min?: number; max?: number; int?: boolean },
    lane?: FieldLane,
  ): NumberField
  boolean(fallback: FieldFallback<boolean>, lane?: FieldLane): BooleanField
  string(o?: { fallback?: FieldFallback<string>; max?: number }, lane?: FieldLane): StringField
}
export type RangeValue<P extends string> = { preset: P; from?: string; to?: string }

export type FieldHandle<F extends AnyField> = {
  // declared in `basalt-ui/state` (headless)
  readonly kind: F['kind']
  readonly fallback: FieldValue<F>
  readonly options: readonly { value: string; label: string }[] // enum/multi; from labels()
  /** Read + write. Reads `useSearch({ strict: false })` when the field is on the URL lane, else storage,
   *  else fallback. Writes `navigate({ to: '.', search: prev => ({ ...prev, ...encoded }), replace,
   *  resetScroll: false })` when the matched route validates the param, then persists when
   *  `persist`. EVERY store navigate (a field write, `useReset`) passes `resetScroll: false` — a
   *  filter halfway down a page must not jump the reader back to the top.
   *  `opts.patch` merges extra search params into the SAME navigate (URL lane only) for keys the
   *  store does not own — clearing a sibling `detailDate` with `undefined`. The field's own params
   *  always win over the patch. */
  use(): readonly [
    FieldValue<F>,
    (next: FieldValue<F>, opts?: { patch?: Record<string, unknown> }) => void,
  ]
  /** UNSET the field — the persist lane deletes its key, the memory lane drops its value, the URL
   *  lane navigates back to the fallback params. What a control's reset calls; `set(fallback)`
   *  would PIN a thunk fallback into the mirror and be read back tomorrow as a choice. */
  clear(): void
  isDefault(v: FieldValue<F>): boolean
  // range only — a preset declared with a `window` resolver projects to `{ from, to }` too, and is
  // EXCLUDED from the `{ window }` branch (`W` = the resolver keys), so the result assigns to an
  // API param type naming only the server-understood windows with no cast. `custom: true` keeps
  // `'custom'` in the union: a custom preset with no dates resolves to `{ window: 'custom' }`.
  toWindow?: (v: RangeValue<P>) => { window: Exclude<P, W> } | { from: string; to: string }
  // number only — the declared bounds and grain, republished so a control can bound its own input
  // instead of the call site restating them. The codec clamps to these on write either way.
  min?: number | undefined
  max?: number | undefined
  int?: boolean
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
}): Pick<SearchStore<S>, 'field' | 'readStored' | 'labels'> // `basalt-ui/state`, no router
```

`useSearch({ strict: false })` reads the merged search of every matched route, so a control renders
on a sibling or child route without `from` (A3). The lane pair spells out three homes, and BOTH
factories resolve all three the same way (one store-core helper, no per-factory copy):

| Lane            | Declared                         | Lives in                                                                                    | For                                                                                         |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **URL+mirror**  | default                          | the URL, mirrored to `localStorage` under it                                                | every page filter — shareable, and remembered next visit                                    |
| **mirror-only** | `{ url: false }`                 | `localStorage`                                                                              | linewatch `compact`, argo's five per-chart selects, `Section` views                         |
| **memory-only** | `{ url: false, persist: false }` | one session-shared external store per store instance — never `localStorage`, gone on reload | a scratch comparison, a temporary drill-down: a value nobody should be handed back tomorrow |

`{ persist: false }` with the URL lane still on is the URL-only lane (pagination, linewatch's
deliberately unpersisted `minDuration`, argo's strength `tab`). Memory-only fields are counted by
`useActiveCount()` and cleared by `useReset()`; they never appear in `useValues()`/`validateSearch`,
which are the URL lane by definition. In a `createLocalStore` the `url` flag is ignored, so
`persist: false` alone lands a field in the memory lane.
`RangeField` keeps three URL params so argo's loaders and deep links do not change shape;
`toWindow()` replaces argo's three `presetToParams` — including the DERIVED presets that sent one
consumer back to a hand-rolled one: `field.range({ window: { '3m': (now) => ({ from, to }) } })`
makes `toWindow({ preset: '3m' })` return `{ from, to }` while `3m` stays one preset in the URL, and
a preset with no resolver keeps `{ window: preset }` in the same field. The resolver runs at CALL
time with the current `Date`, so a derived window is never stale and never leaves the store. The
resolved presets are dropped from the RETURN TYPE too (`Exclude<P, W>`), which is the half that lets
a consumer delete its `presetToParams` switch rather than move the cast into it; a `custom: true`
field still guards `'custom'`, the one preset that can come back with no dates.

**The handle type a consumer WRITES for a range field follows the `custom` flag**, because the
handle's setter is contravariant in the value: `field.range` without `custom: true` hands out a
`RangeField<P, false>`, and a prop typed `FieldHandle<RangeField<P>>` (`C` defaulting to `boolean`)
therefore accepts only a custom-capable handle. A wrapper over the preset-only shape pins
`FieldHandle<RangeField<P, false>>`; one with a picker pins `FieldHandle<RangeField<P, true>>`; one
that must take either is generic over the flag (`<P extends string, C extends boolean>`), which is
what `RangeFilter` itself does.

**A reset UNSETS.** `useReset()` and `FieldHandle.clear()` DELETE the persisted key and drop the
memory value rather than writing `fallback` — so a thunk fallback keeps resolving, and a field
nobody chose is not counted by `useActiveCount()` tomorrow. A URL-lane `clear()` navigates back to
the fallback params, which is the only lane where the fallback is written anywhere. Writing a field from outside the owning route
persists only; `validateSearch` picks it up on the next visit (A1). A `patch` on such a write is
DROPPED with it (dev warns once), and a `patch` naming a param another field of the same store owns
is refused outright — it would reach the URL while the mirror kept the old value. Cross-field defaults are
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
prop; a `size="xs"` typed there is C5. **`CtlSlot` takes `tier?: 'ctl' | 'widget'`** (default `'ctl'`): a
`WidgetHeader tier="widget"` header row is 28px and cannot hold a 30px control, so its `actions` slot
mounts at `'widget'` — ActionIcon-only, `size="icon"` (24px, `--vx-space-control-height-widget`, which
is what that anchor has always named). `StatCard` used the default and a card with a kebab measured a
30px title row against 28 beside it, so two KPI cards in one grid row sat 2px out of line.
`ChartCard` lives inside the Mantine-free `charts/` boundary and therefore cannot mount `CtlSlot` at all: its `actions` slot carries the same `data-basalt-tier="widget"` marker written by hand, and the basalt controls placed there size themselves (`size="ctl"` internally) — a raw Mantine element in that one slot is not auto-tiered, which `control-size-literal` and `hand-rolled-filter` are what catch. Mantine's own `sm`/`xs` sizes are **not** re-pointed —
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
`BOUND_TAGS` is the `BOUND_TAGS` set in `configs/oxlint-plugin.js` — read it there, never a copy
here (this line spelled out a literal set that shipped one member stale).

`SettingsRow.control` is the form-row home: Mantine `md`, raw inputs allowed, no filter/size rule
applies; `control-outside-home` treats it as a home.

| Rule id                             | Law     | AST pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Escape                                                                  | Severity                                                                                                                                                          |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basalt/hand-rolled-filter`         | C1, C3  | `JSXOpeningElement` ∈ RAW_FILTER_TAGS inside a slot attribute (direct or via hoisted binding)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `theme-allow hand-rolled-filter — <why>`                                | **error 1.26.0** (no incumbents once the migrations land)                                                                                                         |
| `basalt/control-outside-home`       | C1      | ∈ RAW_FILTER_TAGS with no slot ancestor, not under `SettingsRow \| Modal \| Drawer \| Popover.Dropdown \| Menu.Dropdown \| Composer`, file does not import `@mantine/form`, file does not define a basalt control WHILE importing nothing from `basalt-ui*` (the owner exemption, `hand-rolled-plot`'s `notesOwnerDefinition` shape plus an import test — `CONTROL_OWNER_NAMES` carries generic names like `PanelRow`, so a bare-name match let one local helper switch three rules off for a whole consumer file; basalt's own control sources import each other relatively, a consumer of basalt always names the package), not under `FilterSet \| PageAside \| PanelRow` — the three basalt SUBTREE homes, provenance-gated, read by BOTH C1 rules so the two cannot disagree about what a home is, file basename does not match either dialect of the declared overlay convention — kebab `*-{modal,drawer,popover,panel,form}.tsx` or PascalCase `<Subject>{Modal,Drawer,Popover,Panel,Form}.tsx`, both requiring the leading subject (`isOverlayConventionFile`, one predicate for both rules and the guard lane) — the cross-file case, where the `<Modal>` is the PARENT's | same, plus `theme-allow-file control-outside-home — overlay`            | warn, `promote: '1.30.0'` — re-dated 2026-08-28: the argo wave-7 migration has not run, and the PascalCase dialect above is expected to clear most of its 9 warns |
| `basalt/bound-control-outside-home` | C1      | a BOUND basalt control (`BOUND_TAGS`; **`SliderControl` is deliberately NOT policed** — it always renders its own `PanelRow` and has no pill form at all, so a `Section` body is a legitimate home for it and "renders as a stray pill" would be false. The plugin has no per-tag home set, so the honest fix is dropping it rather than a private exemption) resolved through a `basalt-ui*` import with no slot ancestor, not under `FilterSet \| PageAside \| PanelRow` (the same provenance-gated subtree homes its sibling now reads) nor a `CONTROL_HOST_TAGS` member, and hosted also through a hoisted binding rendered as a subtree home's `{expr}` CHILD (`const rows = <SelectFilter/>` handed to `<PageAside>{rows}</PageAside>` — the same `Program:exit` deferral the slot lane uses), same owner exemption and the same two-dialect basename exemption (`isOverlayConventionFile`). NOT the `@mantine/form` exemption — a `FieldHandle`-bound filter is not a form input. Ledger G5 (`docs/ASIDE-SPEC.md` §2): its sibling matches raw Mantine tags only, so `<SelectFilter/>` in a `Section` body rendered as a stray pill and no lane saw it                       | `theme-allow bound-control-outside-home — <why>`, plus the `-file` form | warn, `since: '1.28.0'`, `promote: '1.30.0'` — a NEW id, not a widening (C16: a level is per-id)                                                                  |
| `basalt/control-size-literal`       | C5      | `JSXAttribute` ∈ `{ size, w, fullWidth, visibleFrom, hiddenFrom }` on any element inside a slot attribute, EXCEPT a slot owned by `ChartCard` — the one home that cannot mount the tier theme (§5), so the control there states its own size and the rule's advice would be false. A HOISTED binding handed to several slots is exempt only when EVERY basalt home it reached is `ChartCard`: the same `size="xs"` also renders in the tiered slot, and keying the exemption on one owner made the verdict depend on JSX order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | same                                                                    | **error 1.27.0**                                                                                                                                                  |
| `basalt/page-bar-budget`            | C6      | >1 `PageBar` in one returned JSX tree; `actions.secondary` `ArrayExpression` >4 elements; `Section actions` >3; a second `variant="filled"` inside one slot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | same                                                                    | **error 1.26.0**                                                                                                                                                  |
| `basalt/in-body-page-title`         | C8      | `Title` with `order` literal 1 or 2 outside a `content/` path segment and not under `Prose \| ArticleLayout \| Modal \| Drawer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | same                                                                    | **error 1.27.0** (both lanes — the guard kind of the same id promoted with it)                                                                                    |
| `basalt/responsive-twin`            | C9      | two sibling `JSXElement`s where one carries `visibleFrom="X"` and the other `hiddenFrom="X"` **and** both subtrees contain the same tag ∈ RAW_FILTER_TAGS ∪ BOUND_TAGS; exempt when the file defines a basalt control and imports nothing from `basalt-ui*` (the same two-part owner test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | same                                                                    | **error 1.27.0**                                                                                                                                                  |
| `basalt/search-literal-link`        | C10     | `ObjectExpression` as the `search` property of a `linkOptions()` call inside a `defineNav()`/`navGroup()` argument (fires on argo `nav.tsx:132`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | same                                                                    | **error 1.27.0**                                                                                                                                                  |
| `basalt/use-search-from-literal`    | C10     | `useSearch({ from: <StringLiteral> })` anywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | same                                                                    | **error 1.27.0**                                                                                                                                                  |
| `raw-scroll-container` (widened)    | C7      | existing `Property` visitor adds: `overflowX: 'auto' \| 'scroll'` or a Mantine `ScrollArea scrollbars="x"` reached through a slot attribute (a `Section`/`ChartCard` BODY is exempt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | existing                                                                | error, no grace (a scroll container in a slot has no incumbent)                                                                                                   |
| `shadow-basalt-export` (extended)   | C8, C12 | skips an ALIAS hit when the file both imports the basalt export it renames AND REFERENCES that binding as a value (a `HeroCard` composing `StatCard` is a wrapper, not a fork — the provenance test reads the IMPORTED name, so `StatCard as Base` counts; a type-only import, a value import used only in a type position and a dead import all compose nothing and stay reported; the name-COLLISION half is never exempted this way). Existing barrel collision plus `SHADOW_ALIASES`: `Section ← { PageSection, SectionTitle, SectionHeading }`, `RangeFilter ← { WindowSelector, RangeSelector, DateFilter }`, `ViewTabs ← { ViewSwitch, ViewToggle }`, `SyncButton ← { RefreshButton, SyncControl, SyncStatusButton }`, `PageBar ← { PageHeader, FilterBar }`, `StatCard ← { HeroCard, HeroStats }`                                                                                                                                                                                                                                                                                                                                                                           | rename                                                                  | permanent advisory (`ADVISORY` set)                                                                                                                               |

Text-level guard kinds (`src/guard`, for the PreToolUse hook lane): `in-body-page-title`
(`<Title order={1|2}` in consumer `src/**`) is **error 1.27.0** — promoted with its plugin twin, one
id across two lanes; `raw-selection-control` (a RAW_FILTER_TAG on a line outside a
`SettingsRow`/`Modal` window) stays `warn` with `promote: '1.30.0'`, re-dated alongside its AST twin
`basalt/control-outside-home` and carrying the same two-dialect basename exemption (its own
`isOverlayConventionFile`, pinned against the plugin's by both test files, and the same three
subtree homes added to its host-tag window — matched by name there, because a 12-line regex has no
import graph to gate them on). **The PascalCase dialect exempts a whole file on its basename, and
that trade was measured before it was kept**: across argo, linewatch, image-share, rb and image-gen
it matches 9 files, all in image-gen, and none of them renders a `<PageBar>` or sits under a
`routes/` directory — nine overlay bodies and zero pages, so the dialect stays whole-file rather
than growing a "does it render a page bar" predicate. Re-measure before widening the suffix set.
**`bound-control-outside-home` gets no text twin, deliberately**: a raw tag name
is Mantine's whatever the file does with it, while a bound control's name means nothing without the
import graph and the ancestry — neither of which a 12-line regex window has. A text heuristic there
would report a consumer's own `SelectFilter` sitting in its own `filters` slot, which is signal the
plugin already has and noise the guard would add.

Infrastructure in the same wave: `DoctrineSpec` gains `pluginRules: readonly PluginRuleId[]`
(the literal union of the plugin's `rules` keys, asserted equal by `oxlint-plugin.test.ts`);
`./controls` is a real doctrine surface (`rule: 'controls'`, `layer: 'mantine-coupled'`) carrying
the ids above; `hand-rolled-shell` moves onto `.`'s `pluginRules`; `basalt-ui check-coverage`
asserts every registered plugin id maps to exactly one surface and every guard kind to at least one. `PLUGIN_RULE_GRACE` and
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
| `basalt-controls.md` _(new)_                   | 185    | `src/**`                         | C1–C16, the homes table, the tier, the mobile table, the aside (`docs/ASIDE-SPEC.md` §4), sidebar blocks, the store-binding recipe      |
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
implementers can run in parallel inside a wave. All seven waves below shipped together as ONE
release, **1.26.0, on 2026-08-27** — the per-wave 1.26.0/1.27.0/1.28.0 split in this table was the
plan, not what happened. Promotion of the wave-6 `warn` rules is **1.27.0**, gated on the argo +
linewatch migrations of §8.

| Wave                       | File group                                                                                                                                                                                                                                                                                                          | Delivers                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 Foundations**          | `src/tokens/palette.ts`, `src/tokens/index.ts`, `src/theme/index.ts`, `src/theme/*.test.ts`, `src/dashboard/delta-badge.tsx`, `src/widget-header/**` _(new)_, `src/guard/index.ts` + `configs/oxlint-plugin.js` (grace ledger shape only)                                                                           | anchors + steps, `ctl`/`icon` var sets + coverage test, slot `CTL_THEME`, `SegmentedControl` theming, Mantine-free `DeltaBadge` + `WidgetHeader`, `{ since, promote, why }` ledger + version-gated tests, nine stale entries promoted |
| **2 Stores**               | `src/router-tanstack/**`, `src/state.ts`, `src/index.ts` (state lines only)                                                                                                                                                                                                                                         | `createSearchStore`, `field.*`, `FieldHandle` in `./state`, `createLocalStore`, deprecated wrappers, `useOnlineStatus` removed, D11/D12 tests                                                                                         |
| **3 Homes**                | `src/shell/index.tsx`, `src/shell/page-bar.tsx` _(new, replaces `page-header.tsx`)_, `src/shell/app-header.module.css`, `src/shell/index.test.tsx`, `src/dashboard/stat-card.tsx`, `src/dashboard/settings-section.tsx`, `src/charts/primitives/ChartCard.tsx`, `src/section/**` _(new)_, `src/data/data-table.tsx` | `PageBar` (portal row 1, sticky row 2, `--basalt-page-bar-h`), `GlobalAction[]`, header 48 everywhere, composers on `WidgetHeader`, `Section`, table title/count                                                                      |
| **4 Controls**             | `src/controls/**` _(new)_, `src/controls-dates/**` _(new)_, `src/content/article-filter-bar.tsx` (delete) + `src/content/index.ts`, `package.json` exports, `src/surfaces.ts` (two surface entries), `scripts/pack-test.sh`                                                                                         | every control in §3, `FilterSet` + mobile sheet, `SyncButton`, `ViewTabs`, `DateRangePicker` behind the peer, pack-test step for `./controls-dates` without `@mantine/dates`                                                          |
| **5 Sidebar blocks**       | `src/shell/app-sidebar.tsx`, `src/shell/app-sidebar.module.css`, `src/shell/app-mobile-nav.tsx`, `src/shell/mobile-nav-model.ts`, `src/nav/types.ts`, `src/shell/index.tsx` (props only, after wave 3)                                                                                                              | `SidebarBlock` union, `brand.menu`, `search.actions`, persisted folds, rail dot/ring, More projection, `sidebarNavExtra`/`moreExtra`/B14 deleted                                                                                      |
| **6 Guards + agent layer** | `configs/oxlint-plugin.js`, `configs/oxlint-plugin.test.ts`, `src/guard/**`, `src/surfaces.ts` (`pluginRules`), `src/cli/**` (`check-coverage`), `agent/**`, `CLAUDE.md`, `MIGRATING.md`, `STATUS.md`, `docs/*.md` corrections                                                                                      | the ten rules of §6, two guard kinds, generated coverage headers, 13→6 rules, ledger dispositions of §7                                                                                                                               |
| **7 Dogfood + consumers**  | `apps/playground/**`; then argo and linewatch PRs                                                                                                                                                                                                                                                                   | the playground gate, then the two migrations of §8; promotion of every wave-6 `warn` rule is blocked until this wave is green with ≤3 waivers                                                                                         |

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
            <MultiSelectFilter
              field={analytics.field.channels}
              label="All channels"
              noun="channels"
            />
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
