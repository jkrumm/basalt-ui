/**
 * Compile-time proof of the `segmented` guard, checked by `tsc --noEmit`: a props type that drops a
 * size or a prop composites call fails, one that adds a size passes.
 */
import { describe, expect, test } from 'bun:test'
import type { SegmentedProps } from './segmented'
import { segmentedItemVariants, segmentedVariants } from './segmented'
import { requires } from './segmented.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Size = NonNullable<SegmentedProps['size']>
type WithoutSm = { size?: Exclude<Size, 'sm'> | null | undefined }
type WithLg = { size?: Size | 'lg' | null | undefined }

// @ts-expect-error `sm` is called but no longer accepted
export const removed: Accepts<WithoutSm> = requires

export const added: Accepts<WithLg> = requires

describe('segmented guard', () => {
  test('every called size resolves to classes in both cva tables', () => {
    const track = (['md', 'sm'] as const).map((size) => segmentedVariants({ size }))
    const item = (['md', 'sm'] as const).map((size) => segmentedItemVariants({ size }))
    expect(new Set(track).size).toBe(2)
    expect(new Set(item).size).toBe(2)
    expect(requires({ size: 'sm', options: [] })).toEqual({ size: 'sm', options: [] })
  })
})
