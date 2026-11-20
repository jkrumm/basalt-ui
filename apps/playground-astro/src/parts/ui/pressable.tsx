import { Pressable } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Pressable size="row" className="w-full">
        Morning run, 12.4 km
      </Pressable>
      <Pressable size="chip">Last 7 days</Pressable>
    </div>
  )
}
