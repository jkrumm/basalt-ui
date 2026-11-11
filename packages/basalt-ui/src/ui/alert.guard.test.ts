/**
 * Compile-time proof of the `alert` guard, checked by `tsc --noEmit`: a props type that drops a
 * `tone` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { AlertProps } from './alert'
import { alertVariants } from './alert'
import { requires } from './alert.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<AlertProps['tone']>
type WithoutInfo = { tone?: Exclude<Tone, 'info'> | null | undefined; title?: string }
type WithPurple = { tone?: Tone | 'purple' | null | undefined; title?: string }

// @ts-expect-error `info` is called but no longer accepted
export const removedTone: Accepts<WithoutInfo> = requires

export const addedTone: Accepts<WithPurple> = requires

describe('alert guard', () => {
  test('every called tone resolves to classes in its cva table', () => {
    for (const tone of ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const) {
      expect(alertVariants({ tone })).toBeString()
    }
    expect(alertVariants({ tone: 'bad' })).toContain('bg-bad-tint')
    expect(alertVariants({})).toBe(alertVariants({ tone: 'neutral' }))
    expect(requires({ tone: 'warn', title: 'x' })).toEqual({ tone: 'warn', title: 'x' })
  })
})
