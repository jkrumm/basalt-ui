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
  ...(await loadCycleKnown()),
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
    item: /svg "Requests per day, 30 day.*outline contrast 1\.8\d:1/,
    owner: 'charts: focusable plot ring contrast (as /charts)',
  },
  {
    route: '/overview',
    assertion: 'focusNotObscured',
    item: /view-tabs\]>div>div\[segmented\]>button\[segmented-item\].*covered at .* by div\[control-view\]/,
    owner: 'controls: the phone track sits under the control view layer at the page edge',
  },
  {
    route: '/scenarios/mdx',
    assertion: 'axe',
    item: /^color-contrast \(serious\)|^\.text_/,
    owner: 'provider: the fallback text contrast the mdx scenario renders (not owned here)',
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
    route: '/cards',
    assertion: 'focusNotObscured',
    item: /a\[stat-target\].*covered at .* by div\[card-phase\]/,
    owner: 'cards: the phase overlay sits over the stat target link',
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
