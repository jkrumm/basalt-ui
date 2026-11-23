/**
 * Compile-time proof of the `calendar` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes.
 */
import { describe, expect, test } from 'bun:test'
import { calendarParts, calendarVariants } from './calendar'
import { requiresCalendar, requiresRangeCalendar } from './calendar.guard'
import type { CalendarDate } from '../core/format'

type CalledCalendar = Parameters<typeof requiresCalendar>[0]
type Accepts<P> = (c: CalledCalendar) => P

type WithoutMarks = {
  'aria-label'?: string | undefined
  mode?: 'single' | undefined
  size?: 'md' | 'sm' | undefined
  value?: CalendarDate | null | undefined
  onChange?: ((day: CalendarDate) => void) | undefined
  month?: CalendarDate | undefined
  marks?: null | undefined
  today?: CalendarDate | undefined
}

// @ts-expect-error marks is called but no longer accepted
export const removed: Accepts<WithoutMarks> = requiresCalendar

describe('calendar guard', () => {
  test('the requires functions pass through and the tables resolve', () => {
    expect(requiresCalendar({ 'aria-label': 'Month', size: 'sm', month: '2026-11-01' })).toEqual({
      'aria-label': 'Month',
      size: 'sm',
      month: '2026-11-01',
    })
    expect(requiresRangeCalendar({ 'aria-label': 'Window', mode: 'range', value: null })).toEqual({
      'aria-label': 'Window',
      mode: 'range',
      value: null,
    })
    expect(calendarVariants({ size: 'sm' })).toContain('--spacing(8)')
    expect(calendarParts).toEqual(['calendar'])
  })
})
