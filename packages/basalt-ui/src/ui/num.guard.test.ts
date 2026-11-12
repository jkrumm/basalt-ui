/**
 * Compile-time proof of the `num` guard, checked by `tsc --noEmit`: a props type that drops a
 * `tone` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { NumProps } from './num'
import { numVariants } from './num'
import { requires } from './num.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<NumProps['tone']>
type WithoutBad = {
  tone?: Exclude<Tone, 'bad'> | null | undefined
  value: number | null | undefined
}
type WithPurple = { tone?: Tone | 'purple' | null | undefined; value: number | null | undefined }

// @ts-expect-error `bad` is called but no longer accepted
export const removedTone: Accepts<WithoutBad> = requires

export const addedTone: Accepts<WithPurple> = requires

describe('num guard', () => {
  test('every called tone resolves to classes in its cva table', () => {
    for (const tone of ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const) {
      expect(numVariants({ tone })).toContain('tabular-nums')
    }
    expect(numVariants({ tone: 'bad' })).toContain('text-bad')
    expect(requires({ tone: 'bad', value: 1 })).toEqual({ tone: 'bad', value: 1 })
  })
})
