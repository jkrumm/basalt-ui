import type { ReactElement } from 'react'
import { ChartCard, Lines } from '../../../src/charts'
import { StatCard } from '../../../src/dashboard/stat-card'
import { VX } from '../../../src/tokens'

type Row = { t: Date; v: number }
const DATA: Row[] = Array.from({ length: 12 }, (_, i) => ({
  t: new Date(Date.UTC(2026, 9, 1 + i)),
  v: 20 + ((i * 7) % 11),
}))

const EMPTY = 'No readings in the window. Check that the probe is reporting.'

const line = (
  <Lines
    ariaLabel="Throughput"
    data={DATA}
    x={(d) => d.t}
    series={[{ key: 'v', label: 'Mbit/s', color: VX.accent, getValue: (d) => d.v }]}
  />
)

const SPARK = () => <span style={{ display: 'block', height: 22 }} />

/**
 * Wave 46 r1: a line `ChartCard` at rest, empty and pending (`w46-chart-<mode>`), and a `StatCard`
 * with a delta and a sparkline at rest, loading and empty (`w46-stat-<mode>`), each in a 420px cell.
 */
export function W46ChartsFixture(): ReactElement {
  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, width: 420 }}>
      {(['rest', 'empty', 'pending'] as const).map((mode) => (
        <div key={mode} data-testid={`w46-chart-${mode}`}>
          <ChartCard
            title="Throughput"
            {...(mode === 'empty' && { state: { empty: EMPTY } })}
            {...(mode === 'pending' && { state: { pending: true } })}
          >
            {line}
          </ChartCard>
        </div>
      ))}
      {(['rest', 'loading', 'empty'] as const).map((mode) => (
        <div key={mode} data-testid={`w46-stat-${mode}`}>
          <StatCard
            title="Latency"
            value="18 ms"
            delta={4}
            deltaPeriod="vs median"
            sparkline={SPARK}
            {...(mode === 'loading' && { loading: true })}
            {...(mode === 'empty' && {
              emptyText: EMPTY,
              query: {
                data: [],
                isError: false,
                error: null,
                fetchStatus: 'idle' as const,
                refetch: () => undefined,
              },
            })}
          />
        </div>
      ))}
    </div>
  )
}
