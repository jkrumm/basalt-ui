import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary">Save run</Button>
      <Button>Cancel</Button>
      <Button variant="ghost">Skip</Button>
      <Button variant="danger">Delete</Button>
      <Button size="sm" loading>
        Syncing
      </Button>
    </div>
  )
}
