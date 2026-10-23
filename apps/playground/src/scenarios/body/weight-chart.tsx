/** The body-weight Lines with a goal RefLine and end labels (argo UPSTREAM Wave 51–52). */
import { Box } from '@mantine/core'
import { ChartCard, Lines } from 'basalt-ui/charts'
import type { ChartSeries } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { chartStateFor, noop } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { BODY, GOAL_KG, NO_WEIGH_INS, READING_DATE, WEIGHT_ERROR } from './body-data'

type WeightPoint = { date: Date; weightKg: number; ma: number }

const DAYS = 60
const DAY_MS = 86_400_000
const NBSP = ' '
const fmtKg = (v: number): string => `${v.toFixed(1)}${NBSP}kg`

/** Invented: a slow fall with a daily wobble, ending on the strip's reading. */
const RAW = Array.from({ length: DAYS }, (_, i) => {
  const trend = 75.6 - i * 0.055
  const wobble = Math.sin(i * 2.1) * 0.6 + Math.cos(i * 0.9) * 0.3
  return i === DAYS - 1 ? BODY.weightKg : trend + wobble
})
const DATA: WeightPoint[] = RAW.map((weightKg, i) => {
  const window = RAW.slice(Math.max(0, i - 6), i + 1)
  const ma = window.reduce((sum, v) => sum + v, 0) / window.length
  return { date: new Date(READING_DATE.getTime() - (DAYS - 1 - i) * DAY_MS), weightKg, ma }
})

const SERIES: ChartSeries<WeightPoint>[] = [
  {
    key: 'weight',
    label: 'Weight',
    color: VX.line,
    strokeWidth: 2.25,
    getValue: (d) => d.weightKg,
    formatValue: fmtKg,
  },
  {
    key: 'ma',
    label: `7${NBSP}d${NBSP}mean`,
    color: VX.line,
    dash: 'dashed',
    strokeWidth: 1.5,
    role: 'overlay',
    parent: 'weight',
    getValue: (d) => d.ma,
    formatValue: fmtKg,
  },
]

export function BodyWeightChart({ shotState }: ScenarioProps) {
  return (
    <Box data-shot="weight-trend">
      <ChartCard
        title="Body weight, last 60 days"
        ghost="line"
        state={chartStateFor(shotState, { empty: NO_WEIGH_INS, error: WEIGHT_ERROR })}
        {...(shotState === 'error' && { onRetry: noop })}
      >
        <Lines<WeightPoint, Date>
          ariaLabel="Body weight trend over time"
          data={DATA}
          height={{ base: 220, regular: 280 }}
          x={(d) => d.date}
          series={SERIES}
          naming="endLabels"
          refLines={[{ value: GOAL_KG, color: VX.muted, label: 'Goal' }]}
          y={{ domain: [69, 77], format: (v) => `${v}${NBSP}kg` }}
        />
      </ChartCard>
    </Box>
  )
}
