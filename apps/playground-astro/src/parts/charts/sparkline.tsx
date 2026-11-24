import { Sparkline } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { WEEK } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xs flex-col gap-4">
      <Sparkline points={WEEK} height={56} label="Healthy services per day" />
      <Sparkline
        points={WEEK}
        height={72}
        form="area"
        axisLabels={['Fri', 'Mon', 'Thu']}
        label="Healthy services per day"
      />
    </div>
  )
}
