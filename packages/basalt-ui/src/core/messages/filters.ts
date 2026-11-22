import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `FilterSet`. Keys carry the area prefix (`filters.`), which the coverage test holds:
 *
 * - `filters.title`: the heading of the `Filters` sheet and the accessible name of the set;
 * - `filters.count(n)`: the phone button, `Filters (n)` with `n` active filters, bare `Filters` at none;
 * - `filters.moreFilters(n)`: the accessible name of the `+N` fold button;
 * - `filters.showMore`: the accessible name of the fold's panel;
 * - `filters.resetAll`: the button that returns every active filter to its default;
 * - `filters.selected(n)`: a pill whose multi selection holds more than one value;
 * - `filters.on`, `filters.off`: the value a switch filter prints in its pill;
 * - `filters.filter`: the word on the page bar's filter trigger (three filters or more);
 * - `filters.showing(shown, total)`: the trigger popover's live match line.
 */
export type FiltersMessages = Record<
  | 'filters.title'
  | 'filters.showMore'
  | 'filters.resetAll'
  | 'filters.on'
  | 'filters.off'
  | 'filters.filter',
  string
> &
  Record<'filters.showing', (f: Format, shown: number, total: number) => string> &
  Record<
    'filters.count' | 'filters.moreFilters' | 'filters.selected',
    (f: Format, n: number) => string
  >

export const filters = {
  'filters.title': 'Filters',
  'filters.showMore': 'More filters',
  'filters.resetAll': 'Reset all',
  'filters.on': 'On',
  'filters.off': 'Off',
  'filters.filter': 'Filter',
  'filters.showing': (f, shown, total) => `Showing ${f.number(shown)} of ${f.number(total)}`,
  'filters.count': (_f, n) => (n > 0 ? `Filters (${n})` : 'Filters'),
  'filters.moreFilters': (_f, n) => `${n} more filters`,
  'filters.selected': (_f, n) => `${n} selected`,
} satisfies Partial<BasaltMessages>
