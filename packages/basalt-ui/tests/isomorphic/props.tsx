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
import { lineY } from '@tanstack/charts/line'
import type { ChartSeries } from '../../src/charts'
import { DateRangePicker } from '../../src/controls-dates'
import { defineCommands } from '../../src/commands'

/* ----------------------------------------------------------------- fixtures */

type Row = { date: string; a: number; b: number }

const ROWS: Row[] = [
  { date: '2026-08-01', a: 10, b: 4 },
  { date: '2026-08-02', a: 40, b: 6 },
  { date: '2026-08-03', a: 25, b: 5 },
]

const x = (d: Row): Date => new Date(`${d.date}T00:00:00Z`)

const SERIES: ChartSeries<Row>[] = [
  { key: 'a', label: 'A', color: '#4c7cf3', mark: 'line', getValue: (d) => d.a },
  { key: 'b', label: 'B', color: '#e0803a', mark: 'line', getValue: (d) => d.b },
]

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

/**
 * `ShortcutsHelp` has NO prop that makes it render — it reads the command registry, and an empty
 * one returns `null`. So the fixture is a registration, not a `MINIMAL_PROPS` row: without it the
 * className probe records "drops the class" for a component that painted no box at all.
 *
 * A module-level write to `defineCommands`' stash, which is safe precisely because nothing else in
 * this package's tests reads or writes it (the palette/hotkey suites drive their own inputs).
 */
defineCommands({
  'iso:save': { label: 'Save', group: 'File', shortcut: 'Mod+S', run: () => {} },
})

/* ------------------------------------------------------------- the prop map */

