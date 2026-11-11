/**
 * Compile-time proof of the `number-field` guard, checked by `tsc --noEmit`: a props type that
 * drops a size or a prop composites call fails, one that adds a size passes.
 */
import { describe, expect, test } from 'bun:test'
import type { NumberFieldProps } from './number-field'
import { numberFieldVariants } from './number-field'
import { requires } from './number-field.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Size = NonNullable<NumberFieldProps['size']>
type WithoutSm = { size?: Exclude<Size, 'sm'> | null | undefined }
type WithLg = { size?: Size | 'lg' | null | undefined }

// @ts-expect-error `sm` is called but no longer accepted
export const removed: Accepts<WithoutSm> = requires

export const added: Accepts<WithLg> = requires

describe('number-field guard', () => {
  test('every called size resolves to classes in the cva table', () => {
    const sizes = (['md', 'sm'] as const).map((size) => numberFieldVariants({ size }))
    expect(new Set(sizes).size).toBe(2)
    expect(requires({ size: 'sm', locale: 'de-DE' })).toEqual({ size: 'sm', locale: 'de-DE' })
  })
})
