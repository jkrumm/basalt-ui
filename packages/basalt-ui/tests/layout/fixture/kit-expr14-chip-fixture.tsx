/**
 * Expression cycle 14 kit fixes (`v3-expr-14-kit-fixes` 9): n67's two stacked panes on one date axis, a
 * volume line with no x tick labels above, a recovery line and intensity dots with a tick every 15 days
 * below, sharing one cursor and one focus. The hover guard's chip check reads it: the x chip covers no
 * tick label. Entry of `kit-expr14-chip.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { useChartFocus } from '../../../src/charts/focus'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Lines } from '../../../src/charts/parts/lines'

const DAY_MS = 86_400_000
type Day = { day: Date; index: number; volume: number; recovery: number; intensity: number | null }
const START = Date.UTC(2026, 6, 1)
const DAYS: readonly Day[] = Array.from({ length: 90 }, (_, index) => ({
  day: new Date(START + index * DAY_MS),
  index,
  volume: 12_000 + ((index * 1_700) % 20_000),
  recovery: 55 + ((index * 7) % 30),
  intensity: index % 3 === 0 ? 40 + ((index * 11) % 50) : null,
}))
const DOMAIN = [DAYS[0]!.day, DAYS[89]!.day] as const
const TICKS = DAYS.filter((d) => d.index % 15 === 0 && d.index < 89).map((d) => d.day)
const GUTTER = 56
const blue = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const red = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }
const dayOf = (d: Day): Date => d.day

function Fixture(): ReactElement {
  const focus = useChartFocus(DAYS, { announce: (d) => d.day.toISOString().slice(0, 10) })
  return (
    <main className="w-full max-w-[900px] min-w-0 p-4 text-foreground">
      <div data-testid="x14-lone" className="mb-16">
        <CartesianChart
          label="Gain since the first session"
          data={DAYS}
          x={{ value: dayOf, ticks: TICKS, domain: DOMAIN }}
          y={{ title: 'Gain, kg', gutter: GUTTER, domain: [0, 100] }}
          height={120}
          focus={focus}
          tooltip={false}
          series={[
            {
              mark: 'line',
              key: 'gain',
              label: 'Gain',
              color: blue,
              y: (d: Day) => d.recovery,
              legend: false,
            },
          ]}
        />
      </div>
      <div data-testid="x14-chip" className="flex flex-col">
        <div>
          <Lines
            label="Weekly volume"
            data={DAYS}
            x={{ value: dayOf, ticks: [], domain: DOMAIN }}
            y={{ title: 'Volume, kg', gutter: GUTTER, domain: [0, 45_000] }}
            height={100}
            focus={focus}
            tooltip={false}
            series={[
              {
                mark: 'line',
                key: 'volume',
                label: 'Volume',
                color: blue,
                y: (d: Day) => d.volume,
                curve: 'stepAfter',
                area: 'fade',
                legend: false,
              },
            ]}
          />
        </div>
        <div>
          <CartesianChart
            label="Recovery and session intensity"
            data={DAYS}
            x={{ value: dayOf, ticks: TICKS, domain: DOMAIN }}
            y={{ title: 'Score', gutter: GUTTER, domain: [0, 100] }}
            height={180}
            focus={focus}
            tooltip={false}
            series={[
              {
                mark: 'line',
                key: 'recovery',
                label: 'Recovery',
                color: blue,
                y: (d: Day) => d.recovery,
                legend: false,
              },
              {
                mark: 'dot',
                key: 'intensity',
                label: 'Intensity',
                color: red,
                y: (d: Day) => d.intensity,
                legend: false,
              },
            ]}
          />
        </div>
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
