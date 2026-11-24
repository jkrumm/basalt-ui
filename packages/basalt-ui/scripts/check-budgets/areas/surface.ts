/**
 * Area: surface — the public API's size. Value symbols outside `./charts`, barrel type exports,
 * published subpaths. (docs/V2-SPEC.md § 1: 140 public value symbols = 92 non-chart + § 9's chart
 * allowance of 48.) A ceiling falls to its target in the commit that lands the work.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHART_SUBPATH } from '../../surface-gates'
import { isEjectPath, subpathFamilies } from '../../export-keys'
import type { Manifest, Surface } from '../../surface-gates'
import { PKG_ROOT, Unmeasured, readGatedSurface, readManifest } from '../lib'
import type { Raises, RowDef } from '../lib'

/** Value exports of every subpath except `./charts`, which is budgeted apart. */
function nonChartSymbols(surface: Surface): number {
  return Object.entries(surface)
    .filter(([subpath]) => subpath !== CHART_SUBPATH)
    .reduce((sum, [, names]) => sum + names.length, 0)
}

/**
 * Non-chart barrel type exports: names in `export type { … }` / `export { type X }` clauses of each
 * non-chart subpath's source entry. Counted from source so it needs no build; unmeasured when an
 * entry is missing (a half-moved tree cannot vouch for the number).
 */
function barrelTypeExports(manifest: Manifest): number {
  let total = 0
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const js = typeof target === 'object' && target !== null ? target.import : undefined
    // A wildcard entry (`./ui/*`) has no single barrel to count types from, and `./shell` is the 2.x
    // shell barrel the root already re-exports (counted there) until the v3 shell swaps it.
    if (
      js === undefined ||
      js.includes('*') ||
      isEjectPath(subpath) ||
      subpath === CHART_SUBPATH ||
      subpath === './shell'
    ) {
      continue
    }
    const base = join(PKG_ROOT, 'src', js.replace(/^\.\/dist\//, '').replace(/\.js$/, ''))
    const entry = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(existsSync)
    if (entry === undefined) throw new Unmeasured(`no source entry for ${subpath}`)
    const source = readFileSync(entry, 'utf8')
    for (const m of source.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
      total += (m[1] ?? '').split(',').filter((name) => name.trim() !== '').length
    }
    for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
      total += (m[1] ?? '').split(',').filter((name) => /^\s*type\s/.test(name)).length
    }
  }
  return total
}

