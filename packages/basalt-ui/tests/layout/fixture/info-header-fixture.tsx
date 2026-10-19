import type { ReactElement } from 'react'
import { ChartCard } from '../../../src/charts'
import { DeltaBadge, Section, StatCard, StatGroup } from '../../../src/index'

const LONG_INFO =
  'The acute-to-chronic workload ratio compares the load of the last seven days with the rolling ' +
  'average of the last four weeks. Values between 0.8 and 1.3 sit in the sweet spot, below that ' +
  'fitness erodes, above it the risk of overreaching climbs. A fresh reading needs at least four ' +
  'weeks of history before the ratio is stable enough to steer a training week.'

const FACTS = [
  { value: '0.80', unit: 'zone', period: 'last 7 d' },
  { value: '−75.1', unit: 'MET-min/day', period: 'vs 28 d' },
]

const STAT_INFO =
  'Runs that ended in an error or a timeout over the selected window, counted once per run even ' +
  'when retried. A retry that succeeds is not a failure, a retry that fails again is still one.'

/** A plot-sized body: the bubble must land on it, not on the header. */
// theme-allow -- a plot-sized body; the bubble must land on it, not on the header
const Plot = (): ReactElement => <div style={{ height: 320 }} />

/**
 * Argo-shaped cards whose long `info` bubble used to open over the headline figures:
 * `info-header` (title + facts + basis line), `info-header-nofacts` (value + subtitle),
 * `info-header-section` (a `Section` with `info` around a ChartCard with facts) and
 * `info-header-bottom` (the facts card pushed 1200px down so a test can park it at the viewport's
 * bottom edge). Each carries `data-testid="<id>"`; the facts row is `<id>-facts`.
 */
export function InfoHeaderFixture(): ReactElement {
  return (
    // theme-allow -- the wrappers take the viewport width up to 700
    <div style={{ maxWidth: 700 }}>
      <div data-testid="info-header">
        <ChartCard
          title="ACWR"
          info={LONG_INFO}
          facts={FACTS}
          subtitle="Acute 7 d against chronic 28 d"
        >
          <Plot />
        </ChartCard>
      </div>
      <div data-testid="info-header-nofacts">
        <ChartCard title="ACWR" info={LONG_INFO} value="1.19" subtitle="7 days against the norm">
          <Plot />
        </ChartCard>
      </div>
      <div data-testid="info-header-section">
        <Section title="Training" info={LONG_INFO}>
          <div data-testid="info-header-section-facts">
            <ChartCard title="Inner" facts={FACTS}>
              <Plot />
            </ChartCard>
          </div>
        </Section>
      </div>
      <div data-testid="info-header-stat">
        {/* theme-allow -- a four-up, strip-like grid: each card is a quarter of the row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <StatCard
            title="Sessions"
            info={STAT_INFO}
            value="12,847"
            delta={4.2}
            deltaPeriod="vs prior"
          />
          <StatCard title="Volume" value="1,204" />
          <StatCard title="Distance" value="88" />
          <StatCard title="Pace" value="5:12" />
        </div>
      </div>
      <div data-testid="info-header-strip">
        <StatGroup
          variant="strip"
          label="Failures"
          cols={4}
          cells={[
            {
              key: 'failures',
              caption: 'Failures',
              info: STAT_INFO,
              value: '12,847',
              delta: <DeltaBadge value={4.2} period="vs prior 24 h" />,
            },
            { key: 'fleet', caption: 'Fleet', value: '19', unit: 'items' },
            { key: 'spend', caption: 'Spend', value: '€5.40' },
            { key: 'idle', caption: 'Idle', value: '3' },
          ]}
        />
      </div>
      {/* theme-allow -- a tall spacer so the card can be scrolled to the viewport's bottom edge */}
      <div style={{ height: 1200 }} />
      <div data-testid="info-header-bottom">
        <ChartCard title="ACWR" info={LONG_INFO} facts={FACTS} subtitle="Acute 7 d">
          <Plot />
        </ChartCard>
      </div>
      {/* theme-allow -- room below the bottom card so the page can scroll it up to the edge */}
      <div style={{ height: 600 }} />
    </div>
  )
}
