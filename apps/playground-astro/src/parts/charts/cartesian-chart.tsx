import { CartesianChart } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { CHART_WIDTH, DAYS, DEMO_SERIES } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <CartesianChart
        label="Sessions per day with signups as bars"
        data={DAYS}
        x={{ value: (d) => d.t }}
        height={220}
        series={[
          {
            mark: 'bar',
            key: 'signups',
            label: 'Signups',
            color: DEMO_SERIES.signups,
            y: (d) => d.signups,
            axis: 'right',
          },
          {
            mark: 'line',
            key: 'sessions',
            label: 'Sessions',
            color: DEMO_SERIES.sessions,
            y: (d) => d.sessions,
          },
        ]}
      />
    </div>
  )
}
