/**
 * Expression cycle 14 contract (2), panes that share a card's box (n63 .7, n67): a ChartCard (`panes`) of two panes
 * weighted 2 and 1 (`c14-two`) and one of three equal panes (`c14-three`), no pixel height anywhere. Entry
 * of `kit-c14-panes.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'
import type { Box } from '../../../src/core/ports'

type Day = { day: Date; load: number; score: number; rest: number }
const DAY_MS = 86_400_000
const START = Date.UTC(2026, 9, 1)
const DAYS: readonly Day[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(START + i * DAY_MS),
  load: 40 + ((i * 13) % 50),
  score: 30 + ((i * 17) % 60),
  rest: 5 + ((i * 7) % 20),
}))
const blue = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const dayOf = (d: Day): Date => d.day

const GUTTER = 48
type Key = 'load' | 'score' | 'rest'

function pane(key: Key, last: boolean) {
  return (box: Box): ReactElement => (
    <Lines
      label={key}
      data={DAYS}
      x={{ value: dayOf, ...(last ? {} : { ticks: [] }) }}
      y={{ gutter: GUTTER }}
      cursor="c14"
      height={box.height}
      series={[
        { mark: 'line', key, label: key, color: blue, y: (d: Day) => d[key], legend: false },
      ]}
    />
  )
}

function Fixture(): ReactElement {
  return (
    <main className="grid grid-cols-1 gap-8 p-4 text-foreground">
      <div data-testid="c14-two">
        <ChartCard
          title="Recovery"
          height="tall"
          panes={[{ weight: 2, chart: pane('score', false) }, { chart: pane('load', true) }]}
        />
      </div>
      <div data-testid="c14-three">
        <ChartCard
          title="Drivers"
          height="tall"
          panes={[
            { chart: pane('score', false) },
            { chart: pane('load', false) },
            { chart: pane('rest', true) },
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
