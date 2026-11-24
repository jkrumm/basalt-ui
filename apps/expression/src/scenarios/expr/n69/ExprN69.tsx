/**
 * Lead routing across five Claude accounts: which account takes the next lead, which one fills before
 * its week resets, and how much of each reset's allowance went unused. Design contract: DESIGN.md.
 */
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase, Tone } from 'basalt-ui/cards'
import { ChartCard, Heatmap, Sparkline, useChartFocus } from 'basalt-ui/charts'
import type { HeatmapState } from 'basalt-ui/charts'
import { createFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { Num } from 'basalt-ui/ui/num'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { NOW, SEAT_CAP, snapshotFor } from './fixture'
import type { Mode, Snapshot } from './fixture'
import {
  cellsOf,
  COLS,
  fleetUnusedPerReset,
  fullResets,
  NEXT_COL,
  PAST_COLS,
  routeRows,
  worstReset,
} from './model'
import type { Cell, Route, Row } from './model'

// cycle-expression-15: the kit ships no icon set, so the three strip icons are one-path glyphs drawn here.
function glyph(d: string): (props: { className?: string }) => ReactElement {
  return function Glyph({ className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    )
  }
}
const RouteGlyph = glyph('M5 4v6a4 4 0 0 0 4 4h6M5 4 3 6m2-2 2 2M19 14v6m0 0-2-2m2 2 2-2')
const FillGlyph = glyph('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2')
const LeftoverGlyph = glyph('M4 20V10M10 20V4M16 20v-7M22 20H2')

const ROUTES = ['next', 'open', 'fills', 'closed', 'stale'] as const satisfies readonly Route[]
const ROUTE_LABEL: Record<Route, string> = {
  next: 'Takes lead',
  open: 'Eligible',
  fills: 'Fills early',
  closed: 'Closed',
  stale: 'Stale',
}
// accent: the account that answers; warn: the one that needs a hand; everything else stays neutral.
const ROUTE_TONE: Record<Route, Tone> = {
  next: 'accent',
  open: 'neutral',
  fills: 'warn',
  closed: 'neutral',
  stale: 'neutral',
}

const MODE_LABEL: Record<Mode, string> = {
  normal: 'Normal',
  'fill-first': 'Fill first',
  held: 'Held',
  paused: 'Paused',
}

type TableRow = {
  id: string
  name: string
  sub: string
  route: Route
  weekUse: number
  fiveHourUse: number
  seatsTaken: number
  fullAtLabel: string | null
  fullAtMs: number | null
  weekResetMs: number
  weekResetLabel: string
  fiveHourResetLabel: string
}

const c = col<TableRow>()
// cycle-expression-15: no column kind prints a time of day from a fixed clock, so the three time columns are `c.custom` over text formatted here.
const COLUMNS = [
  c.entity('name', { header: 'Account', priority: 1, sub: (r) => r.sub, width: 'content' }),
  c.status('route', {
    header: 'Routing',
    priority: 1,
    card: 'value',
    options: ROUTES,
    labels: ROUTE_LABEL,
    tone: (r) => ROUTE_TONE[r],
  }),
  c.meter('weekUse', { header: 'Week, %', max: 100, priority: 2, card: 'meta' }),
  c.meter('fiveHourUse', { header: '5 h, %', max: 100, priority: 2, card: 'meta' }),
  c.custom('fullAt', {
    header: 'Full by',
    width: 10,
    priority: 2,
    card: 'meta',
    sortValue: (r) => r.fullAtMs,
    render: (r) =>
      r.fullAtLabel === null ? (
        <Num value={null} />
      ) : (
        <span className="font-mono tabular-nums">{r.fullAtLabel}</span>
      ),
  }),
  c.meter('seatsTaken', {
    header: `Seats of ${SEAT_CAP}`,
    max: SEAT_CAP,
    priority: 3,
    card: 'meta',
  }),
  c.custom('resetAt', {
    header: 'Resets',
    width: 14,
    priority: 3,
    card: 'meta',
    sortValue: (r) => r.weekResetMs,
    render: (r) => (
      <span className="flex flex-col font-mono tabular-nums">
        <span>{r.weekResetLabel}</span>
        <span>{r.fiveHourResetLabel}</span>
      </span>
    ),
  }),
]

const HEAT_STATES: readonly HeatmapState<'full' | 'none'>[] = [
  { key: 'full', label: 'Will fill', tone: 'warn', glyph: '' },
  { key: 'none', label: 'No forecast', color: BASALT.hairline, glyph: '–' },
]

/** The ramp tops out here; a reset that left more reads as the darkest step and carries its true value. */
const HEAT_TOP = 50
/** A change of fewer points than this across resets is noise: its pill stays neutral. */
const NOISE_PTS = 3

const getRow = (d: Cell) => d.id
const getCol = (d: Cell) => d.col
const getValue = (d: Cell) => d.unused
const getState = (d: Cell) => d.state
const TICK_COLS = [PAST_COLS[0] ?? '', '-4', '-1', NEXT_COL]
const colText = (k: string) => (k === NEXT_COL ? 'Next' : k.replace('-', '−'))
const ago = (k: string) => `${-Number(k)} ${k === '-1' ? 'reset' : 'resets'} ago`
const whenOf = (d: Cell) => (d.col === NEXT_COL ? 'forecast' : ago(d.col))

const formatPercent = (n: number) => `${n} %`
const formatLegend = (n: number) => (n >= HEAT_TOP ? `${n} %+` : `${n} %`)

const reloadAccounts = () => undefined
const reloadHistory = () => undefined

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1)
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

