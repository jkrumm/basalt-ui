import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `BarList`, `EventList`, `RowList` and `StepRail`. Keys carry the area prefix (`lists.`),
 * which the coverage test holds; the brief's `card.*` prefix would fail it.
 */
export type ListsMessages = Record<
  | 'lists.noItems'
  | 'lists.noRows'
  | 'lists.noEvents'
  | 'lists.today'
  | 'lists.yesterday'
  | 'lists.thisWeek'
  | 'lists.earlierThisMonth'
  | 'lists.expandBody'
  | 'lists.collapseBody'
  | 'lists.stepFailed'
  | 'lists.stepColumn'
  | 'lists.durationColumn'
  | 'lists.timeColumn'
  | 'lists.detailColumn',
  string
> &
  Record<
    'lists.showMore' | 'lists.eventCount' | 'lists.stepDuration' | 'lists.stepScale',
    (f: Format, n: number) => string
  > &
  Record<'lists.rowsShown', (f: Format, shown: number, total: number) => string>

/** A step's working time, not the clock form of `Format.duration`: sub-second steps read in ms. */
function stepDuration(f: Format, ms: number): string {
  // Round to the printed precision first, then pick the unit, so 59 980 ms reads "1 min", never "60.0 s".
  const whole = Math.round(ms)
  if (whole < 1000) return `${f.number(whole)} ms`
  const tenths = Math.round(ms / 100)
  if (tenths < 600) {
    return `${f.number(tenths / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
  }
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  if (minutes < 60) return `${f.number(minutes)} min`
  const rest = minutes % 60
  const hours = f.number(Math.floor(minutes / 60))
  return rest === 0 ? `${hours} h` : `${hours} h ${f.number(rest)} min`
}

export const lists = {
  'lists.noItems': 'No items to compare yet',
  'lists.noRows': 'Nothing to list yet',
  'lists.noEvents': 'Nothing has happened yet',
  'lists.today': 'Today',
  'lists.yesterday': 'Yesterday',
  'lists.thisWeek': 'This week',
  'lists.earlierThisMonth': 'Earlier this month',
  'lists.expandBody': 'More',
  'lists.collapseBody': 'Less',
  'lists.showMore': (f, n) => `Show more (${f.number(n)})`,
  'lists.rowsShown': (f, shown, total) => `${f.number(shown)} of ${f.number(total)} shown`,
  'lists.eventCount': (f, n) => `${f.number(n)} ${f.plural(n) === 'one' ? 'event' : 'events'}`,
  'lists.stepFailed': 'Failed',
  'lists.stepColumn': 'Step',
  'lists.durationColumn': 'Duration',
  'lists.timeColumn': 'Time',
  'lists.detailColumn': 'Detail',
  'lists.stepDuration': stepDuration,
  'lists.stepScale': (f, longest) =>
    `Bars are scaled to the longest step, ${stepDuration(f, longest)}`,
} satisfies Partial<BasaltMessages>
