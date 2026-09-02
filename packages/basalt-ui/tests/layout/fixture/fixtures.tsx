import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { ThreadFeedRow, ThreadTranscript } from '../../../src/agent-chat'
import type { AgentThread, ChatMessage, StreamStatus, TranscriptPart } from '../../../src/agent'
import { Bars, BarSparkline, Donut, Heatmap, MultiLine, fmtAxisDate } from '../../../src/charts'
import type { BarsBar, ChartSeries, DonutDatum } from '../../../src/charts'
import { FilterSet, SelectFilter } from '../../../src/controls'
import { BasaltDataTable } from '../../../src/data/table'
import type { DataTableFacet } from '../../../src/data/table'
import type { ColumnDef } from '@tanstack/react-table'
import { BasaltShell, PageAside, PageBar, StatCard, StatGroup } from '../../../src/index'
import type { NavAnchor, SidebarItem, SidebarSection } from '../../../src/shell/nav-types'
import { createLocalStore, field } from '../../../src/state'
import type {
  AgentSpec,
  AsideSpec,
  BarSpec,
  ChartsSpec,
  FixtureSpec,
  ItemSpec,
  TableSpec,
} from './spec'

/** A consumer-sized (18px) glyph — the bar normalizes it to `--vx-space-mobile-nav-icon-size` in
 *  CSS, which is part of what the geometry assertions cover. */
function Glyph(): ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={8} fill="currentColor" />
    </svg>
  )
}

/**
 * Stands in for the consumer's router `Link`, and is built PER PATH because that is what a real
 * one is: `BasaltShell` passes an `Anchor` only chrome props (className, aria-*, onClick) and
 * never the item's `href` — the router seam assumes the Link closes over its own destination.
 * Memoized so the component identity survives a remount and React does not tear the tree down.
 *
 * VERIFIED THE HARD WAY: a version that spread `props` and read `props.href` recorded `""` on
 * every tap, because that href never arrives. Invariant 3 would have passed vacuously.
 *
 * The handler composes the caller's FIRST and returns early when `defaultPrevented`, verbatim
 * @tanstack/react-router semantics — which is what the "re-tap the active slot scrolls instead of
 * navigating" rule depends on. Recording the path is what lets a test assert the tap REACHED the
 * page as well as raised nothing.
 */
const anchors = new Map<string, NavAnchor>()

function anchorFor(path: string): NavAnchor {
  const cached = anchors.get(path)
  if (cached) return cached
  const Anchor: NavAnchor = (props) => (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the shell supplies children and keyboard semantics through `props`; oxlint cannot see them through the spread
    <a
      {...props}
      href={path}
      onClick={(event) => {
        props.onClick?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        window.basaltNavigations.push(path)
      }}
    />
  )
  anchors.set(path, Anchor)
  return Anchor
}

const toItem = (spec: ItemSpec, icons: boolean): SidebarItem => ({
  key: spec.key,
  label: spec.label,
  // `icon` is a REQUIRED field carrying a `ReactNode`, so an icon-less consumer passes
  // `undefined` — exactly what `useNav` produces for an item that omits it (image-share's real
  // shape). Dropping the key entirely would not type-check and is not the configuration.
  icon: icons ? <Glyph /> : undefined,
  href: `/${spec.key}`,
  Anchor: anchorFor(`/${spec.key}`),
  ...(spec.short !== undefined && { short: spec.short }),
  ...(spec.mobile !== undefined && { mobile: spec.mobile }),
  ...(spec.active !== undefined && { active: spec.active }),
  ...(spec.disabled !== undefined && { disabled: spec.disabled }),
  ...(spec.count !== undefined && { count: spec.count }),
  ...(spec.children !== undefined && {
    children: spec.children.map((child) => toItem(child, icons)),
  }),
})

// ── The data table ────────────────────────────────────────────────────────────────────────────

type TableRow = { id: number; name: string; value: number }

