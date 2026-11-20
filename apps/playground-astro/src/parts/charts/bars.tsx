import { Bars } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { CHART_WIDTH, DAYS, DEMO_SERIES } from '../../demo/data'

const WEEKS = DAYS.filter((_, i) => i % 7 === 0)

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <Bars
        label="Sessions and signups per week"
        data={WEEKS}
        x={{ value: (d) => d.t }}
        height={220}
        layout="grouped"
        series={[
          {
            mark: 'bar',
            key: 'sessions',
            label: 'Sessions',
            color: DEMO_SERIES.sessions,
            y: (d) => d.sessions,
          },
          {
            mark: 'bar',
            key: 'signups',
            label: 'Signups',
            color: DEMO_SERIES.signups,
            y: (d) => d.signups,
          },
        ]}
      />
    </div>
  )
}
