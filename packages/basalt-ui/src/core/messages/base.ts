import type { BasaltMessages } from './index'
import type { Format } from '../format'

/**
 * The strings the shared primitives (`basalt-ui/ui/*`) print themselves; `base.spinner.loading`
 * names a `Spinner`, `base.infoHint.label` names an `InfoHint` glyph after its word,
 * `base.copy.action` and `base.copy.done` are a `CopyButton` before and after it copied,
 * `base.password.show` and `base.password.hide` name a `PasswordInput`'s reveal button,
 * `base.tags.remove` a `TagInput` chip's remove button, `base.otp.character` one box of a
 * `OneTimeCode`, `base.matrix.all`, `base.matrix.allForRow` and `base.matrix.allForColumn` the
 * toggles of a `CheckboxMatrix`, `base.swatch.menu` the panel of a `SwatchPicker` menu.
 */
export type BaseMessages = Record<
  | 'base.spinner.loading'
  | 'base.copy.action'
  | 'base.copy.done'
  | 'base.password.show'
  | 'base.password.hide'
  | 'base.matrix.all'
  | 'base.swatch.menu',
  string
> &
  Record<
    | 'base.infoHint.label'
    | 'base.tags.remove'
    | 'base.matrix.allForRow'
    | 'base.matrix.allForColumn',
    (f: Format, term: string) => string
  > &
  Record<'base.otp.character', (f: Format, index: number, length: number) => string>

export const base = {
  'base.spinner.loading': 'Loading',
  'base.copy.action': 'Copy',
  'base.copy.done': 'Copied',
  'base.password.show': 'Show password',
  'base.password.hide': 'Hide password',
  'base.infoHint.label': (_f, term) => `What ${term} means`,
  'base.tags.remove': (_f, tag) => `Remove ${tag}`,
  'base.otp.character': (_f, index, length) => `Character ${index} of ${length}`,
  'base.matrix.all': 'All',
  'base.swatch.menu': 'Color',
  'base.matrix.allForRow': (_f, row) => `All for ${row}`,
  'base.matrix.allForColumn': (_f, column) => `${column} for every row`,
} satisfies Partial<BasaltMessages>
