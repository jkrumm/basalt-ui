import type {
  PreviewCardContentProps,
  PreviewCardProps,
  PreviewCardTriggerProps,
} from './preview-card'

/**
 * Hand-authored guard for `preview-card` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. There are no variant axes: the guard pins what a caller binds (the
 * link's address and hover timing, the card's placement) and that the open state stays boolean.
 */

// basalt:guard requires
type CalledCard = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}
type CalledTrigger = {
  href: string
  delay?: number
  closeDelay?: number
}
type CalledContent = {
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export const requiresPreviewCard = (
  c: CalledCard,
): Pick<PreviewCardProps, 'open' | 'defaultOpen' | 'onOpenChange'> => c
export const requiresPreviewCardTrigger = (
  c: CalledTrigger,
): Pick<PreviewCardTriggerProps, 'href' | 'delay' | 'closeDelay'> => c
export const requiresPreviewCardContent = (
  c: CalledContent,
): Pick<PreviewCardContentProps, 'side' | 'align' | 'sideOffset'> => c

// basalt:guard closed
// @ts-expect-error a side outside the union is a type error
export const closedSide: Pick<PreviewCardContentProps, 'side'> = { side: 'middle' }
// @ts-expect-error the open state is a boolean
export const closedOpen: Pick<PreviewCardProps, 'open'> = { open: 'yes' }
