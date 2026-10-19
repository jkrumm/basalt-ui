import type { ReactElement } from 'react'
import { ChartCard } from '../../../src/charts'

const LONG_INFO =
  'The acute-to-chronic workload ratio compares the load of the last seven days with the rolling ' +
  'average of the last four weeks. Values between 0.8 and 1.3 sit in the sweet spot, below that ' +
  'fitness erodes, above it the risk of overreaching climbs. A fresh reading needs at least four ' +
  'weeks of history before the ratio is stable enough to steer a training week.'

/**
 * An argo-shaped `ChartCard` (`data-testid="info-header"`): a title with a ~60-word `info`, headline
 * `facts` and a basis line, over a plot body — the composition whose bubble used to open over the
 * facts. The plot is tall enough that the bubble fits below the header block inside the card.
 */
export function InfoHeaderFixture(): ReactElement {
  return (
    // theme-allow -- the wrapper is the fixture's payload: it takes the viewport width up to 700
    <div data-testid="info-header" style={{ maxWidth: 700 }}>
      <ChartCard
        title="ACWR"
        info={LONG_INFO}
        facts={[
          { value: '0.80', unit: 'zone', period: 'last 7 d' },
          { value: '−75.1', unit: 'MET-min/day', period: 'vs 28 d' },
        ]}
        subtitle="Acute 7 d against chronic 28 d"
      >
        {/* theme-allow -- a plot-sized body; the bubble must land on it, not on the header */}
        <div style={{ height: 320 }} />
      </ChartCard>
    </div>
  )
}
