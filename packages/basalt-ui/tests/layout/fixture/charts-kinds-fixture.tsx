/**
 * The `charts-kinds` fixture: `Lines`, `Bars` and `CartesianChart` (bars, a line and dots) on their own
 * markup, plus a `Lines` with `selection`. Entry of `charts-kinds.layout.test.ts`, which bundles it
 * in memory; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box: `ck-lines` (two lines, a hidden table), `ck-bars` (stacked),
 * `ck-mixed` (bars, a line and dots), `ck-select` (selection); `ck-log` prints the selected day.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Lines } from '../../../src/charts/parts/lines'

type Row = { day: Date; a: number; b: number }
const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 8, i + 1)),
  a: 40 + Math.round(Math.sin(i / 3) * 20) + i,
  b: 25 + Math.round(Math.cos(i / 4) * 10),
}))
const x = { value: (d: Row): Date => d.day }
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }

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

const BOX = 'flex min-w-0 flex-col gap-2'

function Fixture() {
  const [picked, setPicked] = useState<Row | null>(null)
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Charts</h1>
      <p data-testid="ck-log" className="text-sm">
        {`picked:${picked ? picked.day.toISOString().slice(0, 10) : 'none'}`}
      </p>
      <section className={BOX} data-testid="ck-lines">
        <h2 className="text-sm">Lines</h2>
        <Lines
          ariaLabel="Requests and errors per day"
          data={rows}
          x={x}
          series={[lineA, lineB]}
          table
        />
      </section>
      <section className={BOX} data-testid="ck-bars">
        <h2 className="text-sm">Bars</h2>
        <Bars ariaLabel="Requests and errors, stacked" data={rows} x={x} series={[barA, barB]} />
      </section>
      <section className={BOX} data-testid="ck-mixed">
        <h2 className="text-sm">Mixed</h2>
        <CartesianChart
          ariaLabel="Requests as bars, errors as a line, spikes as dots"
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
        />
      </section>
      <section className={BOX} data-testid="ck-select">
        <h2 className="text-sm">Selection</h2>
        <Lines
          ariaLabel="Requests per day, selectable"
          data={rows}
          x={x}
          series={[lineA]}
          selection={{ selected: picked, onSelect: setPicked }}
        />
      </section>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
