import type { BasaltMessages } from './index'
import type { Format } from '../format'

/**
 * The strings the shared primitives (`basalt-ui/ui/*`) print themselves; `base.spinner.loading`
 * names a `Spinner`, `base.infoHint.label` names an `InfoHint` glyph after its word,
 * `base.copy.action` and `base.copy.done` are a `CopyButton` before and after it copied,
 * `base.password.show` and `base.password.hide` name a `PasswordInput`'s reveal button.
 */
export type BaseMessages = Record<
  | 'base.spinner.loading'
  | 'base.copy.action'
  | 'base.copy.done'
  | 'base.password.show'
  | 'base.password.hide',
  string
> &
  Record<'base.infoHint.label', (f: Format, term: string) => string>

export const base = {
  'base.spinner.loading': 'Loading',
  'base.copy.action': 'Copy',
  'base.copy.done': 'Copied',
  'base.password.show': 'Show password',
  'base.password.hide': 'Hide password',
  'base.infoHint.label': (_f, term) => `What ${term} means`,
} satisfies Partial<BasaltMessages>
