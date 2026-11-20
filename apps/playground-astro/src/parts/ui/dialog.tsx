import { Button } from 'basalt-ui/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from 'basalt-ui/ui/dialog'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" />}>Rename run</DialogTrigger>
      <DialogContent
        title="Rename run"
        description="The name shows in the run list and in exports."
      >
        <DialogClose render={<Button />}>Cancel</DialogClose>
      </DialogContent>
    </Dialog>
  )
}
