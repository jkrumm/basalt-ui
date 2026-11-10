/**
 * Compile-time proof of the `button` guard, checked by `tsc --noEmit`: a `requires` function that
 * returns a props type missing a variant composites call fails (`@ts-expect-error` below turns a
 * silent pass into an error), and one that returns a wider type passes. Same convention as
 * `unwrap.type-guard.test.ts`; the `.test.ts` name keeps the fixture out of the tsup build.
 */
import { describe, expect, test } from 'bun:test'
import { buttonVariants, pressableVariants } from './button'
import type { ButtonProps } from './button'
import { requires, requiresPressable } from './button.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Variant = NonNullable<ButtonProps['variant']>
type WithoutGhost = { variant?: Exclude<Variant, 'ghost'> | null | undefined }
type WithTertiary = { variant?: Variant | 'tertiary' | null | undefined }

// Removing a variant composites call (`ghost`) fails the guard.
// @ts-expect-error `ghost` is called but no longer accepted
export const removed: Accepts<WithoutGhost> = requires

// Adding a variant does not.
export const added: Accepts<WithTertiary> = requires

describe('button guard', () => {
  test('every called variant and size resolves to classes in the cva table', () => {
    const called: Called = { variant: 'ghost', size: 'icon' }
    expect(buttonVariants(called)).toContain('size-ctl')
    const variants = (['primary', 'secondary', 'ghost'] as const).map((variant) =>
      buttonVariants({ variant }),
    )
    expect(new Set(variants).size).toBe(3)
    for (const size of ['none', 'row', 'chip'] as const) {
      expect(pressableVariants({ size })).toBeString()
    }
    expect(requires({})).toEqual({})
    expect(requiresPressable({ size: 'chip' })).toEqual({ size: 'chip' })
  })
})
