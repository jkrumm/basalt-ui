import { createRoot } from 'react-dom/client'
import { Lines } from '../../../src/charts/parts/lines'
import { ChartCard } from '../../../src/charts/parts/chart-card'

const C = [
  { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' },
  { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' },
  { light: 'var(--basalt-chart-3)', dark: 'var(--basalt-chart-3)' },
  { light: 'var(--basalt-chart-4)', dark: 'var(--basalt-chart-4)' },
]

type Row = {
  t: number
  a: number | null
  b: number | null
  c: number | null
  d: number | null
  e: number | null
}
// A research pool that ends high, and a batch pool that is a two-point stub near the baseline.
const POOLS: Row[] = Array.from({ length: 12 }, (_, i) => ({
  t: i,
  a: 40 + i * 2,
  b: 30 + i,
  c: 20 + i,
  d: 10 + i,
  e: i >= 10 ? 2 : null,
}))
// Four lines that all end within 6 of the baseline of a 0 to 60 axis.
const CLUSTER: Row[] = Array.from({ length: 12 }, (_, i) => ({
  t: i,
  a: i === 11 ? 3 : 50,
  b: i === 11 ? 2 : 40,
  c: i === 11 ? 4 : 30,
  d: i === 11 ? 1.5 : 20,
  e: null,
}))

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
      <Card id="x13-stub">
        <Lines
          label="Credit pools"
          height={300}
          data={POOLS}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 100] }}
          series={[
            { mark: 'line', key: 'a', label: 'Research pool', color: C[0]!, y: (d) => d.a },
            { mark: 'line', key: 'e', label: 'Batch pool', color: C[1]!, y: (d) => d.e },
          ]}
          naming="endLabels"
        />
      </Card>
      <Card id="x13-cluster">
        <Lines
          label="Sources"
          height={300}
          data={CLUSTER}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 60] }}
          series={[
            { mark: 'line', key: 'a', label: 'Alpha', color: C[0]!, y: (d) => d.a },
            { mark: 'line', key: 'b', label: 'Beta', color: C[1]!, y: (d) => d.b },
            { mark: 'line', key: 'c', label: 'Gamma', color: C[2]!, y: (d) => d.c },
            { mark: 'line', key: 'd', label: 'Delta', color: C[3]!, y: (d) => d.d },
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
