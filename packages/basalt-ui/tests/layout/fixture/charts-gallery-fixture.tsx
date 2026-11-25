/**
 * The `charts-gallery` fixture: the chart patterns of the `/charts` gallery, one probe each. Entry of
 * `charts-gallery.layout.test.ts`, which bundles it in memory; the harness is told to "mount" it by a
 * no-op `window.basaltMountFixture`.
 *
 * Probes: `g-linked-a` and `g-linked-b`, two charts on one cursor that both paint their readout
 * (`tooltip.follow`), the second with a change, a reference and a status per row; `g-cycle`, a price
 * on a log right axis colored by a score, with events and its extremes; `g-waterfall`; `g-navigator`,
 * a `RangeNavigator` on a local window handle whose value the probe writes to `data-window`; and
 * `g-heatmap`, a grid whose tooltip rows read each cell against its row.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Heatmap } from '../../../src/charts/parts/heatmap'
import { RangeNavigator } from '../../../src/charts/parts/range-navigator'
import type { WindowHandle } from '../../../src/charts/parts/range-navigator'
import { Waterfall } from '../../../src/charts/parts/waterfall'
import type { RangeValue } from '../../../src/router/controls/codec'

const BOX = 'flex min-w-0 flex-col gap-2'
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }
const grey = { light: '#71717a', dark: '#a1a1aa' }

const day = (i: number): Date => new Date(Date.UTC(2026, 0, 1 + i))

type Day = { t: Date; load: number; rhr: number; mean: number }
const days: Day[] = Array.from({ length: 40 }, (_, i) => ({
  t: day(i),
  load: 50 + Math.round(Math.sin(i / 3) * 30),
  rhr: 48 + Math.round(Math.cos(i / 4) * 30) / 10,
  mean: 48 + Math.round(Math.cos((i - 2) / 4) * 20) / 10,
}))

function Linked() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <section className={BOX} data-testid="g-linked-a">
        <CartesianChart
          label="Training load"
          data={days}
          x={{ value: (d) => d.t }}
          series={[{ mark: 'line', key: 'load', label: 'Load', color: blue, y: (d) => d.load }]}
          tooltip={{ follow: true }}
          height={220}
        />
      </section>
      <section className={BOX} data-testid="g-linked-b">
        <CartesianChart
          label="Resting heart rate"
          data={days}
          x={{ value: (d) => d.t }}
          series={[
            {
              mark: 'line',
              key: 'rhr',
              label: 'Resting HR',
              color: amber,
              y: (d) => d.rhr,
              format: (v) => `${v.toFixed(1)} bpm`,
              compare: { label: '7-day mean', y: (d) => d.mean },
              status: (v) =>
                v >= 50 ? { tone: 'warn', label: 'Strained' } : { tone: 'good', label: 'Rested' },
            },
          ]}
          tooltip={{ follow: true, change: 'previous' }}
          height={220}
        />
      </section>
    </div>
  )
}

type Close = { t: Date; price: number; score: number }
const closes: Close[] = Array.from({ length: 120 }, (_, i) => ({
  t: day(i * 7),
  price: Math.round(10 ** (1 + (i / 119) * 3) * (1 + Math.sin(i / 6) * 0.3)),
  score: Math.round(50 + Math.sin(i / 6) * 45),
}))

function Cycle() {
  return (
    <section className={BOX} data-testid="g-cycle">
      <CartesianChart
        label="A price on a log axis colored by its score"
        data={closes}
        x={{ value: (d) => d.t }}
        y={{ domain: [0, 100] }}
        y2={{ scale: 'log', format: (v) => `$${v}` }}
        series={[
          {
            mark: 'line',
            key: 'score',
            label: 'Score',
            color: grey,
            y: (d) => d.score,
            tooltip: false,
          },
          {
            mark: 'line',
            key: 'price',
            label: 'Price',
            color: blue,
            y: (d) => d.price,
            axis: 'right',
            extremes: true,
            colorBy: { value: (d) => d.score, domain: [0, 100], label: 'Score' },
          },
        ]}
        events={[{ at: day(7 * 60), label: 'Halving' }]}
        tooltip={{ change: 'start' }}
        height={300}
      />
    </section>
  )
}

function Bridge() {
  return (
    <section className={BOX} data-testid="g-waterfall">
      <Waterfall
        label="A bridge"
        data={[
          { name: 'Up', v: 40 },
          { name: 'Down', v: -25 },
          { name: 'Up again', v: 15 },
        ]}
        step={(d) => d.name}
        value={(d) => d.v}
        start={{ label: 'Open', value: 100 }}
        total="Close"
        ticks="all"
        height={260}
      />
    </section>
  )
}

type Spans = '1m' | 'all'
const SPANS = { '1m': 30, all: 'all' } as const
const history = Array.from({ length: 365 }, (_, i) => ({
  t: day(i),
  v: 100 + Math.sin(i / 20) * 40 + i / 5,
}))

function Navigator() {
  const [value, setValue] = useState<RangeValue<Spans | 'custom'>>({ preset: '1m' })
  const handle: WindowHandle<Spans> = {
    use: () => [value, setValue],
    options: [
      { value: '1m', label: '1M' },
      { value: 'all', label: 'All' },
    ],
  }
  const view = RangeNavigator.window(history, (d) => d.t, value, SPANS)
  const iso = (d: Date): string => d.toISOString().slice(0, 10)
  return (
    <section
      className={BOX}
      data-testid="g-navigator"
      data-window={`${value.preset} ${iso(view.domain[0])} ${iso(view.domain[1])}`}
    >
      <CartesianChart
        label="The window"
        data={view.data}
        x={{ value: (d) => d.t, domain: view.domain }}
        series={[{ mark: 'line', key: 'v', label: 'Value', color: blue, y: (d) => d.v }]}
        height={200}
      />
      <RangeNavigator
        label="History"
        data={history}
        x={(d) => d.t}
        y={(d) => d.v}
        color={blue}
        window={handle}
        spans={SPANS}
      />
    </section>
  )
}

const ROWS = ['Mon', 'Tue', 'Wed']
const COLS = ['08', '09', '10', '11']
const cells = ROWS.flatMap((row, r) => COLS.map((col, c) => ({ row, col, v: r * 4 + c + 1 })))

function Grid() {
  return (
    <section className={BOX} data-testid="g-heatmap">
      <Heatmap
        label="A grid"
        data={cells}
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
        tooltip={{
          rows: (d) => {
            const peers = cells.filter((c) => c.row === d.row).map((c) => c.v)
            const mean = peers.reduce((a, b) => a + b) / peers.length
            return [
              { label: `${d.row} average`, value: String(mean) },
              { label: 'Rank in row', value: `${peers.filter((v) => v > d.v).length + 1} of 4` },
            ]
          },
        }}
        height={200}
      />
    </section>
  )
}

function Fixture() {
  return (
    <main className="flex flex-col gap-8 p-6">
      <Linked />
      <Cycle />
      <Bridge />
      <Navigator />
      <Grid />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
