import type { PopoverContentProps, PopoverProps, PopoverTriggerProps } from './popover'

/**
 * Hand-authored guard for `popover` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. There are no variant axes; a panel's accessible name is required by
 * type, and `openOnHover` lives on the trigger.
 */

// basalt:guard requires
type CalledPopover = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean | 'trap-focus'
}
type CalledTrigger = {
  openOnHover?: boolean
  delay?: number
  closeDelay?: number
}
type CalledContent = {
  'aria-label': string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  finalFocus?: boolean
}

export const requiresPopover = (
  c: CalledPopover,
): Pick<PopoverProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'modal'> => c
export const requiresPopoverTrigger = (
  c: CalledTrigger,
): Pick<PopoverTriggerProps, 'openOnHover' | 'delay' | 'closeDelay'> => c
export const requiresPopoverContent = (
  c: CalledContent,
): Pick<PopoverContentProps, 'aria-label' | 'side' | 'align' | 'sideOffset' | 'finalFocus'> => c

// basalt:guard closed
// @ts-expect-error a popover panel without an accessible name fails to type-check
export const unnamed: PopoverContentProps = {}
// @ts-expect-error a side outside the union is a type error
export const closedSide: Pick<PopoverContentProps, 'side'> = { side: 'middle' }
