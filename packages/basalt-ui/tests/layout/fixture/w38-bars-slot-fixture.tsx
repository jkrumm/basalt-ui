import type { ReactElement } from 'react'
import { Bars, Sparkline } from '../../../src/charts'
import { StatCard, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

type Bin = { bin: string; n: number }

const BINS: Bin[] = ['<20', '20–30', '30–40', '40–50', '50–60', '60–70', '70+'].map((bin, i) => ({
  bin,
  n: [1, 3, 6, 4, 5, 2, 1][i] ?? 0,
}))

const SPARK = BINS.map((b) => b.n)

const visuals = {
  bars: (height: number) => (
    <Bars
      ariaLabel="Pace distribution"
      data={BINS}
      x={(d) => d.bin}
      height={height}
      bars={[{ key: 'n', label: 'Books', color: VX.accent, getValue: (d) => d.n }]}
    />
  ),
  spark: (height: number) => <Sparkline ariaLabel="Trend" height={height} data={SPARK} />,
}

/** A `Bars` and a `Sparkline` in the same StatCard slot and the same strip cell: the two must sit alike. */
export function W38BarsSlotFixture(): ReactElement {
  return (
    <>
      {(['bars', 'spark'] as const).map((kind) => (
        <div key={kind} data-testid={`w38-${kind}-card`} style={{ width: 240 }}>
          <StatCard
            title="Pace"
            value="42"
            unit="pages/h"
            subtitle="slowest 18, fastest 71"
            sparkline={({ height }) => visuals[kind](height)}
          />
        </div>
      ))}
      {(['bars', 'spark'] as const).map((kind) => (
        <div key={kind} data-testid={`w38-${kind}-strip`} style={{ width: 240 }}>
          <StatGroup
            variant="strip"
            label="Reading"
            cells={[
              {
                key: 'pace',
                caption: 'Pace',
                value: '42',
                visual: visuals[kind](28),
                footer: 'slowest 18, fastest 71',
              },
            ]}
          />
        </div>
      ))}
    </>
  )
}
