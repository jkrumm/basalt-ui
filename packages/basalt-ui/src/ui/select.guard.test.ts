/**
 * Compile-time proof of the `select` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. A `Select` or
 * `SelectTrigger` without an accessible name is a type error (the `@ts-expect-error` lines in the
 * guard and below).
 */
import { describe, expect, test } from 'bun:test'
import {
  nativeSelectVariants,
  selectContentVariants,
  selectItemVariants,
  selectTriggerVariants,
  selectVariants,
} from './select'
import type { SelectProps } from './select'
import { requiresNativeSelect, requiresSelect, requiresSelectTrigger } from './select.guard'

type CalledTrigger = Parameters<typeof requiresSelectTrigger>[0]
type Accepts<P> = (c: CalledTrigger) => P

type WithoutLabel = { size?: 'md' | 'sm'; 'aria-label'?: undefined; 'aria-labelledby'?: string }
type WithMoreSizes = {
  size?: 'md' | 'sm' | 'lg' | null | undefined
  'aria-label'?: string | undefined
  'aria-labelledby'?: string | undefined
}

// @ts-expect-error `aria-label` is called but no longer accepted
export const removed: Accepts<WithoutLabel> = requiresSelectTrigger

export const added: Accepts<WithMoreSizes> = requiresSelectTrigger

// @ts-expect-error neither `aria-label` nor `aria-labelledby`: the trigger has no name
export const nameless: SelectProps<string> = { options: [{ value: 'a', label: 'A' }], size: 'sm' }

export const named: SelectProps<string> = {
  options: [{ value: 'a', label: 'A' }],
  'aria-labelledby': 'label',
}

describe('select guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requiresSelect({ size: 'sm' })).toEqual({ size: 'sm' })
    expect(requiresSelectTrigger({ 'aria-label': 'Stage' })).toEqual({ 'aria-label': 'Stage' })
    expect(requiresNativeSelect({ name: 'stage', disabled: true })).toEqual({
      name: 'stage',
      disabled: true,
    })
    expect(selectVariants()).toContain('w-full')
    expect(selectTriggerVariants({ size: 'sm' })).toContain('h-6')
    expect(selectContentVariants()).toContain('max-h-(--available-height)')
    expect(selectItemVariants()).toContain('pointer-coarse:min-h-11')
    expect(nativeSelectVariants()).toContain('appearance-none')
    expect(nativeSelectVariants()).toContain('h-ctl')
    expect(nativeSelectVariants()).toContain('pointer-coarse:text-base')
  })
})
