import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `StatCell` (and so of `StatGroup`) and the legend of `DataPanel`. Keys carry the
 * area prefix (`cards.`), which the coverage test holds; the brief's `card.*` prefix would fail it.
 * `StatCell` draws its own dense phase arms, so it prints these; `DataPanel` goes through
 * `CardPhase`, which prints its own.
 */
export type CardsMessages = Record<
  | 'cards.retry'
  | 'cards.clearFilters'
  | 'cards.updating'
  | 'cards.refreshFailed'
  | 'cards.errorDefault'
  | 'cards.errorForbidden'
  | 'cards.errorNotFound'
  | 'cards.unavailable',
  string
> &
  Record<'cards.about', (f: Format, label: string) => string>

export const cards = {
  'cards.retry': 'Retry',
  'cards.clearFilters': 'Clear filters',
  'cards.updating': 'Updating',
  'cards.refreshFailed': 'Could not refresh. Showing earlier data.',
  'cards.errorDefault': 'Could not load this.',
  'cards.errorForbidden': 'You do not have access to this.',
  'cards.errorNotFound': 'This no longer exists.',
  'cards.unavailable': 'unavailable',
  'cards.about': (_f, label) => `About ${label}`,
} satisfies Partial<BasaltMessages>
