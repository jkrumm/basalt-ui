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
    item: /^div>div\[filter-pills\]>div\[filter-set-pill\]>button\[button\] ".*": outline is clipped by div$/,
    owner: 'v3-state-1-visual: the filter pill rings are clipped by their row (as /cycle/state)',
  },
  {
    route: '/cycle/dogfood',
    assertion: 'ringWalk',
    item: /^div>div>div>svg "[^"]*": (outline contrast 1\.81:1 is under 3:1|outline is clipped by div)$/,
    owner:
      'v3-dogfood-1-visual: the StatCard chart box clips the Sparkline focus ring (dogfood-1.21)',
  },
  {
    route: '/cycle/dogfood',
    assertion: 'focusNotObscured',
    item: /button\[stat-target\].*covered at .* by div\[card-phase\]/,
    owner: 'v3-dogfood-1-visual: the phase layer covers the StatCard target (dogfood-1.21)',
  },
  {
    route: '/cycle/dogfood',
    assertion: 'forcedColors',
    item: /^\[stat-menu\] button/,
    owner: 'v3-dogfood-1-visual: the stat menu frame vanishes under forced colors (dogfood-1.21)',
  },
]
