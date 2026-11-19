import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'

const LINE = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const INK = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }
const INK2 = { light: 'var(--basalt-chart-3)', dark: 'var(--basalt-chart-3)' }

type Pt = { t: number; a: number; b: number }
const HOURS: Pt[] = Array.from({ length: 11 }, (_, i) => ({ t: i, a: 30 + i * 4, b: 60 - i * 3 }))
// A forge pegged at 99 from hour 5 on: its line runs through the top row of a zone that starts there.
const PEG: Pt[] = Array.from({ length: 11 }, (_, i) => ({ t: i, a: i >= 5 ? 99 : 40, b: 20 }))

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
      <Card id="x13-n57">
        <CartesianChart
          label="Night"
          height={300}
          data={HOURS}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 100] }}
          series={[{ mark: 'line', key: 'a', label: 'Total', color: INK, y: (d) => d.a }]}
          zones={[
            { axis: 'x', from: 0, to: 7, fill: 'var(--basalt-line)', label: 'Moon up' },
            {
              axis: 'x',
              from: 7.5,
              to: 10,
              fill: 'var(--basalt-chart-2)',
              label: 'Usable 00:30-03:00',
            },
          ]}
          refLines={[{ value: 80, color: LINE, dashed: true, label: 'Clear under 80 %' }]}
        />
      </Card>
      <Card id="x13-n62">
        <CartesianChart
          label="Wind"
          height={300}
          data={HOURS}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 100] }}
          series={[{ mark: 'line', key: 'a', label: 'Wind', color: INK, y: (d) => d.a }]}
          zones={[
            { axis: 'x', from: 0, to: 2.5, fill: 'var(--basalt-chart-2)', label: 'Steady, 7 h' },
            { axis: 'x', from: 2.5, to: 5.5, fill: 'var(--basalt-warn)', label: 'Offshore' },
            { axis: 'x', from: 5.5, to: 7.5, fill: 'var(--basalt-chart-2)', label: 'Gusty, 5 h' },
          ]}
        />
      </Card>
      <Card id="x13-n59">
        <CartesianChart
          label="Machine"
          height={300}
          data={HOURS}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 100] }}
          series={[{ mark: 'line', key: 'b', label: 'Forge', color: INK2, y: (d) => d.b }]}
          zones={[
            { axis: 'x', from: 7, to: 10, fill: 'var(--basalt-line)', label: 'forge silent' },
          ]}
          refLines={[{ value: 100, color: LINE, dashed: true, label: 'Limit' }]}
        />
      </Card>
      <Card id="x13-pegged">
        <CartesianChart
          label="Forge pegged"
          height={120}
          data={PEG}
          x={{ value: (d) => d.t }}
          y={{ domain: [0, 100] }}
          series={[{ mark: 'line', key: 'a', label: 'Forge', color: INK2, y: (d) => d.a }]}
          zones={[
            { axis: 'x', from: 5.5, to: 10, fill: 'var(--basalt-line)', label: 'edge silent' },
          ]}
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
