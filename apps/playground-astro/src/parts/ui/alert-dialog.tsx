import { Button } from 'basalt-ui/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
  DialogClose,
} from 'basalt-ui/ui/dialog'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="danger" />}>Delete run</AlertDialogTrigger>
      <AlertDialogContent
        title="Delete this run?"
        description="The run and its splits are removed. This cannot be undone."
      >
        <DialogClose render={<Button />}>Keep run</DialogClose>
        <DialogClose render={<Button variant="danger" />}>Delete run</DialogClose>
      </AlertDialogContent>
    </AlertDialog>
  )
}
