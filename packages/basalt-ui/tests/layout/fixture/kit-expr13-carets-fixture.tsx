import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Lines } from '../../../src/charts/parts/lines'
import { ChartCard } from '../../../src/charts/parts/chart-card'

const INK = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }
const INK2 = { light: 'var(--basalt-chart-3)', dark: 'var(--basalt-chart-3)' }

type Pt = { t: number; a: number; b: number }
// One spike past the 40 cap, at hour 6, on the first line only.
const SPIKE: Pt[] = Array.from({ length: 12 }, (_, i) => ({
  t: i,
  a: i === 6 ? 58 : 12 + i,
  b: 20,
}))
// Two money lines past the cap at one hour: one true value each, and two lines at one value.
const SRC: Pt[] = Array.from({ length: 12 }, (_, i) => ({
  t: i,
  a: i === 6 ? 120 : 12 + i,
  b: i === 6 ? 60 : 8,
}))
const SAME: Pt[] = Array.from({ length: 12 }, (_, i) => ({
  t: i,
  a: i === 6 ? 120 : 12 + i,
  b: i === 6 ? 120 : 9,
}))
const money = (v: number): string => 'US$' + v.toFixed(2)

function Card({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div data-testid={id} className="min-w-0">
      <ChartCard title={id} chart={() => children} />
    </div>
  )
}

function Probe() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card id="x13-spike">
        <CartesianChart
          label="Spike"
          height={300}
          data={SPIKE}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 40] }}
          series={[{ mark: 'line', key: 'a', label: 'Spend', color: INK, y: (d) => d.a }]}
        />
      </Card>
      <Card id="x13-src">
        <Lines
          label="Sources"
          height={300}
          data={SRC}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 40] }}
          series={[
            { mark: 'line', key: 'a', label: 'Lead', color: INK, y: (d) => d.a, format: money },
            { mark: 'line', key: 'b', label: 'Rest', color: INK2, y: (d) => d.b, format: money },
          ]}
          naming="endLabels"
        />
      </Card>
      <Card id="x13-same">
        <Lines
          label="Same"
          height={300}
          data={SAME}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 40] }}
          series={[
            { mark: 'line', key: 'a', label: 'Lead', color: INK, y: (d) => d.a, format: money },
            { mark: 'line', key: 'b', label: 'Rest', color: INK2, y: (d) => d.b, format: money },
          ]}
          naming="endLabels"
        />
      </Card>
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="flex max-w-[1100px] min-w-0 flex-col gap-6 p-4 text-foreground">
    <Probe />
  </main>,
)
