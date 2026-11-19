/**
 * Expression cycle 12 kit fixes, the rule group (`v3-expr-12-kit-fixes` 8): n46's chart, three
 * labelled reference rules and two labelled zones over a month of bars that write their values.
 * Entry of `kit-expr12-rules.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Bars } from '../../../src/charts/parts/bars'
import { ChartCard } from '../../../src/charts/parts/chart-card'

const LINE = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const BAR = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }

type Day = { d: number; mbit: number }
const BELOW = new Set([17, 18, 19, 20])
const DAYS: Day[] = Array.from({ length: 29 }, (_, i) => ({
  d: i + 1,
  mbit: i + 1 === 7 ? 0 : BELOW.has(i + 1) ? 90 + (i % 4) * 8 : 232 + (i % 3) * 3,
}))

function Probe() {
  return (
    <div data-testid="x12-rules" className="min-w-0">
      <ChartCard
        title="x12-rules"
        chart={(box) => (
          <Bars<Day>
            label="Download speed"
            data={DAYS}
            height={box.height}
            x={{ value: (d) => d.d }}
            y={{ domain: [0, 250] }}
            zones={[
              { axis: 'x', from: 3.5, to: 6.5, label: 'No tests', fill: 'var(--basalt-warn)' },
              { axis: 'x', from: 8.5, to: 14.5, label: '7 slow days', fill: 'var(--basalt-warn)' },
              { axis: 'x', from: 15.5, to: 21.5, label: 'No tests', fill: 'var(--basalt-warn)' },
            ]}
            refLines={[
              { value: 250, color: LINE, dashed: true, label: 'Maximum 250' },
              { value: 200, color: LINE, dashed: true, label: 'Normal 200' },
              { value: 100, color: LINE, dashed: true, label: 'Minimum 100' },
            ]}
            series={[
              {
                mark: 'bar',
                key: 'mbit',
                label: 'Median test',
                color: BAR,
                y: (d) => d.mbit,
                values: true,
                highlight: (d) => d.mbit < 100,
              },
            ]}
          />
        )}
      />
    </div>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
    <Probe />
  </main>,
)
void CartesianChart
