import { Progress, Ring } from 'basalt-ui/ui/progress'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xs flex-col gap-4">
      <Progress aria-label="Import progress" value={64} />
      <Progress aria-label="Upload in progress" value={null} />
      <Ring aria-label="Weekly goal" value={42.5} />
    </div>
  )
}
