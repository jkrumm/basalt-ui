/**
 * The `ui-dialogs` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 13, 14 and
 * 18): a dialog, an alert dialog, a sheet and a toast stack on their own markup, no shell and no
 * provider. It is the entry the `ui-dialogs` layout test bundles; the harness is told to "mount" it
 * by a no-op `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each a `data-testid`:
 * - `ud-open-dialog`, `ud-open-alert`, `ud-open-sheet`: the triggers; each overlay holds a field
 *   and a `ud-close-*` close button;
 * - `ud-add-toast`: queues one toast through a Base UI toast manager (the real host is `ToastHost`,
 *   state-5); `ud-page`: the page content behind every overlay.
 */
import { Toast as BaseToast } from '@base-ui/react/toast'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { Button } from '../../../src/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '../../../src/ui/dialog'
import { Input } from '../../../src/ui/input'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '../../../src/ui/sheet'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from '../../../src/ui/toast'

const manager = BaseToast.createToastManager()

function ToastList(): ReactElement {
  const { toasts } = BaseToast.useToastManager()
  return (
    <ToastViewport>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} tone="good" data-testid="ud-toast">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <ToastTitle />
            <ToastDescription />
          </div>
          <ToastClose />
        </Toast>
      ))}
    </ToastViewport>
  )
}

function Fixture(): ReactElement {
  return (
    <main
      className="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground"
      data-testid="ud-page"
    >
      <h1 className="text-lg font-medium">Overlays</h1>
      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger render={<Button data-testid="ud-open-dialog" />}>Rename</DialogTrigger>
          <DialogContent title="Rename project" description="Shown in the sidebar.">
            <Input aria-label="Name" defaultValue="basalt" />
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button data-testid="ud-close-dialog" />}>Cancel</DialogClose>
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="danger" data-testid="ud-open-alert" />}>
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent title="Delete project?" description="This cannot be undone.">
            <DialogClose render={<Button data-testid="ud-close-alert" />}>Cancel</DialogClose>
          </AlertDialogContent>
        </AlertDialog>
        <Sheet>
          <SheetTrigger render={<Button data-testid="ud-open-sheet" />}>Edit</SheetTrigger>
          <SheetContent title="Edit record">
            <Input aria-label="Title" defaultValue="Quarterly report" />
            <SheetClose render={<Button data-testid="ud-close-sheet" />}>Done</SheetClose>
          </SheetContent>
        </Sheet>
        <Button
          data-testid="ud-add-toast"
          onClick={() => manager.add({ title: 'Saved', description: 'Project renamed.' })}
        >
          Notify
        </Button>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        The page behind the overlays: it must stay out of reach while one is open and answer again
        once it is closed.
      </p>
    </main>
  )
}

function Root(): ReactElement {
  return (
    <BaseToast.Provider toastManager={manager}>
      <Fixture />
      <ToastList />
    </BaseToast.Provider>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Root />)
