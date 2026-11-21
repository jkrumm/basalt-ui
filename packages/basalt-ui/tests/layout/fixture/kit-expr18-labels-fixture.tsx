/**
 * Expression cycle 18, chart labels (`v3-expr-18-kit-fixes` 7, 8 and 10): n91's two panes (daily spend bars that
 * print their values over a cache-hit line, one card, no page `y.gutter`) at `k18-panes`. Entry of
 * `kit-expr18-labels.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'

type Day = { at: Date; spend: number; cache: number | null }
const DAY_MS = 86_400_000
const START = Date.UTC(2026, 9, 23)
const SPEND = [
  0.04, 0.09, 0.16, 0.33, 0.21, 0.12, 0.07, 0.19, 0.28, 0.14, 0.06, 0.1, 0.22, 0.31, 0.17,
]
const DAYS: readonly Day[] = SPEND.map((spend, i) => ({
  at: new Date(START + i * DAY_MS),
  spend,
  cache: i === 6 ? null : 0.45 + ((i * 7) % 5) / 10,
}))
const INK = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const usd = (v: number): string => `US$${v.toFixed(2)}`
const pct = (v: number): string => `${Math.round(v * 100)}%`

function Fixture(): ReactElement {
  return (
    <main className="@container grid gap-4 p-4 text-foreground">
      <div data-testid="k18-panes">
        <ChartCard
          title="Spend and cache"
          subtitle="Each day"
          height="tall"
          legend={[{ key: 'spend', label: 'Spend', color: INK }]}
          panes={[
            {
              chart: (box) => (
                <CartesianChart<Day>
                  label="US dollars billed each day"
                  data={DAYS}
                  height={box.height}
                  cursor="k18-panes"
                  tooltip={false}
                  x={{ value: (d) => d.at }}
                  y={{ title: 'US dollars', format: usd }}
                  series={[
                    {
                      mark: 'bar',
                      key: 'spend',
                      label: 'Spend',
                      color: INK,
                      y: (d) => d.spend,
                      format: usd,
                      values: true,
                    },
                  ]}
                />
              ),
            },
            {
              chart: (box) => (
                <CartesianChart<Day>
                  label="Cache served each day"
                  data={DAYS}
                  height={box.height}
                  cursor="k18-panes"
                  tooltip={false}
                  x={{ value: (d) => d.at }}
                  y={{ title: 'Share of reads', domain: [0, 1], format: pct }}
                  series={[
                    {
                      mark: 'line',
                      key: 'cache',
                      label: 'Hit rate',
                      color: INK,
                      y: (d) => d.cache,
                      format: pct,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
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
