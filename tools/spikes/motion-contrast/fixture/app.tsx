/**
 * The Q5 fixture. `?variant=shipped` renders the four overlays as the package ships them
 * (src/ui, which carry their own `motion-reduce:transition-none`); `?variant=bare` renders the same
 * Base UI parts with only their enter/exit transitions, so the harness clamp alone acts on the exit.
 * Base UI is imported through the package's own copy so there is one React and one Base UI per page.
 */
import { createRoot } from 'react-dom/client'
import { Dialog as BaseDialog } from '../../../../packages/basalt-ui/node_modules/@base-ui/react/dialog'
import { Drawer as BaseDrawer } from '../../../../packages/basalt-ui/node_modules/@base-ui/react/drawer'
import { Popover as BasePopover } from '../../../../packages/basalt-ui/node_modules/@base-ui/react/popover'
import { Toast as BaseToast } from '../../../../packages/basalt-ui/node_modules/@base-ui/react/toast'
import { Dialog, DialogContent, DialogTrigger } from '../../../../packages/basalt-ui/src/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../packages/basalt-ui/src/ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '../../../../packages/basalt-ui/src/ui/sheet'
import {
  Toast,
  ToastClose,
  ToastTitle,
  ToastViewport,
} from '../../../../packages/basalt-ui/src/ui/toast'

const variant = new URLSearchParams(location.search).get('variant') === 'bare' ? 'bare' : 'shipped'

function ShippedToasts() {
  const manager = BaseToast.useToastManager()
  return (
    <>
      <button
        type="button"
        data-open="toast"
        onClick={() => manager.add({ title: 'Saved', timeout: 0 })}
      >
        toast
      </button>
      <ToastViewport>
        {manager.toasts.map((toast) => (
          <Toast key={toast.id} toast={toast}>
            <ToastTitle />
            <ToastClose />
          </Toast>
        ))}
      </ToastViewport>
    </>
  )
}

function BareToasts() {
  const manager = BaseToast.useToastManager()
  return (
    <>
      <button
        type="button"
        data-open="toast"
        onClick={() => manager.add({ title: 'Saved', timeout: 0 })}
      >
        toast
      </button>
      <BaseToast.Portal>
        <BaseToast.Viewport className="bare-toast-stack" aria-label="Notifications">
          {manager.toasts.map((toast) => (
            <BaseToast.Root
              key={toast.id}
              toast={toast}
              className="bare-toast bare-pop"
              data-part="toast"
            >
              <BaseToast.Title />
              <BaseToast.Close data-part="toast-close" aria-label="Dismiss">
                x
              </BaseToast.Close>
            </BaseToast.Root>
          ))}
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </>
  )
}

function Shipped() {
  return (
    <>
      <Dialog>
        <DialogTrigger data-open="dialog">dialog</DialogTrigger>
        <DialogContent title="Rename">Body</DialogContent>
      </Dialog>
      <Sheet placement="right">
        <SheetTrigger data-open="sheet">sheet</SheetTrigger>
        <SheetContent title="Edit">Form</SheetContent>
      </Sheet>
      <Popover>
        <PopoverTrigger data-open="popover">popover</PopoverTrigger>
        <PopoverContent aria-label="Filters">Filters</PopoverContent>
      </Popover>
      <BaseToast.Provider>
        <ShippedToasts />
      </BaseToast.Provider>
    </>
  )
}

function Bare() {
  return (
    <>
      <BaseDialog.Root>
        <BaseDialog.Trigger data-open="dialog">dialog</BaseDialog.Trigger>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="bare-backdrop bare-fade" />
          <BaseDialog.Viewport className="bare-center">
            <BaseDialog.Popup className="bare-panel bare-pop" data-part="dialog">
              <BaseDialog.Title>Rename</BaseDialog.Title>
              <BaseDialog.Close>close</BaseDialog.Close>
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>
      <BaseDrawer.Root swipeDirection="right">
        <BaseDrawer.Trigger data-open="sheet">sheet</BaseDrawer.Trigger>
        <BaseDrawer.Portal>
          <BaseDrawer.Backdrop forceRender className="bare-backdrop bare-fade" />
          <BaseDrawer.Viewport>
            <BaseDrawer.Popup className="bare-sheet" data-part="sheet">
              <BaseDrawer.Content>
                <BaseDrawer.Title>Edit</BaseDrawer.Title>
                <BaseDrawer.Close>close</BaseDrawer.Close>
              </BaseDrawer.Content>
            </BaseDrawer.Popup>
          </BaseDrawer.Viewport>
        </BaseDrawer.Portal>
      </BaseDrawer.Root>
      <BasePopover.Root>
        <BasePopover.Trigger data-open="popover">popover</BasePopover.Trigger>
        <BasePopover.Portal>
          <BasePopover.Positioner sideOffset={4}>
            <BasePopover.Popup
              className="bare-panel bare-pop"
              data-part="popover"
              aria-label="Filters"
            >
              Filters
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
      <BaseToast.Provider>
        <BareToasts />
      </BaseToast.Provider>
    </>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <main style={{ display: 'flex', gap: 12, padding: 24 }}>
    {variant === 'bare' ? <Bare /> : <Shipped />}
  </main>,
)
