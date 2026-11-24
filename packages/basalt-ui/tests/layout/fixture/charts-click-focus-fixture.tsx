/**
 * The `charts-click-focus` fixture: one probe per chart kind. The sparkline comes last: its decorative
 * line svg is hit-testable beyond its box and would take a click meant for the probe below it., each after a plain `button` so a Tab from
 * that button lands on the probe's tab stop. Entry of `charts-click-focus.layout.test.ts`, which bundles
 * it in memory; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` section preceded by a `cf-before-<kind>` button: `cf-lines`, `cf-bars`,
 * `cf-cartesian`, `cf-heatmap`, `cf-band-strip`, `cf-interval-track`, `cf-sparkline`, and `cf-seam`, a
 * hand-drawn host spreading `focus.target` and `focus.item`.
 */
import { createRoot } from 'react-dom/client'
import { useChartFocus } from '../../../src/charts/focus'
import { BandStrip } from '../../../src/charts/parts/band-strip'
import type { BandSpan, BandStripSeries } from '../../../src/charts/parts/band-strip'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Heatmap } from '../../../src/charts/parts/heatmap'
import { IntervalTrack } from '../../../src/charts/parts/interval-track'
import type { IntervalSeries } from '../../../src/charts/parts/interval-track'
import { Lines } from '../../../src/charts/parts/lines'
import { Sparkline } from '../../../src/charts/parts/sparkline'

const BOX = 'flex min-w-0 flex-col gap-2'
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }

type Row = { day: Date; a: number; b: number }
const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 8, i + 1)),
  a: 40 + Math.round(Math.sin(i / 3) * 20) + i,
  b: 25 + Math.round(Math.cos(i / 4) * 10),
}))
const x = { value: (d: Row): Date => d.day }
const announceRow = (d: Row): string => `${d.day.toISOString().slice(0, 10)}: ${d.a} requests`

const lineA = {
  mark: 'line',
  key: 'a',
  label: 'Requests',
  color: blue,
  y: (d: Row) => d.a,
} as const
const lineB = {
  mark: 'line',
  key: 'b',
  label: 'Errors',
  color: amber,
  y: (d: Row) => d.b,
  dash: true,
} as const
const barA = { mark: 'bar', key: 'a', label: 'Requests', color: blue, y: (d: Row) => d.a } as const
const barB = { mark: 'bar', key: 'b', label: 'Errors', color: amber, y: (d: Row) => d.b } as const

function LinesProbe() {
  const focus = useChartFocus(rows, { announce: announceRow })
  return (
    <section className={BOX} data-testid="cf-lines">
      <h2 className="text-sm">Lines</h2>
      <Lines
        label="Requests and errors per day"
        data={rows}
        x={x}
        series={[lineA, lineB]}
        focus={focus}
      />
    </section>
  )
}

function BarsProbe() {
  const focus = useChartFocus(rows, { announce: announceRow })
  return (
    <section className={BOX} data-testid="cf-bars">
      <h2 className="text-sm">Bars</h2>
      <Bars
        label="Requests and errors, stacked"
        data={rows}
        x={x}
        series={[barA, barB]}
        focus={focus}
      />
    </section>
  )
}

function CartesianProbe() {
  const focus = useChartFocus(rows, { announce: announceRow })
  return (
    <section className={BOX} data-testid="cf-cartesian">
      <h2 className="text-sm">Cartesian</h2>
      <CartesianChart
        label="Requests as bars, errors as a line, spikes as dots"
        data={rows}
        x={x}
        series={[
          barA,
          lineB,
          {
            mark: 'dot',
            key: 'spike',
            label: 'Spikes',
            color: amber,
            y: (d: Row) => (d.a > 70 ? d.a : null),
          },
        ]}
        focus={focus}
      />
    </section>
  )
}

type Cell = { row: string; col: string; v: number }
const DAY_ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const cells: Cell[] = DAY_ROWS.flatMap((row, r) =>
  Array.from({ length: 12 }, (_, c) => ({
    row,
    col: String(c * 2).padStart(2, '0'),
    v: (r * 7 + c * 5) % 11,
  })),
)

function HeatmapProbe() {
  const focus = useChartFocus(cells, {
    announce: (c) => `${c.row} ${c.col}h: ${c.v}`,
  })
  return (
    <section className={BOX} data-testid="cf-heatmap">
      <h2 className="text-sm">Heatmap</h2>
      <Heatmap
        label="Events per weekday and hour"
        data={cells}
        getRow={(c) => c.row}
        getCol={(c) => c.col}
        getValue={(c) => c.v}
        focus={focus}
      />
    </section>
  )
}

type Slot = { t: string; s: 'up' | 'down' }
const SLOTS: Slot[] = Array.from({ length: 24 }, (_, i) => ({
  t: `s${String(i).padStart(2, '0')}`,
  s: i % 5 === 3 ? 'down' : 'up',
}))
const up: BandStripSeries<Slot> = { key: 'up', label: 'Up', color: 'var(--basalt-good)' }
const down: BandStripSeries<Slot> = { key: 'down', label: 'Down', color: 'var(--basalt-bad)' }
const getBand = (d: Slot): BandSpan => ({ state: d.s })

function BandStripProbe() {
  return (
    <section className={BOX} data-testid="cf-band-strip">
      <h2 className="text-sm">Band strip</h2>
      <BandStrip
        label="Availability"
        data={SLOTS}
        x={(d) => d.t}
        states={[up, down]}
        getBand={getBand}
      />
    </section>
  )
}

