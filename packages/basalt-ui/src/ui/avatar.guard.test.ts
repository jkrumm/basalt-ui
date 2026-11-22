/**
 * Compile-time proof of the `avatar` guard, checked by `tsc --noEmit`: a props type that drops a
 * `size`, `shape` or `ground` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { AvatarProps, AvatarStackProps } from './avatar'
import { avatarStackVariants, avatarVariants } from './avatar'
import { requires, requiresStack } from './avatar.guard'

type Called = Parameters<typeof requires>[0]
type CalledStack = Parameters<typeof requiresStack>[0]
type Accepts<P> = (c: Called) => P
type AcceptsStack<P> = (c: CalledStack) => P

type Size = NonNullable<AvatarProps['size']>
type Ground = NonNullable<AvatarStackProps['ground']>

// @ts-expect-error `lg` is called but no longer accepted
export const removedSize: Accepts<{ name: string; size?: Exclude<Size, 'lg'> | null | undefined }> =
  requires

export const addedSize: Accepts<{ name: string; size?: Size | 'xl' | null | undefined }> = requires

// @ts-expect-error `object` is called but no longer accepted
export const removedShape: Accepts<{ name: string; shape?: 'person' | null | undefined }> = requires

// @ts-expect-error `popover` is called but no longer accepted
export const removedGround: AcceptsStack<{
  label: string
  people: AvatarStackProps['people']
  ground?: Exclude<Ground, 'popover'> | null | undefined
}> = requiresStack

describe('avatar guard', () => {
  test('every called value resolves to classes in its cva table', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      expect(avatarVariants({ size })).toBeString()
      expect(avatarStackVariants({ size })).toBeString()
    }
    expect(avatarVariants({ shape: 'person' })).toContain('rounded-full')
    expect(avatarVariants({ shape: 'object' })).toContain('rounded-chip')
    expect(avatarVariants({ size: 'lg', shape: 'object' })).toContain('rounded-ctrl')
    expect(avatarVariants({})).toBe(avatarVariants({ size: 'md', shape: 'person' }))
    expect(avatarStackVariants({ ground: 'card' })).toContain('ring-card')
    expect(requires({ name: 'Ada', size: 'lg', shape: 'object' })).toEqual({
      name: 'Ada',
      size: 'lg',
      shape: 'object',
    })
  })
})
