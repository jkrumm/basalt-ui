/**
 * The prop map — the actual deliverable of the isomorphic pass.
 *
 * `harness.ts` FINDS the components; this file is what makes them renderable. Four tables:
 *
 * - `MINIMAL_PROPS` — the smallest prop set that gets a component past its first required read.
 *   Deliberately minimal: the point is to exercise the mount path, not to compose a realistic
 *   screen. A component ABSENT from the table renders with `{}`, and that is the interesting case
 *   — an export that needs nothing is an export a consumer cannot hold wrong.
 * - `SVG_HOSTED` — components that render SVG children and must be mounted inside an `<svg>`.
 *   Without it React logs `The tag <rect> is unrecognized in this browser`, which is a harness
 *   artifact, not a defect.
 * - `SKIP` — components that cannot be smoke-rendered here, each with its reason. A skip is a
 *   finding, not a pass; `.claude/maturation/isomorphic-findings.md` lists them.
 * - `EXPECTED_DEFECTS` — components that render but VIOLATE one of the assertions today. Each
 *   entry names the finding it waives, so the suite stays green while the defect stays visible.
 *   Deleting an entry is how a fix gets proven.
 *
 * The bound-control fixtures use `createLocalStore`, never `createSearchStore`: the field
 * vocabulary is identical and the local store needs no router, so every `FieldHandle`-bound filter
 * renders here without the harness having to host a `RouterProvider`.
 */
import type { ReactNode } from 'react'
import { createLocalStore, field } from '../../src/state'
import type { ChartSeries } from '../../src/charts'
import { scaleBand, scaleLinear, scalePoint } from '../../src/charts'
import { DateRangePicker } from '../../src/controls-dates'
import { createBasaltQueryClient } from '../../src/query'
import { createThreadsStore } from '../../src/agent'

/* ----------------------------------------------------------------- fixtures */

type Row = { date: string; a: number; b: number }

const ROWS: Row[] = [
  { date: '2026-08-01', a: 10, b: 4 },
  { date: '2026-08-02', a: 40, b: 6 },
  { date: '2026-08-03', a: 25, b: 5 },
]

const KEYS = ROWS.map((d) => d.date)
const getX = (d: Row): string => d.date

const SERIES: ChartSeries<Row>[] = [
  { key: 'a', label: 'A', color: '#4c7cf3', mark: 'line', getValue: (d) => d.a },
  { key: 'b', label: 'B', color: '#e0803a', mark: 'line', getValue: (d) => d.b },
]

const bandScale = scaleBand<string>({ domain: KEYS, range: [0, 200] })
const pointScale = scalePoint<string>({ domain: KEYS, range: [0, 200] })
const linearScale = scaleLinear<number>({ domain: [0, 50], range: [100, 0] })

const num = (v: number): string => String(v)

const store = createLocalStore({
  key: 'isomorphic-smoke',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    compare: field.enum(['none', 'previous', 'year'] as const, 'none'),
    channels: field.multi(['web', 'email'], []),
    range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
    errorsOnly: field.boolean(false),
    q: field.string(),
    nights: field.number({ fallback: 2, min: 1, max: 14, int: true }),
  },
})

const OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
]
const MULTI_OPTIONS = [
  { value: 'web', label: 'web' },
  { value: 'email', label: 'email' },
]

const TEXT: ReactNode = 'body'

/** A settled, read, outcome-carrying thread — the agent-chat chrome's happy path. */
const THREAD = {
  id: 'iso-thread',
  messages: [],
  outcome: { title: 'Iso', summary: '', status: 'done' },
  status: 'done',
  read: true,
  createdAt: 0,
  updatedAt: 0,
}

const useIsoThreads = createThreadsStore({ key: 'isomorphic-smoke-threads', version: 1 })

const isoTransport = {
  stream: (): never => {
    throw new Error('isomorphic harness: the transport must never be reached by a smoke render')
  },
}

/* ------------------------------------------------------------- the prop map */