type Span = { day: string; start: number; end: number; title: string; kind: 'meeting' | 'focus' }
const at = (clock: string): number => {
  const [h = '0', m = '0'] = clock.split(':')
  return Number(h) * 60 + Number(m)
}
const span = (day: string, from: string, to: string, title: string, kind: Span['kind']): Span => ({
  day,
  start: at(from),
  end: at(to),
  title,
  kind,
})
const SPANS: readonly Span[] = [
  span('Mon 23', '09:00', '09:15', 'Standup', 'meeting'),
  span('Mon 23', '09:15', '10:30', 'Plan the release', 'focus'),
  span('Mon 23', '10:30', '11:30', 'Design review', 'meeting'),
  span('Tue 24', '09:00', '09:15', 'Standup', 'meeting'),
  span('Tue 24', '09:15', '10:00', 'Inbox and reviews', 'focus'),
  span('Tue 24', '10:00', '11:00', 'Sprint planning', 'meeting'),
  span('Wed 25', '09:00', '09:15', 'Standup', 'meeting'),
  span('Wed 25', '10:00', '10:45', 'Architecture review', 'focus'),
  span('Wed 25', '10:45', '11:30', 'Candidate interview', 'meeting'),
]
const TRACK_SERIES: readonly IntervalSeries<Span['kind']>[] = [
  { key: 'meeting', label: 'Meeting', color: blue },
  { key: 'focus', label: 'Focus', color: amber },
]
/** Minutes since midnight as a time on one shared UTC day, so the axis ticks whole hours. */
const day = (min: number): Date => new Date(Date.UTC(2026, 10, 23, 0, min))
const clock = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

function IntervalProbe() {
  const focus = useChartFocus(SPANS, { announce: (s) => `${s.title}, ${s.day}` })
  return (
    <section className={BOX} data-testid="cf-interval-track">
      <h2 className="text-sm">Interval track</h2>
      <IntervalTrack
        label="Events by workday"
        data={SPANS}
        rows={['Mon 23', 'Tue 24', 'Wed 25']}
        getRow={(d) => d.day}
        getStart={(d) => day(d.start)}
        getEnd={(d) => day(d.end)}
        series={TRACK_SERIES}
        getSeries={(d) => d.kind}
        getLabel={(d) => d.title}
        rowExtent={() => [day(at('09:00')), day(at('17:30'))]}
        xDomain={[day(at('09:00')), day(at('18:00'))]}
        formatX={clock}
        height={160}
        focus={focus}
      />
    </section>
  )
}

const DAYS = [12, 18, 9, 24, 31, 22, 40, 36, 28, 33, 45, 38, 52, 47]
const LABELS = ['Mon', 'Today', 'Sun'] as const

function SparklineProbe() {
  return (
    <section className={BOX} data-testid="cf-sparkline">
      <h2 className="text-sm">Sparkline</h2>
      <Sparkline points={DAYS} height={56} axisLabels={LABELS} label="Shipped per day" />
    </section>
  )
}

/** The seam probe: a waterfall of hand-drawn rows, the same geometry as `charts-seam-track`. */
const RUN = 8120
const RUN_SPANS = [
  { name: 'plan', start: 0, ms: 420 },
  { name: 'search docs', start: 420, ms: 1180 },
  { name: 'read files', start: 1600, ms: 310 },
  { name: 'call model', start: 1910, ms: 5480 },
  { name: 'write patch', start: 7390, ms: 560 },
  { name: 'verify', start: 7950, ms: 170 },
]

function SeamProbe() {
  const focus = useChartFocus(RUN_SPANS, {
    announce: (s) => `${s.name}: ${(s.ms / 1000).toFixed(2)} s`,
  })
  return (
    <section className={BOX} data-testid="cf-seam">
      <h2 className="text-sm">Seam</h2>
      <div {...focus.target} aria-label="Spans of the run" className="flex flex-col text-xs">
        {RUN_SPANS.map((s, i) => (
          <div
            key={s.name}
            {...focus.item(i)}
            className="grid grid-cols-[1fr_3fr] items-center gap-x-2 py-0.5"
          >
            <span className="truncate">{s.name}</span>
            <div data-track="" className="relative h-5">
              <div
                className="absolute inset-y-0.5 rounded-sm bg-dim-bar"
                style={{ left: `${(s.start / RUN) * 100}%`, width: `${(s.ms / RUN) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {focus.live}
    </section>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Chart focus on click and Tab</h1>
      <button type="button" data-testid="cf-before-lines">
        before
      </button>
      <LinesProbe />
      <button type="button" data-testid="cf-before-bars">
        before
      </button>
      <BarsProbe />
      <button type="button" data-testid="cf-before-cartesian">
        before
      </button>
      <CartesianProbe />
      <button type="button" data-testid="cf-before-heatmap">
        before
      </button>
      <HeatmapProbe />
      <button type="button" data-testid="cf-before-band-strip">
        before
      </button>
      <BandStripProbe />
      <button type="button" data-testid="cf-before-interval-track">
        before
      </button>
      <IntervalProbe />
      <button type="button" data-testid="cf-before-seam">
        before
      </button>
      <SeamProbe />
      <button type="button" data-testid="cf-before-sparkline">
        before
      </button>
      <SparklineProbe />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
