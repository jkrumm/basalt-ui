import type { AlertDialogContentProps, DialogContentProps, DialogProps } from './dialog'

/**
 * Hand-authored guard for `dialog` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The one axis is `size`; a panel's `title` is required by type.
 */

// basalt:guard requires
type CalledDialog = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean | 'trap-focus'
}
type CalledContent = {
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
}
type CalledAlert = { title: string; description?: string }

export const requiresDialog = (
  c: CalledDialog,
): Pick<DialogProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'modal'> => c
export const requiresContent = (
  c: CalledContent,
): Pick<DialogContentProps, 'title' | 'description' | 'size'> => c
export const requiresAlertContent = (
  c: CalledAlert,
): Pick<AlertDialogContentProps, 'title' | 'description'> => c

// basalt:guard closed
// @ts-expect-error a dialog panel without a title fails to type-check
export const untitled: DialogContentProps = {}
// @ts-expect-error an alert panel without a title fails to type-check
export const untitledAlert: AlertDialogContentProps = {}
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<DialogContentProps, 'size'> = { size: 'xl' }