/**
 * Plain accessor columns — the sticky invariant is the header's POSITION, not what a cell renders.
 * `spec.columns` widens the set for the overflow guard: cell text is deliberately unbreakable
 * (`Row 1 · segment 3` has no wrap opportunity a narrow column could take), because a table that
 * CAN reflow proves nothing about containment.
 */
function tableColumns(count: number): ColumnDef<TableRow>[] {
  const base: ColumnDef<TableRow>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'value', header: 'Value' },
  ]
  for (let i = base.length; i < count; i++) {
    base.push({
      id: `col${i}`,
      header: `Column ${i + 1}`,
      accessorFn: (row: TableRow) => `value-${row.id}-${i}`,
    })
  }
  return base
}

const tableRows = (n: number): TableRow[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i + 1}`, value: i * 3 }))

/**
 * The toolbar's facets — real `EnumFilter` pills over the generated columns, with the long option
 * labels a production facet carries. A facet whose options were `a`/`b` would make the pill row
 * narrow enough to fit anywhere, which is the opposite of what the overflow guard needs to see.
 */
function tableFacets(count: number): DataTableFacet<TableRow>[] {
  const all: DataTableFacet<TableRow>[] = [
    {
      columnId: 'name',
      label: 'Department',
      options: [
        { value: 'Row 1', label: 'Engineering' },
        { value: 'Row 2', label: 'Customer success' },
      ],
    },
    {
      columnId: 'value',
      label: 'Role',
      options: [
        { value: '0', label: 'Individual contributor' },
        { value: '3', label: 'Engineering manager' },
      ],
    },
  ]
  return all.slice(0, count)
}

/**
 * The REAL `BasaltDataTable`, mounted with the props a consumer pairs on a scrolling body. The
 * page-level `stickyHeaderOffset` is passed on purpose: it is the prop that used to reach Mantine
 * and park the `<thead>` mid-body.
 *
 * `title` rides along with the toolbar because the two share the header row: the toolbar is a flex
 * item BESIDE the title, and it was that item's `flex: 0 0 auto` (no shrink) that let a 461px
 * search-plus-pills row sit in a 302px column and widen the page.
 */
function TableFixture({ spec }: { spec: TableSpec }): ReactElement {
  const facets = tableFacets(spec.facets ?? 0)
  return (
    <BasaltDataTable
      data={tableRows(spec.rows)}
      columns={tableColumns(spec.columns ?? 2)}
      stickyHeader={spec.stickyHeader ?? true}
      {...(spec.maxHeight !== undefined && { maxHeight: spec.maxHeight })}
      {...(spec.minWidth !== undefined && { minWidth: spec.minWidth })}
      {...(spec.stickyHeaderOffset !== undefined && {
        stickyHeaderOffset: spec.stickyHeaderOffset,
      })}
      {...(spec.search === true && { enableGlobalFilter: true, title: 'Projects' })}
      {...(facets.length > 0 && { facets })}
    />
  )
}

// ── The page bar, with real controls ──────────────────────────────────────────────────────────

/**
 * ONE store at module scope, not per mount: `createLocalStore` is a per-key FACTORY and a fresh one
 * on every render would re-subscribe every bound control (the same memo law `BasaltShell` documents
 * for `collapseStore`). Long option labels on purpose — a pill is as wide as its longest word, and
 * a bar of narrow pills cannot demonstrate law C7's fold.
 */
const BAR_VALUES = ['organic-search', 'paid-social', 'referral-traffic', 'direct-sessions'] as const
const BAR_LABELS: Record<string, string> = {
  'organic-search': 'Organic search',
  'paid-social': 'Paid social',
  'referral-traffic': 'Referral traffic',
  'direct-sessions': 'Direct sessions',
}

const barStore = createLocalStore({
  key: 'layout-fixture-bar',
  fields: {
    f0: field.enum(BAR_VALUES, 'organic-search'),
    f1: field.enum(BAR_VALUES, 'paid-social'),
    f2: field.enum(BAR_VALUES, 'referral-traffic'),
    f3: field.enum(BAR_VALUES, 'direct-sessions'),
  },
}).labels({ f0: BAR_LABELS, f1: BAR_LABELS, f2: BAR_LABELS, f3: BAR_LABELS })

const BAR_FIELD_KEYS = ['f0', 'f1', 'f2', 'f3'] as const

function BarFixture({ spec }: { spec: BarSpec }): ReactElement {
  const pills = BAR_FIELD_KEYS.slice(0, Math.min(spec.pills ?? 0, BAR_FIELD_KEYS.length))
  const actions = Array.from({ length: spec.actions ?? 0 }, (_, i) => ({
    key: `a${i}`,
    label: `Action ${i + 1}`,
    onClick: () => {},
  }))
  return (
    <PageBar
      {...(spec.title !== undefined && { title: spec.title })}
      {...(pills.length > 0 && {
        filters: (
          <FilterSet>
            {pills.map((key, i) => (
              <SelectFilter key={key} field={barStore.field[key]} label={`Filter ${i + 1}`} />
            ))}
          </FilterSet>
        ),
      })}
      {...(actions.length > 0 && {
        actions: {
          primary: actions[0]!,
          ...(actions.length > 1 && { secondary: actions.slice(1) }),
        },
      })}
    />
  )
}

// ── The KPI row ───────────────────────────────────────────────────────────────────────────────

const SPARK_DATA = Array.from({ length: 24 }, (_, i) => 10 + ((i * 7) % 19))

/** `StatGroup` + `StatCard` with a BLED sparkline — the render-prop form, so the mark sizes itself
 * to the card's measured inner width rather than to a hardcoded one. That measurement is exactly
 * what can overshoot a 320px page if a card's own box does not stay inside its column. */
function StatsFixture({ count }: { count: number }): ReactElement {
  return (
    <StatGroup cols={4}>
      {Array.from({ length: count }, (_, i) => (
        <StatCard
          key={i}
          title={`Metric ${i + 1}`}
          value={`${(i + 1) * 1234}`}
          sparkline={({ width, height }) => (
            <BarSparkline data={SPARK_DATA} width={width} height={height} />
          )}
        />
      ))}
    </StatGroup>
  )
}

// ── The aside ─────────────────────────────────────────────────────────────────────────────────

/**
 * Called by the fixture host before every mount, so each `remount(spec)` counts from zero.
 *
 * The counters live on `window`, not in module state, because a test has to read them while
 * NOTHING is mounted — the phone projection renders no node at all until its sheet is opened, and
 * "the children were never mounted before that" is half the invariant.
 */
export function resetAsideMounts(): void {
  window.basaltAsideMounts = { total: 0, live: 0 }
}

/**
 * The aside's payload, counting its own mounts.
 *
 * `live` is how many instances exist RIGHT NOW: a CSS-only responsive twin — the shape law C9
 * mandates for every other control — would render this component in both halves and `live` would
 * be 2, with every bound control beside it subscribed to its field twice. `total` is the
 * page-lifetime ordinal, so a projection that tears the subtree down and rebuilds it reads 2 even
 * though `live` never left 1. `data-mounts` mirrors the ordinal onto the node itself, so a failure
 * says which of the two shapes it was without a second query.
 */
function AsideProbe(): ReactElement {
  const [mounts, setMounts] = useState(0)
  useEffect(() => {
    const counts = window.basaltAsideMounts
    counts.total += 1
    counts.live += 1
    setMounts(counts.total)
    return () => {
      counts.live -= 1
    }
  }, [])
  return (
    <div data-testid="aside-probe" data-mounts={mounts}>
      Composition
    </div>
  )
}

/**
 * A row-2 payload, so `PageBar` publishes the `panelHost` claim the phone projection hangs its
 * `Panel` pill off. Deliberately NOT a bound control: this fixture measures where the aside goes,
 * and a store would put a second stateful thing in the tree that the mount count would then have
 * to account for.
 */
function AsideBar(): ReactElement {
  return <PageBar filters={<span data-testid="bar-filters">Filters</span>} />
}

function AsideFixture({ spec }: { spec: AsideSpec }): ReactElement {
  return (
    <PageAside title={spec.title}>
      <AsideProbe />
    </PageAside>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────────────────────

type ChartPoint = { date: string; values: number[] }

/** Distinct swatches — a plain hex set, not `VX.series` (which is consumer data per
 * `docs/CHARTS-SPEC.md` §"Series color is consumer data" — the framework ships no series map). */
const CHART_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
]

/** UTC so the fixture is deterministic regardless of the host machine's timezone. */
function isoDate(dayIndex: number): string {
  return new Date(Date.UTC(2024, 0, 1 + dayIndex)).toISOString().slice(0, 10)
}

/** `Mar 08 14:00`-shaped — deliberately wide, to force the §1 tick-spacing/rotation laws to fire. */
function fmtWide(key: string): string {
  const d = new Date(key)
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${month} ${day} 14:00`
}

