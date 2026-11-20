import { Meter } from 'basalt-ui/ui/meter'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Meter
      label="Training load"
      value={58}
      min={0}
      max={100}
      zones={[
        { to: 40, tone: 'good', label: 'Easy' },
        { to: 70, tone: 'warn', label: 'Hard' },
        { to: 100, tone: 'bad', label: 'Overload' },
      ]}
      className="max-w-xs"
    />
  )
}
