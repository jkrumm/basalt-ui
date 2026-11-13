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

export const KNOWN: readonly KnownFinding[] = [
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
    route: '/overview',
    assertion: 'forcedColors',
    item: /^\[button\] button/,
    owner: 'ui: buttons whose frame is a shadow only (filter pills, Filters)',
  },
  {
    route: '/overview',
    assertion: 'focusNotObscured',
    item: /select-trigger\] "Range": covered at .* by div\[stat-controls\]/,
    owner: 'cards: the stat controls overlay covers the range select on the phone',
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
    route: '/shell',
    assertion: 'forcedColors',
    item: /^\[button\] button 57x24/,
    owner: 'ui: a button whose frame is a shadow only (phone page action)',
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
    route: '/settings',
    assertion: 'ringWalk',
    item: /input "": no focus outline/,
    owner: 'playground settings (2.x inputs): no focus ring',
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
  {
    route: '/settings',
    assertion: 'axe',
    item: /^color-contrast \(serious\)/,
    owner: 'playground settings (2.x components): text contrast',
  },
  {
    route: '/table',
    assertion: 'axe',
    item: /^scrollable-region-focusable \(serious\)/,
    owner: 'table: scrollport is not keyboard reachable',
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
