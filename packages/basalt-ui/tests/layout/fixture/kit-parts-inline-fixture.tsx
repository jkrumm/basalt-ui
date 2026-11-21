/**
 * A page of shipped chart parts written as an app without the React Compiler writes them: every
 * datum array, accessor, series, legend, tooltip and domain is a new value on each render, and each
 * kind that takes a `useChartFocus` has its focus built over that array. Bundled with the
 * production build and no compiler plugin, as a stock init'd app is. `window.fixtureProbe` counts every
 * component's renders and collects what React reports as an uncaught error. Entry of
 * `kit-parts-inline.layout.test.ts`.
 */
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from '../../../src/charts/focus'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Heatmap } from '../../../src/charts/parts/heatmap'
import { IntervalTrack } from '../../../src/charts/parts/interval-track'
import { Lines } from '../../../src/charts/parts/lines'
import { DataTable, col, useDataTable } from '../../../src/table'

type Probe = { renders: Record<string, number>; errors: string[] }
const probe: Probe = { renders: {}, errors: [] }
;(window as unknown as { fixtureProbe: Probe }).fixtureProbe = probe
const count = (name: string): void => {
  probe.renders[name] = (probe.renders[name] ?? 0) + 1
  if (probe.renders[name] > 300) throw new Error(`${name} rendered more than 300 times`)
}

const BLUE = { light: '#0b6bcb', dark: '#5aa9f0' }
const AMBER = { light: '#9a5b00', dark: '#e0a84a' }

type Day = { day: Date; a: number; b: number }
const days = (): Day[] =>
  Array.from({ length: 24 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 8, i + 1)),
    a: 40 + Math.round(Math.sin(i / 3) * 20) + i,
    b: 25 + Math.round(Math.cos(i / 4) * 10),
  }))

function LinesCard(): ReactElement {
  count('lines')
  const data = days()
  const focus = useChartFocus(data, { announce: (d) => d.day.toISOString() })
  return (
    <div data-testid="p-lines" className="min-w-0">
      <ChartCard
        title="Requests"
        subtitle="last 24 days"
        figure={{
          value: 12840,
          unit: 'req',
          period: focus.readout('last 24 days', (d) => String(d.a)),
        }}
        footer={[{ label: 'Peak', value: 1200 }]}
        chart={(box) => (
          <Lines
            label="Requests and errors per day"
            data={data}
            x={{ value: (d) => d.day }}
            series={[
              { mark: 'line', key: 'a', label: 'Requests', color: BLUE, y: (d) => d.a },
              { mark: 'line', key: 'b', label: 'Errors', color: AMBER, y: (d) => d.b },
            ]}
            focus={focus}
            height={box.height}
          />
        )}
      />
    </div>
  )
}

function BarsCard(): ReactElement {
  count('bars')
  const data = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((k, i) => ({
    k,
    a: 10 + i * 4,
    b: 6 + (i % 3) * 5,
  }))
  const focus = useChartFocus(data, { announce: (d) => d.k })
  return (
    <div data-testid="p-bars" className="min-w-0">
      <ChartCard
        title="Orders"
        subtitle="this week"
        figure={{
          value: 214,
          unit: 'orders',
          period: focus.readout('this week', (d) => String(d.a)),
        }}
        footer={[{ label: 'Best day', value: 'Fri' }]}
        chart={(box) => (
          <Bars
            label="Orders per weekday"
            data={data}
            x={{ value: (d) => d.k }}
            layout="grouped"
            series={[
              { mark: 'bar', key: 'a', label: 'New', color: BLUE, y: (d) => d.a },
              { mark: 'bar', key: 'b', label: 'Repeat', color: AMBER, y: (d) => d.b },
            ]}
            focus={focus}
            height={box.height}
          />
        )}
      />
    </div>
  )
}

type Metric = { key: string; label: string; now: number }
const c = col<Metric>()
const METRIC_COLUMNS = [
  c.entity('label', { header: 'Metric', priority: 1 }),
  c.number('now', { header: 'Today', digits: 0, priority: 1 }),
]

function HeatCard(): ReactElement {
  count('heat')
  const rows = ['Mon', 'Tue', 'Wed', 'Thu']
  const data = rows.flatMap((row, r) =>
    ['0', '6', '12', '18'].map((col, c) => ({ row, col, v: (r + 1) * (c + 1) * 3 })),
  )
  const focus = useChartFocus(data, { announce: (d) => `${d.row} ${d.col}` })
  const metrics: Metric[] = rows.map((row, r) => ({ key: row, label: row, now: (r + 1) * 12 }))
  const table = useDataTable<Metric>({
    id: 'metrics',
    label: 'The metrics today',
    columns: METRIC_COLUMNS,
    data: metrics,
    getRowId: (m) => m.key,
    mode: { kind: 'client' },
    bodyRows: 4,
  })
  return (
    <div data-testid="p-heat" className="min-w-0">
      <ChartCard
        title="Load"
        subtitle="by weekday and hour"
        figure={{
          value: 48,
          unit: 'peak',
          period: focus.readout('by weekday and hour', (d) => String(d.v)),
        }}
        footer={[{ label: 'Quietest', value: 'Mon' }]}
        chart={() => (
          <Heatmap
            label="Load by weekday and hour"
            data={data}
            getRow={(d) => d.row}
            getCol={(d) => d.col}
            getValue={(d) => d.v}
            rows={rows}
            domain={[0, 60]}
            legend={{ label: 'Load, 0 to 60' }}
            tooltip={{ valueLabel: 'Load' }}
            focus={focus}
          />
        )}
      />
      <div data-testid="p-heat-table">
        <DataTable
          table={table}
          focusItems={{ focus, holds: (row, cell) => cell.row === row.key }}
        />
      </div>
    </div>
  )
}

function BareCartesian(): ReactElement {
  count('cartesian')
  const data = days()
  const focus = useChartFocus(data, { announce: (d) => d.day.toISOString() })
  return (
    <div data-testid="p-cartesian" className="h-[220px] min-w-0">
      <CartesianChart
        label="Requests per day"
        data={data}
        x={{ value: (d) => d.day }}
        series={[{ mark: 'line', key: 'a', label: 'Requests', color: BLUE, y: (d) => d.a }]}
        focus={focus}
      />
    </div>
  )
}

function BareTrack(): ReactElement {
  count('track')
  const data = [
    { day: 'Mon', start: 540, end: 600, title: 'Standup', kind: 'meeting' as const },
    { day: 'Mon', start: 660, end: 780, title: 'Review', kind: 'meeting' as const },
    { day: 'Tue', start: 600, end: 720, title: 'Planning', kind: 'meeting' as const },
  ]
  const focus = useChartFocus(data, { announce: (d) => `${d.day} ${d.title}` })
  return (
    <div data-testid="p-track" className="h-[160px] min-w-0">
      <IntervalTrack
        label="The week"
        data={data}
        rows={['Mon', 'Tue']}
        getRow={(s) => s.day}
        getStart={(s) => s.start}
        getEnd={(s) => s.end}
        series={[{ key: 'meeting', label: 'Meeting', color: BLUE }]}
        getSeries={(s) => s.kind}
        getLabel={(s) => s.title}
        xDomain={[540, 1080]}
        focus={focus}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <LinesCard />
      <BarsCard />
      <HeatCard />
      <BareCartesian />
      <BareTrack />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container, {
  onUncaughtError: (error) => probe.errors.push(String(error)),
  onCaughtError: (error) => probe.errors.push(String(error)),
}).render(<Fixture />)
