/**
 * Compile-time proof of the `scroll-area` guard, checked by `tsc --noEmit`: a props type that drops
 * an orientation composites call fails, one that adds an orientation passes.
 */
import { describe, expect, test } from 'bun:test'
import type { ScrollAreaProps } from './scroll-area'
import { scrollAreaVariants } from './scroll-area'
import { requires } from './scroll-area.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Orientation = NonNullable<ScrollAreaProps['orientation']>
type WithoutBoth = { orientation?: Exclude<Orientation, 'both'> | null | undefined }
type WithDiagonal = { orientation?: Orientation | 'diagonal' | null | undefined }

// @ts-expect-error `both` is called but no longer accepted
export const removed: Accepts<WithoutBoth> = requires

export const added: Accepts<WithDiagonal> = requires

describe('scroll-area guard', () => {
  test('every called orientation resolves to classes in the cva table', () => {
    const classes = (['vertical', 'horizontal', 'both'] as const).map((orientation) =>
      scrollAreaVariants({ orientation }),
    )
    expect(new Set(classes).size).toBe(3)
    expect(scrollAreaVariants({})).toBe(scrollAreaVariants({ orientation: 'vertical' }))
    expect(requires({ orientation: 'both' })).toEqual({ orientation: 'both' })
  })
})
