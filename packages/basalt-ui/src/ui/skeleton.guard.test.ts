/**
 * Compile-time proof of the `skeleton` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The module has no cva axes,
 * so the guard pins its props and the tables' classes.
 */
import { describe, expect, test } from 'bun:test'
import { skeletonVariants, spinnerVariants } from './skeleton'
import { requires } from './skeleton.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type WithoutId = { className?: string; id?: undefined }
type WithMoreIds = { className?: string; id?: string | number | undefined }

// @ts-expect-error `id` is called but no longer accepted
export const removed: Accepts<WithoutId> = requires

export const added: Accepts<WithMoreIds> = requires

describe('skeleton guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requires({ className: 'w-8', id: 'x' })).toEqual({ className: 'w-8', id: 'x' })
    expect(skeletonVariants()).toContain('h-lh')
    expect(spinnerVariants()).toContain('w-lh')
  })
})
