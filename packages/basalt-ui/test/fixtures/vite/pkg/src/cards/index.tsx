// An npm composite on `./cards`: it imports the primitive by its published specifier, so an eject
// reroutes it, and basalt() reads this import into the closure (cards -> ui/button).
import { Button } from 'basalt-ui/ui/button'
import type { ReactElement } from 'react'

export function SaveBar({ label }: { label: string }): ReactElement {
  return (
    <div data-slot="save-bar">
      <Button variant="primary">{label}</Button>
    </div>
  )
}
