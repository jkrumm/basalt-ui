import type { BasaltMessages } from './index'
import type { Format } from '../format'

/**
 * The strings the shared primitives (`basalt-ui/ui/*`) print themselves; `base.spinner.loading`
 * names a `Spinner`, `base.infoHint.label` names an `InfoHint` glyph after its word.
 */
export type BaseMessages = Record<'base.spinner.loading', string> &
  Record<'base.infoHint.label', (f: Format, term: string) => string>

export const base = {
  'base.spinner.loading': 'Loading',
  'base.infoHint.label': (_f, term) => `What ${term} means`,
} satisfies Partial<BasaltMessages>