const CHART_DAYS = 30

function buildChartData(seriesCount: number): ChartPoint[] {
  return Array.from({ length: CHART_DAYS }, (_, i) => ({
    date: isoDate(i),
    values: Array.from(
      { length: seriesCount },
      (_, s) => 20 + Math.round(12 * Math.sin((i + s * 2) / 4)) + s * 3,
    ),
  }))
}

function buildLineSeries(seriesCount: number): ChartSeries<ChartPoint>[] {
  return Array.from({ length: seriesCount }, (_, i) => ({
    key: `s${i}`,
    label: `Series ${i + 1}`,
    color: CHART_COLORS[i % CHART_COLORS.length] as string,
    mark: 'line' as const,
    getValue: (d: ChartPoint) => d.values[i] ?? null,
  }))
}

function buildPositiveBars(seriesCount: number): BarsBar<ChartPoint>[] {
  return Array.from({ length: seriesCount }, (_, i) => ({
    key: `s${i}`,
    label: `Series ${i + 1}`,
    color: CHART_COLORS[i % CHART_COLORS.length] as string,
  }))
}

const barGetValue = (d: ChartPoint, key: string): number | null => {
  const value = d.values[Number(key.slice(1))]
  return value ?? null
}

type HeatCell = { row: string; col: string; value: number }
const HEAT_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HEAT_COLS = ['00', '06', '12', '18']
const HEAT_DATA: HeatCell[] = HEAT_ROWS.flatMap((row, ri) =>
  HEAT_COLS.map((col, ci) => ({ row, col, value: (ri + 1) * (ci + 1) })),
)

