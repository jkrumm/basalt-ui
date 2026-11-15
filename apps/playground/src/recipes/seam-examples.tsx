// The worked examples of the geometry seam; gen-docs copies each `example:` region into its doc.
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'

type Stage = { name: string; at: number; behind: number }

const STAGES: readonly Stage[] = [
  { name: 'Build', at: 1, behind: 12 },
  { name: 'Lint', at: 2, behind: 4 },
  { name: 'Test', at: 3, behind: 94 },
  { name: 'Package', at: 4, behind: 31 },
  { name: 'Deploy', at: 5, behind: 18 },
]
const STAGES_TOTAL = STAGES.reduce((sum, s) => sum + s.behind, 0)
const PACE = { light: VX.accent, dark: VX.accent }

// #region example:useChartFocus
export function PipelinePace() {
  const focus = useChartFocus(STAGES, { announce: (s) => `${s.name}: ${s.behind} s behind best` })
  return (
    <ChartCard
      title="Pipeline pace"
      subtitle="Seconds behind the best run, per stage"
      figure={{
        value: focus.readout(`${STAGES_TOTAL} s`, (s) => `${s.behind} s`),
        period: focus.readout('whole run', (s) => s.name),
      }}
      chart={() => (
        <CartesianChart
          data={STAGES}
          ariaLabel="Seconds behind the best run for each of five pipeline stages"
          x={{ value: (s) => s.at, format: (at) => STAGES[Number(at) - 1]?.name ?? '' }}
          y={{ title: 'Seconds behind best' }}
          series={[
            { mark: 'dot', key: 'behind', label: 'Behind best', color: PACE, y: (s) => s.behind },
          ]}
          focus={focus}
        />
      )}
    />
  )
}
// #endregion

type Point = { id: string; name: string; x: number; y: number; weight: number }

// #region example:chartLabels
export function DirectLabels({ points }: { points: readonly Point[] }) {
  const { placed } = chartLabels.place(
    points.map((p) => ({ key: p.id, text: p.name, x: p.x, y: p.y, priority: p.weight })),
    { width: 480, height: 240 },
  )
  const focus = useChartFocus(placed, { announce: (l) => l.text })
  return (
    <>
      <svg {...focus.target} viewBox="0 0 480 240" aria-label="Labelled points">
        {placed.map((l, i) => (
          <text
            key={l.key}
            {...focus.item(i)}
            x={l.textX}
            y={l.baselineY}
            textAnchor={l.textAnchor}
          >
            {l.text}
          </text>
        ))}
      </svg>
      {focus.live}
    </>
  )
}
// #endregion
