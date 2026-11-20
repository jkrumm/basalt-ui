import { Lines } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { CHART_WIDTH, DAYS, DEMO_SERIES } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <Lines
        label="Sessions and signups per day"
        data={DAYS}
        x={{ value: (d) => d.t }}
        height={220}
        series={[
          {
            mark: 'line',
            key: 'sessions',
            label: 'Sessions',
            color: DEMO_SERIES.sessions,
            y: (d) => d.sessions,
          },
          {
            mark: 'line',
            key: 'signups',
            label: 'Signups',
            color: DEMO_SERIES.signups,
            y: (d) => d.signups,
            axis: 'right',
          },
        ]}
      />
    </div>
  )
}
