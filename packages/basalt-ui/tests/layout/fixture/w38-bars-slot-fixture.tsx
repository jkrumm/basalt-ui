import type { ReactElement } from 'react'
import { Bars, Sparkline } from '../../../src/charts'
import { StatCard, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

type Bin = { bin: string; n: number }

const BINS: Bin[] = ['<20', '20–30', '30–40', '40–50', '50–60', '60–70', '70+'].map((bin, i) => ({
  bin,
  n: [1, 3, 6, 4, 5, 2, 1][i] ?? 0,
}))

/** A `Bars` and a `Sparkline` in the same StatCard slot: the bars must match the sparkline's box. */
export function W38BarsSlotFixture(): ReactElement {
  return (
    <StatGroup>
      <div data-testid="w38-bars-card">
        <StatCard
          title="Pace"
          value="42"
          unit="pages/h"
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
      <div data-testid="w38-spark-card">
        <StatCard
          title="Pace"
          value="42"
          unit="pages/h"
          sparkline={({ height }) => (
            <Sparkline ariaLabel="Trend" height={height} data={[1, 3, 6, 4, 5, 2, 1]} />
          )}
        />
      </div>
    </StatGroup>
  )
}
