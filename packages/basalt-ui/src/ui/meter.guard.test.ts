/**
 * Compile-time proof of the `meter` guard, checked by `tsc --noEmit`: a props type that drops a
 * `tone` value or a prop composites call fails, one that adds a value passes; a zone without a
 * label does not compile.
 */
import { describe, expect, test } from 'bun:test'
import type { MeterProps } from './meter'
import { meterVariants } from './meter'
import { requires } from './meter.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<MeterProps['tone']>
type Rest = { label: string; value: number | null; min?: number | undefined; max: number }
type WithoutWarn = Rest & { tone?: Exclude<Tone, 'warn'> | null | undefined }
type WithPurple = Rest & { tone?: Tone | 'purple' | null | undefined }

// @ts-expect-error `warn` is called but no longer accepted
export const removedTone: Accepts<WithoutWarn> = requires

export const addedTone: Accepts<WithPurple> = requires

describe('meter guard', () => {
  test('every called tone resolves to classes in the cva table', () => {
    for (const tone of ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const) {
      expect(meterVariants({ tone })).toBeString()
    }
    expect(meterVariants({ tone: 'good' })).toContain('bg-good')
    expect(meterVariants({})).toBe(meterVariants({ tone: 'neutral' }))
    expect(requires({ label: 'Load', value: 1, max: 2 })).toEqual({
      label: 'Load',
      value: 1,
      max: 2,
    })
  })
})
