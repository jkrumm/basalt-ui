/**
 * Compile-time proof of the `sheet` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a placement composites call fails, one that accepts more passes.
 */
import { describe, expect, test } from 'bun:test'
import { sheetContentVariants } from './sheet'
import type { SheetProps } from './sheet'
import { requiresContent, requiresSheet } from './sheet.guard'

type CalledSheet = Parameters<typeof requiresSheet>[0]
type Accepts<P> = (c: CalledSheet) => P

type Placement = NonNullable<SheetProps['placement']>
type WithoutRight = { placement?: Exclude<Placement, 'right'> | undefined }
type WithLeft = { placement?: Placement | 'left' | undefined }

// @ts-expect-error `right` is called but no longer accepted
export const removed: Accepts<WithoutRight> = requiresSheet

export const added: Accepts<WithLeft> = requiresSheet

describe('sheet guard', () => {
  test('every called placement resolves to classes in the cva table', () => {
    const tables = (['bottom', 'right', 'auto'] as const).map((placement) =>
      sheetContentVariants({ placement }),
    )
    expect(new Set(tables).size).toBe(3)
    expect(sheetContentVariants({ placement: 'bottom' })).toContain('min(72dvh,560px)')
    expect(requiresSheet({ placement: 'auto' })).toEqual({ placement: 'auto' })
    expect(requiresContent({ title: 'T' })).toEqual({ title: 'T' })
  })
})
