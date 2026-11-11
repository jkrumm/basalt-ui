/**
 * Compile-time proof of the `progress` guard, checked by `tsc --noEmit`: a props type that drops a
 * `tone` value or a prop composites call fails, one that adds a value passes; a bar and a ring
 * compile with a name and not without.
 */
import { describe, expect, test } from 'bun:test'
import type { ProgressProps, RingProps } from './progress'
import { progressVariants, ringVariants } from './progress'
import { requires, requiresRing } from './progress.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<ProgressProps['tone']>
type WithoutBad = {
  tone?: Exclude<Tone, 'bad'> | null | undefined
  value: number | null
  min?: number | undefined
  max?: number | undefined
}
type WithPurple = {
  tone?: Tone | 'purple' | null | undefined
  value: number | null
  min?: number | undefined
  max?: number | undefined
}

// @ts-expect-error `bad` is called but no longer accepted
export const removedTone: Accepts<WithoutBad> = requires

export const addedTone: Accepts<WithPurple> = requires

export const labelled: ProgressProps = { value: 1, 'aria-label': 'Upload' }
export const labelledBy: ProgressProps = { value: null, 'aria-labelledby': 'heading' }
export const ring: RingProps = { value: 1, 'aria-label': 'Disk' }
export const ringBy: RingProps = { value: 1, 'aria-labelledby': 'heading' }

describe('progress guard', () => {
  test('every called tone resolves to classes in its cva tables', () => {
    for (const tone of ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const) {
      expect(progressVariants({ tone })).toBeString()
      expect(ringVariants({ tone })).toBeString()
    }
    expect(progressVariants({ tone: 'good' })).toContain('*:bg-good')
    expect(progressVariants({})).toBe(progressVariants({ tone: 'accent' }))
    expect(ringVariants({ tone: 'warn' })).toContain('text-warn')
    expect(requires({ value: 3, tone: 'info' })).toEqual({ value: 3, tone: 'info' })
    expect(requiresRing({ value: 3, digits: 0 })).toEqual({ value: 3, digits: 0 })
  })
})
