/**
 * The `charts-axes` fixture: `CartesianChart` with the three axis props of `v3-expr-3-kit-fixes`.
 * Entry of `charts-axes.layout.test.ts`, which bundles it in memory; the harness is told to "mount"
 * it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box: `ax-band` (five long stage names, `x.ticks: 3`), `ax-edge`
 * (the same bars with a rule on a band's leading edge), `ax-clamp` (31 dots and a 40x outlier under
 * a capping `y.domain` function), `ax-format` (a comma decimal on the y ticks).
 */
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'

type Stage = { name: string; ms: number }
const STAGES: readonly Stage[] = [
  { name: 'Planning the change', ms: 420 },
  { name: 'Searching the docs', ms: 1180 },
  { name: 'Reading the files', ms: 310 },
  { name: 'Calling the model', ms: 5480 },
  { name: 'Verifying the patch', ms: 170 },
]
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const red = { light: '#b42318', dark: '#f97066' }
const stageBars = {
  mark: 'bar',
  key: 'ms',
  label: 'Time',
  color: blue,
  y: (d: Stage) => d.ms,
} as const
const stageX = { value: (d: Stage): string => d.name }

type Point = { i: number; v: number }
const POINTS: readonly Point[] = [
  ...Array.from({ length: 31 }, (_, i) => ({ i, v: 10 + ((i * 7) % 51) })),
  { i: 31, v: 2400 },
]
const small: readonly Point[] = [0, 1, 2, 3, 4].map((i) => ({ i, v: i * 0.25 }))
const pointX = { value: (d: Point): number => d.i }
const dots = { mark: 'dot', key: 'v', label: 'Value', color: blue, y: (d: Point) => d.v } as const

const BOX = 'flex min-w-0 flex-col gap-2'

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <section className={BOX} data-testid="ax-band">
        <CartesianChart
          label="Time per stage, three labels"
          data={STAGES}
          x={{ ...stageX, ticks: 3 }}
          series={[stageBars]}
        />
      </section>
      <section className={BOX} data-testid="ax-edge">
        <CartesianChart
          label="Time per stage, a rule before the fourth"
          data={STAGES}
          x={stageX}
          series={[stageBars]}
          refLines={[{ value: 'Calling the model', axis: 'x', at: 'start', color: red }]}
        />
      </section>
      <section className={BOX} data-testid="ax-clamp">
        <CartesianChart
          label="Values with one outlier, capped"
          data={POINTS}
          x={pointX}
          series={[dots]}
          y={{ domain: ([lo, hi]) => [lo, Math.min(hi, 80)] }}
        />
      </section>
      <section className={BOX} data-testid="ax-format">
        <CartesianChart
          label="Quarter steps with a comma decimal"
          data={small}
          x={pointX}
          series={[dots]}
          y={{ format: (v) => v.toFixed(1).replace('.', ',') }}
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