function buildDonutData(seriesCount: number): DonutDatum<string>[] {
  return Array.from({ length: seriesCount }, (_, i) => ({ key: `s${i}`, value: 10 + i * 3 }))
}

/** One real `basalt-ui/charts` kind, picked by `spec.kind` — never a hand-rolled stand-in. Wrapped
 * in a `data-testid` box so a layout test has one stable selector for "the chart's own container"
 * regardless of which kind is mounted, and — only when `containerHeight` is set — a fixed-height
 * box so `fill` has something real to fill (`docs/CHARTS-SPEC.md` §6). */
function ChartsFixture({ spec }: { spec: ChartsSpec }): ReactElement {
  const seriesCount = spec.legendEntries ?? 3
  const formatX = spec.formatX === 'wide' ? fmtWide : fmtAxisDate
  const sizing = {
    ...(spec.height !== undefined && { height: spec.height }),
    ...(spec.fill !== undefined && { fill: spec.fill }),
    ...(spec.aspectRatio !== undefined && { aspectRatio: spec.aspectRatio }),
  }

  const chart = (() => {
    switch (spec.kind) {
      case 'bars':
        return (
          <Bars
            data={buildChartData(seriesCount)}
            chartId="fixture-chart"
            getX={(d) => d.date}
            getValue={barGetValue}
            positiveBars={buildPositiveBars(seriesCount)}
            formatX={formatX}
            {...(spec.xLabelRotate !== undefined && { xLabelRotate: spec.xLabelRotate })}
            {...(spec.height !== undefined && { height: spec.height })}
          />
        )
      case 'heatmap':
        return (
          <Heatmap
            data={HEAT_DATA}
            chartId="fixture-chart"
            getRow={(d) => d.row}
            getCol={(d) => d.col}
            getValue={(d) => d.value}
            {...sizing}
          />
        )
      case 'donut':
        return (
          <Donut
            data={buildDonutData(seriesCount)}
            colorForKey={(k) => CHART_COLORS[Number(k.slice(1)) % CHART_COLORS.length] as string}
            formatValue={(v) => `${v}`}
            {...(spec.height !== undefined && { height: spec.height })}
          />
        )
      case 'multiLine':
      default:
        return (
          <MultiLine
            data={buildChartData(seriesCount)}
            chartId="fixture-chart"
            getX={(d) => d.date}
            series={buildLineSeries(seriesCount)}
            formatX={formatX}
            {...(spec.xLabelRotate !== undefined && { xLabelRotate: spec.xLabelRotate })}
            {...(spec.height !== undefined && { height: spec.height })}
          />
        )
    }
  })()

  return (
    <div
      data-testid="chart-frame"
      // theme-allow -- a measured fixed-height BOX is the fixture's payload for the `fill` sizing
      // mode (docs/CHARTS-SPEC.md §6), not a themed size
      style={spec.containerHeight !== undefined ? { height: spec.containerHeight } : undefined}
    >
      {chart}
    </div>
  )
}

