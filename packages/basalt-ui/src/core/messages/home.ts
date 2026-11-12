import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The page kit's strings (`QueryState` and `EmptyState`). Keys keep the `home.` prefix:
 *
 * - `home.retry`: the retry button on a failed query;
 * - `home.error.default`, `home.error.forbidden`, `home.error.not-found`: the one line a failed
 *   query shows, by kind;
 * - `home.offline`: a query with no data that is paused because the device is offline;
 * - `home.refreshFailed`: the banner over cached data after a failed refetch;
 * - `home.filtersClear`: the action of an empty state under active filters;
 * - `home.filters`: the accessible name of a control home's group of filters;
 * - `home.resetAll`: the button of a `row` home that returns every changed control to its default;
 * - `home.local`, `home.overridesGlobal(value)`, `home.useGlobal`, `home.resetToGlobal(label)`: the override
 *   cue of a `filterSlot.custom` control, the same words `ControlView` prints for the kinds.
 */
export type HomeMessages = Record<
  | 'home.retry'
  | 'home.error.default'
  | 'home.error.forbidden'
  | 'home.error.not-found'
  | 'home.offline'
  | 'home.refreshFailed'
  | 'home.filtersClear'
  | 'home.filters'
  | 'home.resetAll'
  | 'home.local'
  | 'home.useGlobal',
  string
> &
  Record<'home.overridesGlobal', (f: Format, value: string) => string> &
  Record<'home.resetToGlobal', (f: Format, label: string) => string>

export const home = {
  'home.retry': 'Retry',
  'home.error.default': 'Could not load this.',
  'home.error.forbidden': 'You do not have access to this.',
  'home.error.not-found': 'This no longer exists.',
  'home.offline': 'You are offline. This loads when the connection is back.',
  'home.refreshFailed': 'Showing saved data. The last refresh failed.',
  'home.filtersClear': 'Clear filters',
  'home.filters': 'Filters',
  'home.resetAll': 'Reset all',
  'home.local': 'Local',
  'home.useGlobal': 'Use global',
  'home.overridesGlobal': (_f, value) => `Overrides global: ${value}`,
  'home.resetToGlobal': (_f, label) => `Reset ${label} to global`,
} satisfies Partial<BasaltMessages>
