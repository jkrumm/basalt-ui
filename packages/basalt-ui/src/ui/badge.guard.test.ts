/**
 * Compile-time proof of the `badge` guard, checked by `tsc --noEmit`: a props type that drops a
 * `tone` or `polarity` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { CountBadgeProps, DeltaBadgeProps, LozengeProps } from './badge'
import { countBadgeVariants, deltaBadgeVariants, lozengeVariants } from './badge'
import { requires } from './badge.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<LozengeProps['tone']>
type WithoutWarn = { tone?: Exclude<Tone, 'warn'> | null | undefined }
type WithPurple = { tone?: Tone | 'purple' | null | undefined }
type WithoutNeutralPolarity = { polarity: Exclude<DeltaBadgeProps['polarity'], 'neutral'> }

// @ts-expect-error `warn` is called but no longer accepted
export const removedTone: Accepts<WithoutWarn> = requires

export const addedTone: Accepts<WithPurple> = requires

// @ts-expect-error the `neutral` polarity is called but no longer accepted
export const removedPolarity: Accepts<WithoutNeutralPolarity> = requires

export const attention: Accepts<Pick<CountBadgeProps, 'attention'>> = requires

describe('badge guard', () => {
  test('every called value resolves to classes in its cva table', () => {
    for (const tone of ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const) {
      expect(lozengeVariants({ tone })).toBeString()
    }
    expect(lozengeVariants({ tone: 'good' })).toContain('bg-good-tint')
    expect(lozengeVariants({})).toBe(lozengeVariants({ tone: 'neutral' }))
    expect(countBadgeVariants({ attention: true })).toContain('bg-brand-fill')
    expect(countBadgeVariants({})).toBe(countBadgeVariants({ attention: false }))
    expect(deltaBadgeVariants({ tone: 'bad' })).toContain('bg-bad-tint')
    expect(requires({ polarity: 'up-bad', tone: 'info' })).toEqual({
      polarity: 'up-bad',
      tone: 'info',
    })
  })
})
