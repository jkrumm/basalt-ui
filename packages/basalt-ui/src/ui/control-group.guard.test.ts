/**
 * Compile-time proof of the `control-group` guard, checked by `tsc --noEmit`: a `requires` function
 * that returns a props type missing an axis composites call fails, a wider one passes. The
 * `.test.ts` name keeps the fixture out of the tsup build.
 */
import { describe, expect, test } from 'bun:test'
import { buttonGroupVariants, controlGroupVariants, inputAddonVariants } from './control-group'
import type { ButtonGroupProps } from './control-group'
import { requires, requiresControl, requiresInput } from './control-group.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Orientation = NonNullable<ButtonGroupProps['orientation']>
type WithoutVertical = { orientation?: Exclude<Orientation, 'vertical'> | undefined }
type WithDiagonal = { orientation?: Orientation | 'diagonal' | undefined }

// Removing an orientation composites call fails the guard.
// @ts-expect-error `vertical` is called but no longer accepted
export const removed: Accepts<WithoutVertical> = requires

// Adding one does not.
export const added: Accepts<WithDiagonal> = requires

describe('control-group guard', () => {
  test('every called axis resolves to classes in the cva tables', () => {
    expect(buttonGroupVariants({ orientation: 'vertical' })).toContain('flex-col')
    expect(buttonGroupVariants({ fill: true })).toContain('w-full')
    expect(controlGroupVariants({ orientation: 'horizontal' })).toContain('gap-0.5')
    expect(inputAddonVariants({ size: 'sm' })).toContain('h-6')
    expect(requires({})).toEqual({})
    expect(requiresControl({ fill: true })).toEqual({ fill: true })
    expect(requiresInput({ size: 'sm' })).toEqual({ size: 'sm' })
  })
})
