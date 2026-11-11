/**
 * Compile-time proof of the `combobox` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes.
 */
import { describe, expect, test } from 'bun:test'
import {
  autocompleteContentVariants,
  autocompleteVariants,
  comboboxChipsVariants,
  comboboxContentVariants,
  comboboxInputVariants,
  comboboxItemVariants,
  comboboxVariants,
} from './combobox'
import { requiresComboboxChips, requiresComboboxInput } from './combobox.guard'

type CalledInput = Parameters<typeof requiresComboboxInput>[0]
type Accepts<P> = (c: CalledInput) => P

type WithoutPlaceholder = {
  size?: 'md' | 'sm' | null | undefined
  'aria-label': string
  placeholder?: undefined
}
type WithMoreSizes = {
  size?: 'md' | 'sm' | 'lg' | null | undefined
  'aria-label': string
  placeholder?: string | undefined
}

// @ts-expect-error `placeholder` is called but no longer accepted
export const removed: Accepts<WithoutPlaceholder> = requiresComboboxInput

export const added: Accepts<WithMoreSizes> = requiresComboboxInput

describe('combobox guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requiresComboboxInput({ 'aria-label': 'City', size: 'sm' })).toEqual({
      'aria-label': 'City',
      size: 'sm',
    })
    expect(requiresComboboxChips({ 'aria-label': 'Cities' })).toEqual({ 'aria-label': 'Cities' })
    expect(comboboxVariants()).toContain('w-full')
    expect(comboboxInputVariants({ size: 'sm' })).toContain('h-6')
    expect(comboboxInputVariants()).toContain('pointer-coarse:min-h-11')
    expect(comboboxChipsVariants()).toContain('flex-wrap')
    expect(comboboxContentVariants()).toContain('max-h-(--available-height)')
    expect(comboboxItemVariants()).toContain('pointer-coarse:min-h-11')
    expect(autocompleteVariants()).toContain('w-full')
    expect(autocompleteContentVariants()).toContain('max-h-(--available-height)')
  })
})
