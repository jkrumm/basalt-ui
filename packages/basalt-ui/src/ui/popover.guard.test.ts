/**
 * Compile-time proof of the `popover` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. A panel without an
 * accessible name is a type error (the `unnamed` line in the guard).
 */
import { describe, expect, test } from 'bun:test'
import { popoverContentVariants } from './popover'
import type { PopoverContentProps } from './popover'
import { requiresPopover, requiresPopoverContent, requiresPopoverTrigger } from './popover.guard'

type CalledContent = Parameters<typeof requiresPopoverContent>[0]
type Accepts<P> = (c: CalledContent) => P

type Side = NonNullable<PopoverContentProps['side']>
type WithoutBottom = {
  'aria-label'?: string | undefined
  side?: Exclude<Side, 'bottom'> | undefined
}
type WithInlineSides = {
  'aria-label'?: string | undefined
  side?: Side | 'inline-end' | undefined
}

// @ts-expect-error `bottom` is called but no longer accepted
export const removed: Accepts<WithoutBottom> = requiresPopoverContent

export const added: Accepts<WithInlineSides> = requiresPopoverContent

describe('popover guard', () => {
  test('the requires functions pass through and the table resolves', () => {
    expect(requiresPopover({ defaultOpen: true })).toEqual({
      defaultOpen: true,
    })
    expect(requiresPopoverTrigger({ openOnHover: true, delay: 200 })).toEqual({
      openOnHover: true,
      delay: 200,
    })
    expect(requiresPopoverContent({ 'aria-label': 'Filters', side: 'bottom' })).toEqual({
      'aria-label': 'Filters',
      side: 'bottom',
    })
    expect(popoverContentVariants()).toContain('max-h-(--available-height)')
  })
})
