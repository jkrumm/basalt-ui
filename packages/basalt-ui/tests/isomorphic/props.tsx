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
 */
import type { ReactNode } from 'react'
import type { Series } from '../../src/charts'
import { memoryHandle } from '../../src/controls/control-view.handles'
import { Input } from '../../src/ui/input'
import { spec } from '../../src/controls/spec'

/* ----------------------------------------------------------------- fixtures */

type Row = { date: string; a: number; b: number }

const ROWS: Row[] = [
  { date: '2026-08-01', a: 10, b: 4 },
  { date: '2026-08-02', a: 40, b: 6 },
  { date: '2026-08-03', a: 25, b: 5 },
]

const x = (d: Row): Date => new Date(`${d.date}T00:00:00Z`)

const BLUE = { light: '#4c7cf3', dark: '#7a9cf5' }
const ORANGE = { light: '#e0803a', dark: '#e89a62' }

const SERIES: Series<Row>[] = [
  { key: 'a', label: 'A', color: BLUE, mark: 'line', y: (d) => d.a },
  { key: 'b', label: 'B', color: ORANGE, mark: 'line', y: (d) => d.b },
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

/* ------------------------------------------------------------- the prop map */

export const MINIMAL_PROPS: Record<string, Record<string, unknown>> = {
  StatusDot: { color: 'red' },
  StatusVerdict: { color: 'red', word: 'Over' },
  /* --- charts ------------------------------------------------------------- */
  CartesianChart: {
    ariaLabel: 'Cartesian',
    data: ROWS,
    x: { value: x },
    series: SERIES,
    height: 200,
  },
  Lines: { ariaLabel: 'Lines', data: ROWS, x: { value: x }, series: SERIES, height: 200 },
  Bars: {
    ariaLabel: 'Bars',
    data: ROWS,
    x: { value: x },
    series: [{ key: 'a', label: 'A', color: BLUE, mark: 'bar', y: (d: Row) => d.a }],
    height: 200,
  },
  ChartCard: { title: 'Card', chart: () => TEXT },
  Sparkline: { ariaLabel: 'Spark', series: [1, 3, 2, 5], height: 28, width: 80 },
  MiniBars: { ariaLabel: 'Mini', series: [1, 3, 2, 5], height: 28, width: 80 },
  BandStrip: {
    ariaLabel: 'Strip',
    data: ROWS,
    x,
    states: [{ key: 'up', label: 'Up', color: '#4c7cf3' }],
    getBand: () => ({ state: 'up' }),
    height: 60,
  },
  Heatmap: {
    ariaLabel: 'Heat',
    data: ROWS,
    getRow: (d: Row) => d.date,
    getCol: () => 'c',
    getValue: (d: Row) => d.a,
  },

  /* --- controls ------------------------------------------------------------ */
  // v3 ctl-4: a spec over an in-memory handle, so the smoke render needs no router
  ControlView: {
    spec: spec(
      memoryHandle('smoke', 'a', {
        kind: 'enum',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
      'Smoke',
    ),
  },
  FilterSet: { specs: [] },
  ViewTabs: {
    handle: memoryHandle('smoke.tabs', 'a', {
      kind: 'enum',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    }),
  },
  // v3 ctl-4b: a home with nothing to host draws nothing, so the smoke render needs no router
  ControlHome: { home: 'aside' },

  /* --- data ---------------------------------------------------------------- */
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
  FormRow: { children: TEXT },
  FormFooter: {
    form: {
      state: { values: {}, isSubmitting: false, canSubmit: true, errors: [] },
      options: {},
      store: { subscribe: () => ({ unsubscribe() {} }) },
      reset() {},
    },
    actions: [{ label: 'Save', primary: true }],
  },
  FormField: {
    label: 'Email',
    control: memoryHandle('iso.field', '', { kind: 'string' }),
    children: <Input />,
  },

  /* --- content ------------------------------------------------------------- */
  Prose: { children: TEXT },
  Markdown: { children: '# Hello', contentTrust: 'untrusted' },
  CodeBlock: { code: 'const a = 1', lang: 'ts' },

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
  DataTable:
    'v3-table-t2a — its only prop is an instance made by the `useDataTable` hook, which a plain props ' +
    'map cannot build. Covered by table/parts/data-table.test.tsx (SSR hydration and axe at the full tier).',
  ...Object.fromEntries(
    ['BulkBar', 'DataTableBody', 'TablePager', 'TableToolbar'].map((part) => [
      part,
      'Issue 1146 — a part of `DataTable` whose only prop is an instance made by `useDataTable`, ' +
        'which a plain props map cannot build. Rendered through `DataTable` by table/parts/*.test.tsx ' +
        'and through the barrel by table/barrel.test.tsx.',
    ]),
  ),
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
  CodeBlock: 'gap', // by design: the props are frozen (lang, code, settled); styling goes on a wrapper
  Markdown: 'gap', // by design: the root is data-slot="markdown"; styling goes on a wrapper
  ControlHome: 'gap', // by design: the home decides the look of its controls; there is no className or variant
  // v3 chart kinds and the card: the host owns the box (height, phase, legend); layout is the parent's
  CartesianChart: 'gap',
  Lines: 'gap',
  Bars: 'gap',
  Sparkline: 'gap',
  ChartCard: 'gap',
  FilterSet: 'gap', // draws a list of specs; a row of pills has no className, the layout is the home's
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