export const MINIMAL_PROPS: Record<string, Record<string, unknown>> = {
  /* --- charts (docs/V2-SPEC.md § 9) --------------------------------------- */
  CartesianChart: {
    ariaLabel: 'Cartesian',
    data: ROWS,
    x,
    series: SERIES,
    height: 200,
    marks: () => [lineY(ROWS, { x, y: (d: Row) => d.a })],
  },
  Lines: { ariaLabel: 'Lines', data: ROWS, x, series: SERIES, height: 200 },
  Bars: {
    ariaLabel: 'Bars',
    data: ROWS,
    x,
    bars: [{ key: 'a', label: 'A', color: '#4c7cf3', getValue: (d: Row) => d.a }],
    height: 200,
  },
  ChartCard: { title: 'Card', children: TEXT },
  StackedArea: {
    ariaLabel: 'Stacked',
    data: ROWS,
    x,
    series: [
      { key: 'a', label: 'A', color: '#4c7cf3', getValue: (d: Row) => d.a },
      { key: 'b', label: 'B', color: '#e0803a', getValue: (d: Row) => d.b },
    ],
    height: 200,
  },
  Sparkline: { ariaLabel: 'Spark', data: [1, 3, 2, 5], height: 28, width: 80 },
  BandStrip: {
    ariaLabel: 'Strip',
    data: ROWS,
    x,
    states: [{ key: 'up', label: 'Up', color: '#4c7cf3' }],
    getBand: () => ({ state: 'up' }),
    height: 60,
  },
  Donut: {
    ariaLabel: 'Donut',
    data: [
      { key: 'a', value: 3 },
      { key: 'b', value: 1 },
    ],
    colorForKey: () => '#4c7cf3',
    formatValue: (v: number) => String(v),
  },
  Heatmap: {
    ariaLabel: 'Heat',
    data: ROWS,
    getRow: (d: Row) => d.date,
    getCol: () => 'c',
    getValue: (d: Row) => d.a,
  },
  DualPanel: {
    ariaLabel: 'Dual',
    data: ROWS,
    x,
    series: [{ key: 'a', label: 'A', color: '#4c7cf3', getValue: (d: Row) => d.a }],
    bar: {
      label: 'B',
      getValue: (d: Row) => d.b,
      positive: '#4c7cf3',
      negative: '#e0803a',
      format: (v: number) => String(v),
    },
    height: 240,
  },
  MirroredBars: {
    ariaLabel: 'Mirrored',
    data: ROWS,
    x,
    series: [
      { key: 'a', label: 'A', color: '#4c7cf3', getValue: (d: Row) => d.a },
      { key: 'b', label: 'B', color: '#e0803a', getValue: (d: Row) => d.b },
    ],
    up: { key: 'a', format: (v: number) => String(v) },
    down: { key: 'b', format: (v: number) => String(v) },
    height: 240,
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
  FilterSet: { children: TEXT },
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

  /* --- shell --------------------------------------------------------------- */
  NavCountBadge: { count: 3 },
  AppBreadcrumbs: { items: [{ label: 'Home' }] },
  PageBar: { title: 'Page' },
  PageAside: { title: 'Aside', children: TEXT },
  PageTitle: { title: 'Title' },
  BasaltShell: { brand: { name: 'Iso' }, nav: { groups: [] }, children: TEXT },
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

  /* --- forms --------------------------------------------------------------- */
  // An error is REQUIRED here: `errorEntries.length === 0` returns null, and the className probe
  // would then be recording "drops the class" for a component that never rendered a box at all.
  FormErrorSummary: { form: { errors: { email: 'Enter a valid address' } } },
  // The layout primitives each `assertRequiredProps` their label/title (F-ERR-1), so the empty-props
  // render is a throw rather than a smoke test.
  FormSection: { title: 'Billing', children: TEXT },
  FormRow: { label: 'Email', children: TEXT },
  FormGroup: { label: 'Notify me about', children: TEXT },

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
  // `opened: true` for the same reason `FormErrorSummary` carries an error — a closed Drawer paints
  // nothing, so the probe would be measuring the empty branch.
  GuideDrawer: { opened: true, onClose: () => {}, title: 'Guide', children: TEXT },
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
}

/**
 * Rendered inside an `<svg>` rather than a `<div>`. Everything here paints SVG children directly;
 * React's "unrecognized tag" console error outside an SVG host would be a harness artifact.
 */
export const SVG_HOSTED: ReadonlySet<string> = new Set([])

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
 * Four kinds, because they are not the same finding:
 * - `provider` — renders no box of its own (context, portal host, error boundary). Nothing to put
 *   a class on; not a gap.
 * - `svg` — paints SVG children only. A class would land on a `<g>`/`<rect>`, which is a different
 *   styling question from the chrome components' one.
 * - `portal` — forwards the class CORRECTLY, onto a node the probe cannot see: the probe reads
 *   `container.innerHTML`, and a Mantine `Modal`/`Drawer` renders into `document.body`. A harness
 *   limit recorded as one, so it does not read as a component defect. Fixing it means teaching the
 *   probe about `baseElement`, not editing the component.
 * - `gap` — a component that renders a real box and drops the class. THIS is C8: 15 of the
 *   remaining 35, now that the six `BasaltProps` adopter waves forward `className` across the rest
 *   of the barrel.
 */
export const NO_CLASSNAME: Record<string, 'provider' | 'svg' | 'portal' | 'gap'> = {
  // provider — renders no box of its own (context, portal host, error boundary); nothing to put a
  // class on.

  // svg — paints SVG children only; a class would land on a `<g>`/`<rect>`, a different styling
  // question from the chrome components' one.

  // portal — forwards the class onto a node outside the probe's container. Not a gap.

  // gap — renders a real box and drops the class.
  DateRangePicker: 'gap',
  DeltaBadge: 'gap',
}

/**
 * `renderToString` casualties. **Empty, and that is the assertion** — the whole library
 * server-renders inside its own provider tree, and the test compares this ledger against what
 * actually throws in BOTH directions, so a new portal-in-render lands here as a red test rather
 * than as a consumer's SSR crash.
 *
 * It held exactly one entry, `ChartTooltipFloat` (F-SSR-1: an unconditional `createPortal`, which
 * `react-dom/server` refuses outright). Deleting the entry IS how the fix is proven — see that
 * component's `useIsClient` guard and `ChartTooltip.test.tsx`'s server-rendering block.
 */
export const SSR_UNSUPPORTED: Record<string, string> = {}
