import type { ReactElement } from 'react'
import { ChartCard, Heatmap, Lines } from '../../../src/charts'
import type { ChartFact } from '../../../src/charts'
import { Meter, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

type Point = { at: Date; v: number }

const DATA: Point[] = Array.from({ length: 14 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 9, 1 + i)),
  v: 40 + 12 * Math.sin(i / 2),
}))

const FACTS: ChartFact = {
  value: '+01:23',
  unit: 'behind best pace',
  comparison: '+0:12',
  period: ['last entry 3 d ago', '12 entries this month', '7 d mean'],
}
const BASIS =
  'Pace against the best split of the last 30 runs; a stage that has not started shows the ghost of its best split.'

const chart = (
  <Lines
    ariaLabel="Pace"
    data={DATA}
    x={(d) => d.at}
    series={[{ key: 'v', label: 'Value', color: VX.line, getValue: (d) => d.v }]}
  />
)

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const ROWS = ['orders', 'refunds', 'payouts', 'invoices', 'ledger']
const CELLS = ROWS.flatMap((r, ri) => HOURS.map((c, ci) => ({ r, c, v: (ri * 7 + ci * 3) % 11 })))

const heat = (
  <Heatmap
    ariaLabel="Deliveries"
    data={CELLS}
    rows={ROWS}
    cols={HOURS}
    getRow={(d) => d.r}
    getCol={(d) => d.c}
    getValue={(d) => d.v}
  />
)

const STATES = {
  rest: undefined,
  pending: { pending: true as const },
  empty: { empty: 'No run to compare.' },
  error: { error: new Error('The run feed is not answering.') },
}

const SEGMENTS = [
  { value: 620, label: 'Files', color: VX.status.good },
  { value: 260, label: 'History', color: VX.status.warn },
  { value: 40, label: 'Tools', color: VX.status.bad },
  { value: 24, label: 'Other', tone: 'muted' as const },
]

/** Expression cycle 1 kit fixes: state heights, the fact period, the strip verdict and the Meter (`k1-*`). */
export function K1KitFixture(): ReactElement {
  return (
    <>
      {(['rest', 'pending', 'empty', 'error'] as const).map((mode) => (
        <div key={mode} data-testid={`k1-chart-${mode}`}>
          <ChartCard
            title="Pipeline pace"
            facts={FACTS}
            subtitle={BASIS}
            {...(STATES[mode] !== undefined && { state: STATES[mode] })}
          >
            {chart}
          </ChartCard>
        </div>
      ))}
      {(['rest', 'pending', 'empty', 'error'] as const).map((mode) => (
        <div key={mode} data-testid={`k1-heat-${mode}`}>
          <ChartCard
            title="Webhook deliveries"
            facts={FACTS}
            subtitle={BASIS}
            {...(STATES[mode] !== undefined && { state: STATES[mode] })}
          >
            {heat}
          </ChartCard>
        </div>
      ))}
      <div data-testid="k1-strip">
        <StatGroup
          variant="strip"
          label="Tool SLO"
          cols={2}
          cells={[
            { key: 'fail', caption: 'Failures', value: '681', unit: 'allowed', tone: 'bad' },
            { key: 'lat', caption: 'p95 latency', value: '90 ms', tone: 'good' },
          ]}
        />
      </div>
      <div data-testid="k1-meter-over">
        <Meter label="Spend" value={130} max={100} />
      </div>
      <div data-testid="k1-meter-in">
        <Meter label="Spend" value={60} max={100} />
      </div>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} data-testid={`k1-meter-${size}`}>
          <Meter label="Context window" segments={SEGMENTS} max={1000} size={size} />
        </div>
      ))}
    </>
  )
}
