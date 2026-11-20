import { ControlHome, ControlView, spec } from 'basalt-ui/controls'
import type { ReactElement } from 'react'
import { runs } from './fixtures'

export function Demo(): ReactElement {
  return (
    <ControlHome home="aside">
      <ControlView spec={spec(runs.field.region, 'Region')} />
      <ControlView spec={spec(runs.field.status, 'Status')} />
    </ControlHome>
  )
}
