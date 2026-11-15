/**
 * Quality-matrix waivers of /cycle/state-3, the orders page (docs/v3/cycles/state-3.md; docs/v3/CYCLES.md
 * step 2). The matrix reads `known` from every `cycle/<cycle>/known.ts`. Each entry is a finding of a
 * kit part the page composes, owned by the fix row that removes it. The full run fails an entry that
 * matched nothing.
 */
interface KnownFinding {
  route: string
  assertion: string
  item: RegExp
  owner: string
}

export const known: readonly KnownFinding[] = [
  {
    route: '/cycle/state-3',
    assertion: 'focusNotObscured',
    item: /th\[table-head\]>button\[pressable\] "Flagged": covered at \(\d+,\d+\) by button\[button\]/,
    owner:
      'v3-state-3-visual: a narrow column header column-actions button covers its sort button (state-3.6)',
  },
]
