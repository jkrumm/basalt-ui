import { Alert } from 'basalt-ui/ui/alert'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-prose flex-col gap-3">
      <Alert tone="warn" title="Sync paused">
        Three runs could not reach the watch. They retry at 18:00.
      </Alert>
      <Alert tone="bad" title="Upload failed">
        The file is larger than 25 MB. Split it and try again.
      </Alert>
    </div>
  )
}
