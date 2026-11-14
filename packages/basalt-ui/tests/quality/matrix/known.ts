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
// findings of the table parts and the controls it composes, one item each: a cycle PR may not touch
// `packages/basalt-ui/`, so the rows that own the parts remove each line with its fix. The full run
// fails an entry that matched nothing.
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
  ...stateItems('ringWalk', [
    'div[view-tabs]>div[tabs]>div[tabs-list]>button[tabs-trigger] "Table": outline is clipped by div',
    `${PILL} "Date: Last 30 days": outline is clipped by div`,
    `${PILL} "Status": outline is clipped by div`,
    `${PILL} "Search: Customer or orde": outline is clipped by div`,
    `${PILL} "Flagged only: Off": outline is clipped by div`,
  ]),
  ...stateItems('hitFloor', ['button[pressable] "Live" 32x44 < 44x44']),
]

// /cycle/shell/* is the shell cycle's fleet app (docs/v3/cycles/shell-1.md). Each entry is a finding of
// a kit part the build composes, owned by the fix row that removes it (shell-1.21); the gate conflict
// that puts these lines in a cycle PR is shell-1.22.
const SHELL_KNOWN: readonly KnownFinding[] = [
  {
    route: '/cycle/shell',
    assertion: 'axe',
    item: /^color-contrast \(serious\)/,
    owner: 'v3-shell-1-visual: the chart card fact value text contrast (as /overview)',
  },
  {
    route: '/cycle/shell',
    assertion: 'ringWalk',
    item: /fieldset>button ".*no focus outline/,
    owner: 'v3-shell-1-visual: chart legend toggles have no focus ring (as /charts)',
  },
  {
    route: '/cycle/shell',
    assertion: 'overflow',
    item: /^320px: document scrollWidth \d+ > 320/,
    owner: 'v3-shell-1-visual: two page actions overflow the phone header (shell-1.14)',
  },
  {
    route: '/cycle/shell/services',
    assertion: 'forcedColors',
    item: /^\[empty-state\] div \d+x\d+$/,
    owner: 'v3-shell-1-visual: the empty state frame vanishes under forced colors',
  },
  ...['/cycle/shell/services', '/cycle/shell/settings'].map((route): KnownFinding => ({
    route,
    assertion: 'ringWalk',
    item: /inner-nav-item\]>a ".*outline is clipped by div/,
    owner: 'v3-shell-1-inner-nav: the InnerNav list pane clips the link rings (as /settings)',
  })),
]

export const KNOWN: readonly KnownFinding[] = [
  ...STATE_KNOWN,
  ...SHELL_KNOWN,
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
    assertion: 'axe',
    item: /^color-contrast \(serious\)/,
    owner: 'overview: the fact value text contrast',
  },
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
    route: '/settings',
    assertion: 'ringWalk',
    item: /inner-nav-item\]>a ".*outline is clipped by div/,
    owner: 'page: the InnerNav list pane clips the link rings (settings exemplar)',
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
    route: '/charts',
    assertion: 'ringWalk',
    item: /fieldset>button ".*no focus outline/,
    owner: 'charts: legend toggles have no focus ring',
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
    item: /fieldset>button ".*no focus outline/,
    owner: 'charts: legend toggles have no focus ring',
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
    assertion: 'focusNotObscured',
    item: /th\[table-head\]>button\[pressable\] "Booking": covered at .* by button\[button\]/,
    owner:
      "table: the virtual table's flex identity head is 84 px at 390, too narrow for its sort button and a 44 px column menu hit area",
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

export function classify(route: string, failures: readonly string[]): Classified {
  const unexpected: string[] = []
  const matched: KnownFinding[] = []
  for (const failure of failures) {
    const assertion = failure.slice(0, failure.indexOf(':'))
    const items = itemsOf(failure)
    const covers = items.map((item) =>
      KNOWN.find(
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
