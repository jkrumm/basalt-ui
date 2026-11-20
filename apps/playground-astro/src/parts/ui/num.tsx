import { Num } from 'basalt-ui/ui/num'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <dl className="m-0 grid max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
      <dt>Distance, km</dt>
      <dd className="m-0">
        <Num value={1284} />
      </dd>
      <dt>Share of goal</dt>
      <dd className="m-0">
        <Num value={0.42} format={{ style: 'percent' }} />
      </dd>
      <dt>Heart rate</dt>
      <dd className="m-0">
        <Num value={null} />
      </dd>
    </dl>
  )
}
