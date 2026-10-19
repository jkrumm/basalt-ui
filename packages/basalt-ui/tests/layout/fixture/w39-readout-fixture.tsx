import type { ReactElement } from 'react'
import { Bars, ChartCard, Sparkline } from '../../../src/charts'
import { StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

type Day = { day: string; load: number }

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
  day,
  load: [120, 340, 80, 410, 260, 520, 200][i] ?? 0,
}))

/** argo's activities tooltip: a total plus one row per activity, labels carrying `TE x/y` and `HR a/b`. */
const activityRows = (n: number) => (d: Day) => [
  { label: 'Total', value: `${d.load} min` },
  ...Array.from({ length: n }, (_, i) => ({
    label: `${['Strength', 'Running', 'Cycling'][i % 3]} · TE 2.${i}/0.4 · HR 1${40 + i}/1${70 + i} · Load (${7 + i})`,
    value: `${40 + i} min`,
  })),
]

type Bin = { bin: string; n: number }
const BINS: Bin[] = [
  { bin: 'Mon', n: 4 },
  { bin: 'Tue', n: 0 },
  {
    bin: 'Wednesday the long bin that cannot fit a phone cell, nor a desktop one, however wide the strip',
    n: 6,
  },
  { bin: 'Thu', n: 3 },
  { bin: 'Fri', n: 5 },
  { bin: 'Sat', n: 2 },
]

const tipCard = (id: string, width: number, height: number, rows: number): ReactElement => (
  // theme-allow -- the wrapper width IS the fixture's payload
  <div data-testid={id} style={{ width }}>
    <h2 data-testid={`${id}-heading`}>Training</h2>
    <ChartCard title="Activities">
      <Bars
        ariaLabel={id}
        data={DAYS}
        x={(d) => d.day}
        height={height}
        bars={[
          { key: 'load', label: 'Load', color: VX.accent, getValue: (d) => d.load, tooltip: false },
        ]}
        tooltip={{ rows: activityRows(rows) }}
      />
    </ChartCard>
  </div>
)

// The line rides the top of its box until the last point drops: the bottom band is clear of it.
const ROW_DAYS = [88, 90, 89, 91, 90, 92, 91, 90, 91, 60].map((value, i) => ({
  at: Date.UTC(2026, 9, 10 + i),
  value,
}))

/** Wave 39 readouts: a tall tooltip in a short card, a slotted Bars in a strip cell, a short bare Sparkline between two lines of text. */
export function W39ReadoutFixture(): ReactElement {
  return (
    <>
      {tipCard('w39-tip', 360, 90, 4)}
      {tipCard('w39-tip-tall', 360, 60, 16)}
      {tipCard('w39-tip-room', 360, 240, 3)}
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 340px phone card) */}
      <div data-testid="w39-strip" style={{ width: 340 }}>
        <StatGroup
          variant="strip"
          label="Reading"
          cells={[
            {
              key: 'pace',
              caption: 'Pace',
              value: '42',
              visual: (
                <Bars
                  ariaLabel="Pace distribution"
                  data={BINS}
                  x={(d) => d.bin}
                  height={28}
                  legend={false}
                  bars={[{ key: 'n', label: 'Runs', color: VX.accent, getValue: (d) => d.n }]}
                />
              ),
              footer: 'slowest 18, fastest 71',
            },
          ]}
        />
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 150px row) */}
      <div data-testid="w39-spark" style={{ width: 150, marginBlock: 40 }}>
        <p data-testid="w39-above">Resting heart rate</p>
        <Sparkline
          ariaLabel="Resting heart rate"
          data={ROW_DAYS}
          height={28}
          format={(v) => `${v} bpm`}
          labels={ROW_DAYS.map((_, i) => `${10 + i} Oct`)}
        />
        <p data-testid="w39-below">7-day rolling</p>
      </div>
    </>
  )
}
