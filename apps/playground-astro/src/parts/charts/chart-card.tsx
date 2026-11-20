import { ChartCard, Lines } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { CHART_WIDTH, DAYS, DEMO_SERIES } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <ChartCard
        title="Sessions"
        subtitle="last 28 days"
        figure={{ value: 1652, delta: { value: '+8%', polarity: 'up-good' }, period: 'vs prior' }}
        chart={(box) => (
          <Lines
            height={box.height}
            label="Sessions per day"
            data={DAYS}
            x={{ value: (d) => d.t }}
            series={[
              {
                mark: 'line',
                key: 'sessions',
                label: 'Sessions',
                color: DEMO_SERIES.sessions,
                y: (d) => d.sessions,
              },
            ]}
          />
        )}
        footer={[
          { label: 'Peak', value: '1,810' },
          { label: 'Low', value: '1,004' },
        ]}
      />
    </div>
  )
}
