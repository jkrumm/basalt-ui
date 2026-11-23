import type { Format } from '../format'
import type { BasaltMessages } from './index'

/** The strings of `Schedule` (`basalt-ui/cards`): its header, its views, its rail and its slots. */
export type ScheduleMessages = Record<
  | 'schedule.today'
  | 'schedule.previous'
  | 'schedule.next'
  | 'schedule.view'
  | 'schedule.day'
  | 'schedule.week'
  | 'schedule.month'
  | 'schedule.allDay'
  | 'schedule.upNext'
  | 'schedule.nothingNext'
  | 'schedule.days'
  | 'schedule.failed',
  string
> &
  Record<'schedule.more', (f: Format, n: number) => string> &
  Record<'schedule.slot', (f: Format, at: number) => string>

export const schedule = {
  'schedule.today': 'Today',
  'schedule.previous': 'Previous',
  'schedule.next': 'Next',
  'schedule.view': 'View',
  'schedule.day': 'Day',
  'schedule.week': 'Week',
  'schedule.month': 'Month',
  'schedule.allDay': 'All day',
  'schedule.upNext': 'Up next',
  'schedule.nothingNext': 'Nothing else is planned',
  'schedule.days': 'Days of the week',
  'schedule.failed': 'Could not load the schedule. The request failed.',
  'schedule.more': (f, n) => `+${f.number(n)} more`,
  'schedule.slot': (f, at) => `New event at ${f.dateTime(at)}`,
} satisfies Partial<BasaltMessages>
