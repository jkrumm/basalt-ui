import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `ui/select` and `ui/combobox`. `combobox.dismiss` names the two hidden buttons that
 * close an open combobox (Base UI hardcodes English); `combobox.remove` names a chip's remove
 * button, given the chip's text.
 */
export type SelectMessages = Record<'combobox.dismiss', string> &
  Record<'combobox.remove', (f: Format, label: string) => string>

export const select = {
  'combobox.dismiss': 'Dismiss',
  'combobox.remove': (_f, label) => `Remove ${label}`,
} satisfies Partial<BasaltMessages>
