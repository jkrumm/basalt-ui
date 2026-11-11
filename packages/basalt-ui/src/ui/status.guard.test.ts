/**
 * Compile-time proof of the `status` guard, checked by `tsc --noEmit`: a props type that drops a
 * `tone` value composites call fails, one that adds a value passes; a `Swatch` takes a `VX` or
 * `groupTokens` ref and nothing else.
 */
import { describe, expect, test } from 'bun:test'
import { VX, groupTokens } from '../tokens'
import type { StatusProps, SwatchProps } from './status'
import { statusVariants, swatchVariants } from './status'
import { requires } from './status.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<StatusProps['tone']>
type WithoutWarn = { tone?: Exclude<Tone, 'warn'> | null | undefined }
type WithPurple = { tone?: Tone | 'purple' | null | undefined }

// @ts-expect-error `warn` is called but no longer accepted
export const removedTone: Accepts<WithoutWarn> = requires

export const addedTone: Accepts<WithPurple> = requires

const series = groupTokens('probe', { a: { light: '#2f6fed', dark: '#7aa2ff' } })

export const fromVx: SwatchProps = { color: VX.good }
export const fromGroup: SwatchProps = { color: series.a }
// @ts-expect-error a plain `var(--other)` string is not a `--vx-*` reference
export const foreignVar: SwatchProps = { color: 'var(--other)' }

describe('status guard', () => {
  test('every called tone resolves to classes in its cva table', () => {
    for (const tone of ['neutral', 'accent', 'good', 'warn', 'bad', 'info'] as const) {
      expect(statusVariants({ tone })).toBeString()
    }
    expect(statusVariants({ tone: 'good' })).toContain('before:bg-good')
    expect(statusVariants({})).toBe(statusVariants({ tone: 'neutral' }))
    expect(swatchVariants()).toContain('bg-(--swatch)')
    expect(requires({ tone: 'bad' })).toEqual({ tone: 'bad' })
  })
})
