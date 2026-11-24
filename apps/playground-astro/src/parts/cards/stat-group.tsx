import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import type { ReactElement } from 'react'
import { WEEK } from '../../demo/data'

export function Demo(): ReactElement {
  return (
    <StatGroup variant="strip" label="Fleet health">
      <StatCell
        title="Services healthy"
        value="5 / 6"
        status={{ tone: 'warn', label: '1 degraded' }}
        chart={(box) => (
          <Sparkline
            points={WEEK}
            height={box.height}
            reference={6}
            label="Healthy services per day"
          />
        )}
      />
      <StatCell
        title="Deploys"
        value={164}
        delta={{ value: '+12%', polarity: 'up-good', label: 'vs last week' }}
      />
      <StatCell
        title="Median duration"
        value={174}
        unit="s"
        delta={{ value: '-14 s', polarity: 'up-bad', label: 'vs last week' }}
      />
    </StatGroup>
  )
}
