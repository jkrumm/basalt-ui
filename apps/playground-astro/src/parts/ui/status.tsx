import { Status, Swatch } from 'basalt-ui/ui/status'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <ul className="m-0 flex max-w-sm list-none flex-col gap-2 p-0 text-sm">
      <li className="flex items-center justify-between">
        <span>Ingest</span>
        <Status tone="good">Healthy</Status>
      </li>
      <li className="flex items-center justify-between">
        <span>Worker</span>
        <Status tone="warn">Degraded</Status>
      </li>
      <li className="flex items-center justify-between">
        <span>Archive</span>
        <Status tone="bad">Down</Status>
      </li>
      <li className="flex items-center gap-2">
        <Swatch color={BASALT.good} />
        <span>Sessions</span>
      </li>
    </ul>
  )
}
