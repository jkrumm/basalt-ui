/**
 * Area: surface — the public API's size. Value symbols outside `./charts`, barrel type exports,
 * published subpaths. (docs/V2-SPEC.md § 1: 140 public value symbols = 92 non-chart + § 9's chart
 * allowance of 48.) A ceiling falls to its target in the commit that lands the work.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHART_SUBPATH } from '../../surface-gates'
import type { Manifest, Surface } from '../../surface-gates'
import { PKG_ROOT, Unmeasured, readManifest, readSurface } from '../lib'
import type { Raise, RowDef } from '../lib'

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
    ceiling: 157, // v3 qa-i4: `quality` from `./testing` (shutterflow's e2e specs run its axe, overflow and focus assertions over their own route list; tooling, never in an app bundle); v3 live-2: `createChannel` (root; software-factory console live.ts, shutterflow's hub, epos and rollhook streams) and `useNow` (console now.ts); v3 live-1: `liveQuery` from `./data` (argo gym.ts and its 14 other refetchInterval sites); v3 shell-i5c: `expectShellInvariants` from `./testing` (shutterflow's invariants.spec.ts is the port source; the G2 rb and obsidian apps wire it; tooling, never in an app bundle); v3 ctl-4b: `ControlHome` and `filterSlot` from `./controls` (every composite takes its controls through `filterSlot`; `ControlHome` hosts them in an aside, a sheet or a toolbar); v3 shell-i7a: `InnerNav`, `SplitPage` from `./page` (shutterflow's 11-section settings, argo m365-explorer; both hand-build the inner sidebar today); v3 table-t2a: `DataTable`, `useDataTable` from `./table` (linewatch outage-table.tsx and its status table, the G1 consumers; the 2.x `BasaltDataTable` stays until it retires); v3 cards-4: `KanbanCard` from `./cards` (software-factory console IssueCard and its flow columns, epos board block; the 2.x `Board` retires with the dashboard barrel); v3 ctl-4: `spec` and `ControlView` from `./controls` (the data every filter and card slot is built from, and the one view that draws the override cue); v3 page-core: `Page`, `PageBar`, `PageAside`, `Section` from `./page` (argo login.tsx, agents.tsx, astro-window site-map.tsx, strength-tracker.tsx; the 2.x root `PageBar`/`PageAside`/`Section` retire with the shell and dashboard barrels); v3 qa-i3: `settled`, `installDomShims`, `SLOTS` from `./testing` (shutterflow's e2e slot selectors and its component tests, which hand-roll ResizeObserver stubs; tooling, never in an app bundle); v3 state-5: `notify` (root) and `ToastHost` (`./page`), the toast queue and its host (argo emit sites, shutterflow notifyError calls); v3 ai-i2: `CodeBlock` from `./content` (rb knot-detail page), `Prose`, `Callout`, `Toc`, `ArticleLayout` from `./page` (rb, argo slots-list, obsidian note-view; the 2.x `./content` ones retire with the legacy barrel); v3 page-kit: `PageSummary`, `CardGrid`, `QueryState`, `EmptyState`, `OverlayHost`, `defineOverlays`, `useSizeClass` from `./page` (argo and shutterflow screens; the 2.x root and `./commands` ones retire with the dashboard barrel); v3 cards-3: `StatGroup`, `StatCell`, `DataPanel` from `./cards` (linewatch StatusBar's dense stat bar, argo's strips and its 19 non-chart panels; the 2.x `StatStrip` and `ChartCard` bodies retire with the dashboard barrel); v3 cards-2: `BarList`, `EventList` from `./cards` (the ranked list and activity feed shutterflow and linewatch hand-roll; the 2.x root ones retire with the dashboard barrel); v3 table-t1a: `col` from `./table` (linewatch outage-table.tsx, the G1 DataTable consumer; the 2.x `createColumnHelper` stays until BasaltDataTable retires); v3 ctl-2: `defineControls`, `field` from `./router` (linewatch dashboard-store.ts, argo window-stores.ts; the 2.x `./state` `field` stays until the state subpath retires); v3 qa-i2: `createFormat`, `useFormat` (rb + linewatch format.ts model modules; the 2.x `./format` functions stay until the format subpath retires); v3 cards-1: `StatCard` from `./cards` (linewatch StatusBar, console; the 2.x root `StatCard` retires with the dashboard barrel); v3 state-1b: root `externalField` (the 2.x `./state` one stays until the state subpath retires); W45: `Board` (argo warden board prototype, SPEC § 6.8); W44: `EventList` (argo narratives-section + home activity feed prototype, warden item timeline; rb journal; linewatch transition timeline; SPEC § 6.7); W37: `PageSummary` (argo components/upstream/page-summary.tsx, SPEC § 6.9; UPSTREAM Waves 24-26); 2.19 (W35): `StatusDot`, `StatusVerdict` (argo warden/agents status chips; status is a dot plus a word, D28); 2.18 (W34): `Meter` (argo reading card, warden dispatch budget, usage cache hit; rb course + ingest; linewatch link vs ceiling; ledger rows 143–145, 152, 158), `BarList` (argo top projects, weatherorb factor bars; rows 146, 160); 2.14: `date`/`time`/`dateTime`/`duration` (rb + linewatch format.ts, argo walking-pad; consumer-05); `bytes`/`compact`/`delta`/`defineFormat` (linewatch + rb format.ts, argo sparkline; maturation-v2 consumer-05); 2.13: `basaltRouterOptions` (weatherorb `getRouter()`, maturation-v2 provider-01); 2.6: `externalField` (argo timer-card.tsx, row 39); was 93 for `toAgentError` (row 18)
    measure: () => nonChartSymbols(readSurface()),
  },
  {
    id: 'barrel-types',
    order: 30,
    label: 'barrel type exports, non-chart (src entries)',
    // 2.0 target 60.
    ceiling: 101, // v3 live-2: `Channel`, `ChannelOptions`, `ChannelState`, `Delivered`, `Envelope`, `Scheduler`, `Transport`, `Wire` (apps type a stream handler, a custom Transport such as the WebSocket adapter, and an injected clock off them); v3 live-1: `Freshness` from `./data` (apps type a shared cadence off it); v3 cards-4: `KanbanCardProps`, `ColumnRef`, `Move`, `CardChip` from `./cards` (apps type their column list and `onMove` handler off them); v3 ctl-4: `FilterSpec` from `./controls` (apps type a slot list off it); v3 state-5: `NotificationPayload` (apps type the payload they build before calling `notify`); v3 cards-3: `StatGroupProps`, `StatCellProps`, `DataPanelProps` from `./cards`; v3 cards-2: `BarListProps`, `EventListProps` from `./cards`; v3 ctl-2: `Controls`, `FieldHandle`, `SearchOf`, `RangeValue` from `./router` (linewatch types its dashboard query params and range window off them); v3 qa-i2: `BasaltMessages`, `CalendarDate`, `Format`, `Msg` (apps type their message overrides and zone-less dates off them); v3 cards-1: `StatCardProps` from `./cards`; W45: `BoardProps` (card and column shapes stay inline: `BoardProps['columns'][number]`); W44: `EventListProps` (argo/rb/linewatch read the item shape off `EventListProps['items'][number]`; it stays inline); W37: `PageSummaryProps`; 2.19 (W35): `MeterSegment`, `MeterZone`, `MeterTick` (argo types its zone/segment helpers off them, UPSTREAM § basalt friction); 2.19 (W35): `StatusDotProps`, `StatusVerdictProps` (the two status primitives); `StatStripCell`, `StatStripRow` (argo strip prototypes: garmin-health, agents, warden stat-strip.tsx; rows 147, 156); 2.18 (W34): `MeterProps`, `BarListProps` (the two W34 primitives; segment/item shapes stay inline)
    measure: () => barrelTypeExports(readManifest()),
  },
  {
    id: 'subpaths',
    order: 40,
    label: 'published subpaths (package.json exports)',
    // 2.0 target 15.
    ceiling: 32, // v3 eject: `./core/*`, the module paths an ejected seed imports (Issue 849); v3 skeleton: 15 (2.x) + 16 additive entries (see docs/v3/ARCHITECTURE.md § 3); consumers: rollhook for CSS, lint, testing; linewatch for ui, page, cards, data, router; ratchets down as 2.x subpaths retire
    measure: () => Object.keys(readManifest().exports ?? {}).length,
  },
]

export const raises: readonly Raise[] = [
  {
    ceiling: 'non-chart-symbols',
    from: 156,
    to: 157,
    consumer:
      '`quality` from `./testing`: shutterflow runs its axe, overflow, focus-ring, focus-not-obscured and text-spacing assertions over its own route list in e2e/desktop/a11y',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 152,
    to: 153,
    consumer:
      '`expectShellInvariants` from `./testing`: shutterflow holds its shell to the same geometry rules in invariants.spec.ts, and the rb and obsidian G2 apps wire it into their tests',
    repo: 'shutterflow',
  },
  {
    ceiling: 'subpaths',
    from: 31,
    to: 32,
    consumer:
      '`./core/*`, the modules an ejected seed imports (`basalt-ui/core/cn`, `/format`, `/ports`); rb and obsidian are the G2 eject pilots',
    repo: 'rb',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 116,
    to: 117,
    consumer: '`col` from `./table`, the v3 kind column factory for the outage table',
    repo: 'linewatch',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 110,
    to: 111,
    consumer: 'root `externalField`, the ControlHandle bridge for the shutterflow memory store',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 111,
    to: 112,
    consumer: '`StatCard` from `./cards`, the stat card anatomy linewatch StatusBar hand-rolls',
    repo: 'linewatch',
  },
  {
    ceiling: 'barrel-types',
    from: 72,
    to: 73,
    consumer: '`StatCardProps` from `./cards`, read by linewatch to type its status cells',
    repo: 'linewatch',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 112,
    to: 114,
    consumer:
      '`createFormat` (rb format.ts model module) and `useFormat` (linewatch format helpers), the one Format that replaces their hand-rolled Intl calls',
    repo: 'rb',
  },
  {
    ceiling: 'barrel-types',
    from: 73,
    to: 77,
    consumer:
      '`Format`, `Msg`, `BasaltMessages`, `CalendarDate`: rb and linewatch type their format modules, message packs and zone-less dates off them',
    repo: 'rb',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 114,
    to: 116,
    consumer:
      '`defineControls` and `field` from `./router`, the branded store that replaces the linewatch dashboard-store.ts `createSearchStore` store',
    repo: 'linewatch',
  },
  {
    ceiling: 'barrel-types',
    from: 77,
    to: 81,
    consumer:
      '`Controls`, `FieldHandle`, `SearchOf`, `RangeValue`: linewatch types its dashboard query params and range window off them',
    repo: 'linewatch',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 117,
    to: 119,
    consumer:
      '`BarList` and `EventList` from `./cards`, the ranked list and activity feed that shutterflow and linewatch each copy',
    repo: 'shutterflow',
  },

  {
    ceiling: 'barrel-types',
    from: 81,
    to: 83,
    consumer:
      '`BarListProps` and `EventListProps` from `./cards`: shutterflow types its list rows and event items off them',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 119,
    to: 122,
    consumer:
      '`StatGroup`, `StatCell` and `DataPanel` from `./cards`: linewatch rebuilds its 753-line StatusBar on the strip, argo wraps 19 non-chart panels in the frame',
    repo: 'linewatch',
  },
  {
    ceiling: 'barrel-types',
    from: 83,
    to: 86,
    consumer:
      '`StatGroupProps`, `StatCellProps` and `DataPanelProps` from `./cards`: linewatch types its status bar cells off them',
    repo: 'linewatch',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 122,
    to: 129,
    consumer:
      'the page kit from `./page`: `PageSummary` (argo page-summary.tsx), `EmptyState` (12 shutterflow files, argo strength-tracker.tsx), `QueryState` (3 shutterflow files, argo m365-explorer), `useSizeClass` (2 shutterflow files), `CardGrid` (argo garmin-health, the `SimpleGrid type="container"` it replaces), `OverlayHost` and `defineOverlays` (shutterflow shell/overlays.tsx, argo lib/commands.tsx)',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 129,
    to: 134,
    consumer:
      '`CodeBlock` from `./content` and `Prose`, `Callout`, `Toc`, `ArticleLayout` from `./page`: rb knot-detail and course pages, the argo models slots list and the obsidian note view render them',
    repo: 'rb',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 134,
    to: 136,
    consumer:
      '`notify` (root) and `ToastHost` (`./page`): argo emit sites and its root host, shutterflow notifyError calls',
    repo: 'shutterflow',
  },
  {
    ceiling: 'barrel-types',
    from: 86,
    to: 87,
    consumer: '`NotificationPayload`, read by apps to type the payload they build before `notify`',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 136,
    to: 139,
    consumer:
      '`settled`, `installDomShims` and `SLOTS` from `./testing`: shutterflow replaces its Mantine-keyed e2e selectors with `SLOTS` and its hand-rolled DOM stubs with the kit',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 139,
    to: 143,
    consumer:
      'the page core from `./page`: `Page` and `PageAside` (shutterflow photos route: `Page fill area="photos"` and `PageAside dock="always"`), `PageBar` and `Section` (shutterflow settings and library screens, argo agents.tsx and strength-tracker.tsx); the 2.x shell and dashboard ones they replace',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 143,
    to: 145,
    consumer:
      '`spec` and `ControlView` from `./controls`: argo and shutterflow build every filter slot from `spec`, and `ControlView` is the one place the override cue is drawn',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 145,
    to: 146,
    consumer:
      '`KanbanCard` from `./cards`: the software-factory console builds its IssueCard on it, with the mandatory non-drag move path',
    repo: 'software-factory',
  },
  {
    ceiling: 'barrel-types',
    from: 87,
    to: 88,
    consumer:
      '`FilterSpec` from `./controls`, read by apps to type a list of specs before `filterSlot`',
    repo: 'shutterflow',
  },
  {
    ceiling: 'barrel-types',
    from: 88,
    to: 92,
    consumer:
      '`KanbanCardProps`, `ColumnRef`, `Move` and `CardChip` from `./cards`: the console types its columns and its `onMove` handler off them',
    repo: 'software-factory',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 146,
    to: 148,
    consumer:
      '`DataTable` and `useDataTable` from `./table`: linewatch replaces the hand-rolled outage table and its status table (outage-table.tsx, table-card-swap.module.css and both minWidths go at G1)',
    repo: 'linewatch',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 148,
    to: 150,
    consumer:
      "`InnerNav` and `SplitPage` from `./page`: shutterflow's 11-section settings and argo m365-explorer hand-build the inner sidebar; the pair gives it real links and a Back that walks sections",
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 150,
    to: 152,
    consumer:
      '`filterSlot` and `ControlHome` from `./controls`: argo and shutterflow hand every composite its controls through `filterSlot`, and place the rest of them in a `ControlHome`',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 153,
    to: 154,
    consumer:
      "`liveQuery` from `./data`: linewatch's polled queries (web/src/lib/queries.ts) take a freshness class instead of a per-component refetchInterval",
    repo: 'linewatch',
  },
  {
    ceiling: 'barrel-types',
    from: 92,
    to: 93,
    consumer:
      '`Freshness` from `./data`: linewatch types a shared cadence off it in web/src/lib/queries.ts',
    repo: 'linewatch',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 154,
    to: 156,
    consumer:
      "`createChannel` and `useNow` from the root: the software-factory console replaces its hand-rolled live.ts and now.ts with them, and shutterflow's hub, epos and rollhook streams are the other SSE copies they remove",
    repo: 'software-factory',
  },
  {
    ceiling: 'barrel-types',
    from: 93,
    to: 101,
    consumer:
      "`Channel`, `Delivered`, `ChannelState` and the `Transport` seam types, read by the console's live wiring and by any app that writes a Transport",
    repo: 'software-factory',
  },
]
