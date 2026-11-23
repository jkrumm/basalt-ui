import type { CalendarDate } from '../core/format'
import type { CalendarProps, CalendarRange } from './calendar'

/**
 * Hand-authored guard for `calendar` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. There are no variant axes past `size`. A day is a `YYYY-MM-DD` string,
 * so a `Date` is a type error at the boundary, and a calendar without an accessible name fails to type-check.
 */

type NamedSingle = Extract<CalendarProps, { mode?: 'single'; 'aria-label': string }>
type NamedRange = Extract<CalendarProps, { mode: 'range'; 'aria-label': string }>

// basalt:guard requires
type CalledCalendar = {
  'aria-label': string
  mode?: 'single'
  size?: 'md' | 'sm'
  value?: CalendarDate | null
  onChange?: (day: CalendarDate) => void
  month?: CalendarDate
  marks?: NonNullable<CalendarProps['marks']>
  today?: CalendarDate
}
type CalledRangeCalendar = {
  'aria-label': string
  mode: 'range'
  size?: 'md' | 'sm'
  value?: CalendarRange | null
  onChange?: (range: CalendarRange) => void
  month?: CalendarDate
  marks?: NonNullable<CalendarProps['marks']>
  today?: CalendarDate
}

export const requiresCalendar = (
  c: CalledCalendar,
): Pick<
  NamedSingle,
  'aria-label' | 'mode' | 'size' | 'value' | 'onChange' | 'month' | 'marks' | 'today'
> => c
export const requiresRangeCalendar = (
  c: CalledRangeCalendar,
): Pick<
  NamedRange,
  'aria-label' | 'mode' | 'size' | 'value' | 'onChange' | 'month' | 'marks' | 'today'
> => c

// basalt:guard closed
// @ts-expect-error a calendar without an accessible name fails to type-check
export const unnamed: CalendarProps = { mode: 'single' }
// @ts-expect-error a size outside md and sm is a type error
export const wide: Pick<CalendarProps, 'size'> = { size: 'lg' }
// @ts-expect-error a Date is not a value: a day is a YYYY-MM-DD string
export const dateValue: Pick<CalendarProps, 'value'> = { value: new Date() }
