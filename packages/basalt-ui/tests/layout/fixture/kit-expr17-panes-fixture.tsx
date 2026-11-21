/**
 * Expression cycle 17 contract (`v3-expr-17-contract`, Issue 2717): the round-0 pane setups of n82 and
 * n84 without the page's hand floor. `k17-n82` is five equal bar panes in a `tall` card with a figure,
 * a legend and a footer, inside the grid cell n82 drew (its `min-h-180` wrapper removed); `k17-n84` is a
 * rolling-total `Lines` pane weighted 3 over a daily `Bars` pane weighted 2 in a `tall` card, in n84's
 * two-of-three column. Entry of `kit-expr17-panes.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Bars } from '../../../src/charts/parts/bars'
import { Lines } from '../../../src/charts/parts/lines'
import type { ChartPane } from '../../../src/charts/contract'
import type { Box } from '../../../src/core/ports'

type Day = {
  day: Date
  votes: number
  saves: number
  shares: number
  views: number
  replies: number
}
const DAY_MS = 86_400_000
const START = Date.UTC(2026, 9, 1)
const DAYS: readonly Day[] = Array.from({ length: 31 }, (_, i) => ({
  day: new Date(START + i * DAY_MS),
  votes: 4 + ((i * 13) % 30),
  saves: 2 + ((i * 7) % 18),
  shares: 1 + ((i * 5) % 12),
  views: 40 + ((i * 17) % 90),
  replies: (i * 3) % 9,
}))
const ink = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const dim = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }
const dayOf = (d: Day): Date => d.day
const GUTTER = 44
const MEASURES = ['votes', 'saves', 'shares', 'views', 'replies'] as const

const n82Panes: ChartPane[] = MEASURES.map((key, i) => ({
  chart: (box: Box): ReactElement => (
    <Bars
      label={`${key} per day`}
      data={DAYS}
      height={box.height}
      cursor="k17-n82"
      x={{ value: dayOf, ...(i === MEASURES.length - 1 ? {} : { ticks: [] }) }}
      y={{ gutter: GUTTER, title: key }}
      series={[{ mark: 'bar', key, label: key, color: ink, legend: false, y: (d: Day) => d[key] }]}
    />
  ),
}))

let total = 0
const ROLLING = DAYS.map((d) => ({ day: d.day, total: (total += d.votes), votes: d.votes }))
type Roll = (typeof ROLLING)[number]
const rollDay = (d: Roll): Date => d.day

function Fixture(): ReactElement {
  return (
    <main className="@container grid gap-4 p-4 text-foreground">
      <div className="grid gap-4 @wide:grid-cols-3">
        <div data-testid="k17-n82" className="grid @wide:col-span-3">
          <ChartCard
            title="Daily counts"
            subtitle="One bar per day, then now"
            height="tall"
            legend={[{ key: 'day', label: 'Day', color: ink }]}
            figure={{ value: 3, unit: 'unusual days' }}
            footer={[{ label: 'Days in use', value: '30 of 30' }]}
            panes={n82Panes}
          />
        </div>
      </div>
      <div className="grid gap-4 @wide:grid-cols-3">
        <div data-testid="k17-n84" className="@wide:col-span-2">
          <ChartCard
            title="Spend by key"
            subtitle="Total against the cap, then each day"
            height="tall"
            legend={[{ key: 'total', label: 'Total', color: ink }]}
            figure={{ value: '$412', delta: { value: '+$38', polarity: 'neutral' } }}
            footer={[{ label: 'Days billed', value: '12 of 31' }]}
            panes={[
              {
                weight: 3,
                chart: (box) => (
                  <Lines
                    label="Total per key"
                    data={ROLLING}
                    height={box.height}
                    cursor="k17-n84"
                    x={{ value: rollDay, ticks: [] }}
                    y={{ gutter: GUTTER, title: 'Rolling total' }}
                    series={[
                      {
                        mark: 'line',
                        key: 'total',
                        label: 'Total',
                        color: ink,
                        legend: false,
                        y: (d: Roll) => d.total,
                      },
                    ]}
                  />
                ),
              },
              {
                weight: 2,
                chart: (box) => (
                  <Bars
                    label="Each day"
                    data={ROLLING}
                    height={box.height}
                    cursor="k17-n84"
                    x={{ value: rollDay }}
                    y={{ gutter: GUTTER, title: 'Per day' }}
                    series={[
                      {
                        mark: 'bar',
                        key: 'votes',
                        label: 'Per day',
                        color: dim,
                        legend: false,
                        y: (d: Roll) => d.votes,
                      },
                    ]}
                  />
                ),
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
