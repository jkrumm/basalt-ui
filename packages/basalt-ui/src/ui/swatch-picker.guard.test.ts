/**
 * Compile-time proof of the `swatch-picker` guard, checked by `tsc --noEmit`, and a runtime check that the
 * called props pass through and the cva tables resolve.
 */
import { describe, expect, test } from 'bun:test'
import { requiresSwatchPicker } from './swatch-picker.guard'
import { SWATCH_TOKENS, swatchPickerVariants } from './swatch-picker'

describe('swatch-picker guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    const options = [{ value: 'good' as const, label: 'Green' }]
    expect(requiresSwatchPicker({ options, value: 'good' }).value).toBe('good')
    expect(SWATCH_TOKENS).toContain('chart-1')
    expect(swatchPickerVariants()).toContain('grid-cols-4')
  })
})
