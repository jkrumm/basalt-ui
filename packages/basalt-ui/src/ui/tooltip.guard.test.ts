/**
 * Compile-time proof of the `tooltip` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The label is a string (the
 * `richLabel` line in the guard).
 */
import { describe, expect, test } from 'bun:test'
import { tooltipVariants } from './tooltip'
import type { TooltipProps } from './tooltip'
import { requiresTooltip } from './tooltip.guard'

type Called = Parameters<typeof requiresTooltip>[0]
type Accepts<P> = (c: Called) => P

type Side = NonNullable<TooltipProps['side']>
type WithoutTop = { label: string; side?: Exclude<Side, 'top'> | undefined }
type WithMore = { label: string; side?: Side | undefined; extra?: number }

// @ts-expect-error `top` is called but no longer accepted
export const removed: Accepts<WithoutTop> = requiresTooltip

export const added: Accepts<WithMore> = requiresTooltip

// @ts-expect-error a label that is not a string does not type-check
export const notAString: Pick<TooltipProps, 'label'> = { label: 1 }

describe('tooltip guard', () => {
  test('the requires function passes through and the table resolves', () => {
    expect(requiresTooltip({ label: 'Copy', side: 'top', delay: 0 })).toEqual({
      label: 'Copy',
      side: 'top',
      delay: 0,
    })
    expect(tooltipVariants()).toContain('pointer-events-none')
  })
})
