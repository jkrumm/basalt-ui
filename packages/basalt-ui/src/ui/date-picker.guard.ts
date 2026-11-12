import type { DatePickerProps, DateRangePickerProps } from './date-picker'

/**
 * Hand-authored guard for `date-picker` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. There are no variant axes. The value is a `YYYY-MM-DD` string, so a
 * `Date` is a type error at the boundary, and a picker without an accessible name fails to type-check.
 */

// basalt:guard requires
type Named<P> = Extract<P, { 'aria-label': string }>
type CalledPicker = {
  'aria-label': string
  value?: `${number}-${number}-${number}` | null
  onChange?: (value: `${number}-${number}-${number}`) => void
  placeholder?: string
  disabled?: boolean
  defaultOpen?: boolean
}
type CalledRangePicker = {
  'aria-label': string
  value?: {
    from?: `${number}-${number}-${number}` | null
    to?: `${number}-${number}-${number}` | null
  } | null
  onChange?: (value: {
    from: `${number}-${number}-${number}`
    to: `${number}-${number}-${number}`
  }) => void
  placeholder?: string
  disabled?: boolean
  defaultOpen?: boolean
}

export const requiresDatePicker = (
  c: CalledPicker,
): Pick<
  Named<DatePickerProps>,
  'aria-label' | 'value' | 'onChange' | 'placeholder' | 'disabled' | 'defaultOpen'
> => c
export const requiresDateRangePicker = (
  c: CalledRangePicker,
): Pick<
  Named<DateRangePickerProps>,
  'aria-label' | 'value' | 'onChange' | 'placeholder' | 'disabled' | 'defaultOpen'
> => c

// basalt:guard closed
const pairOfDates = (range: { from: Date; to: Date }): Date => range.from
// @ts-expect-error a date picker without an accessible name fails to type-check
export const unnamed: DatePickerProps = {}
// @ts-expect-error a Date is not a value: the boundary is a YYYY-MM-DD string
export const dateValue: Pick<DatePickerProps, 'value'> = { value: new Date() }
// @ts-expect-error a range onChange receives YYYY-MM-DD ends, never a Date pair
export const dateRange: Pick<DateRangePickerProps, 'onChange'> = { onChange: pairOfDates }
