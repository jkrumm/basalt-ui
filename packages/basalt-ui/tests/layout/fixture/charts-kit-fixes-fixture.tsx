/**
 * The `charts-kit-fixes` fixture (v3-expr-3-kit-fixes): `Bars` and `CartesianChart` in a `ChartCard`
 * with a reference line that meets bars, a legend, negative bars, a dot on the plot floor, and a
 * scroll region of rows linked to a chart. No shell. Entry of `charts-kit-fixes.layout.test.ts`.
 *
 * Probes, each in a `data-testid` box: `kf-ref` (a line a tall last bar covers), `kf-ref-start`
 * (the same with a spot at the start), `kf-legend` (two bar series), `kf-neg` (negative bars and a
 * legend), `kf-dot` (a dot on the floor), `kf-focus` (a 96 px scroll region of 12 rows) with
 * `kf-focus-set` (focuses row 11).
 */
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Bars } from '../../../src/charts/parts/bars'
import type { BarsSeries } from '../../../src/charts/parts/bars'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { useChartFocus } from '../../../src/charts/focus'

type Row = { day: Date; a: number; b: number }
const day = (i: number): Date => new Date(Date.UTC(2026, 9, 5 + i))
const x = { value: (d: Row): Date => d.day }
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }
const red = { light: '#b42318', dark: '#f97066' }

/** Hours worked: every bar is over the line at 7, the last is the tallest, so no spot is clear. */
const covered: Row[] = [8, 8.5, 9, 8, 7.5, 8.5, 9, 9, 8.2, 8, 8.8, 9.5].map((a, i) => ({
  day: day(i),
  a,
  b: 2,
}))
/** Hours worked with the first bars short: the start of the plot is clear above the line. */
const startClear: Row[] = covered.map((r, i) => ({ ...r, a: i < 3 ? r.a - 5 : r.a }))
const two: Row[] = Array.from({ length: 12 }, (_, i) => ({
  day: day(i),
  a: 4 + (i % 5),
  b: 2 + (i % 3),
}))
const mixed: Row[] = Array.from({ length: 12 }, (_, i) => ({
  day: day(i),
  a: i % 3 === 0 ? -(2 + (i % 4)) : 3 + (i % 4),
  b: 0,
}))

const barA = { mark: 'bar', key: 'a', label: 'Worked', color: blue, y: (d: Row) => d.a } as const
const barB = { mark: 'bar', key: 'b', label: 'Idle', color: amber, y: (d: Row) => d.b } as const

const BOX = 'min-w-0'
const REF = [{ value: 7, color: red, dashed: true, label: 'Need 7h' }] as const

function Card(props: {
  id: string
  rows: Row[]
  series: BarsSeries<Row>[]
  refLines?: typeof REF
  /** A slot that states no height of its own: the chart's own height law applies. */
  free?: boolean
}) {
  return (
    <div data-testid={props.id} className={BOX}>
      <ChartCard
        title={props.id}
        chart={(box) => (
          <Bars
            label={props.id}
            data={props.rows}
            x={x}
            series={props.series}
            {...(props.free !== true && { height: box.height })}
            {...(props.refLines && { refLines: props.refLines })}
          />
        )}
      />
    </div>
  )
}

/** A period that wraps onto two or three lines at 390 and sits on one beside the figure at 1800 (expression cycle 8, n29 and n31). */
const LONG_PERIOD = 'tagged, 12,400 of 30,100 spent at merchants with untagged bookings this year'

/** One card per phase, each declaring its figure's period and a footer fact, as a page that wants a held height does. */
function PeriodCard({ phase }: { phase: 'ready' | 'loading' | 'error' }) {
  const ready = phase === 'ready'
  return (
    <div data-testid={`kf-period-${phase}`} className={BOX}>
      <ChartCard
        title="Spending tagged for tax"
        phase={ready ? undefined : phase === 'error' ? { tag: 'error' } : 'loading'}
        height="short"
        figure={{ value: ready ? '61%' : null, period: LONG_PERIOD }}
        footer={[{ label: 'Untagged bookings', value: ready ? 14 : 0 }]}
        chart={() => <div className="h-full" />}
      />
    </div>
  )
}

/** A page that fills its figure only when ready: loading and error declare a null value and no period (expression cycle 9, n34, n35, n38). */
function LazyCard({ phase }: { phase: 'ready' | 'loading' | 'error' }) {
  const ready = phase === 'ready'
  return (
    <div data-testid={`kf-lazy-${phase}`} className={BOX}>
      <ChartCard
        title="Water over the bar"
        phase={ready ? undefined : phase === 'error' ? { tag: 'error' } : 'loading'}
        height="short"
        figure={ready ? { value: 'Go Fri 03:00', period: '2 windows, 7 h' } : { value: null }}
        footer={[{ label: 'Calm hours', value: ready ? 14 : 0 }]}
        chart={() => <div className="h-full" />}
      />
    </div>
  )
}

type Pt = { n: number; v: number }
const points: Pt[] = Array.from({ length: 8 }, (_, n) => ({ n, v: n === 3 ? 0 : 1 + (n % 3) }))

function Focus() {
  const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({ day: day(i), a: i, b: 0 }))
  const focus = useChartFocus(rows, { announce: (d) => `row ${d.a}` })
  return (
    <div data-testid="kf-focus" className={BOX}>
      <button type="button" data-testid="kf-focus-set" onClick={() => focus.set(11)}>
        focus 11
      </button>
      <button type="button" data-testid="kf-focus-clear" onClick={() => focus.set(null)}>
        clear
      </button>
      <div data-testid="kf-focus-list" className="h-24 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} data-row={i} className="h-8 text-foreground" {...focus.item(i)}>
            Row {i}
          </div>
        ))}
      </div>
      {focus.live}
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Kit fixes</h1>
      <Card id="kf-ref" rows={covered} series={[barA]} refLines={REF} />
      <Card id="kf-ref-start" rows={startClear} series={[barA]} refLines={REF} />
      <Card id="kf-legend" rows={two} series={[barA, barB]} />
      <Card id="kf-legend-free" rows={two} series={[barA, barB]} free />
      <Card id="kf-neg" rows={mixed} series={[barA, barB]} />
      <div data-testid="kf-dot" className={BOX}>
        <ChartCard
          title="Dot on the floor"
          chart={(box) => (
            <CartesianChart<Pt>
              label="A dot on the floor"
              data={points}
              x={{ value: (d) => d.n }}
              y={{ domain: [0, 4] }}
              series={[{ mark: 'dot', key: 'v', label: 'Value', color: blue, y: (d: Pt) => d.v }]}
              height={box.height}
            />
          )}
        />
      </div>
      <Focus />
      <PeriodCard phase="ready" />
      <PeriodCard phase="loading" />
      <PeriodCard phase="error" />
      <LazyCard phase="ready" />
      <LazyCard phase="loading" />
      <LazyCard phase="error" />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
