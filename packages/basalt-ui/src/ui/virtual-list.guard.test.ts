/**
 * Compile-time proof of the `virtual-list` guard, checked by `tsc --noEmit`: a props type that
 * drops a `spacer` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { VirtualListProps } from './virtual-list'
import { virtualListVariants } from './virtual-list'
import { requires } from './virtual-list.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Spacer = NonNullable<VirtualListProps['spacer']>
type WithoutTr = {
  count: number
  keepIndex?: number | undefined
  overscan?: number | undefined
  spacer?: Exclude<Spacer, 'tr'> | undefined
}
type WithLi = {
  count: number
  keepIndex?: number | undefined
  overscan?: number | undefined
  spacer?: Spacer | 'li' | undefined
}

// @ts-expect-error `tr` is called but no longer accepted
export const removedSpacer: Accepts<WithoutTr> = requires

export const addedSpacer: Accepts<WithLi> = requires

describe('virtual-list guard', () => {
  test('the scroller table owns the overflow', () => {
    expect(virtualListVariants()).toContain('overflow-y-auto')
    expect(requires({ count: 3, spacer: 'tr' })).toEqual({ count: 3, spacer: 'tr' })
  })
})
