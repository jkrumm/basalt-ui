import type { ReactElement } from 'react'
import { Lines, Sparkline } from '../../../src/charts'
import type { ChartSeries, LinesProps } from '../../../src/charts'
import { StatGroup } from '../../../src/index'
import { VX, alpha } from '../../../src/tokens'

type Point = { at: Date; a: number; b: number }

const DATA: Point[] = Array.from({ length: 30 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 8, 1 + i)),
  a: 1 + 0.5 * Math.sin(i / 4),
  b: 0.8 + 0.3 * Math.cos(i / 5),
}))

const ONE: ChartSeries<Point>[] = [
  { key: 'a', label: 'ACWR', color: VX.line, getValue: (d) => d.a },
]
const TWO: ChartSeries<Point>[] = [
  ...ONE,
  { key: 'b', label: 'Overnight', color: VX.line2, dash: 'dashed', getValue: (d) => d.b },
]
const ZONES = [
  {
    from: 0.8,
    to: 1.3,
    fill: alpha(VX.goodSolid, 0.06),
    legend: { label: 'Optimal', color: VX.goodSolid },
  },
  {
    from: 1.3,
    to: 1.5,
    fill: alpha(VX.warnSolid, 0.06),
    legend: { label: 'Caution', color: VX.warnSolid },
  },
  {
    from: 1.5,
    to: 2,
    fill: alpha(VX.badSolid, 0.06),
    legend: { label: 'Danger', color: VX.badSolid },
  },
]
const UNNAMED = ZONES.map(({ from, to, fill }) => ({ from, to, fill }))

const SPARK = [60, 62, 61, 64, 66, 65, 63, 62, 64, 67, 66, 65]
const LABELS = SPARK.map(() => 'Sun 5 Oct 2026')

const chart = (
  id: string,
  props: Omit<LinesProps<Point>, 'ariaLabel' | 'data' | 'x' | 'height'>,
): ReactElement => (
  // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
  <div data-testid={id} style={{ width: 340 }}>
    <Lines ariaLabel={id} data={DATA} x={(d) => d.at} height={160} {...props} />
  </div>
)

/** Wave 38: argo's garmin charts at a 390 viewport (a 340px card) and a strip cell's readout at ~150px. */
export function W38LegendFixture(): ReactElement {
  return (
    <>
      {chart('w38-zones-one', { series: ONE, zones: ZONES, legend: false })}
      {chart('w38-zones-two', { series: TWO, zones: ZONES, legend: false })}
      {chart('w38-single', { series: ONE, legend: false })}
      {chart('w38-unnamed-zones', { series: ONE, zones: UNNAMED, legend: false })}
      {chart('w38-wide-optout', { series: TWO, legend: false, naming: 'endLabels' })}
      {/* theme-allow -- the wrapper width IS the fixture's payload (a ~150px cell) */}
      <div data-testid="w38-strip" style={{ width: 150 }}>
        <StatGroup
          variant="strip"
          label="Fitness"
          cells={[
            {
              key: 'rhr',
              caption: 'RHR',
              value: '62',
              visual: (
                <Sparkline
                  ariaLabel="RHR"
                  data={SPARK}
                  labels={LABELS}
                  format={(v) => `${v} bpm`}
                  height={28}
                />
              ),
            },
          ]}
        />
      </div>
    </>
  )
}
