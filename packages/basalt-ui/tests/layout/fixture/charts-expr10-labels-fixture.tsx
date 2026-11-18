/**
 * The `charts-expr10-labels` fixture (v3-expr-10-kit-fixes 1 and 2): the labels that name the
 * answer at 390. Each probe sits in a `data-testid` box: `e10-bar` (hourly stacked bars, the worst
 * hour under a vertical rule and a peak rule, value labels on), `e10-zone` (three lines crossing a
 * frost rule, a labelled zone per run), `e10-today` (dense dots under a labelled 'Today' rule) and
 * `e10-end` (three lines that end among each other, named at their ends). No shell. Entry of
 * `charts-expr10-labels.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'

const color = (n: number) => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})
const HOUR_MS = 3_600_000
const START = Date.UTC(2026, 10, 9)

type Hour = { at: Date; from: number; other: number }
const PEAK_HOUR = 120
const HOURS: Hour[] = Array.from({ length: 168 }, (_, h) => ({
  at: new Date(START + h * HOUR_MS),
  from: h === PEAK_HOUR ? 39 : (h * 7) % 9,
  other: h === PEAK_HOUR ? 12 : (h * 5) % 4,
}))
const DAY_STARTS = Array.from({ length: 7 }, (_, d) => new Date(START + d * 24 * HOUR_MS))

function BarProbe() {
  return (
    <div data-testid="e10-bar" className="min-w-0">
      <ChartCard
        title="e10-bar"
        chart={(box) => (
          <Bars<Hour>
            label="Fallbacks per hour"
            data={HOURS}
            height={box.height}
            x={{
              value: (h) => h.at,
              ticks: DAY_STARTS,
              format: (x) => new Date(x).toISOString().slice(5, 10),
            }}
            y={{ domain: [0, 70], format: (v) => `${Math.round(v)}%` }}
            refLines={[
              { axis: 'x', value: HOURS[PEAK_HOUR]?.at as Date, color: color(2), dashed: true },
              { value: 51, color: color(2), dashed: true, label: 'Peak 51%' },
            ]}
            series={[
              {
                mark: 'bar',
                key: 'from',
                label: 'First',
                color: color(1),
                y: (h) => h.from,
                values: (v) => `${Math.round(v)}%`,
              },
              { mark: 'bar', key: 'other', label: 'Other', color: color(3), y: (h) => h.other },
            ]}
          />
        )}
      />
    </div>
  )
}

type Temp = { h: number; a: number; b: number; c: number }
/** Five nights of three models around 0, every night dipping under it: a run per night. */
const TEMPS: Temp[] = Array.from({ length: 121 }, (_, h) => {
  const night = Math.cos(((h % 24) / 24) * 2 * Math.PI)
  return { h, a: 2.2 * night - 0.2, b: 2 * night + 0.4, c: 2.4 * night - 0.6 }
})
const RUNS = [0, 1, 2, 3, 4].map((n) => ({ from: n * 24 + 9, to: n * 24 + 15 }))

function ZoneProbe() {
  return (
    <div data-testid="e10-zone" className="min-w-0">
      <ChartCard
        title="e10-zone"
        chart={(box) => (
          <CartesianChart<Temp>
            label="Hourly temperature of three models"
            data={TEMPS}
            height={box.height}
            x={{ value: (t) => t.h, domain: [0, 120] }}
            y={{ domain: [-3, 3] }}
            series={[
              { mark: 'line', key: 'a', label: 'A', color: color(1), y: (t) => t.a },
              { mark: 'line', key: 'b', label: 'B', color: color(2), y: (t) => t.b },
              { mark: 'line', key: 'c', label: 'C', color: color(3), y: (t) => t.c },
            ]}
            refLines={[{ value: 0, color: color(4), dashed: true, label: 'Frost, 0 C' }]}
            zones={RUNS.map((r, i) => ({
              axis: 'x' as const,
              from: r.from,
              to: r.to,
              y: { from: -3, to: 0 },
              fill: 'var(--basalt-warn)',
              label: `${5 + i} h`,
            }))}
          />
        )}
      />
    </div>
  )
}

type Task = { day: number; a: number; b: number; c: number }
const TASKS: Task[] = Array.from({ length: 30 }, (_, day) => ({
  day,
  a: 3 + 2.8 * Math.sin(day * 1.7),
  b: 3 + 2.8 * Math.sin(day * 1.7 + 2),
  c: 3 + 2.8 * Math.sin(day * 1.7 + 4),
}))

function TodayProbe() {
  return (
    <div data-testid="e10-today" className="min-w-0">
      <ChartCard
        title="e10-today"
        chart={(box) => (
          <CartesianChart<Task>
            label="Tasks per day"
            data={TASKS}
            height={box.height}
            x={{ value: (t) => t.day, domain: [0, 29] }}
            y={{ domain: [0, 6] }}
            series={[
              { mark: 'dot', key: 'a', label: 'Errands', color: color(1), y: (t) => t.a },
              { mark: 'dot', key: 'b', label: 'Home', color: color(2), y: (t) => t.b },
              { mark: 'dot', key: 'c', label: 'Reading', color: color(3), y: (t) => t.c },
            ]}
            refLines={[{ axis: 'x', value: 15, color: color(4), dashed: true, label: 'Today' }]}
          />
        )}
      />
    </div>
  )
}

type Load = { m: number; a: number; b: number; c: number }
/** CPU pegged at the plot's top, memory and disk jagged and crossing over their last stretch. */
const LOADS: Load[] = Array.from({ length: 60 }, (_, m) => ({
  m,
  a: m > 40 ? 100 : 60 + 40 * Math.sin(m / 9),
  b: 62 + 9 * Math.sin(m * 1.3) - (m > 50 ? (m - 50) * 0.8 : 0),
  c: 58 + 9 * Math.cos(m * 1.1) + (m > 50 ? (m - 50) * 0.6 : 0),
}))

function EndProbe() {
  return (
    <div data-testid="e10-end" className="min-w-0">
      <ChartCard
        title="e10-end"
        chart={(box) => (
          <Lines<Load>
            label="Load of three services"
            data={LOADS}
            height={box.height}
            naming="endLabels"
            x={{ value: (l) => l.m, domain: [0, 59] }}
            y={{ domain: [0, 100] }}
            series={[
              { mark: 'line', key: 'a', label: 'CPU', color: color(1), y: (l) => l.a },
              { mark: 'line', key: 'b', label: 'Memory', color: color(2), y: (l) => l.b },
              { mark: 'line', key: 'c', label: 'Disk', color: color(3), y: (l) => l.c },
            ]}
          />
        )}
      />
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <BarProbe />
      <ZoneProbe />
      <TodayProbe />
      <EndProbe />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
