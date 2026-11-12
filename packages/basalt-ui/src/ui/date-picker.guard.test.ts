/**
 * Compile-time proof of the `date-picker` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes.
 */
import { describe, expect, test } from 'bun:test'
import { datePickerVariants } from './date-picker'
import type { DatePickerProps } from './date-picker'
import { requiresDatePicker, requiresDateRangePicker } from './date-picker.guard'

type CalledPicker = Parameters<typeof requiresDatePicker>[0]
type Accepts<P> = (c: CalledPicker) => P

type WithoutDays = {
  'aria-label'?: string | undefined
  value?: null | undefined
  onChange?: DatePickerProps['onChange']
  placeholder?: string | undefined
  disabled?: boolean | undefined
  defaultOpen?: boolean | undefined
}
type WithMinDate = {
  'aria-label'?: string | undefined
  value?: DatePickerProps['value']
  onChange?: DatePickerProps['onChange']
  placeholder?: string | undefined
  disabled?: boolean | undefined
  defaultOpen?: boolean | undefined
  min?: string
}

// @ts-expect-error a picked day is called but no longer accepted
export const removed: Accepts<WithoutDays> = requiresDatePicker

export const added: Accepts<WithMinDate> = requiresDatePicker

describe('date-picker guard', () => {
  test('the requires functions pass through and the table resolves', () => {
    expect(requiresDatePicker({ 'aria-label': 'Due', value: '2026-11-20' })).toEqual({
      'aria-label': 'Due',
      value: '2026-11-20',
    })
    expect(requiresDateRangePicker({ 'aria-label': 'Window', value: null })).toEqual({
      'aria-label': 'Window',
      value: null,
    })
    expect(datePickerVariants()).toContain('h-ctl')
  })
})