export const rows: readonly RowDef[] = [
  {
    id: 'non-chart-symbols',
    order: 10,
    label: 'public value symbols, non-chart (export-surface shards)',
    // 2.0 target 92.
    ceiling: 187, // v3 table-ga: `TableToolbar`, `DataTableBody`, `TablePager`, `BulkBar`, `tableCodec` from `./table` (the parts `DataTable` composes, for a bespoke layout, and the bridge `field.composite` needs; argo's warden issues table and its ledger take them when `BasaltDataTable` retires, Issue 1146); v3 shell-i9: `routerDefaults`, `navTarget` from `./router` (linewatch's createBasaltRouter wiring and typed links); v3 state-4a: `useFormDraft`, `toSubmitErrors`, `FormFooter` from `./controls` (shutterflow's useFormSubmit sites and FormActions footers, argo's run-edit draft); v3 ai-i4: `defineBlock`, `defineCatalog` from `./ai` and `expectCatalog` from `./testing` (epos's `show` tool mirrors its zod schemas by hand and its contract test checks them; the catalog is the one validator between model output and render; `expectCatalog` is tooling, never in an app bundle); v3 ctl-7: `FormField` from `./controls` (shutterflow's settings forms, 19 files on `FormRow`, carry label, description and error through it; the 2.x `FormGroup` stays until its migration row lands); v3 live-4: `useConnection`, `useFreshness` from `./data` and `ConnectionIndicator`, `RefreshButton` from `./page` (software-factory console connection.ts and linewatch each hand-build a freshness chip; argo's SyncButton becomes `RefreshButton`); v3 live-3: `bindInvalidation` from `./data` (software-factory console live.ts + policy.ts + debounce.ts hand-roll this policy today); v3 ai-i3: `partView` from `./ai` (software-factory console artifact-content.tsx renders model text through raw react-markdown today; epos chat replaces assistant-ui parts at G6); v3 ai-i7: `mdxComponents` from `./page` (jkrumm.com and the docs site render authored MDX through one component map); v3 state-3: `createSyncedState` from `./data` (argo gym and epos settings each hand-roll a synced preference store; one core serves both, spike S1); v3 qa-i4: `quality` from `./testing` (shutterflow's e2e specs run its axe, overflow and focus assertions over their own route list; tooling, never in an app bundle); v3 live-2: `createChannel` (root; software-factory console live.ts, shutterflow's hub, epos and rollhook streams) and `useNow` (console now.ts); v3 live-1: `liveQuery` from `./data` (argo gym.ts and its 14 other refetchInterval sites); v3 shell-i5c: `expectShellInvariants` from `./testing` (shutterflow's invariants.spec.ts is the port source; the G2 rb and obsidian apps wire it; tooling, never in an app bundle); v3 ctl-4b: `ControlHome` and `filterSlot` from `./controls` (every composite takes its controls through `filterSlot`; `ControlHome` hosts them in an aside, a sheet or a toolbar); v3 shell-i7a: `InnerNav`, `SplitPage` from `./page` (shutterflow's 11-section settings, argo m365-explorer; both hand-build the inner sidebar today); v3 table-t2a: `DataTable`, `useDataTable` from `./table` (linewatch outage-table.tsx and its status table, the G1 consumers; the 2.x `BasaltDataTable` stays until it retires); v3 cards-4: `KanbanCard` from `./cards` (software-factory console IssueCard and its flow columns, epos board block; the 2.x `Board` retires with the dashboard barrel); v3 ctl-4: `spec` and `ControlView` from `./controls` (the data every filter and card slot is built from, and the one view that draws the override cue); v3 page-core: `Page`, `PageBar`, `PageAside`, `Section` from `./page` (argo login.tsx, agents.tsx, astro-window site-map.tsx, strength-tracker.tsx; the 2.x root `PageBar`/`PageAside`/`Section` retire with the shell and dashboard barrels); v3 qa-i3: `settled`, `installDomShims`, `SLOTS` from `./testing` (shutterflow's e2e slot selectors and its component tests, which hand-roll ResizeObserver stubs; tooling, never in an app bundle); v3 state-5: `notify` (root) and `ToastHost` (`./page`), the toast queue and its host (argo emit sites, shutterflow notifyError calls); v3 ai-i2: `CodeBlock` from `./content` (rb knot-detail page), `Prose`, `Callout`, `Toc`, `ArticleLayout` from `./page` (rb, argo slots-list, obsidian note-view; the 2.x `./content` ones retire with the legacy barrel); v3 page-kit: `PageSummary`, `CardGrid`, `QueryState`, `EmptyState`, `OverlayHost`, `defineOverlays`, `useSizeClass` from `./page` (argo and shutterflow screens; the 2.x root and `./commands` ones retire with the dashboard barrel); v3 cards-3: `StatGroup`, `StatCell`, `DataPanel` from `./cards` (linewatch StatusBar's dense stat bar, argo's strips and its 19 non-chart panels; the 2.x `StatStrip` and `ChartCard` bodies retire with the dashboard barrel); v3 cards-2: `BarList`, `EventList` from `./cards` (the ranked list and activity feed shutterflow and linewatch hand-roll; the 2.x root ones retire with the dashboard barrel); v3 table-t1a: `col` from `./table` (linewatch outage-table.tsx, the G1 DataTable consumer; the 2.x `createColumnHelper` stays until BasaltDataTable retires); v3 ctl-2: `defineControls`, `field` from `./router` (linewatch dashboard-store.ts, argo window-stores.ts; the 2.x `./state` `field` stays until the state subpath retires); v3 qa-i2: `createFormat`, `useFormat` (rb + linewatch format.ts model modules; the 2.x `./format` functions stay until the format subpath retires); v3 cards-1: `StatCard` from `./cards` (linewatch StatusBar, console; the 2.x root `StatCard` retires with the dashboard barrel); v3 state-1b: root `externalField` (the 2.x `./state` one stays until the state subpath retires); W45: `Board` (argo warden board prototype, SPEC § 6.8); W44: `EventList` (argo narratives-section + home activity feed prototype, warden item timeline; rb journal; linewatch transition timeline; SPEC § 6.7); W37: `PageSummary` (argo components/upstream/page-summary.tsx, SPEC § 6.9; UPSTREAM Waves 24-26); 2.19 (W35): `StatusDot`, `StatusVerdict` (argo warden/agents status chips; status is a dot plus a word, D28); 2.18 (W34): `Meter` (argo reading card, warden dispatch budget, usage cache hit; rb course + ingest; linewatch link vs ceiling; ledger rows 143–145, 152, 158), `BarList` (argo top projects, weatherorb factor bars; rows 146, 160); 2.14: `date`/`time`/`dateTime`/`duration` (rb + linewatch format.ts, argo walking-pad; consumer-05); `bytes`/`compact`/`delta`/`defineFormat` (linewatch + rb format.ts, argo sparkline; maturation-v2 consumer-05); 2.13: `basaltRouterOptions` (weatherorb `getRouter()`, maturation-v2 provider-01); 2.6: `externalField` (argo timer-card.tsx, row 39); was 93 for `toAgentError` (row 18); v3 state-1 wiring: `createChannel` from `./data` (the root keeps it until the teardown; software-factory console live.ts); v3 peek: `Peek` from `./page` and `usePeek` from `./router` (software-factory console: its hand-built peek panel and click host, components/kit/peek.tsx and components/peek/host.tsx; a plain click on a record link opens it beside the list); v3 dock: `Dock` from `./page` (the console's Peek pin); v3 bench-board: `Board`, `applyMove` from `./cards` (software-factory console flow columns hand-build a board; the factory console needs drag between states; Issue 2855).
    measure: () => nonChartSymbols(readGatedSurface()),
  },
  {
    id: 'barrel-types',
    order: 30,
    label: 'barrel type exports, non-chart (src entries)',
    // 2.0 target 60.
    // 261 -> 264 (Issue 3209, site header menus): `SiteNavItem`, `SiteNavMenu`, `SiteMenuEntry` from `./static` (the section and image shapes stay inline: `SiteNavMenu['menu'][number]`, `SiteMenuEntry['image']`).
    // 158 -> 162 (Issue 3106, shell nav): `FavouriteEntry`, `FavouriteInput`, `FavouritesStore`, `FavouriteToggleProps` from `./page`.
    // 162 -> 163 (Issue 3109, record page parts): `RelationshipCardProps` from `./cards` (the item, fact and strength shapes stay inline: `RelationshipCardProps['facts']`).
    // 163 -> 166 (Issue 3103, bench-calendar): `ScheduleProps`, `ScheduleEvent`, `MiniMonthLike` from `./cards`.
    // 166 -> 168 (Issue 3105, runtime theme attributes): `AccentName` from `./tokens` and `AppearanceSwitcherProps` from `./controls`.
    // 168 -> 175 (Issue 3128, bench-chat-parts): `ComposerProps`, `ComposerMessage`, `ComposerStatus`, `Mention`, `ModelPickerProps`, `TraceStep`, `MessageAction` from `./ai`.
    // 181 -> 261 (Issue 3163, ga-exports): the contract and Props types of every entry and the port types on the root.
    // 175 -> 181 (Issue 3141, bench-inbox-mail): `MailItem`, `MailListProps`, `MailMessage`, `MailThreadProps` from `./cards` and `BulkBarAction`, `BulkBarProps` from `./table` (the sender, row action and attachment shapes stay inline: `MailItem['from']`).
    ceiling: 264, // Issue 3209: `SiteNavItem`, `SiteNavMenu`, `SiteMenuEntry` from `./static` (basalt-ui.com's nav data and its current-page marker are typed off them); v3 table-ga: 24 table contract types from `./table` (`TableState`, `TableRequest`, `View`, `ViewStore`, `Mode`, `Selection`, `DataTableInstance`, `TableEscape` and the rest apps type their own composites and stores with; Issue 1146); v3 ctl-7: `FormFieldProps`, `FormRowProps` from `./controls` (apps type a field wrapper and a repeated row off them); v3 live-4: `FreshnessOptions` from `./data`, `ConnectionIndicatorProps` and `RefreshButtonProps` from `./page` (apps type the `source` reader and wrap the views off them); v3 ai-i3: `MessagePart`, `PartViewOptions`, `ToolView` from `./ai` (apps type a message mapper and a tool renderer off them); v3 live-2: `Channel`, `ChannelOptions`, `ChannelState`, `Delivered`, `Envelope`, `Scheduler`, `Transport`, `Wire` (apps type a stream handler, a custom Transport such as the WebSocket adapter, and an injected clock off them); v3 live-1: `Freshness` from `./data` (apps type a shared cadence off it); v3 cards-4: `KanbanCardProps`, `ColumnRef`, `Move`, `CardChip` from `./cards` (apps type their column list and `onMove` handler off them); v3 ctl-4: `FilterSpec` from `./controls` (apps type a slot list off it); v3 state-5: `NotificationPayload` (apps type the payload they build before calling `notify`); v3 cards-3: `StatGroupProps`, `StatCellProps`, `DataPanelProps` from `./cards`; v3 cards-2: `BarListProps`, `EventListProps` from `./cards`; v3 ctl-2: `Controls`, `FieldHandle`, `SearchOf`, `RangeValue` from `./router` (linewatch types its dashboard query params and range window off them); v3 qa-i2: `BasaltMessages`, `CalendarDate`, `Format`, `Msg` (apps type their message overrides and zone-less dates off them); v3 cards-1: `StatCardProps` from `./cards`; W45: `BoardProps` (card and column shapes stay inline: `BoardProps['columns'][number]`); W44: `EventListProps` (argo/rb/linewatch read the item shape off `EventListProps['items'][number]`; it stays inline); W37: `PageSummaryProps`; 2.19 (W35): `MeterSegment`, `MeterZone`, `MeterTick` (argo types its zone/segment helpers off them, UPSTREAM § basalt friction); 2.19 (W35): `StatusDotProps`, `StatusVerdictProps` (the two status primitives); `StatStripCell`, `StatStripRow` (argo strip prototypes: garmin-health, agents, warden stat-strip.tsx; rows 147, 156); 2.18 (W34): `MeterProps`, `BarListProps` (the two W34 primitives; segment/item shapes stay inline); v3 state-1 wiring: `Transport`, `Wire` from `./data` (the channel types ship beside `createChannel`); v3 peek: `PeekProps` from `./page`, `PeekKinds`, `PeekState` from `./router` (software-factory console types its record kinds and the open record off them); v3 dock: `DockProps` from `./page`, `DockedState` from `./router`; v3 bench-board: `BoardProps` from `./cards` (column and card shapes stay inline: `BoardProps['columns'][number]`); Issue 2995 (settings grammar): `FormActionRowProps`, `FormConfirmRowProps`, `FormGroupRowProps`, `SettingsRowTone` from `./controls` and `SettingsLayoutProps` from `./page`; Issue 3039 (saved views as tabs): `TableViewsOptions`, `TableViewsResult`, `ViewParam` from `./table` (apps bind `?view=` to their route search and pass the slots off them); Issue 3104 (flow canvas): `FlowCanvasProps`, `FlowChecklistProps` from `./cards` (column, group, row, edge and issue shapes stay inline: `FlowCanvasProps['columns'][number]`); Issue 3103 (bench-calendar): `ScheduleProps`, `ScheduleEvent`, `MiniMonthLike` from `./cards` (apps type their event rows and pass `Calendar` as the rail's mini month off them); Issue 3128 (chat parts): `ComposerProps`, `ComposerMessage`, `ComposerStatus`, `Mention`, `ModelPickerProps`, `TraceStep`, `MessageAction` from `./ai` (apps type their send handler, the mentions they resolve, a model list and the steps another runtime reports off them; the add, file and feedback shapes stay inline: `ComposerProps['add']`)
    measure: () => barrelTypeExports(readManifest()),
  },
  {
    id: 'subpaths',
    order: 40,
    label: 'published subpaths (package.json exports, the eject paths as one ./core/*)',
    // 2.0 target 15.
    ceiling: 37, // the MDX island tags `./astro/mdx/Chart.astro` and `./astro/mdx/DataTable.astro` (raise row below); was 35: the site profile: `./static`, `./static.css`, `./starlight.css`, `./astro`, `./astro/BasaltFonts.astro` (raise row below); was 30: `./motion` (Issue 2529, raise row below); was 29: `./form` (raise row below); was 28: `./archify.css` (raise row below); was 27: v3 teardown-peers: the count after `./format` retired with src/format (the 2.x subpaths are gone; consumers: rollhook for CSS, lint, testing; linewatch for ui, page, cards, data, router)
    measure: () => subpathFamilies(readManifest().exports ?? {}).length,
  },
]