const FORMAT = createFormat()
const clock = (iso: string) =>
  FORMAT.time(new Date(iso), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const stamp = (iso: string) => `${FORMAT.date(new Date(iso), 'weekday')} ${clock(iso)}`

const annotate = (d: Cell) =>
  d.state === 'full' && d.fullAt !== null
    ? stamp(d.fullAt)
    : d.state === undefined && d.unused !== null
      ? String(d.unused)
      : null
const cellText = (d: Cell) =>
  d.state === undefined
    ? `${d.unused} % unused`
    : `${HEAT_STATES.find((s) => s.key === d.state)?.label.toLowerCase()} ${d.state === 'full' && d.fullAt !== null ? stamp(d.fullAt) : d.missing}`
const sayCell = (d: Cell) => `${d.name}, ${whenOf(d)}: ${cellText(d)}`

const HEAT_DOMAIN = [0, HEAT_TOP] as const
const HEAT_LEGEND = { label: '% of the allowance' }

const toTableRow = (r: Row): TableRow => ({
  id: r.id,
  name: r.name,
  sub: [
    r.readAgeH !== null
      ? null
      : r.mode === 'held'
        ? `${r.heldFor ?? 'One model'} only`
        : MODE_LABEL[r.mode],
    r.readAgeH === null ? null : `${r.readAgeH} h old`,
  ]
    .filter((part) => part !== null)
    .join(', '),
  route: r.route,
  weekUse: r.weekUse,
  fiveHourUse: r.fiveHourUse,
  seatsTaken: r.seatsTaken,
  fullAtLabel: r.fullAt === null ? null : stamp(r.fullAt),
  fullAtMs: r.fullAt === null ? null : Date.parse(r.fullAt),
  weekResetMs: Date.parse(r.weekResetAt),
  weekResetLabel: stamp(r.weekResetAt),
  fiveHourResetLabel: clock(r.fiveHourResetAt),
})

/** Everything the page reads off one snapshot, built once at module scope so the chart props keep their identity across renders. */
function buildView(snapshot: Snapshot) {
  const rows = routeRows(snapshot)
  const cells = cellsOf(rows)
  const perReset = fleetUnusedPerReset(rows)
  const names = new Map(rows.map((r) => [r.id, r.name]))
  const unusedMean = Math.round(mean(perReset))
  return {
    rows,
    cells,
    rowIds: rows.map((r) => r.id),
    rowName: (id: string) => names.get(id) ?? id,
    tableRows: rows.map(toTableRow),
    next: rows.find((r) => r.route === 'next'),
    fills: rows
      .filter((r) => r.fullAt !== null)
      .toSorted((a, b) => Date.parse(a.fullAt ?? '') - Date.parse(b.fullAt ?? ''))[0],
    sparkSeries: perReset.map((value, i) => ({ value, label: colText(PAST_COLS[i] ?? '') })),
    unusedMean,
    unusedShift: Math.round(mean(perReset.slice(4)) - mean(perReset.slice(0, 4))),
    worst: worstReset(cells),
    fullest: rows.toSorted((a, b) => fullResets(b) - fullResets(a))[0],
  }
}
type View = ReturnType<typeof buildView>

const VIEWS: Readonly<Record<string, View>> = {
  default: buildView(snapshotFor(undefined)),
  quiet: buildView(snapshotFor('quiet')),
  extreme: buildView(snapshotFor('extreme')),
  none: buildView(snapshotFor('none')),
}
const EMPTY_VIEW = buildView({ now: NOW, accounts: [] })
const DEFAULT_VIEW = VIEWS['default'] ?? EMPTY_VIEW
/** The table body: the head row and one 41 px row, two lines of mono time, per account. */
const TABLE_PX = DEFAULT_VIEW.rows.length * 41 + 34

// cycle-expression-15: the `primitive-bypass` rule reads a StatCell as no card frame around an inline Sparkline, so the strip's trend is its own component.
function FleetTrend({
  series,
  height,
}: {
  series: View['sparkSeries']
  height: number | 'fill'
}): ReactElement {
  return (
    <Sparkline
      points={series}
      height={height}
      format={formatPercent}
      label="Fleet mean, oldest first"
    />
  )
}

export function ExprN69Scenario({ shotState, fixture }: ScenarioProps) {
  const accountsPhase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: reloadAccounts }
        : 'ready'
  const historyPhase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: reloadHistory }
        : 'ready'
  const ready = shotState === undefined
  const noAccounts = shotState === 'empty'
  const v = ready ? (VIEWS[fixture ?? ''] ?? DEFAULT_VIEW) : EMPTY_VIEW
  const { next, fills, worst, fullest } = v
  // A figure derived from rows is computed in the ready phase only.
  const lockedMs =
    fills === undefined ? 0 : Date.parse(fills.weekResetAt) - Date.parse(fills.fullAt ?? NOW)

  const focus = useChartFocus(v.cells, { announce: sayCell, columns: COLS.length })
  const table = useDataTable({
    id: 'expr-n69-accounts',
    label: 'Usage table',
    columns: COLUMNS,
    data: v.tableRows,
    phase: accountsPhase,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    // cycle-expression-15: a 'columns' table with no rows draws its head at a few pixels wide on a phone, so the empty and error frames take cards.
    phone: shotState === 'empty' || shotState === 'error' ? 'cards' : 'columns',
    bodyRows: DEFAULT_VIEW.rows.length,
  })

  const heldRest = worst === undefined ? '' : `Worst: ${worst.name}, ${ago(worst.col)}`
  const heldRun = (run: readonly Cell[]) => {
    const unused = run.flatMap((d) => (d.col === NEXT_COL || d.unused === null ? [] : [d.unused]))
    return `${run[0]?.name ?? ''}: ${Math.round(mean(unused))} % on average`
  }
  const period = focus.span.length > 1 ? heldRun(focus.span) : focus.readout(heldRest, sayCell)

  return (
    <Page area="expr-n69">
      <PageBar title="Lead routing across five Claude accounts" />
      <StatGroup variant="strip" label="Answers">
        <StatCell
          icon={RouteGlyph}
          title="Next lead"
          value={next?.name ?? null}
          sub={next === undefined ? '' : `As of ${clock(next.readAt)}`}
          subMono
          status={{
            tone: next === undefined ? 'neutral' : 'accent',
            label: !ready ? '' : next === undefined ? 'None open' : MODE_LABEL[next.mode],
          }}
          meter={{
            label: 'Seats open',
            value: next === undefined ? null : next.seatCap - next.seatsTaken,
            max: SEAT_CAP,
            format: (n) => `${n} free`,
          }}
          phase={accountsPhase}
          empty={noAccounts ? { cause: 'Nothing connected.' } : null}
        />
        <StatCell
          icon={FillGlyph}
          title="Fills before reset"
          value={fills?.name ?? null}
          sub={fills === undefined ? '' : stamp(fills.fullAt ?? NOW)}
          subMono
          meter={{
            label: 'Projected use',
            value: fills === undefined ? null : (fills.projectedAtReset ?? 100),
            max: 120,
            zones: [
              { to: 99, tone: 'neutral', label: 'Under cap' },
              { to: 100, tone: 'warn', label: 'At cap' },
              { to: 120, tone: 'warn', label: 'Over cap' },
            ],
            format: (n) => `${n} %`,
          }}
          status={{
            tone: fills === undefined ? 'neutral' : 'warn',
            label: !ready
              ? ''
              : fills === undefined
                ? 'None on pace'
                : `${Math.round(lockedMs / 3_600_000)} h locked`,
          }}
          phase={accountsPhase}
          empty={noAccounts ? { cause: 'No pace to read.' } : null}
        />
        <StatCell
          icon={LeftoverGlyph}
          title="Unused on average"
          value={ready ? v.unusedMean : null}
          unit="%"
          delta={{
            value: ready ? `${signed(v.unusedShift)} pts` : '',
            polarity: Math.abs(v.unusedShift) < NOISE_PTS ? 'neutral' : 'up-bad',
            label: 'vs prior 4',
          }}
          chart={(box) => <FleetTrend series={v.sparkSeries} height={box.height} />}
          phase={historyPhase}
          empty={noAccounts ? { cause: 'Nothing recorded.' } : null}
        />
      </StatGroup>
      <DataPanel
        title="Accounts"
        subtitle="Times UTC, ranked by mode then week left."
        phase={accountsPhase}
        empty={
          noAccounts
            ? {
                cause: 'No Claude account is connected. Connect one to see its use here.',
                action: { label: 'Connect an account', href: '#connect' },
              }
            : null
        }
        bodySize={{ height: TABLE_PX }}
        body={() => (
          <DataTable
            table={table}
            height="fill"
            focusItems={{ focus, holds: (row, cell) => cell.id === row.id }}
          />
        )}
      />
      <ChartCard
        title="Unused allowance at each reset"
        subtitle="Resets back; Next is the forecast"
        phase={historyPhase}
        empty={
          noAccounts
            ? { cause: 'No history yet. The grid fills after the first weekly reset.' }
            : null
        }
        figure={{
          value: worst?.unused ?? null,
          unit: '%',
          delta: {
            value:
              ready && worst !== undefined
                ? `+${Math.round((((worst.unused ?? 0) - v.unusedMean) / Math.max(v.unusedMean, 1)) * 100)} %`
                : '',
            polarity: 'up-bad',
            label: 'over the mean',
          },
          period,
        }}
        footer={[
          {
            label: 'Used in full',
            value:
              !ready || fullest === undefined
                ? ''
                : fullResets(fullest) === 0
                  ? 'None'
                  : `${fullest.name}, ${fullResets(fullest)} of 8`,
          },
        ]}
        chart={() => (
          <Heatmap
            label="Allowance left, one row for each of the accounts"
            data={v.cells}
            getRow={getRow}
            getCol={getCol}
            getValue={getValue}
            getState={getState}
            states={HEAT_STATES}
            rows={v.rowIds}
            cols={COLS}
            color={BASALT.ink}
            domain={HEAT_DOMAIN}
            formatRow={v.rowName}
            formatCol={colText}
            formatValue={formatPercent}
            formatLegend={formatLegend}
            tickCols={TICK_COLS}
            annotate={annotate}
            legend={HEAT_LEGEND}
            tooltip={false}
            focus={focus}
            matchHeight
          />
        )}
      />
    </Page>
  )
}
