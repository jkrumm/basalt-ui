import type { ReactElement } from 'react'
import { ChartCard, Lines } from '../../../src/charts'
import type { ChartSeries } from '../../../src/charts'
import { VX } from '../../../src/tokens'

type Point = { at: Date; weight: number; mean: number }

const DAYS = 60
const NBSP = ' '

/** Invented, shaped like argo's body weight: a slow fall, a daily wobble, the last weight 0.1 kg off its mean. */
const RAW = Array.from({ length: DAYS }, (_, i) => {
  const trend = 84 - i * 0.09
  const wobble = Math.sin(i * 2.1) * 0.6 + Math.cos(i * 0.9) * 0.3
  return i === DAYS - 1 ? trend + 0.1 : trend + wobble
})
const DATA: Point[] = RAW.map((weight, i) => {
  const window = RAW.slice(Math.max(0, i - 6), i + 1)
  return {
    at: new Date(Date.UTC(2026, 7, 1 + i)),
    weight,
    mean: window.reduce((a, v) => a + v, 0) / window.length,
  }
})

const SERIES: ChartSeries<Point>[] = [
  { key: 'weight', label: 'Weight', color: VX.line, strokeWidth: 2.25, getValue: (d) => d.weight },
  {
    key: 'ma',
    label: `7${NBSP}d${NBSP}mean`,
    color: VX.line,
    dash: 'dashed',
    strokeWidth: 1.5,
    role: 'overlay',
    parent: 'weight',
    getValue: (d) => d.mean,
  },
]

/** argo's body-weight chart: end labels on two close lines beside a goal rule (`w43-lines`). */
export function W43LinesFixture(): ReactElement {
  return (
    <div data-testid="w43-lines">
      <ChartCard title="Body weight">
        <Lines<Point, Date>
          ariaLabel="Body weight"
          data={DATA}
          height={{ base: 220, regular: 280 }}
          x={(d) => d.at}
          series={SERIES}
          naming="endLabels"
          refLines={[{ value: 78, color: VX.muted, label: 'Goal' }]}
          y={{ domain: [77, 86] }}
        />
      </ChartCard>
    </div>
  )
}
