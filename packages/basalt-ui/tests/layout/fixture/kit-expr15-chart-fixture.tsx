/**
 * Expression cycle 15 kit fixes, chart behaviours (`v3-expr-15-kit-fixes` 6 to 9): a `ChartCard` legend on a
 * `Bars` chart with `highlight` (n73), the shape that looped the plot measure. Read by
 * `kit-expr15-chart.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { alpha, BASALT } from '../../../src/tokens'
import { Bars } from '../../../src/charts/parts/bars'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { useChartFocus } from '../../../src/charts/focus'

const tone = (n: number): { light: string; dark: string } => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})

type Step = { name: string; count: number; slipped: boolean }
const STEPS: Step[] = [
  { name: 'Unrated', count: 4, slipped: false },
  { name: 'Forgotten', count: 3, slipped: true },
  { name: 'Shaky', count: 6, slipped: true },
  { name: 'Learning', count: 12, slipped: false },
  { name: 'Known', count: 9, slipped: false },
  { name: 'Fluent', count: 5, slipped: false },
]

type Entry = { key: string; label: string; color: { light: string; dark: string }; swatch: 'bar' }
const BRAND = { light: 'var(--basalt-brand)', dark: 'var(--basalt-brand)' }
const VARIANTS: Record<string, Entry[]> = {
  one: [{ key: 'slipped', label: 'Slipped', color: BRAND, swatch: 'bar' }],
  same: [{ key: 'items', label: 'Count', color: tone(1), swatch: 'bar' }],
  two: [
    { key: 'items', label: 'Count', color: tone(1), swatch: 'bar' },
    { key: 'slipped', label: 'Slipped', color: BRAND, swatch: 'bar' },
  ],
}

function Legend({ id, legend }: { id: string; legend: Entry[] }) {
  const focus = useChartFocus<Step>(STEPS, { announce: (s) => `${s.name}: ${s.count}` })
  return (
    <div data-testid={`x15-legend-${id}`} style={{ width: window.innerWidth < 600 ? 342 : 720 }}>
      <ChartCard
        title="Confidence by step"
        height="tall"
        legend={legend}
        chart={() => (
          <Bars<Step>
            label="Count at each step"
            data={STEPS}
            focus={focus}
            tooltip={false}
            x={{ value: (s) => s.name, ticks: STEPS.map((s) => s.name) }}
            y={{ title: 'Items', domain: { floor: 0, pad: 0.12 } }}
            zones={[
              {
                axis: 'x',
                from: 'Forgotten',
                to: 'Shaky',
                fill: alpha(BASALT.brand, 0.1),
                label: '9 slipped, limit 6',
              },
            ]}
            series={[
              {
                mark: 'bar',
                key: 'items',
                label: 'Count',
                color: tone(1),
                y: (s) => s.count,
                values: true,
                highlight: (s) => s.slipped,
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
createRoot(container, {
  onUncaughtError: (error) => {
    ;(window as unknown as { __fixtureError: string }).__fixtureError = String(error)
  },
  onCaughtError: (error) => {
    ;(window as unknown as { __fixtureError: string }).__fixtureError = String(error)
  },
}).render(
  <main className="flex max-w-[1500px] min-w-0 flex-col gap-6 p-4 text-foreground">
    {Object.entries(VARIANTS).map(([id, legend]) => (
      <Legend key={id} id={id} legend={legend} />
    ))}
  </main>,
)
