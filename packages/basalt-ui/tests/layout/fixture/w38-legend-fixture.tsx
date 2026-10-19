import type { ReactElement } from 'react'
import { Bars, Lines, Sparkline } from '../../../src/charts'
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
const REC_ZONES = [
  zone(0, 0.8, 'bad', 'Rest'),
  zone(0.8, 1.3, 'warn', 'Normal'),
  zone(1.3, 2, 'good', 'Push'),
]
const UNNAMED = REC_ZONES.map(({ from, to, fill }) => ({ from, to, fill }))

// argo's multi-line shapes: strength (5 series + 2 reference lines), sky panorama (7 series), stress.
const NAMES = ['Squat', 'Bench', 'Deadlift', 'Press', 'Row', 'Pull-up', 'Carry']
const COLORS = [VX.line, VX.line2, VX.accent, VX.good, VX.warn, VX.bad, VX.neutral]
const many = (n: number): ChartSeries<Point>[] =>
  NAMES.slice(0, n).map((label, i) => ({
    key: `s${i}`,
    label,
    color: COLORS[i] ?? VX.line,
    getValue: (d) => d.a + i * 0.1,
  }))
const REFS = [
  { value: 1.2, color: VX.faint, dashed: true, legend: { label: 'Target' } },
  { value: 0.9, color: VX.faint, dashed: true, legend: { label: 'Floor (< 0.9)' } },
]
const NAMED_ZONES = [
  zone(0, 0.8, 'warn', 'Low (< 0.8)'),
  zone(0.8, 1.3, 'good', 'Optimal'),
  zone(1.3, 1.5, 'warn', 'Push (≥70)'),
  zone(1.5, 2, 'bad', 'Danger'),
]
// argo's usage health card (health-card.tsx VERDICT_BARS): three verdict labels.
const VERDICT = [
  { key: 'ok', label: 'Under 1 % of calls', color: alpha(VX.muted, 0.5) },
  { key: 'warn', label: '1–3 % of calls', color: VX.warnSolid },
  { key: 'bad', label: 'Over 3 % of calls', color: VX.badSolid },
].map(({ key, label, color }, i) => ({
  key,
  label,
  color,
  getValue: (d: Point) => (d.a > 1 + i * 0.2 ? d.a : null),
}))
// One zone too many: the last reference wraps a second line, folding just it frees that line.
const ONE_FOLD_ZONES = [
  zone(0.8, 1.3, 'good', 'Optimal'),
  zone(0, 0.8, 'warn', 'Low'),
  zone(1.5, 2, 'bad', 'Very far above the target'),
]
// One entry wider than a 340px card.
const LONG: ChartSeries<Point>[] = [
  {
    key: 'long',
    label: 'A series name much longer than any phone card can hold on a single line of legend',
    color: VX.line,
    getValue: (d) => d.a,
  },
  { key: 'b', label: 'Short', color: VX.line2, getValue: (d) => d.b },
]

const SPARK = [60, 62, 61, 64, 66, 65, 63, 62, 64, 67, 66, 65]
const LABELS = SPARK.map(() => 'Sun 5 Oct 2026')
/** One short and one long date: the one-line and the stacked readout. */
const SHORT = SPARK.map(() => '5 Oct')

const chart = (
  id: string,
  props: Omit<LinesProps<Point>, 'ariaLabel' | 'data' | 'x' | 'height'>,
  width = 340,
): ReactElement => (
  // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
  <div data-testid={id} style={{ width }}>
    <Lines ariaLabel={id} data={DATA} x={(d) => d.at} height={160} {...props} />
  </div>
)

/** Wave 38: argo's garmin charts at a 390 viewport (a 340px card) and a strip cell's readout at ~150px. */
export function W38LegendFixture(): ReactElement {
  return (
    <>
      {chart('w38-five-refs', { series: many(5), refLines: REFS })}
      {chart('w38-seven', { series: many(7) })}
      {chart('w38-two-zones', { series: TWO, zones: NAMED_ZONES })}
      {chart('w38-seven-refs', { series: many(7), refLines: REFS })}
      {chart('w38-five-refs-wide', { series: many(5), refLines: REFS }, 1000)}
      {chart('w38-seven-wide', { series: many(7) }, 1000)}
      {chart('w38-two-zones-wide', { series: TWO, zones: NAMED_ZONES }, 1000)}
      {chart('w38-one-fold', { series: ONE, zones: ONE_FOLD_ZONES })}
      {chart('w38-long', { series: LONG })}
      {/* argo's usage health card: a Bars key with three verdict labels, bottom, in a half column */}
      {[340, 500, 1000].map((w) => (
        // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
        <div key={w} data-testid={`w38-verdict-${w}`} style={{ width: w }}>
          <Bars
            ariaLabel="Error events per day"
            data={DATA}
            height={120}
            x={(d) => d.at}
            legend={{ placement: 'bottom' }}
            bars={VERDICT}
          />
        </div>
      ))}
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
