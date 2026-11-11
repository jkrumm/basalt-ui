/**
 * Compile-time proof of the `toast` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a tone composites call fails, one that accepts more passes.
 */
import { describe, expect, test } from 'bun:test'
import { toastVariants, toastViewportVariants } from './toast'
import type { ToastProps } from './toast'
import { requiresToast } from './toast.guard'

type Called = Parameters<typeof requiresToast>[0]
type Accepts<P> = (c: Called) => P

type Tone = NonNullable<ToastProps['tone']>
type WithoutBad = { tone?: Exclude<Tone, 'bad'> | null | undefined }
type WithLoud = { tone?: Tone | 'loud' | null | undefined }

// @ts-expect-error `bad` is called but no longer accepted
export const removed: Accepts<WithoutBad> = requiresToast

export const added: Accepts<WithLoud> = requiresToast

describe('toast guard', () => {
  test('every called tone resolves to classes in the cva table', () => {
    const tones = (['neutral', 'good', 'warn', 'bad', 'info'] as const).map((tone) =>
      toastVariants({ tone }),
    )
    expect(new Set(tones).size).toBe(5)
    expect(toastViewportVariants()).toContain('z-60')
    expect(requiresToast({ tone: 'bad' })).toEqual({ tone: 'bad' })
  })
})
