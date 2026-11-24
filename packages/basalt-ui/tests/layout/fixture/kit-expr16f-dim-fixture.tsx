/**
 * Expression cycle 16, the dim on an ink-step bar series (`v3-expr-16-kit-fixes` 6, n75 and n76): one
 * `Bars` series in a grey step of the ink scale with the chart's focus, and one in a chromatic color
 * for comparison. `data-testid="k16f-ink"` and `k16f-hue` box each chart; `k16f-ink-focus` carries
 * `focus.index`. Entry of `kit-expr16f-dim.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { Bars, ChartCard, useChartFocus } from '../../../src/charts'

type Step = { name: string; count: number }
const STEPS: readonly Step[] = [
  { name: 'Visited', count: 820 },
  { name: 'Read', count: 540 },
  { name: 'Started', count: 310 },
  { name: 'Sent', count: 120 },
  { name: 'Replied', count: 48 },
]

const INK = { light: '#6b6b6b', dark: '#a8a8a8' }
const HUE = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }

function Probe(props: { id: string; color: { light: string; dark: string } }): ReactElement {
  const focus = useChartFocus(STEPS, { announce: (s) => `${s.name}: ${s.count}` })
  return (
    <div data-testid={props.id} data-focus-index={focus.index ?? ''} className="min-w-0">
      <ChartCard
        title={props.id}
        chart={(box) => (
          <Bars<Step>
            label="Funnel steps"
            height={box.height}
            data={STEPS}
            focus={focus}
            tooltip={false}
            x={{ value: (s) => s.name }}
            series={[
              {
                mark: 'bar',
                key: 'count',
                label: 'Reached',
                color: props.color,
                y: (s) => s.count,
              },
            ]}
          />
        )}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="grid gap-4 p-4 text-foreground">
      <Probe id="k16f-ink" color={INK} />
      <Probe id="k16f-hue" color={HUE} />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
