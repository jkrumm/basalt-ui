import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `ui/select` and `ui/combobox`. `combobox.dismiss` names the two hidden buttons that
 * close an open combobox (Base UI hardcodes English); `combobox.remove` names a chip's remove
 * button, given the chip's text; `combobox.create` is the row a creatable combobox adds for the
 * typed text. `select.loading`, `select.empty` and `select.error` are the state rows of every
 * option list; the error takes the loader's own message, empty when it gave none. `select.search`
 * is the placeholder of a searchable Select's search field.
 */
export type SelectMessages = Record<
  'combobox.dismiss' | 'select.loading' | 'select.empty' | 'select.search',
  string
> &
  Record<
    'combobox.remove' | 'combobox.create' | 'select.error',
    (f: Format, label: string) => string
  >

export const select = {
  'combobox.dismiss': 'Dismiss',
  'combobox.remove': (_f, label) => `Remove ${label}`,
  'combobox.create': (_f, text) => `Create "${text}"`,
  'select.loading': 'Loading…',
  'select.empty': 'No match',
  'select.search': 'Search',
  'select.error': (_f, cause) =>
    cause === ''
      ? 'The options did not load. Type again to retry.'
      : `The options did not load: ${cause}. Type again to retry.`,
} satisfies Partial<BasaltMessages>
