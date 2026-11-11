import type { TooltipProps } from './tooltip'

/**
 * Hand-authored guard for `tooltip` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. There are no variant axes; the label is a string by type, so rich
 * content can never hide behind a hover.
 */

// basalt:guard requires
type CalledTooltip = {
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  delay?: number
  closeDelay?: number
}

export const requiresTooltip = (
  c: CalledTooltip,
): Pick<TooltipProps, 'label' | 'side' | 'align' | 'sideOffset' | 'delay' | 'closeDelay'> => c

// basalt:guard closed
// @ts-expect-error the label is a string: a node is a type error
export const richLabel: Pick<TooltipProps, 'label'> = { label: { rich: true } }
// @ts-expect-error a tooltip without a label fails to type-check
export const unlabelled: Pick<TooltipProps, 'label'> = {}
