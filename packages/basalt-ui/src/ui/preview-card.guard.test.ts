/**
 * Compile-time proof of the `preview-card` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop callers pass fails, one that accepts more passes.
 */
import { describe, expect, test } from 'bun:test'
import type { PreviewCardContentProps } from './preview-card'
import { requiresPreviewCardContent, requiresPreviewCardTrigger } from './preview-card.guard'

type Called = Parameters<typeof requiresPreviewCardContent>[0]
type Accepts<P> = (c: Called) => P

type Side = NonNullable<PreviewCardContentProps['side']>
type WithoutTop = { side?: Exclude<Side, 'top'> | undefined }
type WithMore = { side?: Side | undefined; extra?: number }

// @ts-expect-error `top` is called but no longer accepted
export const removed: Accepts<WithoutTop> = requiresPreviewCardContent

export const added: Accepts<WithMore> = requiresPreviewCardContent

describe('preview-card guard', () => {
  test('the requires functions pass through', () => {
    expect(requiresPreviewCardContent({ side: 'top', sideOffset: 4 })).toEqual({
      side: 'top',
      sideOffset: 4,
    })
    expect(requiresPreviewCardTrigger({ href: '/issues/1', delay: 0 })).toEqual({
      href: '/issues/1',
      delay: 0,
    })
  })
})
