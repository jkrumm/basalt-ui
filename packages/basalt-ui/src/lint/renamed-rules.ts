/**
 * Rule ids 3.0 renamed, old to new, as a waiver names them. A directive naming an old id silences
 * nothing (oxlint knows only the new one), so `waiver-needs-reason` reports it with the new id for
 * the whole 3.x line; the ids are British spellings that the American pass renamed (Issue 3201).
 */
export const RENAMED_RULES: Readonly<Record<string, string>> = {
  'basalt/colour-literal': 'basalt/color-literal',
  'basalt/fixed-colour': 'basalt/fixed-color',
  'basalt/app-colour': 'basalt/app-color',
  'basalt/app-colour-arbitrary': 'basalt/app-color-arbitrary',
}
