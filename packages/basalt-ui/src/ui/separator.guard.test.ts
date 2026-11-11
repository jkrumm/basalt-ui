/**
 * Compile-time proof of the `separator` guard, checked by `tsc --noEmit`: a props type that drops
 * an orientation composites call fails, one that adds an orientation passes.
 */
import { describe, expect, test } from 'bun:test'
import type { SeparatorProps } from './separator'
import { separatorVariants } from './separator'
import { requires } from './separator.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Orientation = NonNullable<SeparatorProps['orientation']>
type WithoutVertical = { orientation?: Exclude<Orientation, 'vertical'> | null | undefined }
type WithDiagonal = { orientation?: Orientation | 'diagonal' | null | undefined }

// @ts-expect-error `vertical` is called but no longer accepted
export const removed: Accepts<WithoutVertical> = requires

export const added: Accepts<WithDiagonal> = requires

describe('separator guard', () => {
  test('every called orientation resolves to classes in the cva table', () => {
    const classes = (['horizontal', 'vertical'] as const).map((orientation) =>
      separatorVariants({ orientation }),
    )
    expect(new Set(classes).size).toBe(2)
    expect(separatorVariants({})).toBe(separatorVariants({ orientation: 'horizontal' }))
    expect(requires({ orientation: 'vertical' })).toEqual({ orientation: 'vertical' })
  })
})
