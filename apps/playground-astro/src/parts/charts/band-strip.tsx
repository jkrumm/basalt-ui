import { BandStrip } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { CHART_WIDTH } from '../../demo/data'

type Day = { t: Date; up: 'up' | 'degraded' | 'down' }

const DAYS: readonly Day[] = Array.from({ length: 30 }, (_, i) => ({
  t: new Date(Date.UTC(2026, 9, 1 + i)),
  up: i === 11 ? 'down' : i % 9 === 4 ? 'degraded' : 'up',
}))

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <BandStrip
        label="Uptime per day"
        data={DAYS}
        x={(d) => d.t}
        height={64}
        states={[
          { key: 'up', label: 'Up', color: BASALT.good, tone: 'good' },
          { key: 'degraded', label: 'Degraded', color: BASALT.warn, tone: 'warn' },
          { key: 'down', label: 'Down', color: BASALT.bad, tone: 'bad' },
        ]}
        getBand={(d) => ({ state: d.up })}
      />
    </div>
  )
}
