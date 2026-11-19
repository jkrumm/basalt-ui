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
  | 'lists.stepFailed'
  | 'lists.stepColumn'
  | 'lists.durationColumn'
  | 'lists.timeColumn'
  | 'lists.detailColumn'
  | 'lists.chainBlocks'
  | 'lists.chainDone'
  | 'lists.chainZoomIn'
  | 'lists.chainZoomOut'
  | 'lists.chainFit'
  | 'lists.chainFocusNone'
  | 'lists.chainShowAll'
  | 'lists.chainControls',
  string
> &
  Record<
    | 'lists.showMore'
    | 'lists.eventCount'
    | 'lists.stepDuration'
    | 'lists.stepScale'
    | 'lists.chainZoomLevel',
    (f: Format, n: number) => string
  > &
  Record<'lists.rowsShown', (f: Format, shown: number, total: number) => string> &
  Record<
    'lists.chainWaitsOn' | 'lists.chainAlsoWaitsOn' | 'lists.chainFocus',
    (f: Format, names: string) => string
  >

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
  'lists.showMore': (f, n) => `Show more (${f.number(n)})`,
  'lists.rowsShown': (f, shown, total) => `${f.number(shown)} of ${f.number(total)} shown`,
  'lists.eventCount': (f, n) => `${f.number(n)} ${f.plural(n) === 'one' ? 'event' : 'events'}`,
  'lists.stepFailed': 'Failed',
  'lists.stepColumn': 'Step',
  'lists.durationColumn': 'Duration',
  'lists.timeColumn': 'Time',
  'lists.detailColumn': 'Detail',
  'lists.chainBlocks': 'Blocks',
  'lists.chainDone': 'Done',
  'lists.chainWaitsOn': (_f, names) => `Waits on ${names}`,
  'lists.chainAlsoWaitsOn': (_f, names) => `Also waits on ${names}`,
  'lists.chainZoomIn': 'Zoom in',
  'lists.chainZoomOut': 'Zoom out',
  'lists.chainFit': 'Fit to width',
  'lists.chainZoomLevel': (f, n) => f.number(n, { style: 'percent' }),
  'lists.chainFocus': (_f, name) => `Focus on ${name}`,
  'lists.chainFocusNone': 'Point at a node to focus it',
  'lists.chainShowAll': 'Show all',
  'lists.chainControls': 'Chain view',
  'lists.stepDuration': stepDuration,
  'lists.stepScale': (f, longest) =>
    `Bars are scaled to the longest step, ${stepDuration(f, longest)}`,
} satisfies Partial<BasaltMessages>
