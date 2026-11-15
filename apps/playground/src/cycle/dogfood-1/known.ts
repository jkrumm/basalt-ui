/**
 * Quality-matrix waivers of /cycle/dogfood, the console overview slice (docs/v3/cycles/dogfood-1.md;
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
    route: '/cycle/dogfood',
    assertion: 'axe',
    item: /^color-contrast \(serious\)/,
    owner: 'v3-shell-1-visual: the chart card fact value text contrast (as /cycle/shell)',
  },
  {
    route: '/cycle/dogfood',
    assertion: 'ringWalk',
    item: /fieldset>button ".*no focus outline/,
    owner: 'v3-shell-1-visual: chart legend toggles have no focus ring (as /cycle/shell)',
  },
  {
    route: '/cycle/dogfood',
    assertion: 'ringWalk',
    item: /^div>div>div>svg ".*": outline contrast 1\.\d+:1 is under 3:1$/,
    owner: 'charts: focusable plot ring contrast (as /charts)',
  },
]
