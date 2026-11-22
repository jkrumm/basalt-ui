import type { ReactNode } from 'react'
import type { SheetContentProps, SheetProps } from './sheet'

/**
 * Hand-authored guard for `sheet` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The one axis is `placement`, set on `Sheet`; a panel's `title` is
 * required by type, and its header takes a `tag` and `actions` and its body a `footer` band.
 */

// basalt:guard requires
type CalledSheet = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: 'bottom' | 'right' | 'auto'
}
type CalledContent = { title: string; tag?: string; actions?: ReactNode; footer?: ReactNode }

export const requiresSheet = (
  c: CalledSheet,
): Pick<SheetProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'placement'> => c
export const requiresContent = (
  c: CalledContent,
): Pick<SheetContentProps, 'title' | 'tag' | 'actions' | 'footer'> => c

// basalt:guard closed
// @ts-expect-error a sheet panel without a title fails to type-check
export const untitled: SheetContentProps = {}
// @ts-expect-error a placement outside the union is a type error
export const closedPlacement: Pick<SheetProps, 'placement'> = { placement: 'left' }
