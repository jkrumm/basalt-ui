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

| #   | Law                                                                                                                                                                                                                                                                                                                                                                                             | Enforced by                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | A control lives in exactly one of three homes — the page bar, a section/widget header, or a form row — and a home is entered only through a slot prop (`actions`, `filters`, `tabs`, `sync`, `control`), or, for a `PageAside` body and a `PanelRow`, through the `'panel'` surface those two mount rather than through a slot prop.                                                            | `basalt/hand-rolled-filter` (slot-scoped), `basalt/control-outside-home` + `basalt/bound-control-outside-home` (advisory-warn)                                                |
| C2  | A basalt filter or tab has no `value`/`onChange`; it takes `field` (a `FieldHandle`) and owns both the URL write and the localStorage mirror.                                                                                                                                                                                                                                                   | TypeScript — the props do not exist                                                                                                                                           |
| C3  | Tab and filter state never lives in `useState`; it derives from a store field on the URL lane or the local lane.                                                                                                                                                                                                                                                                                | C2 + `basalt/hand-rolled-filter`                                                                                                                                              |
| C4  | Every field declares its lanes once at definition — `{ url, persist }` — and resolves URL ⊳ localStorage ⊳ fallback, uniformly for every field kind.                                                                                                                                                                                                                                            | `createSearchStore` types + `search-store.test.ts`                                                                                                                            |
| C5  | A home sets the size tier (`ctl` = 30px); an element inside a home slot carries no `size`, `w`, `fullWidth`, `visibleFrom` or `hiddenFrom`.                                                                                                                                                                                                                                                     | `basalt/control-size-literal`                                                                                                                                                 |
| C6  | A page has one `PageBar`; its `actions` hold ≤5 entries and exactly one `primary`; a `Section` holds ≤3 actions.                                                                                                                                                                                                                                                                                | `basalt/page-bar-budget` + `ActionGroupProps.primary` singular                                                                                                                |
| C7  | A home never scrolls horizontally and never wraps; overflow folds into a `More` menu (actions) or a `Filters (n)` sheet (filters), computed by basalt from typed data (a declared second LINE below `sm` is a control's phone form — C9 — not a wrap; row 2 of `PageBar` is the one home that has one).                                                                                         | `raw-scroll-container` (widened) + typed `BarAction[]`                                                                                                                        |
| C8  | Every section, card or table title is a `WidgetHeader`; the page title is the breadcrumb (`staticData.title`) or `PageBar.title` in shell-less apps; an in-body `<Title order={1\|2}>` is an error.                                                                                                                                                                                             | `basalt/in-body-page-title` (order-1/2 branch); hand-rolled section headings are `advisory` + `shadow-basalt-export` on the name `Section`                                    |
| C9  | A responsive swap belongs to the control; rendering the same control twice under `visibleFrom`/`hiddenFrom` is an error. **`PageAside` is the one declared exception** (`docs/ASIDE-SPEC.md` §0): its two projections are two portal targets under two filter surfaces, so it reads the viewport in JS to mount ONE stateful subtree instead of a CSS twin that would mount the children twice. | `basalt/responsive-twin` (deep search for the same control tag in both halves); the exception is pinned by `tests/layout/page-aside.layout.test.ts`                           |
| C10 | A nav link carrying a store field passes `store.linkSearch` by reference; a `search:` object literal inside `defineNav`/`navGroup` is an error; `useSearch({ from: '<literal>' })` is an error.                                                                                                                                                                                                 | `basalt/search-literal-link`, `basalt/use-search-from-literal`                                                                                                                |
| C11 | Every table or list inside a section states its count in its header.                                                                                                                                                                                                                                                                                                                            | `BasaltDataTable` passes `getRowCount()` to its own `WidgetHeader`; `Section.count` advisory                                                                                  |
| C12 | Refresh/sync has one shape, `SyncButton`, whose `scope` picks the home (`global` → shell header, `page` → `PageBar.sync`).                                                                                                                                                                                                                                                                      | `shadow-basalt-export` alias table (advisory)                                                                                                                                 |
| C13 | Sidebar blocks are declared data (`SidebarBlock[]`), never `ReactNode` slots, so rail and More-sheet projection are basalt's.                                                                                                                                                                                                                                                                   | tsc — `sidebarNavExtra` / `mobileNav.moreExtra` removed                                                                                                                       |
| C14 | An empty home renders nothing, so no route pays for a reserved row.                                                                                                                                                                                                                                                                                                                             | `shell/index.test.tsx` height assertion; `appShellHeaderMobileHeight` deleted                                                                                                 |
| C15 | Every touch target inside a home is ≥36px below `sm` (floor 30 at density −3). The mobile `Filters (n)` sheet draws no dedicated 44px row of its own past 1.28 — it renders the SAME `PanelRow` the aside's `panel` surface does (§3 "Surfaces"), so its rows carry whatever height that primitive gives them, not a sheet-specific number.                                                     | `density-relations.test.ts` floor test on `touchControlHeight`; `advisory` for the sheet/panel row height specifically — no test pins `PanelRow`'s rendered height to a floor |
| C16 | A new guard lands `warn` with a dated `promote` version; the build fails when `package.json` ≥ `promote` and the rule is still `warn`, and `make release` refuses a release whose COMPUTED version has reached one.                                                                                                                                                                             | `oxlint-plugin.test.ts` + `guard-hook.test.ts` (D4 becomes a test); `scripts/check-grace.ts`, run by `scripts/release.sh` on the dry run's version                            |

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
`filtersEnd`) **portals into a second shell-owned outlet**, the BAND between the header and the
scrollport — the same mechanism as row 1, one region down. It is not in the page flow and not
sticky: the band is a sibling of `AppShell.Main`, spanning Main's width, with `--vx-surface-bg` and
one `--vx-divider` hairline under it. That hairline is the ONLY line there (the header's own seam
belongs to `AppShell.Header` one region up) and it is painted only when a bar claims the band, which
is law C14 in CSS (`.band:not(:empty)` in `shell/app-main.module.css`). Row 2's `padding-block` is
`--vx-space-stack-xs`, not `stack-sm`: the band carries the separation now, so the whitespace does
not have to.