export const raises: Raises = {
  'non-chart-symbols': [
    {
      from: 185,
      to: 187,
      consumer:
        '`Board`, `applyMove` from `./cards`: software-factory console flow columns hand-build a board; the factory console needs drag between states (Issue 2855)',
      repo: 'software-factory',
    },
    {
      from: 184,
      to: 185,
      consumer:
        '`Dock` from `./page`: the software-factory console, the `Peek` consumer (Issue 1819), pins a peeked record into a docked panel that stays beside every page; rung 3 of that ladder (Issue 1958)',
      repo: 'software-factory',
    },
    {
      from: 182,
      to: 184,
      consumer:
        '`Peek` from `./page` and `usePeek` from `./router`: software-factory console components/kit/peek.tsx and components/peek/host.tsx hand-build the non-modal, URL-addressed record panel and its one click handler; every list there opens a record through it',
      repo: 'software-factory',
    },
    {
      from: 181,
      to: 182,
      consumer:
        "`BasaltProvider` from `./router`: the entry `init --profile app` writes mounts it, and shutterflow's `app` install imported it from the eject path `basalt-ui/core/provider`",
      repo: 'shutterflow',
    },
    {
      from: 180,
      to: 181,
      consumer:
        "`Facts` from `./page`: the dogfood cycle's issue inspector (apps/playground/src/cycle/dogfood-1/FlowOverview.tsx) hand-builds the same `dl` grid in its `PageAside`; every inspector body is a label and value list",
      repo: 'basalt-ui',
    },
    {
      from: 179,
      to: 180,
      consumer:
        '`createChannel` from `./data`: software-factory console src/lib/live.ts builds its push channel and binds it with `bindInvalidation`, which already ships on `./data`; the root export stays until the 2.x teardown',
      repo: 'software-factory',
    },
    {
      from: 174,
      to: 179,
      consumer:
        '`TableToolbar`, `DataTableBody`, `TablePager`, `BulkBar` and `tableCodec` from `./table`: linewatch lays its outage and status tables out through the parts `DataTable` composes (web/src/components/outage-table.tsx) and carries the table state through `field.composite(tableCodec(...))` (Issue 1146)',
      repo: 'linewatch',
    },
    {
      from: 172,
      to: 174,
      consumer:
        '`routerDefaults`, `navTarget` from `./router`: linewatch replaces `createBasaltRouter` (web/src/lib/router.ts) with plain TanStack options and a typed link adapter (docs/v3/concepts/shell-nav-router.md section 3.4)',
      repo: 'linewatch',
    },
    {
      from: 169,
      to: 172,
      consumer:
        '`defineBlock`, `defineCatalog` from `./ai` and `expectCatalog` from `./testing`: epos ports its `show` tool (stat, chart, table, list, board, callout and four more blocks) onto one catalog and keeps its schema contract test, which `expectCatalog` extends (docs/v3/concepts/ai-mdx.md section 6, stage 3)',
      repo: 'epos',
    },
    {
      from: 160,
      to: 161,
      consumer:
        '`bindInvalidation` from `./data`: software-factory console hand-rolls the push-to-refetch policy (src/lib/live.ts, policy.ts, debounce.ts) that this replaces (docs/v3/concepts/live-realtime.md section 3)',
      repo: 'software-factory',
    },
    {
      from: 159,
      to: 160,
      consumer:
        '`partView` from `./ai`: the software-factory console renders artifact text through raw react-markdown and epos rebuilds its chat parts at G6; the one exhaustive, untrusted-pinned renderer replaces both',
      repo: 'software-factory',
    },
    {
      from: 161,
      to: 165,
      consumer:
        "`useConnection`, `useFreshness` from `./data` and `ConnectionIndicator`, `RefreshButton` from `./page`: the software-factory console replaces its hand-rolled lib/connection.ts, and argo's root route swaps its SyncButton for `RefreshButton` fed by `useFreshness().button`",
      repo: 'software-factory',
    },
    {
      from: 158,
      to: 159,
      consumer:
        '`mdxComponents` from `./page`: jkrumm.com and the docs site render authored MDX with one component map that blocks `//h` links (docs/v3/concepts/ai-mdx.md section 4)',
      repo: 'jkrumm.com',
    },
    {
      from: 157,
      to: 158,
      consumer:
        '`createSyncedState` from `./data`: epos settings (four per-field preferences, no server rev) replaces its hand-rolled synced store; argo gym is the second fit (docs/v3/spikes/synced.md)',
      repo: 'epos',
    },
    {
      from: 156,
      to: 157,
      consumer:
        '`quality` from `./testing`: shutterflow runs its axe, overflow, focus-ring, focus-not-obscured and text-spacing assertions over its own route list in e2e/desktop/a11y',
      repo: 'shutterflow',
    },
    {
      from: 152,
      to: 153,
      consumer:
        '`expectShellInvariants` from `./testing`: shutterflow holds its shell to the same geometry rules in invariants.spec.ts, and the rb and obsidian G2 apps wire it into their tests',
      repo: 'shutterflow',
    },
    {
      from: 116,
      to: 117,
      consumer: '`col` from `./table`, the v3 kind column factory for the outage table',
      repo: 'linewatch',
    },
    {
      from: 110,
      to: 111,
      consumer: 'root `externalField`, the ControlHandle bridge for the shutterflow memory store',
      repo: 'shutterflow',
    },
    {
      from: 111,
      to: 112,
      consumer: '`StatCard` from `./cards`, the stat card anatomy linewatch StatusBar hand-rolls',
      repo: 'linewatch',
    },
    {
      from: 112,
      to: 114,
      consumer:
        '`createFormat` (rb format.ts model module) and `useFormat` (linewatch format helpers), the one Format that replaces their hand-rolled Intl calls',
      repo: 'rb',
    },
    {
      from: 114,
      to: 116,
      consumer:
        '`defineControls` and `field` from `./router`, the branded store that replaces the linewatch dashboard-store.ts `createSearchStore` store',
      repo: 'linewatch',
    },
    {
      from: 117,
      to: 119,
      consumer:
        '`BarList` and `EventList` from `./cards`, the ranked list and activity feed that shutterflow and linewatch each copy',
      repo: 'shutterflow',
    },
    {
      from: 119,
      to: 122,
      consumer:
        '`StatGroup`, `StatCell` and `DataPanel` from `./cards`: linewatch rebuilds its 753-line StatusBar on the strip, argo wraps 19 non-chart panels in the frame',
      repo: 'linewatch',
    },
    {
      from: 122,
      to: 129,
      consumer:
        'the page kit from `./page`: `PageSummary` (argo page-summary.tsx), `EmptyState` (12 shutterflow files, argo strength-tracker.tsx), `QueryState` (3 shutterflow files, argo m365-explorer), `useSizeClass` (2 shutterflow files), `CardGrid` (argo garmin-health, the `SimpleGrid type="container"` it replaces), `OverlayHost` and `defineOverlays` (shutterflow shell/overlays.tsx, argo lib/commands.tsx)',
      repo: 'shutterflow',
    },
    {
      from: 129,
      to: 134,
      consumer:
        '`CodeBlock` from `./content` and `Prose`, `Callout`, `Toc`, `ArticleLayout` from `./page`: rb knot-detail and course pages, the argo models slots list and the obsidian note view render them',
      repo: 'rb',
    },
    {
      from: 134,
      to: 136,
      consumer:
        '`notify` (root) and `ToastHost` (`./page`): argo emit sites and its root host, shutterflow notifyError calls',
      repo: 'shutterflow',
    },
    {
      from: 136,
      to: 139,
      consumer:
        '`settled`, `installDomShims` and `SLOTS` from `./testing`: shutterflow replaces its class-keyed e2e selectors with `SLOTS` and its hand-rolled DOM stubs with the kit',
      repo: 'shutterflow',
    },
    {
      from: 139,
      to: 143,
      consumer:
        'the page core from `./page`: `Page` and `PageAside` (shutterflow photos route: `Page fill area="photos"` and `PageAside dock="always"`), `PageBar` and `Section` (shutterflow settings and library screens, argo agents.tsx and strength-tracker.tsx); the 2.x shell and dashboard ones they replace',
      repo: 'shutterflow',
    },
    {
      from: 143,
      to: 145,
      consumer:
        '`spec` and `ControlView` from `./controls`: argo and shutterflow build every filter slot from `spec`, and `ControlView` is the one place the override cue is drawn',
      repo: 'shutterflow',
    },
    {
      from: 145,
      to: 146,
      consumer:
        '`KanbanCard` from `./cards`: the software-factory console builds its IssueCard on it, with the mandatory non-drag move path',
      repo: 'software-factory',
    },
    {
      from: 146,
      to: 148,
      consumer:
        '`DataTable` and `useDataTable` from `./table`: linewatch replaces the hand-rolled outage table and its status table (outage-table.tsx, table-card-swap.module.css and both minWidths go at G1)',
      repo: 'linewatch',
    },
    {
      from: 148,
      to: 150,
      consumer:
        "`InnerNav` and `SplitPage` from `./page`: shutterflow's 11-section settings and argo m365-explorer hand-build the inner sidebar; the pair gives it real links and a Back that walks sections",
      repo: 'shutterflow',
    },
    {
      from: 150,
      to: 152,
      consumer:
        '`filterSlot` and `ControlHome` from `./controls`: argo and shutterflow hand every composite its controls through `filterSlot`, and place the rest of them in a `ControlHome`',
      repo: 'shutterflow',
    },
    {
      from: 153,
      to: 154,
      consumer:
        "`liveQuery` from `./data`: linewatch's polled queries (web/src/lib/queries.ts) take a freshness class instead of a per-component refetchInterval",
      repo: 'linewatch',
    },
    {
      from: 154,
      to: 156,
      consumer:
        "`createChannel` and `useNow` from the root: the software-factory console replaces its hand-rolled live.ts and now.ts with them, and shutterflow's hub, epos and rollhook streams are the other SSE copies they remove",
      repo: 'software-factory',
    },
    {
      from: 165,
      to: 166,
      consumer:
        "`FormField` from `./controls`: shutterflow's settings forms (apps/desktop/src/features/settings/CamerasSection.tsx and 18 more files on FormRow) carry their label, description and error through it",
      repo: 'shutterflow',
    },
    {
      from: 166,
      to: 169,
      consumer:
        "`useFormDraft`, `toSubmitErrors` and `FormFooter` from `./controls`: shutterflow's 17 `useFormSubmit` calls and 13 `FormActions` footers (apps/desktop/src/features/settings/CamerasSection.tsx among them) and argo's run edit draft replace their hand-rolled submit lifecycle and draft with them",
      repo: 'shutterflow',
    },
  ],
  'barrel-types': [
    {
      from: 261,
      to: 264,
      consumer:
        '`SiteNavItem`, `SiteNavMenu` and `SiteMenuEntry` from `./static`: basalt-ui.com (apps/marketing/src/lib/site.ts) types its header items off them and walks the menu entries to mark the current page; the section and image shapes stay inline',
      repo: 'basalt-ui',
    },
    {
      from: 181,
      to: 261,
      consumer:
        'the exports map as an explicit list (plan row ga-exports, Issue 3163): every [type:X] the shipped rules cite is importable from a published entry (tests/types/rule-tags.type-test.ts compiles each), so the playground imports `DetailHost`, `IconComponent`, `FieldLike` and `DragLike` from the root and no app types a prop through `basalt-ui/core/*`; each entry exports its contract and Props types (shell, page, controls, content, ai, table, cards, data, router)',
      repo: 'basalt-ui',
    },
    {
      from: 175,
      to: 181,
      consumer:
        'inbox and mail parts (plan row bench-inbox-mail, Issue 3141): the mailbox block (packages/basalt-ui/blocks/mailbox) maps its conversations onto `MailItem` and `MailMessage`, wires `MailListProps` and `MailThreadProps`, and types its bulk actions off `BulkBarAction` and `BulkBarProps`',
      repo: 'basalt-ui',
    },
    {
      from: 168,
      to: 175,
      consumer:
        'chat parts on `./ai` (plan row bench-chat-parts, Issue 3128): the assistant block (packages/basalt-ui/blocks/assistant) types its send handler, mentions, model list and actions off `ComposerProps`, `ComposerMessage`, `ComposerStatus`, `Mention`, `ModelPickerProps`, `TraceStep` and `MessageAction`',
      repo: 'basalt-ui',
    },
    {
      from: 166,
      to: 168,
      consumer:
        'runtime theme attributes (Issue 3105): an app types the accents it ships (AccentName, the list it passes the switcher and its tokens:css --accents) and wraps the appearance switcher (AppearanceSwitcherProps)',
      repo: 'basalt-ui',
    },
    {
      from: 163,
      to: 166,
      consumer:
        "`ScheduleProps`, `ScheduleEvent`, `MiniMonthLike` from `./cards`: the owner's 2026-11-21 benchmark found the calendar family absent (plan row bench-calendar, Issue 3103); apps type their event rows and the rail's mini month off them, and the playground's reference schedule does",
      repo: 'basalt-ui',
    },
    {
      from: 162,
      to: 163,
      consumer:
        'relationship cards (plan row bench-record-parts, Issue 3109): a record page types the cards it builds from a list of linked records off `RelationshipCardProps`',
      repo: 'basalt-ui',
    },
    {
      from: 158,
      to: 162,
      consumer:
        'the playground peek layer and supplier page type a favourite (`FavouriteInput`) and an app that keeps favourites on a server implements `FavouritesStore` (Issue 3106)',
      repo: 'basalt-ui',
    },
    {
      from: 156,
      to: 158,
      consumer:
        '`FlowCanvasProps`, `FlowChecklistProps` from `./cards` (Issue 3104): the software-factory console chain graph, on @xyflow/react and dagre today, types its columns, edges and issues off them when it moves to `FlowCanvas`',
      repo: 'software-factory',
    },
    {
      from: 153,
      to: 156,
      consumer:
        'saved views as tabs (Issue 3039): a list page binds ?view= to its route search (ViewParam) and passes the tabs, settings and panel slots (TableViewsOptions, TableViewsResult)',
      repo: 'basalt-ui',
    },
    {
      from: 148,
      to: 153,
      consumer:
        '`FormActionRowProps`, `FormConfirmRowProps`, `FormGroupRowProps`, `SettingsRowTone` and `SettingsLayoutProps` (plan row bench-form-rows, Issue 2995): apps type a wrapper of a settings row off them',
      repo: 'basalt-ui',
    },
    {
      from: 144,
      to: 147,
      consumer:
        '`WizardDialogProps`, `WizardForm` and `WizardStep` from `./controls`: apps type their step list and the form they hand `WizardDialog` off them',
      repo: 'basalt-ui',
    },
    {
      from: 147,
      to: 148,
      consumer:
        "`BoardProps` from `./cards`: software-factory console types its flow board's props off it; the column and card shapes stay inline (Issue 2855)",
      repo: 'software-factory',
    },
    {
      from: 140,
      to: 144,
      consumer:
        "`SiteAction`, `SiteQuestion`, `SiteComparisonColumn` and `SiteComparisonRow` from `./static`: free-planning-poker's Astro landing and versus pages type their data files off them, and emit FAQPage JSON-LD from the same `SiteQuestion` array the question list renders",
      repo: 'free-planning-poker',
    },
    {
      from: 138,
      to: 140,
      consumer:
        '`DockProps` from `./page` and `DockedState` from `./router`: the software-factory console types its docked record and the panel it hands `Dock` off them',
      repo: 'software-factory',
    },
    {
      from: 135,
      to: 138,
      consumer:
        '`PeekProps` from `./page`, `PeekKinds` and `PeekState` from `./router`: the software-factory console types its record-kind map and the open record it hands `Peek` off them',
      repo: 'software-factory',
    },
    {
      from: 133,
      to: 135,
      consumer:
        '`Transport`, `Wire` from `./data`: the console types its channel transport next to `createChannel`',
      repo: 'software-factory',
    },
    {
      from: 109,
      to: 133,
      consumer:
        'the table contract types from `./table` (`TableState`, `TableRequest`, `View`, `ViewStore`, `Mode`, `Selection`, `DataTableInstance`, `TableEscape`, `UseDataTable` and the rest): linewatch types its table composites and its saved-view store off them (web/src/components/outage-table.tsx, Issue 1146)',
      repo: 'linewatch',
    },
    {
      from: 101,
      to: 104,
      consumer:
        '`MessagePart`, `PartViewOptions`, `ToolView` from `./ai`: the software-factory console types its message mapper and its tool renderers off them',
      repo: 'software-factory',
    },
    {
      from: 104,
      to: 107,
      consumer:
        '`FreshnessOptions`, `ConnectionIndicatorProps` and `RefreshButtonProps`: apps type the `source` reader of `useFreshness` and wrap the two views off them',
      repo: 'software-factory',
    },
    {
      from: 72,
      to: 73,
      consumer: '`StatCardProps` from `./cards`, read by linewatch to type its status cells',
      repo: 'linewatch',
    },
    {
      from: 73,
      to: 77,
      consumer:
        '`Format`, `Msg`, `BasaltMessages`, `CalendarDate`: rb and linewatch type their format modules, message packs and zone-less dates off them',
      repo: 'rb',
    },
    {
      from: 77,
      to: 81,
      consumer:
        '`Controls`, `FieldHandle`, `SearchOf`, `RangeValue`: linewatch types its dashboard query params and range window off them',
      repo: 'linewatch',
    },
    {
      from: 81,
      to: 83,
      consumer:
        '`BarListProps` and `EventListProps` from `./cards`: shutterflow types its list rows and event items off them',
      repo: 'shutterflow',
    },
    {
      from: 83,
      to: 86,
      consumer:
        '`StatGroupProps`, `StatCellProps` and `DataPanelProps` from `./cards`: linewatch types its status bar cells off them',
      repo: 'linewatch',
    },
    {
      from: 86,
      to: 87,
      consumer:
        '`NotificationPayload`, read by apps to type the payload they build before `notify`',
      repo: 'shutterflow',
    },
    {
      from: 87,
      to: 88,
      consumer:
        '`FilterSpec` from `./controls`, read by apps to type a list of specs before `filterSlot`',
      repo: 'shutterflow',
    },
    {
      from: 88,
      to: 92,
      consumer:
        '`KanbanCardProps`, `ColumnRef`, `Move` and `CardChip` from `./cards`: the console types its columns and its `onMove` handler off them',
      repo: 'software-factory',
    },
    {
      from: 92,
      to: 93,
      consumer:
        '`Freshness` from `./data`: linewatch types a shared cadence off it in web/src/lib/queries.ts',
      repo: 'linewatch',
    },
    {
      from: 93,
      to: 101,
      consumer:
        "`Channel`, `Delivered`, `ChannelState` and the `Transport` seam types, read by the console's live wiring and by any app that writes a Transport",
      repo: 'software-factory',
    },
    {
      from: 107,
      to: 109,
      consumer:
        "`FormFieldProps` and `FormRowProps` from `./controls`: shutterflow's settings sections (CamerasSection and the forms around it) wrap `FormField` and type a repeated `FormRow` off them",
      repo: 'shutterflow',
    },
  ],
  subpaths: [
    {
      from: 35,
      to: 37,
      consumer:
        'the MDX island tags: basalt-ui.com (apps/marketing) renders `/guides/islands-in-mdx` with `./astro/mdx/Chart.astro` and `./astro/mdx/DataTable.astro`, each an `.astro` wrapper because a `client:` directive cannot sit on a component an MDX map names (Issue 2568); FPP and the other content sites copy the same wiring',
      repo: 'basalt-ui',
    },
    {
      from: 30,
      to: 35,
      consumer:
        'the site profile: basalt-ui.com (apps/marketing) renders every page from `./static` parts on Astro through the `./astro` integration and its `./astro/BasaltFonts.astro` head component, imports `./static.css` as its one sheet and themes its Starlight docs with `./starlight.css` (Issue 2531); FPP and the other content sites copy the same wiring',
      repo: 'basalt-ui',
    },
    {
      from: 29,
      to: 30,
      consumer:
        '`./motion` (Issue 2529): useMotionPreset and motionPreset need the `motion` peer, so they cannot sit in the peer-free `./tokens`; free-planning-poker v9 builds its room table on them',
      repo: 'free-planning-poker',
    },
    {
      from: 28,
      to: 29,
      consumer:
        '`./form` (`useAppForm`, `withForm` on `@tanstack/react-form`, an optional peer the barrel rule keeps out of `./controls`): the playground forms move to it (apps/playground/src/routes/kit/forms), and FPP takes it for its three forms (owner note of 2026-11-20 on Issue 2525)',
      repo: 'basalt-ui',
    },
    {
      from: 27,
      to: 28,
      consumer:
        "`./archify.css`: the software-factory guide (docs/guide/, issue_1797) embeds archify SVGs inline and themes them through `data-preset='basalt'`; the one generated block maps archify's 32 variables to the tokens",
      repo: 'software-factory',
    },
    {
      from: 32,
      to: 33,
      consumer:
        '`./table.css`: linewatch imports the table tier sheet beside `./table` (web/src/components/outage-table.tsx), the CSS entry of an app that renders `DataTable` (Issue 1146)',
      repo: 'linewatch',
    },
    {
      from: 31,
      to: 32,
      consumer:
        '`./core/*`, the modules an ejected seed imports (`basalt-ui/core/cn`, `/format`, `/ports`); rb and obsidian are the G2 eject pilots',
      repo: 'rb',
    },
  ],
}