// ── The agent transcript ──────────────────────────────────────────────────────────────────────

/** Deliberately non-uniform lengths — a one-line ack beside a several-sentence reply — so a
 * uniform fixture never masks a `measureElement` regression the way `AgentTranscriptVirtualizeDemoPage`'s
 * own doc warns about. */
const AGENT_MESSAGE_BODIES = [
  'Got it.',
  'Here is a longer reply that spans a couple of lines to vary the measured row height across the seeded thread — a uniform-height fixture would hide exactly this regression class.',
  'Sure, one moment.',
  'Let me check that for you — a medium-length reply with enough words to wrap onto a second line on a narrow viewport.',
  'Done.',
]

function buildAgentMessages(count: number): ChatMessage<TranscriptPart>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    parts: [
      {
        id: `agent-m${i}-p1`,
        type: 'text',
        text: AGENT_MESSAGE_BODIES[i % AGENT_MESSAGE_BODIES.length] as string,
      },
    ],
    createdAt: i,
  }))
}

/** `mode: 'virtualized'` (default) — a bare, windowed `ThreadTranscript`. `className` reaches the
 * virtualizer's own scroll root (`BasaltProps`), which is the stable selector a layout test reads
 * scroll geometry off. */
function VirtualizedTranscriptFixture({ spec }: { spec: AgentSpec }): ReactElement {
  const messages = useMemo(() => buildAgentMessages(spec.messages), [spec.messages])
  return (
    <ThreadTranscript
      className="lyt-agent-scroll"
      messages={messages}
      virtualize
      height={spec.height}
    />
  )
}

/** `mode: 'inlineRow'` — the same transcript nested inside a collapsed→expandable `ThreadFeedRow`,
 * for the lazy-mount-then-kept-mounted `display: none` remount-measure path. */
function InlineRowFixture({ spec }: { spec: AgentSpec }): ReactElement {
  const messages = useMemo(() => buildAgentMessages(spec.messages), [spec.messages])
  const [expanded, setExpanded] = useState(false)
  const thread: AgentThread<TranscriptPart> = useMemo(
    () => ({
      id: 'agent-row',
      messages,
      outcome: { title: 'Fixture thread', summary: `${spec.messages} messages`, status: 'done' },
      status: 'done',
      read: true,
      createdAt: 0,
      updatedAt: 0,
    }),
    [messages, spec.messages],
  )
  return (
    <>
      <button type="button" data-testid="agent-row-toggle" onClick={() => setExpanded((v) => !v)}>
        Toggle
      </button>
      <ThreadFeedRow
        thread={thread}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onSend={() => {}}
        virtualize
        height={spec.height}
      />
    </>
  )
}

