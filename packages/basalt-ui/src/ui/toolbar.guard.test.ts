/**
 * Compile-time proof of the `toolbar` guard, checked by `tsc --noEmit`: a props type that drops a
 * `variant` composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { ToolbarButtonProps } from './toolbar'
import { toolbarGroupVariants, toolbarSeparatorVariants, toolbarVariants } from './toolbar'
import { requires } from './toolbar.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Variant = NonNullable<ToolbarButtonProps['variant']>
type WithoutGhost = {
  variant?: Exclude<Variant, 'ghost'> | null | undefined
  size?: ToolbarButtonProps['size']
}
type WithExtra = {
  variant?: Variant | 'wild' | null | undefined
  size?: ToolbarButtonProps['size']
}

// @ts-expect-error `ghost` is called but no longer accepted
export const removedVariant: Accepts<WithoutGhost> = requires

export const addedVariant: Accepts<WithExtra> = requires

describe('toolbar guard', () => {
  test('the tables carry the shared control height', () => {
    expect(toolbarVariants()).toContain('min-h-ctl')
    expect(toolbarGroupVariants()).toContain('h-ctl')
    expect(toolbarSeparatorVariants()).toContain('w-px')
    expect(requires({ variant: 'ghost', size: 'md' })).toEqual({ variant: 'ghost', size: 'md' })
  })
})