**The slot contract, and why it is a slot.** Row 2 used to render in flow and stick at the top of
its scrollport, which made its resting position a property of the CONSUMER's DOM: nested one `Stack`
deep — every real page — `position: sticky`'s constraint rectangle was that wrapper, so the band sat
one `--app-shell-padding` below the header seam, while a bar written as Main's direct child sat
flush. Same markup, two geometries, and no prop to reconcile them. Out in the shell's own band there
is one answer at any nesting depth, and nothing inside the scrollport has chrome to clear any more —
a sticky table head, `ArticleLayout`'s `.tocRail` and a `Section` `#anchor` all resolve against
Main's own top edge, with no `--basalt-page-bar-h` term. It still publishes its measured height as
`--basalt-page-bar-h` on `documentElement` (ResizeObserver,
`height > 0` guard — linewatch's `page-header.tsx:73-111` becomes framework behaviour). The AppShell
header therefore stays a token, 48px on every viewport: `appShellHeaderMobileHeight` (97, B12) and
the always-reserved 52px row (`palette.ts:586`, gap #5) are deleted, and no header height is React
state. **Without a shell** the bar renders both rows in-flow, sticky at `top: 0`, with `title` +
`icon` leading row 1. The height lands in the LAYOUT phase (`useLayoutEffect`, plain ref), so a cold
`#anchor` load clears the bar rather than scrolling under it. Each root carries
`data-basalt-page-bar` (`"standalone"` / `"shell"`) and `className`; scope container-gutter bleed
through the class, not through a global attribute selector — a seam under the bar is not the
consumer's to draw (see `docs/MANTINE-THEMING.md` § Chrome integration for the region-seam wiring).

Desktop: row 1 = lead · custom chips · ≤3 secondaries as `default` buttons + `More` · `sync` ·
`primary` filled, RIGHTMOST · then `globalActions` after a gap, all `ctl` (30px). Row 2 = `tabs` ·
filter pills · `filtersEnd` right-aligned, `wrap: nowrap`, overflow folds into `+N`.

Mobile: row 1 = breadcrumb · `primary` as an icon · kebab `Menu` holding every `mobile: 'more'`
action + `globalActions` marked `more` · ≤2 `globalActions` marked `bar`. Row 2: line 1 = `ViewTabs`
full-width (`Select` past three options); line 2 = first `FilterSet` pill inline · `Filters (n)`
pill opening a Drawer where every filter renders the SAME `sheet` form the aside's `panel` surface
does (§3) — a `PanelRow` per filter, label above, full-width control below · the aside's `Panel`
pill when claimed. `n` = `store.useActiveCount()`; a line exists only when its content is mounted
(C14).

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

| Component                        | Mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Removed            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `StatCard`                       | `label`→`title`; `menu`→`actions`; adds `icon`, `info`, `subtitle` (both forwarded to `WidgetHeader` — the method behind the glyph and the unit line, neither expressible in a `string` `value`), `sparklinePlacement?: 'bleed' \| 'right'` (reference: right); keeps `value/delta/deltaPeriod/sparkline/tone`                                                                                                                                                                                                     | `label`, `menu`    |
| `ChartCard`                      | `tooltip`→`info?`; `extra`→`actions`; adds `icon`, `value`, `delta`, `count`; header renders only when any of title/info/value/actions is set (ends linewatch's `''` sentinel, `compact.ts:61-69`)                                                                                                                                                                                                                                                                                                                 | `tooltip`, `extra` |
| `Section` _(new)_                | `WidgetHeaderProps` minus `tier` + `tabs?: ReactNode` + `collapsible?: boolean` + `persistKey?: string` + `defaultOpen?: boolean` (default `true`, respected only while nothing is persisted) + `summary?: ReactNode` (under the header, visible collapsed or not) + `id?: string` (anchor, `scrollMarginTop: var(--vx-space-sticky-header-clearance)` — breathing room only: an anchor scrolls inside `AppShell.Main` and BOTH the header and the page-bar band are regions outside that scrollport) + `children` | —                  |
| `SettingsSection` / `DangerZone` | `description`→`subtitle`; adds `actions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `description`      |
| `BasaltDataTable`                | adds `title`, `icon`, `subtitle`, `actions: ReactNode` (a plain slot — `ActionGroup`'s header semantics never reach a table); `count` always `table.getRowCount()`; `facets` render as `FilterPill`s inside a `FilterSet`; the four `w={220/200/180/110}` literals (`data-table.tsx:923-999`) go                                                                                                                                                                                                                   | `toolbarActions`   |

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
| `RangeFilter`       | `{ field: FieldHandle<RangeField<P, C>>; icon?: ReactNode; customPicker?: ComponentType<RangeCustomPickerProps>; label?: string /* heading + aria name, default 'Range' */ }`             | `field.range` — three URL params (`window`/`from`/`to`, renamable)                                                                                                                                                                                                                                                                                                                                                                                                           | sheet = panel: one `Select` (presets + a `Custom range…` row) revealing the injected picker                                                                                                                                                                 |
| `CompareFilter`     | `{ field: FieldHandle<EnumField<'none' \| 'previous' \| 'year'>>; label?: string }`                                                                                                       | `field.enum`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | sheet = panel: `PanelChoice` (`SegmentedControl` ≤3 options AND fit-checked, else `Select`)                                                                                                                                                                 |
| `SelectFilter`      | `{ field: FieldHandle<EnumField<T>> \| FieldHandle<StringField>; label: string; icon?: ReactNode; clearable?: boolean; options?: readonly FilterOption[] }`                               | `field.enum` / `field.string`; labels from `store.labels()`, or from `options` — a runtime catalogue that OVERRIDES `field.options` whole, and the reason a `StringField` handle (an id set no enum can close over) is legal at all: WITHOUT `options` it is a type error                                                                                                                                                                                                    | sheet = panel: `PanelChoice` (`SegmentedControl` ≤3 options AND fit-checked, else `Select`)                                                                                                                                                                 |
| `MultiSelectFilter` | `{ field: FieldHandle<MultiField<T>>; label: string; icon?: ReactNode; options?: readonly FilterOption[]; noun?: string; counts?: Record<string, number>; max?: number /* default 6 */ }` | `field.multi`; pill reads `All channels` / `3 channels` (`noun` sets the plural read, default the lowercased `label`); `options` overrides the rows at render — it relabels a closed set, never opens it                                                                                                                                                                                                                                                                     | sheet = panel: the facet list, folding past `max` behind `Show N more`                                                                                                                                                                                      |
| `NumberFilter`      | `{ field: FieldHandle<NumberField>; label: string; icon?: ReactNode; options?: readonly { value: number; label: string }[]; step?: number /* default `field.step` */ }`                   | `field.number`; WITH `options` it is the same radio body every enum filter renders (through `EnumFilter`'s `ChoiceHandle`) and the URL still holds a NUMBER; WITHOUT, a `ctl` `NumberInput` that applies on blur/Enter, never per keystroke. `min`/`max`/`int` come off the HANDLE (`NumberHandleExtras`), so the stepper stops at the field's limit and an `int` field refuses decimals; the codec's clamp stays the backstop for a value that did not come through the box | sheet = panel: with `options`, `PanelChoice`; without, the input as a `PanelRow`                                                                                                                                                                            |
| `SearchFilter`      | `{ field: FieldHandle<StringField>; placeholder?: string }`                                                                                                                               | `field.string` (`history: 'replace'`)                                                                                                                                                                                                                                                                                                                                                                                                                                        | sheet = panel: the input as a `PanelRow`                                                                                                                                                                                                                    |
| `ToggleFilter`      | `{ field: FieldHandle<BooleanField>; label: string }`                                                                                                                                     | `field.boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                              | sheet = panel: a `PanelRow` whose `Switch` rides the label line                                                                                                                                                                                             |
| `ViewTabs`          | `{ field: FieldHandle<EnumField<T>>; options?: readonly { value: T; label: string; only?: 'sm-up' \| 'sm-down' }[] }`                                                                     | `field.enum`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ≤3 options AND fit-checked: `SegmentedControl fullWidth`; more (or a fit failure) → `Select`; `only: 'sm-down'` absorbs argo's Train tab                                                                                                                    |
| `SyncButton`        | `{ syncing: boolean; lastCompletedAt?: number \| Date \| null; onSync: () => void; scope: 'page' \| 'global'; label?: string; error?: string }`                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `scope: 'page'` is labelled with the age inline above `sm` and icon-only below it; `scope: 'global'` is icon-only at EVERY width (the shell header shares 48px with the breadcrumb and row 1), age and error in the tooltip, `label` as the accessible name |
| `ActionGroup`       | `ActionGroupProps`                                                                                                                                                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | primary icon + kebab                                                                                                                                                                                                                                        |
| `ControlGroup`      | `{ children: ReactNode; gap?: 'none' \| 'tight' /* default 'none' */ }`                                                                                                                   | — (presentational; no `role`, no label — each child keeps its own accessible name)                                                                                                                                                                                                                                                                                                                                                                                           | unchanged — a joined set is one unit at every width; `ActionGroup` additionally joins ADJACENT icon-only entries on the mobile bar, where two 30px squares with a gap cost three boxes' worth of border                                                     |
| `OverflowMenu`      | `{ actions: readonly BarAction[] }`                                                                                                                                                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 44px rows                                                                                                                                                                                                                                                   |

**Surfaces.** A control has ONE form per mount and it is picked by the HOME, never by a prop or a
media query — `useFilterSurface()` reads it off the scope the home provides. `pill` is the default
and the `PageBar` row's (and the desktop `+N` fold's): a bordered chip whose text is the selected
value. `sheet` — the mobile `Filters (n)` drawer's, provided by `FilterSet` — and `panel` — a
`PageAside` body's, provided by `PageAside` (`docs/ASIDE-SPEC.md` §3) — resolve to the IDENTICAL
control body: past 1.28, **sheet = panel rows inside a Drawer**, not a separate list primitive.
Both render a two-line inspector ROW — label above at `xs`/550, control below at full width, a mono
readout right-aligned on the label line — because a chip in a 300px column, or across a bottom
drawer, reads as a stray button and a label beside its control leaves the control ~90px. `PanelRow`
is that row, and it IS a home (it wraps its slots in `CtlSlot`), so nothing inside it carries a
`size` (C5). `ToggleFilter` is the one panel row whose control rides the label line; `SliderControl`
is a row on every surface, having no pill form at all, and is not a filter (no registration, no
`Reset all`). Only the surrounding CHROME differs between the two: the sheet is a bottom `Drawer`
with a `Reset all` in its header and a `Filters (n)` census (`FilterSet`'s registry); the panel
surface owns no census at all — there is no `Filters (n)` and no `Reset all` in an aside.

Before 1.28 the sheet drew its own `SheetOptionList` — a `<fieldset>` of 44px rows with a hairline
between them, one per option — which did not scale: a filter with many options became a sheet as
tall as the set. `PanelChoice` folds the same set behind a `Select` past `PANEL_TRACK_MAX` (3)
options, and `MultiSelectFilter`'s facet list folds past `max` (default 6) behind `Show N more`,
both already true of the panel surface and now true of the sheet too. `SheetField`, `SheetOptionList`,
`SheetDisclosure`, `SheetRow` and `sheetRowClassNames` are gone (`MIGRATING.md`); a consumer test
that hooked a `role="radio"` `<fieldset>` list inside the sheet now finds a `PanelChoice`
(`SegmentedControl`, `role="radiogroup"`, ≤3 options; `Select` past that) instead.

**`PANEL_TRACK_MAX` is the cheap COUNT gate, not the whole law — a track past it is fit-checked
too.** Three options at three WORDS' worth of label is not the same claim as three at three
SENTENCES' worth: `CompareFilter`'s `Same period last year` clipped mid-word inside its own equal
third at exactly three options, no ellipsis reaching the screen. `panel-row.tsx`'s `useTrackFits`
(shared by `PanelChoice` and `ViewTabs`' phone form, so the two width gates cannot drift the way
they once did over `data-numeric`) measures the track's ROOT against its layout parent —
`root.offsetWidth <= layoutParent(root).clientWidth`, skipping every `display: contents` `CtlSlot`
wrapper a home mounts a control through — in a `useLayoutEffect` plus a `ResizeObserver` on both,
so an overflowing track is never actually painted (the synchronous `setState` lands before paint)
and a later resize (the aside folding, the same control mounting narrower inside the sheet) is
still caught. The check is three-valued (`fits` / `overflow` / `unknown`), because a `clientWidth`
of `0` is not evidence of overflow — it is evidence the ancestor chain has not settled yet (the
aside animates its width in while `PageAside` claims the region), and committing to `Select` on
that reading would be permanent (a one-way latch: the moment a CONFIDENT overflow is found, the
observer disconnects for the rest of that mount, so a detached root is never re-measured into a
false "fits again"). `SegmentedControl`'s own root additionally carries `min-width: max-content`
(`theme/index.ts`) so it never silently clips a label with no ellipsis in the first place — it
overflows a too-narrow ancestor instead, which is what makes it measurable at all; that floor is
itself scoped to `[data-full-width]` on `.control` (`segmented-control.module.css`), so a
NON-`fullWidth` track (two or three options in a header's `actions` slot) keeps the browser's
ordinary flex-item protection rather than being squeezed by `min-width: 0`.

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
`--vx-space-app-header-mobile-actions-height`. `stickyHeaderClearance` = `anchors.stackMd` on every
viewport — breathing room and nothing else: since `AppShell.Main` became the scrollport, BOTH the
app header and `PageBar` row 2's band are regions rendered outside it, so folding either in would
push every consumer that far down inside the content. Palantir's 20/24/30/40 lands as 20/24/30/42 because 42 is Mantine's
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

All AST rules live in `configs/oxlint-plugin.js` (`KNOWN_RULE_IDS`), each honouring `theme-allow` /
`theme-allow-file`. Full AST pattern, escape hatch and rationale for each id: the rule's own JSDoc
in that file — that is the home, not restated here. Slot ancestry (the `actions | filters | tabs |
sync | filtersEnd` attributes on `PageBar | Section | WidgetHeader | ChartCard | StatCard |
BasaltDataTable | SettingsSection | FilterSet`) and `RAW_FILTER_TAGS`/`BOUND_TAGS` are also read
from that file, never copied here. `SettingsRow.control` is the one form-row home exempt from the
filter/size rules.

| Rule id                             | Law     | Severity                                     |
| ----------------------------------- | ------- | -------------------------------------------- |
| `basalt/hand-rolled-filter`         | C1, C3  | error 1.26.0                                 |
| `basalt/control-outside-home`       | C1      | warn, `promote: '1.30.0'`                    |
| `basalt/bound-control-outside-home` | C1      | warn, `since: '1.28.0'`, `promote: '1.30.0'` |
| `basalt/control-size-literal`       | C5      | error 1.27.0                                 |
| `basalt/page-bar-budget`            | C6      | error 1.26.0                                 |
| `basalt/in-body-page-title`         | C8      | error 1.27.0 (both AST + text lanes)         |
| `basalt/responsive-twin`            | C9      | error 1.27.0                                 |
| `basalt/search-literal-link`        | C10     | error 1.27.0                                 |
| `basalt/use-search-from-literal`    | C10     | error 1.27.0                                 |
| `raw-scroll-container` (widened)    | C7      | error, no grace                              |
| `shadow-basalt-export` (extended)   | C8, C12 | permanent advisory                           |

Text-level twin (`src/guard`, PreToolUse hook lane): `in-body-page-title` promoted alongside its
plugin twin; `raw-selection-control` stays `warn`, `promote: '1.30.0'`. `bound-control-outside-home`
gets no text twin, deliberately — a bound control's identity needs the import graph a regex window
doesn't have.

Honest coverage: C1 as a cross-file law, hand-rolled section headings, and C11/C12 are `advisory`
in the generated header — claiming full coverage there is the false-`not guarded: —` failure mode
`basalt-batteries.md` also had (audit A5).

## 7. Agent layer

Six shipped rule files, one line + one link per doctrine, budgets in
`AGENT_RULE_TOTAL_BUDGET`/per-file ceilings (code, not prose — see `packages/basalt-ui/CLAUDE.md`
§ Shipped agent rules for the current numbers). Every rule header is a generated
`<!-- basalt:coverage -->` block from `SURFACES`, diffed by `check-agent-doc-drift.ts`, which also
fails CI over budget. The 13→6 file merge, the per-file content assignment, and the full A1-D16
ledger disposition are the historical execution record: `docs/archive/CONTROLS-SYNTHESIS.md`.
