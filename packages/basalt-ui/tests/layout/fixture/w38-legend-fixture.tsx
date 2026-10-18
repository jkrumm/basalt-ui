import type { ReactElement } from 'react'
import { Lines, Sparkline } from '../../../src/charts'
import type { ChartSeries, LinesProps } from '../../../src/charts'
import { DeltaBadge, StatCard, StatGroup } from '../../../src/index'
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
const zone = (from: number, to: number, tone: 'good' | 'warn' | 'bad', label: string) => ({
  from,
  to,
  fill: alpha(VX[`${tone}Solid`], 0.06),
  legend: { label, color: VX[`${tone}Solid`] },
})
// argo's three garmin shapes: ACWR (1 series, 4 named zones), recovery (1 series, 3), stress (2, 3).
const ACWR_ZONES = [
  zone(0, 0.8, 'warn', 'Undertrained'),
  zone(0.8, 1.3, 'good', 'Optimal'),
  zone(1.3, 1.5, 'warn', 'Caution'),
  zone(1.5, 2, 'bad', 'Danger'),
]
const REC_ZONES = [
  zone(0, 0.8, 'bad', 'Rest'),
  zone(0.8, 1.3, 'warn', 'Normal'),
  zone(1.3, 2, 'good', 'Push'),
]
const UNNAMED = REC_ZONES.map(({ from, to, fill }) => ({ from, to, fill }))

const SPARK = [60, 62, 61, 64, 66, 65, 63, 62, 64, 67, 66, 65]
const LABELS = SPARK.map(() => 'Sun 5 Oct 2026')
/** One short and one long date: the one-line and the stacked readout. */
const SHORT = SPARK.map(() => '5 Oct')

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
      {chart('w38-acwr', { series: ONE, zones: ACWR_ZONES })}
      {chart('w38-recovery', { series: ONE, zones: REC_ZONES })}
      {chart('w38-stress', { series: TWO, zones: REC_ZONES })}
      {chart('w38-single', { series: ONE })}
      {chart('w38-unnamed-zones', { series: ONE, zones: UNNAMED })}
      {chart('w38-false', { series: TWO, zones: REC_ZONES, legend: false })}
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
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 150px card) */}
      {(['one', 'stacked'] as const).map((kind) => (
        <div key={kind} data-testid={`w38-card-${kind}`} style={{ width: 150 }}>
          <StatCard
            title="Sessions"
            value="17"
            unit="sessions"
            delta={13.3}
            deltaPeriod="1–16 Sep"
            subtitle="7-day rolling"
            sparkline={(size) => (
              <Sparkline
                ariaLabel="Sessions"
                data={SPARK}
                labels={kind === 'one' ? SHORT : LABELS}
                format={(v) => `${v} sessions`}
                {...size}
              />
            )}
          />
        </div>
      ))}
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 150px cell) */}
      <div data-testid="w38-strip-delta" style={{ width: 150 }}>
        <StatGroup
          variant="strip"
          label="Fitness delta"
          cells={[
            {
              key: 'rhr',
              caption: 'RHR',
              value: '62',
              delta: <DeltaBadge value={4.2} period="1–16 Sep" />,
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
