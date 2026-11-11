/**
 * Compile-time proof of the `slider` guard, checked by `tsc --noEmit`: a props type that drops a
 * prop composites call fails, one that adds a prop passes.
 */
import { describe, expect, test } from 'bun:test'
import { sliderVariants } from './slider'
import { requires } from './slider.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type NumberOnly = { value?: number | undefined }
type AnyValue = { value?: number | readonly number[] | string | undefined }

// @ts-expect-error a range value (an array) is called but no longer accepted
export const removed: Accepts<NumberOnly> = requires

export const added: Accepts<AnyValue> = requires

describe('slider guard', () => {
  test('the table resolves to classes and the guard is the identity', () => {
    expect(sliderVariants()).toContain('h-6')
    expect(requires({ value: 3, step: 0.5 })).toEqual({ value: 3, step: 0.5 })
    expect(requires({ value: [1, 2], thumbLabels: ['a', 'b'] })).toEqual({
      value: [1, 2],
      thumbLabels: ['a', 'b'],
    })
  })
})
