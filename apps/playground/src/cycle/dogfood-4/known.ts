/**
 * Quality-matrix waivers of /cycle/dogfood-4, the console Overview slice (docs/v3/cycles/dogfood-4.md;
 * docs/v3/CYCLES.md step 2). The matrix reads `known` from every `cycle/<cycle>/known.ts`. Each entry
 * is a finding of a kit part the slice composes, owned by the fix row that removes it. The full run
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
    route: '/cycle/dogfood-4',
    assertion: 'fit',
    item: /^button\[segmented-item\] "(Running|Paused|Not started|Checking)" content \d+px in \d+px$/,
    owner:
      'v3-dogfood-4-visual: card-header segmented options share equal cells too narrow for their labels (dogfood-4.2)',
  },
  {
    route: '/cycle/dogfood-4',
    assertion: 'hitFloor',
    item: /^button\[segmented-item\] "(Running|Paused|Not started|Checking)" \d+x44 < 44x44$/,
    owner:
      'v3-dogfood-4-visual: on a phone the same cells fall under the 44 px hit floor (dogfood-4.2)',
  },
]
