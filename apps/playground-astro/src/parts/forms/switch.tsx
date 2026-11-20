import { Switch } from 'basalt-ui/ui/switch'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-sm items-center justify-between gap-4">
      <span aria-hidden="true">Deploy on push</span>
      <Switch defaultChecked aria-label="Deploy on push" />
    </div>
  )
}
