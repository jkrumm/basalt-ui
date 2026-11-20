import { OverlayHost, defineOverlays } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

const OVERLAYS = defineOverlays({
  'run:delete': {
    title: 'Delete run',
    render: (payload: { id: string }) => <p className="m-0 text-sm">Delete run {payload.id}?</p>,
  },
})

export function Demo(): ReactElement {
  return (
    <div>
      <Button variant="danger">Delete run</Button>
      <OverlayHost overlays={OVERLAYS} />
    </div>
  )
}
