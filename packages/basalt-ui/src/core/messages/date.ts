import type { CalendarDate, Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `ui/date-picker`. The trigger prints a `CalendarDate` through `Format.date`, which
 * reads that day in UTC, so a stored day never shifts with the reader's zone.
 */
export type DateMessages = Record<
  'date.placeholder' | 'date.rangePlaceholder' | 'date.previousMonth' | 'date.nextMonth',
  string
> &
  Record<'date.range', (f: Format, from: CalendarDate, to: CalendarDate) => string> &
  Record<'date.rangeStart', (f: Format, from: CalendarDate) => string>

export const date = {
  'date.placeholder': 'Pick a date',
  'date.rangePlaceholder': 'Pick a date range',
  'date.previousMonth': 'Previous month',
  'date.nextMonth': 'Next month',
  'date.range': (f, from, to) => `${f.date(from)} – ${f.date(to)}`,
  'date.rangeStart': (f, from) => `${f.date(from)} –`,
} satisfies Partial<BasaltMessages>
