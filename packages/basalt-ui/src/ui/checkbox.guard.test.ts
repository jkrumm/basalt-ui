/**
 * Compile-time proof of the `checkbox` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The module has no cva axes,
 * so the guard pins its props and the tables' classes.
 */
import { describe, expect, test } from 'bun:test'
import { checkboxGroupVariants, checkboxVariants } from './checkbox'
import { requiresCheckbox, requiresGroup } from './checkbox.guard'

type CalledCheckbox = Parameters<typeof requiresCheckbox>[0]
type Accepts<P> = (c: CalledCheckbox) => P

type WithoutIndeterminate = {
  checked?: boolean
  defaultChecked?: boolean
  indeterminate?: undefined
  value?: string
  name?: string
  disabled?: boolean
}
type WithMoreNames = { name?: string | number | undefined }

// @ts-expect-error `indeterminate` is called but no longer accepted
export const removed: Accepts<WithoutIndeterminate> = requiresCheckbox

export const added: Accepts<WithMoreNames> = requiresCheckbox

describe('checkbox guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requiresGroup({ value: ['a'] })).toEqual({ value: ['a'] })
    expect(requiresCheckbox({ checked: true, value: 'a' })).toEqual({ checked: true, value: 'a' })
    expect(checkboxGroupVariants()).toContain('flex-col')
    expect(checkboxVariants()).toContain('after:size-6')
  })
})
