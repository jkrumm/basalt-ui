// An npm composite: it imports the primitive by its published specifier, so an eject reroutes it.
import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

export function SaveBar({ label }: { label: string }): ReactElement {
  return (
    <div data-slot="save-bar">
      <Button variant="primary">{label}</Button>
    </div>
  )
}