export const MINIMAL_PROPS: Record<string, Record<string, unknown>> = {
  /* --- charts: assembly primitives ---------------------------------------- */
  CartesianChart: {
    data: ROWS,
    chartId: 'iso-cartesian',
    getX,
    series: SERIES,
    height: 200,
    // Required: the mark-drawing callback, invoked INSIDE the chart's own `<svg>`.
    children: () => <g />,
  },
  ChartFrame: {
    series: [{ key: 'a', label: 'A', color: '#4c7cf3' }],
    height: 120,
    // `ChartFrame` owns the container div and hands the plot rect to the caller — the caller draws
    // the `<svg>`. Returning a bare `<g>` here would be the harness rendering SVG into a div.
    children: () => <svg />,
  },
  ChartCard: { title: 'Card', children: TEXT },
  ChartCenter: { width: 200, height: 120, children: TEXT },
  ChartPending: { width: 200, height: 120 },
  ChartCursorScope: { children: TEXT },
  ChartLegend: { items: [{ key: 'a', label: 'A', color: '#4c7cf3' }] },
  ChartTooltipFloat: { anchor: { x: 10, y: 10 }, children: TEXT },
  VxThemeProvider: { children: TEXT, colorScheme: 'dark' },
  TooltipBody: { children: TEXT },
  TooltipHeader: { date: '2026-08-01' },
  TooltipRow: { color: '#4c7cf3', label: 'A', value: '10' },

  /* --- charts: SVG-hosted primitives -------------------------------------- */
  AreaGradient: { id: 'iso-grad', color: '#4c7cf3' },
  HatchPattern: { id: 'iso-hatch', color: '#4c7cf3' },
  Crosshair: { x: 10, top: 0, bottom: 100 },
  SeriesDot: { cx: 10, cy: 20, color: '#4c7cf3' },
  HoverOverlay: { width: 200, height: 100, onMove: () => {}, onLeave: () => {} },
  ZoneRects: { zones: [{ from: 0, to: 10, fill: '#4c7cf3' }], width: 200, leftScale: linearScale },
  XZoneRects: { zones: [], height: 100, xScale: pointScale },
  AxisLeftNumeric: { scale: linearScale },
  AxisRightNumeric: { scale: linearScale, left: 200 },
  AxisBottomDate: { scale: bandScale, top: 100, tickValues: KEYS },

  /* --- charts: the kinds -------------------------------------------------- */
  MultiLine: { data: ROWS, chartId: 'iso-multiline', getX, series: SERIES, height: 200 },
  StackedArea: { data: ROWS, chartId: 'iso-stacked', getX, series: SERIES, height: 200 },
  Bars: {
    data: ROWS,
    chartId: 'iso-bars',
    getX,
    getValue: (d: Row, key: string) => (key === 'a' ? d.a : d.b),
    positiveBars: [{ key: 'a', label: 'A', color: '#4c7cf3' }],
    height: 200,
  },
  ZonedLine: { data: ROWS, chartId: 'iso-zoned', getX, series: SERIES, height: 200 },
  BandStrip: {
    data: ROWS,
    chartId: 'iso-band',
    getX,
    series: [{ key: 'up', label: 'Up', color: '#4c7cf3' }],
    getBand: () => ({ state: 'up' }),
    height: 120,
  },
  MirroredBars: {
    data: ROWS,
    chartId: 'iso-mirror',
    getX,
    series: [
      { key: 'a', label: 'A', color: '#4c7cf3', mark: 'bar', getValue: (d: Row) => d.a },
      { key: 'b', label: 'B', color: '#e0803a', mark: 'bar', getValue: (d: Row) => d.b },
    ],
    up: { key: 'a', format: num },
    down: { key: 'b', format: num },
    height: 160,
  },
  DualPanel: {
    data: ROWS,
    chartId: 'iso-dual',
    getX,
    series: SERIES,
    getBar: (d: Row) => d.b,
    barLabel: 'Delta',
    barColorPositive: '#4c7cf3',
    barColorNegative: '#e0803a',
    formatTop: num,
    formatBottom: num,
    height: 240,
  },
  Donut: {
    data: [
      { key: 'a', value: 10 },
      { key: 'b', value: 4 },
    ],
    colorForKey: () => '#4c7cf3',
    formatValue: num,
    height: 160,
  },
  Heatmap: {
    data: [{ row: 'mon', col: 'am', value: 1 }],
    chartId: 'iso-heat',
    getRow: (d: { row: string }) => d.row,
    getCol: (d: { col: string }) => d.col,
    getValue: (d: { value: number }) => d.value,
    height: 160,
  },
  LineSparkline: { data: [1, 2, 3, 4], width: 80, height: 24 },
  BarSparkline: { data: [1, 2, 3, 4], width: 80, height: 24 },

  /* --- charts: the visx re-exports ----------------------------------------
   * Third-party components basalt republishes. Their props are visx's contract, not basalt's —
   * the assertion here is only that the re-export RESOLVES and renders, which is what a broken
   * pin or a dropped transitive dep would break. */
  Group: {},
  Bar: { x: 0, y: 0, width: 10, height: 10 },
  Line: { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
  LinePath: { data: ROWS, x: (_d: Row, i: number) => i * 10, y: (d: Row) => d.a },
  GridRows: { scale: linearScale, width: 200 },
  GridColumns: { scale: bandScale, height: 100 },
  AreaClosed: {
    data: ROWS,
    x: (_d: Row, i: number) => i * 10,
    y: (d: Row) => d.a,
    yScale: linearScale,
  },
  AreaStack: { data: ROWS, keys: ['a', 'b'], x: (_d: unknown, i: number) => i * 10 },
  BarStack: {
    data: ROWS,
    keys: ['a', 'b'],
    x: getX,
    xScale: bandScale,
    yScale: linearScale,
    color: () => '#4c7cf3',
  },
  BarGroup: {
    data: ROWS,
    keys: ['a', 'b'],
    height: 100,
    x0: getX,
    x0Scale: bandScale,
    x1Scale: scaleBand<string>({ domain: ['a', 'b'], range: [0, 60] }),
    yScale: linearScale,
    color: () => '#4c7cf3',
  },
  Pie: { data: ROWS, pieValue: (d: Row) => d.a },
  Threshold: {
    id: 'iso-threshold',
    data: ROWS,
    x: (_d: Row, i: number) => i * 10,
    y0: (d: Row) => d.a,
    y1: (d: Row) => d.b,
    yScale: linearScale,
    clipAboveTo: 0,
    clipBelowTo: 100,
  },

  /* --- controls ------------------------------------------------------------ */
  SelectFilter: { field: store.field.currency, label: 'Currency', options: OPTIONS },
  MultiSelectFilter: { field: store.field.channels, label: 'Channels', options: MULTI_OPTIONS },
  CompareFilter: { field: store.field.compare, label: 'Compare' },
  RangeFilter: { field: store.field.range, label: 'Range', customPicker: DateRangePicker },
  ToggleFilter: { field: store.field.errorsOnly, label: 'Errors only' },
  SearchFilter: { field: store.field.q, label: 'Search' },
  NumberFilter: { field: store.field.nights, label: 'Nights' },
  ViewTabs: { field: store.field.currency, options: OPTIONS },
  SliderControl: { field: store.field.nights, label: 'Nights' },
  PanelRow: { label: 'Row', children: TEXT },
  ControlGroup: { children: TEXT },
  FilterSet: { children: TEXT },
  ActionGroup: { actions: [] },
  OverflowMenu: { actions: [] },
  SyncButton: { onSync: () => {} },
  DateRangePicker: { value: [null, null], onChange: () => {} },

  /* --- dashboard / section / widget-header --------------------------------- */
  Section: { title: 'Section', children: TEXT },
  WidgetHeader: { title: 'Widget' },
  DeltaBadge: { value: 0.12 },
  StatCard: { label: 'Revenue', value: '1.2k' },
  EmptyState: { title: 'Nothing here' },
  ErrorState: { title: 'Broke' },
  SettingsSection: { title: 'Settings', children: TEXT },
  SettingsRow: { label: 'Row', control: TEXT },
  DangerZone: { children: TEXT },
  QueryState: {
    query: {
      data: [{ id: 1 }],
      isError: false,
      error: null,
      fetchStatus: 'idle',
      refetch: () => undefined,
    },
    empty: { title: 'No rows' },
    children: (rows: { id: number }[]) => <div>{rows.length}</div>,
  },

  /* --- shell --------------------------------------------------------------- */
  NavCountBadge: { count: 3 },
  AppBreadcrumbs: { items: [{ label: 'Home' }] },
  PageBar: { title: 'Page' },
  PageAside: { title: 'Aside', children: TEXT },
  BasaltShell: { brand: { name: 'Iso' }, sections: [], children: TEXT },
  AppSidebar: {
    brand: { name: 'Iso' },
    sections: [],
    collapsed: false,
    onToggleCollapse: () => {},
  },
  MobileNav: { model: { slots: [] } },
  SidebarAccount: { state: { status: 'unauthenticated' } },
  SidebarSearch: { search: { placeholder: 'Search' } },

  /* --- data ---------------------------------------------------------------- */
  BasaltDataTable: {
    data: [{ id: 1, name: 'one' }],
    columns: [{ accessorKey: 'name', header: 'Name' }],
  },
  BasaltVirtualList: {
    items: [{ id: 1 }, { id: 2 }],
    height: 200,
    renderItem: (item: { id: number }) => <div>{item.id}</div>,
    getItemKey: (item: { id: number }) => item.id,
  },

  /* --- query --------------------------------------------------------------- */
  QueryClientProvider: { client: createBasaltQueryClient(), children: TEXT },

  /* --- forms --------------------------------------------------------------- */
  FormErrorSummary: { form: { errors: {} } },

  /* --- content ------------------------------------------------------------- */
  Prose: { children: TEXT },
  Markdown: { children: '# Hello' },
  CodeBlock: { code: 'const a = 1', language: 'ts' },
  Callout: { children: TEXT },
  ArticleCard: { title: 'Iso' },
  ArticleGrid: { children: TEXT },
  ArticleLayout: { children: TEXT },
  TableOfContents: { items: [{ id: 'a', label: 'A', level: 2 }] },
  HeadingAnchor: { id: 'a' },
  GuideLink: { title: 'Guide', children: TEXT },
  GuideDrawer: { opened: false, onClose: () => {}, title: 'Guide', children: TEXT },
  MermaidDiagram: { code: 'graph TD; A-->B;' },

  /* --- agent / agent-chat --------------------------------------------------- */
  PartList: { parts: [] },
  ToolChip: {
    part: {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-available',
      input: {},
      output: {},
    },
  },
  ThreadFeed: { threads: [THREAD], activeId: null, onSelect: () => {} },
  ThreadFeedRow: { thread: THREAD, expanded: false, onToggle: () => {}, onSend: () => {} },
  ThreadOutcomeCard: { thread: THREAD, selected: false, onSelect: () => {} },
  ThreadTranscript: { messages: [] },
  ThreadDetailPanel: {
    thread: THREAD,
    onSend: () => {},
    onStop: () => {},
    onClose: () => {},
  },
  ThreadWorkspace: {
    useThreads: useIsoThreads,
    transport: isoTransport,
    resolveOutcome: () => ({ title: 'Iso', summary: '', status: 'done' }),
  },
}

/**
 * Rendered inside an `<svg>` rather than a `<div>`. Everything here paints SVG children directly;
 * React's "unrecognized tag" console error outside an SVG host would be a harness artifact.
 */
export const SVG_HOSTED: ReadonlySet<string> = new Set([
  'AreaClosed',
  'AreaGradient',
  'AreaStack',
  'AxisBottomDate',
  'AxisLeftNumeric',
  'AxisRightNumeric',
  'Bar',
  'BarGroup',
  'BarStack',
  'Crosshair',
  'GridColumns',
  'GridRows',
  'Group',
  'HatchPattern',
  'HoverOverlay',
  'Line',
  'LinePath',
  'Pie',
  'SeriesDot',
  'Threshold',
  'XZoneRects',
  'ZoneRects',
])

/* -------------------------------------------------------------------- skips */

export const SKIP: Record<string, string> = {
  BasaltProvider:
    'F-SKIP-1 — the harness wrapper IS a BasaltProvider, and a second nested instance is the ' +
    'documented single-mount violation the provider warns about. Covered by provider/index.test.tsx.',
}

/* --------------------------------------------------------- expected defects */

export type ExpectedDefect = {
  /** The finding id in `.claude/maturation/isomorphic-findings.md`. */
  readonly finding: string
  readonly why: string
}

export const EXPECTED_DEFECTS: Record<string, ExpectedDefect> = {}

/**
 * Audit item C8 — every component that does NOT forward a `className` to its rendered output,
 * recorded so the suite stays green while the gap stays visible. Deleting an entry is how a fix
 * gets proven: the test compares this record against the live probe in BOTH directions, so adding
 * `className` to a component turns the suite red until its line here is removed.
 *
 * Three kinds, because they are not the same finding:
 * - `provider` — renders no box of its own (context, portal host, error boundary). Nothing to put
 *   a class on; not a gap.
 * - `svg` — paints SVG children only. A class would land on a `<g>`/`<rect>`, which is a different
 *   styling question from the chrome components' one.
 * - `gap` — a component that renders a real box and drops the class. THIS is C8: 79 of
 *   98 recorded exports, and the number that would need a shared `Props`/`HTMLDivProps`
 *   primitive (audit-blueprint.md §1) to fix at once rather than one prop type at a time.
 */
export const NO_CLASSNAME: Record<string, 'provider' | 'svg' | 'gap'> = {
  ActionGroup: 'gap',
  AppBreadcrumbs: 'gap',
  AppSidebar: 'gap',
  AreaGradient: 'svg',
  ArticleGrid: 'gap',
  AxisBottomDate: 'svg',
  AxisLeftNumeric: 'svg',
  AxisRightNumeric: 'svg',
  BandStrip: 'gap',
  BarSparkline: 'gap',
  Bars: 'gap',
  BasaltDataTable: 'gap',
  BasaltErrorBoundary: 'provider',
  BasaltNotifications: 'provider',
  BasaltOverlays: 'provider',
  BasaltQueryDevtools: 'provider',
  BasaltShell: 'gap',
  BasaltVirtualList: 'gap',
  CartesianChart: 'gap',
  ChartCard: 'gap',
  ChartCenter: 'gap',
  ChartCursorScope: 'provider',
  ChartFrame: 'gap',
  ChartLegend: 'gap',
  ChartPending: 'gap',
  ChartTooltipFloat: 'gap',
  CompareFilter: 'gap',
  Composer: 'gap',
  ConnectivityIndicator: 'gap',
  ConnectivityProvider: 'provider',
  Crosshair: 'svg',
  CtlSlot: 'gap',
  DangerZone: 'gap',
  DateRangePicker: 'gap',
  DeltaBadge: 'gap',
  DeriveControls: 'gap',
  Donut: 'gap',
  DualPanel: 'gap',
  EmptyState: 'gap',
  ErrorState: 'gap',
  FilterSet: 'gap',
  FormErrorSummary: 'gap',
  GuideDrawer: 'gap',
  GuideLink: 'gap',
  HatchPattern: 'svg',
  HeadingAnchor: 'gap',
  Heatmap: 'gap',
  HoverOverlay: 'svg',
  LineSparkline: 'gap',
  LoadingState: 'gap',
  MirroredBars: 'gap',
  MobileNav: 'gap',
  MultiLine: 'gap',
  MultiSelectFilter: 'gap',
  NavCountBadge: 'gap',
  NotificationBell: 'gap',
  NotificationCenter: 'gap',
  NumberFilter: 'gap',
  OverflowMenu: 'gap',
  PanelRow: 'gap',
  PartList: 'gap',
  QueryClientProvider: 'provider',
  QueryErrorResetBoundary: 'provider',
  QueryState: 'gap',
  RangeFilter: 'gap',
  ReadingProgress: 'gap',
  SearchFilter: 'gap',
  Section: 'gap',
  SelectFilter: 'gap',
  SeriesDot: 'svg',
  SettingsRow: 'gap',
  SettingsSection: 'gap',
  ShortcutsHelp: 'gap',
  SidebarAccount: 'gap',
  SidebarSearch: 'gap',
  SliderControl: 'gap',
  StackedArea: 'gap',
  StatCard: 'gap',
  SyncButton: 'gap',
  ThemeLabControls: 'gap',
  ThemeToggle: 'gap',
  ThreadDetailPanel: 'gap',
  ThreadFeed: 'gap',
  ThreadFeedRow: 'gap',
  ThreadOutcomeCard: 'gap',
  ThreadTranscript: 'gap',
  ThreadWorkspace: 'gap',
  ToggleFilter: 'gap',
  ToolChip: 'gap',
  TooltipBody: 'gap',
  TooltipHeader: 'gap',
  TooltipRow: 'gap',
  ViewTabs: 'gap',
  VxThemeProvider: 'provider',
  WidgetHeader: 'gap',
  XZoneRects: 'svg',
  ZoneRects: 'svg',
  ZonedLine: 'gap',
}

/**
 * `renderToString` casualties. The whole library server-renders inside its own provider tree —
 * this is the entire list, and it is one component.
 */
export const SSR_UNSUPPORTED: Record<string, string> = {
  ChartTooltipFloat:
    'F-SSR-1 — renders through `createPortal`, which the server renderer does not support. The ' +
    'tooltip is a hover artifact with nothing to emit server-side, so the fix is a mount guard ' +
    '(render the portal only after mount), not a rewrite.',
}
