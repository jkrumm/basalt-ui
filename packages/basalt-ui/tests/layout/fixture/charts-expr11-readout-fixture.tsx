/**
 * The `charts-expr11-readout` fixture: `CartesianChart` plots whose axis hover readout (the value tag the
 * crosshair draws on the axis at the pointer) used to land on a tick label (`expression-11.12`, `.42`,
 * `.55`). Entry of `charts-expr11-readout.layout.test.ts`, which bundles it in memory; the harness is
 * told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box: `ro-days` (dots on an integer x with ticks 0, 180, 365, 540: the
 * n49 shape), `ro-int` (integer dots on integer y ticks: n50), `ro-pct` (a percent y axis), `ro-cur` (a
 * currency y axis), `ro-date` (a line on a day x axis) and `ro-band` (bars on a band of days: n46).
 */
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'

type Page = { age: number; views: number }
const PAGES: readonly Page[] = Array.from({ length: 60 }, (_, i) => ({
  age: (i * 37) % 640,
  views: (i * 53) % 500,
}))

type Pt = { i: number; v: number }
const STEPS: readonly Pt[] = Array.from({ length: 31 }, (_, i) => ({ i, v: (i * 7 + 3) % 41 }))
const PERCENT: readonly Pt[] = Array.from({ length: 31 }, (_, i) => ({ i, v: (i * 13) % 101 }))
const MONEY: readonly Pt[] = Array.from({ length: 31 }, (_, i) => ({ i, v: (i * 17) % 251 }))

type Day = { day: Date; v: number }
const DAYS: readonly Day[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 3, i + 1)),
  v: 20 + ((i * 11) % 60),
}))

const blue = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const BOX = 'flex min-w-0 flex-col gap-2'

const ageX = {
  value: (d: Page): number => d.age,
  domain: [0, 640] as [number, number],
  ticks: [0, 180, 365, 540],
}
const stepX = { value: (d: Pt): number => d.i }
const dayX = { value: (d: Day): Date => d.day }

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <section className={BOX} data-testid="ro-days">
        <CartesianChart
          label="Views against days since the last edit"
          data={PAGES}
          x={ageX}
          y={{ domain: [0, 500] }}
          series={[
            { mark: 'dot', key: 'views', label: 'Views', color: blue, y: (d: Page) => d.views },
          ]}
        />
      </section>
      <section className={BOX} data-testid="ro-int">
        <CartesianChart
          label="Whole numbers on whole ticks"
          data={STEPS}
          x={stepX}
          series={[{ mark: 'dot', key: 'v', label: 'Value', color: blue, y: (d: Pt) => d.v }]}
        />
      </section>
      <section className={BOX} data-testid="ro-pct">
        <CartesianChart
          label="A percent axis"
          data={PERCENT}
          x={stepX}
          y={{ domain: [0, 100], format: (v: number) => `${v}%` }}
          series={[{ mark: 'line', key: 'v', label: 'Share', color: blue, y: (d: Pt) => d.v }]}
        />
      </section>
      <section className={BOX} data-testid="ro-cur">
        <CartesianChart
          label="A currency axis"
          data={MONEY}
          x={stepX}
          y={{ domain: [0, 250], format: (v: number) => `$${v}` }}
          series={[{ mark: 'line', key: 'v', label: 'Cost', color: blue, y: (d: Pt) => d.v }]}
        />
      </section>
      <section className={BOX} data-testid="ro-date">
        <CartesianChart
          label="A line over days"
          data={DAYS}
          x={dayX}
          series={[{ mark: 'line', key: 'v', label: 'Requests', color: blue, y: (d: Day) => d.v }]}
        />
      </section>
      <section className={BOX} data-testid="ro-band">
        <CartesianChart
          label="Bars over days"
          data={DAYS}
          x={dayX}
          series={[{ mark: 'bar', key: 'v', label: 'Requests', color: blue, y: (d: Day) => d.v }]}
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
