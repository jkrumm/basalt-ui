import { InfoHint } from 'basalt-ui/ui/info-hint'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <p className="m-0 text-sm">
      Training load{' '}
      <InfoHint label="Training load">
        Acute load over the last 7 days, divided by the 28-day base.
      </InfoHint>{' '}
      is 1.2 this week.
    </p>
  )
}
