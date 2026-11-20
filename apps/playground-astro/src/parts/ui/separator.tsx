import { Separator } from 'basalt-ui/ui/separator'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="max-w-sm">
      <p className="m-0 text-sm">Pace, last 7 days</p>
      <Separator className="my-4" />
      <div className="flex h-6 items-center gap-3 text-sm">
        <span>12.4 km</span>
        <Separator orientation="vertical" />
        <span>52 min</span>
      </div>
    </div>
  )
}
