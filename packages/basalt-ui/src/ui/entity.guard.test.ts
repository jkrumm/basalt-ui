/**
 * Compile-time proof of the `entity` guard, checked by `tsc --noEmit`: a props type that drops a
 * `size` or `level` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { EntityTitleProps } from './entity'
import { entityChipVariants, entityTitleVariants } from './entity'
import { requires, requiresChip } from './entity.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Size = NonNullable<EntityTitleProps['size']>

// @ts-expect-error `lg` is called but no longer accepted
export const removedSize: Accepts<{
  title: string
  size?: Exclude<Size, 'lg'> | null | undefined
}> = requires

export const addedSize: Accepts<{ title: string; size?: Size | 'xl' | null | undefined }> = requires

// @ts-expect-error level 6 is called but no longer accepted
export const removedLevel: Accepts<{ title: string; level?: 1 | 2 | 3 | 4 | 5 }> = requires

describe('entity guard', () => {
  test('every called value resolves to classes in its cva table', () => {
    for (const size of ['sm', 'md', 'lg'] as const)
      expect(entityTitleVariants({ size })).toBeString()
    expect(entityTitleVariants({})).toBe(entityTitleVariants({ size: 'md' }))
    expect(entityChipVariants()).toContain('h-7')
    expect(requires({ title: 'Acme', size: 'lg', level: 1 })).toEqual({
      title: 'Acme',
      size: 'lg',
      level: 1,
    })
    expect(requiresChip({ label: 'Acme', href: '/c/acme' }).label).toBe('Acme')
  })
})
