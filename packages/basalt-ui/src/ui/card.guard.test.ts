/**
 * Compile-time proof of the `card` guard, checked by `tsc --noEmit`: a props type that drops a
 * `flush` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { CardProps } from './card'
import { cardVariants } from './card'
import { requires } from './card.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Flush = NonNullable<CardProps['flush']>
type WithoutTrue = { flush?: Exclude<Flush, true> | null | undefined }
type WithAuto = { flush?: Flush | 'auto' | null | undefined }

// @ts-expect-error `flush` true is called but no longer accepted
export const removed: Accepts<WithoutTrue> = requires

export const added: Accepts<WithAuto> = requires

describe('card guard', () => {
  test('every called flush value resolves to classes in the cva table', () => {
    expect(cardVariants({ flush: true })).toContain('p-0')
    expect(cardVariants({ flush: false })).toContain('p-4')
    expect(cardVariants({})).toBe(cardVariants({ flush: false }))
    expect(requires({ flush: true })).toEqual({ flush: true })
  })
})
