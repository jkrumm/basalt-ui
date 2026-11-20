import { Button } from 'basalt-ui/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from 'basalt-ui/ui/sheet'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="secondary" />}>Edit run</SheetTrigger>
      <SheetContent title="Edit run">
        <p className="m-0 text-sm text-muted-foreground">Morning run, 12.4 km, 52 min.</p>
        <SheetClose render={<Button />}>Close</SheetClose>
      </SheetContent>
    </Sheet>
  )
}
