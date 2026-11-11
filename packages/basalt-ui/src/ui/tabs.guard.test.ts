/**
 * Compile-time proof of the `tabs` guard, checked by `tsc --noEmit`: a props type that drops a size
 * composites call fails, one that adds a size passes.
 */
import { describe, expect, test } from 'bun:test'
import type { TabsProps } from './tabs'
import { tabsVariants } from './tabs'
import { requires } from './tabs.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Size = NonNullable<TabsProps['size']>
type WithoutSm = { size?: Exclude<Size, 'sm'> | null | undefined }
type WithLg = { size?: Size | 'lg' | null | undefined }

// @ts-expect-error `sm` is called but no longer accepted
export const removed: Accepts<WithoutSm> = requires

export const added: Accepts<WithLg> = requires

describe('tabs guard', () => {
  test('every called size resolves to classes in the cva table', () => {
    const sizes = (['md', 'sm'] as const).map((size) => tabsVariants({ size }))
    expect(new Set(sizes).size).toBe(2)
    expect(requires({ size: 'sm' })).toEqual({ size: 'sm' })
  })
})