const STREAM_WORDS = Array.from({ length: 40 }, (_, i) => `word${i}`)
const STREAM_STEP_MS = 60

/** `mode: 'anchorToEnd'` — virtualized, plus a live turn driven purely through `liveParts`/
 * `liveStatus` (no transport needed) so a test can watch `anchorTo: 'end'` + `followOnAppend`
 * track a live append against a real scroll, then hold once the reader scrolls away. */
function AnchorToEndFixture({ spec }: { spec: AgentSpec }): ReactElement {
  const [messages, setMessages] = useState<ChatMessage<TranscriptPart>[]>(() =>
    buildAgentMessages(spec.messages),
  )
  const [liveParts, setLiveParts] = useState<TranscriptPart[] | undefined>(undefined)
  const [liveStatus, setLiveStatus] = useState<StreamStatus | undefined>(undefined)

  const start = useCallback(() => {
    let i = 0
    setLiveStatus('streaming')
    setLiveParts([{ id: 'live-p1', type: 'text', text: '' }])
    const interval = setInterval(() => {
      i += 1
      const text = STREAM_WORDS.slice(0, i).join(' ')
      setLiveParts([{ id: 'live-p1', type: 'text', text }])
      if (i >= STREAM_WORDS.length) {
        clearInterval(interval)
        setMessages((prev) => [
          ...prev,
          {
            id: 'live-final',
            role: 'assistant',
            parts: [{ id: 'live-p1', type: 'text', text }],
            createdAt: Date.now(),
          },
        ])
        setLiveParts(undefined)
        setLiveStatus(undefined)
      }
    }, STREAM_STEP_MS)
  }, [])

  return (
    <>
      <button type="button" data-testid="agent-start-stream" onClick={start}>
        Start streaming
      </button>
      <ThreadTranscript
        className="lyt-agent-scroll"
        messages={messages}
        {...(liveParts !== undefined && { liveParts })}
        {...(liveStatus !== undefined && { liveStatus })}
        virtualize
        height={spec.height}
      />
    </>
  )
}

function AgentFixture({ spec }: { spec: AgentSpec }): ReactElement {
  if (spec.mode === 'inlineRow') return <InlineRowFixture spec={spec} />
  if (spec.mode === 'anchorToEnd') return <AnchorToEndFixture spec={spec} />
  return <VirtualizedTranscriptFixture spec={spec} />
}

export function ShellFixture({ spec }: { spec: FixtureSpec }): ReactElement {
  const icons = spec.icons ?? true
  const sections: SidebarSection[] = spec.sections.map((section) => ({
    label: section.label,
    items: section.items.map((item) => toItem(item, icons)),
    ...(section.tab ? { mobile: { tab: true as const } } : {}),
  }))
  return (
    <BasaltShell
      brand={{ name: 'Fixture' }}
      sections={sections}
      {...(spec.nav && { mobileNav: spec.nav })}
    >
      {spec.aside && !spec.aside.noBar && <AsideBar />}
      {spec.bar && <BarFixture spec={spec.bar} />}
      {spec.stats !== undefined && <StatsFixture count={spec.stats} />}
      {spec.table && <TableFixture spec={spec.table} />}
      {spec.charts && <ChartsFixture spec={spec.charts} />}
      {spec.agent && <AgentFixture spec={spec.agent} />}
      {/* theme-allow -- a measured filler height IS the fixture's payload, not a themed size */}
      <div style={{ height: spec.bodyHeight ?? 0 }} />
      <div data-testid="content-end">end of content</div>
      {/* Written AFTER the main column on purpose — that is the order the in-flow mobile form
          inherits, and the order a consumer page uses. */}
      {spec.aside && <AsideFixture spec={spec.aside} />}
    </BasaltShell>
  )
}
