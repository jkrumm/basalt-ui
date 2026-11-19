/**
 * Quality-matrix waivers of /cycle/shell-6/*, the fleet app rebuilt for owner review 2
 * (docs/v3/cycles/owner-review-2.md; docs/v3/CYCLES.md step 2). The matrix reads `known` from every `cycle/<cycle>/known.ts`. Each entry
 * is a finding of a kit part the page composes, owned by the fix row that removes it. The full run
 * fails an entry that matched nothing.
 */
interface KnownFinding {
  route: string
  assertion: string
  item: RegExp
  owner: string
}

export const known: readonly KnownFinding[] = [
  {
    route: '/cycle/shell-6/settings',
    assertion: 'forcedColors',
    item: /\[form-section\] div \d+x\d+/,
    owner:
      'v3-owner-2-rerun-kit-fixes: a FormSection frame is a shadow with no border, so it vanishes under forced-colors',
  },
]
