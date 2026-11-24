import { StatCard } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { WEEK } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <div className="max-w-sm">
      <StatCard
        title="Services healthy"
        subtitle="vs last week"
        value="5 / 6"
        delta={{ value: '-1', polarity: 'up-good' }}
        status={{ tone: 'warn', label: '1 degraded' }}
        chart={(box) => (
          <Sparkline points={WEEK} height={box.height} label="Healthy services per day" />
        )}
        axisLabels={['Fri', 'Mon', 'Thu']}
        footer={[
          { label: 'Open', value: 1 },
          { label: 'Fixed', value: 4 },
        ]}
      />
    </div>
  )
}
