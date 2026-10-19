import type { ReactElement } from 'react'
import { Bars, ChartCard, Lines, Sparkline } from '../../../src/charts'
import { StatCard, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

type Point = { at: Date; hr: number }

// A line that stays in the top third of its plot: a stacked chip at the plot's top would cover it.
const HIGH = [88, 90, 89, 91, 90, 92, 91, 90, 89, 91, 92, 90]
const DAYS = HIGH.map((_, i) => new Date(Date.UTC(2026, 8, 5 + i)))

const DATA: Point[] = Array.from({ length: 14 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 8, 1 + i)),
  hr: 58 + 6 * Math.sin(i / 2),
}))

const BINS = ['<20', '20–30', '30–40', '40–50', '50–60', '60–70', '70+'].map((bin, i) => ({
  bin,
  n: [1, 3, 6, 4, 5, 2, 1][i] ?? 0,
}))

/** A line chart whose one series label carries a figure, in a card of the given width. */
const lines = (id: string, width: number): ReactElement => (
  // theme-allow -- the wrapper width IS the fixture's payload (a 340px card at 390, a wide one at 1440)
  <div data-testid={id} style={{ width }}>
    <ChartCard title="Heart rate">
      <Lines
        ariaLabel={id}
        data={DATA}
        x={(d) => d.at}
        height={160}
        series={[
          {
            key: 'hr',
            label: 'Resting heart rate (HR 54/62 bpm)',
            color: VX.line,
            getValue: (d) => d.hr,
          },
        ]}
      />
    </ChartCard>
  </div>
)

/** Wave 38 readouts and tooltips: a high line in a 150px strip cell and card, tooltips at the first and last point. */
export function W38Readout2Fixture(): ReactElement {
  return (
    <>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a ~150px cell) */}
      <div data-testid="w38r2-strip" style={{ width: 150 }}>
        <StatGroup
          variant="strip"
          label="Fitness"
          cells={[
            {
              key: 'rhr',
              caption: 'RHR',
              value: '62',
              footer: 'resting, 7 days',
              visual: (
                <Sparkline
                  ariaLabel="RHR"
                  data={HIGH.map((value, i) => ({ at: DAYS[i]?.getTime() ?? 0, value }))}
                  format={(v) => `${v} bpm`}
                  height={28}
                />
              ),
            },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 150px card) */}
      <div data-testid="w38r2-card" style={{ width: 150 }}>
        <StatCard
          title="Resting"
          value="62"
          unit="bpm"
          subtitle="7-day rolling"
          sparkline={(size) => (
            <Sparkline
              ariaLabel="Resting"
              data={HIGH}
              labels={HIGH.map(() => 'Sunday 7 September 2026')}
              format={(v) => `${v} bpm`}
              {...size}
            />
          )}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 240px card) */}
      <div data-testid="w38r2-bars" style={{ width: 240 }}>
        <StatCard
          title="Pace"
          value="42"
          unit="pages/h"
          subtitle="slowest 18, fastest 71"
          sparkline={({ height }) => (
            <Bars
              ariaLabel="Pace distribution"
              data={BINS}
              x={(d) => d.bin}
              height={height}
              bars={[{ key: 'n', label: 'Books', color: VX.accent, getValue: (d) => d.n }]}
            />
          )}
        />
      </div>
      {lines('w38r2-lines-narrow', 340)}
      {lines('w38r2-lines-wide', 900)}
    </>
  )
}
