import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { PLAYGROUND } from './routes'

/**
 * Findings the matrix already reports on code this Issue does not own (shell, cards, charts, the
 * playground's 2.x pages). Each entry names one failing item of one assertion on one route and why it
 * stands; the item stays visible in the run output. Nothing is waived by assertion or route alone: a
 * failure with any item no entry covers fails the cell. In the full run an entry that matched nothing
 * fails too, so a fix removes its line instead of leaving a waiver behind.
 */
export interface KnownFinding {
  /** Route path, or `*` for every route. */
  route: string
  assertion: string
  /** Matches one item line of the failure message. */
  item: RegExp
  /** Where the fix lives. */
  owner: string
}

// /cycle/state is the state cycle's build (v3-state-1, nested route `cycle/state`). The route lists the
// findings of the controls it composes, one item each: a cycle PR may not touch `packages/basalt-ui/`,
// so the row that owns the part removes each line with its fix. The full run fails an entry that
// matched nothing.
const STATE_OWNER = 'v3-state-1-visual: the state cycle build (kit parts it composes)'
const PILL = 'div>div[filter-pills]>div[filter-set-pill]>button[button]'

function stateItems(assertion: string, items: readonly string[]): KnownFinding[] {
  return items.map((item) => ({
    route: '/cycle/state',
    assertion,
    item: new RegExp(`^${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    owner: STATE_OWNER,
  }))
}

const STATE_KNOWN: readonly KnownFinding[] = [
  // desktop, light: the view tab and the pills sit in the page bar's clip
  ...stateItems('ringWalk', [
    'div[view-tabs]>div[tabs]>div[tabs-list]>button[tabs-trigger] "Table": outline is clipped by div',
    `${PILL} "Date: Last 30 days": outline is clipped by div`,
    `${PILL} "Status": outline is clipped by div`,
    `${PILL} "Search: Customer or orde": outline is clipped by div`,
    `${PILL} "Flagged only: Off": outline is clipped by div`,
  ]),
]

// /cycle/shell/* is the shell cycle's fleet app (docs/v3/cycles/shell-1.md). Each entry is a finding of
// a kit part the build composes, owned by the fix row that removes it (shell-1.21); the gate conflict
// that puts these lines in a cycle PR is shell-1.22.
// `filterSlot` in a page bar draws the folding `FilterSet` (F2 n12), whose pill row clips at its
// border box; the same finding /overview lists. The row's own clip margin paints the ring, the walk measures the box.
const SHELL_KNOWN: readonly KnownFinding[] = ['/cycle/shell', '/cycle/shell/services'].map(
  (route): KnownFinding => ({
    route,
    assertion: 'ringWalk',
    item: /filter-set-pill\]>button\[button\] ".*outline is clipped by div/,
    owner: "controls: the FilterSet pill row clips its edge pills' rings (as /overview)",
  }),
)

// /cycle/dogfood is the dogfood cycle's console overview slice (docs/v3/cycles/dogfood-1.md). Each
// entry is a finding of a kit part the slice composes, owned by the fix row that removes it; the gate
// conflict that puts these lines in a cycle PR is shell-1.22 again (dogfood-1.21).
const DOGFOOD_KNOWN: readonly KnownFinding[] = [
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

/**
 * A cycle's waivers live in its own folder, `apps/playground/src/cycle/<cycle>/known.ts`, so a cycle PR
 * never touches this package (docs/v3/CYCLES.md step 2). The file exports `known`, an array of
 * `KnownFinding` shaped objects; the cycle code imports published entry points only, so it declares
 * the shape inline and this loader checks it. The matrix applies the same rules to these entries: one
 * item per entry, and in the full run an entry that matched nothing fails.
 */
export async function loadCycleKnown(dir = join(PLAYGROUND, 'src/cycle')): Promise<KnownFinding[]> {
  if (!existsSync(dir)) return []
  const entries: KnownFinding[] = []
  for (const cycle of readdirSync(dir, { withFileTypes: true }).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const file = join(dir, cycle.name, 'known.ts')
    if (!cycle.isDirectory() || !existsSync(file)) continue
    const mod = (await import(file)) as { known?: unknown }
    if (!Array.isArray(mod.known))
      throw new Error(`matrix: ${file} must export \`known\` as an array`)
    for (const entry of mod.known as Partial<KnownFinding>[]) {
      const { route, assertion, item, owner } = entry
      const ok =
        typeof route === 'string' &&
        typeof assertion === 'string' &&
        item instanceof RegExp &&
        typeof owner === 'string'
      if (!ok) throw new Error(`matrix: ${file} has an entry that is not a KnownFinding`)
      entries.push({ route, assertion, item, owner })
    }
  }
  return entries
}

export const KNOWN: readonly KnownFinding[] = [
  ...STATE_KNOWN,
  ...SHELL_KNOWN,
  ...DOGFOOD_KNOWN,
  ...(await loadCycleKnown()),
  // /gallery is the 2.x Mantine specimen page (Pagination, SegmentedControl, raw inputs). It carries
  // dozens of findings of the legacy components and goes with the legacy barrel, so it is listed by
  // assertion, not by item.
  ...(['axe', 'ringWalk', 'forcedColors', 'fit', 'hitFloor', 'hitOverlap'] as const).map(
    (assertion): KnownFinding => ({
      route: '/gallery',
      assertion,
      item: /./,
      owner: 'playground gallery (2.x Mantine specimens): retires with the legacy barrel',
    }),
  ),
  {
    route: '/overview',
    assertion: 'ringWalk',
    item: /(select-trigger\] "Range"|filter-set-pill|button\[button\] "Filters").*outline is clipped/,
    owner:
      'controls: the range select, filter pills and Filters button rings are clipped by the page bar',
  },
  {
    route: '/overview',
    assertion: 'ringWalk',
    item: /view-tabs\]>div\[tabs\]>div\[tabs-list\]>button\[tabs-trigger\].*outline is clipped by div/,
    owner: 'ui/tabs: the tab list scrolls sideways, so its overflow clips the trigger ring',
  },
  {
    route: '/overview',
    assertion: 'ringWalk',
    item: /view-tabs\]>div>div\[segmented\]>button\[segmented-item\].*outline is clipped by main/,
    owner: 'controls: the track sits on the page edge, so the page bar clips its ring like Range',
  },
  {
    route: '/overview',
    assertion: 'ringWalk',
    item: /button "More information": no focus outline/,
    owner: 'cards: info button has no focus ring',
  },
  {
    route: '*',
    assertion: 'ringWalk',
    item: /shell-rail-toggle.*outline is clipped by div/,
    owner: 'shell: brand zone clips the rail toggle ring',
  },
  {
    route: '/cards',
    assertion: 'forcedColors',
    item: /^\[stat-menu\] button/,
    owner: 'cards: stat menu draws its frame with a shadow only',
  },
  {
    route: '/charts',
    assertion: 'axe',
    item: /^color-contrast \(serious\)/,
    owner: 'charts: legend label contrast (light)',
  },
  {
    route: '/charts',
    assertion: 'ringWalk',
    item: /svg ".*outline contrast 1\.74:1/,
    owner: 'charts: focusable plot ring contrast',
  },
  {
    route: '/scenarios/s1-ops',
    assertion: 'axe',
    item: /^color-contrast \(serious\)/,
    owner: 'playground scenario (2.x cards): text contrast',
  },
  {
    route: '/scenarios/s1-ops',
    assertion: 'ringWalk',
    item: /svg ".*outline is clipped/,
    owner: 'charts: focusable plot ring is clipped by its card',
  },
  {
    route: '/scenarios/s1-ops',
    assertion: 'ringWalk',
    item: /(tbody>tr>td>button "Show Cause"|tr>th>span>button "\+\d+ col).*(outline contrast|outline is clipped)/,
    owner:
      'table: row and folded-column buttons keep a ring that is too faint and is clipped by the scrollport',
  },
  {
    route: '/cards',
    assertion: 'focusNotObscured',
    item: /a\[stat-target\].*covered at .* by div\[card-phase\]/,
    owner: 'cards: the phase overlay sits over the stat target link',
  },
  {
    route: '/scenarios/s1-ops',
    assertion: 'ringWalk',
    item: /button "More information": no focus outline/,
    owner: 'cards: info button has no focus ring',
  },
  {
    route: '/scenarios/s1-ops',
    assertion: 'hitOverlap',
    item: /^\d+:button\[\] x \d+:button\[\]/,
    owner: 'charts: legend hit overlays overlap on the phone',
  },
  // /table is the v3 DataTable exemplar (v3-table-t5-exemplar); its other findings are fixed in src/table.
  {
    route: '/table',
    assertion: 'ringWalk',
    item: /td\[table-cell\]>span\[table-select-cell\]>div\[select\]>button\[select-trigger\] ".*outline is clipped by div/,
    owner:
      'table: the inline select in a cell sits flush in the scrollport, which clips its ring; the 390 walk reaches it now that the page bar folds its filters into one Filters button (fewer stops before the table)',
  },
]

export interface Classified {
  /** Failure texts with at least one item no entry covers (or no item at all). */
  unexpected: string[]
  /** Entries that covered an item of this cell. */
  matched: KnownFinding[]
}

/** Items of a failure message: the lines indented by exactly two spaces. */
function itemsOf(message: string): string[] {
  return message
    .split('\n')
    .filter((line) => /^ {2}\S/.test(line))
    .map((line) => line.trim().replace(/"$/, ''))
}

export function classify(
  route: string,
  failures: readonly string[],
  known: readonly KnownFinding[] = KNOWN,
): Classified {
  const unexpected: string[] = []
  const matched: KnownFinding[] = []
  for (const failure of failures) {
    const assertion = failure.slice(0, failure.indexOf(':'))
    const items = itemsOf(failure)
    const covers = items.map((item) =>
      known.find(
        (k) =>
          (k.route === '*' || k.route === route) && k.assertion === assertion && k.item.test(item),
      ),
    )
    if (items.length === 0 || covers.some((k) => k === undefined)) {
      unexpected.push(failure)
      continue
    }
    for (const k of covers) if (k !== undefined) matched.push(k)
  }
  return { unexpected, matched }
}
