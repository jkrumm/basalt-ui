/**
 * Print findings the lane already reports on code this Issue does not own (cards, charts, the
 * playground's 2.x pages, the table). Each entry names a class of failing item on one route and where
 * the fix lives; the item stays in the lane's detail JSON. A failure no entry covers fails the lane,
 * and so does an entry that matched nothing, so a fix removes its line instead of leaving a waiver.
 */
export interface KnownPrint {
  route: string
  /** Matches one failure line. */
  item: RegExp
  owner: string
}

export const KNOWN_PRINT: readonly KnownPrint[] = [
  {
    route: '/cards',
    item: /^scrollport clips its content: div\[data-slot=stat-chart\]/,
    owner: 'cards: the stat chart frame is 2px shorter than its plot',
  },
  {
    route: '/cards',
    item: /^card split: div\[data-slot=(?:stat-card|card)\]/,
    owner: 'cards: card and stat-card carry no break-inside: avoid (quality-contract P7)',
  },
  {
    route: '/charts',
    item: /^ink under 4\.5:1: (?:text|span) /,
    owner: 'charts: axis labels and legend spans keep the screen muted ink in print',
  },
  {
    route: '/gallery',
    item: /./,
    owner: 'playground gallery (2.x Mantine specimens): retires with the legacy barrel',
  },
  {
    route: '/overview',
    item: /^scrollport clips its content: div\[data-slot=card-phase\]/,
    owner: 'cards: the phase list scrolls inside its card',
  },
  {
    route: '/overview',
    item: /^ink under 4\.5:1: /,
    owner: 'controls: select value and filter count keep the dark-scheme ink in print',
  },
  {
    route: '/overview',
    item: /^card split: div\[data-slot=(?:stat-card|card)\]/,
    owner: 'cards: card and stat-card carry no break-inside: avoid (quality-contract P7)',
  },
  {
    route: '/scenarios/s1-ops',
    item: /^card split: tr /,
    owner: 'scenario s1-ops: its table rows carry no break-inside: avoid',
  },
  {
    route: '/scenarios/s1-ops',
    item: /^ink under 4\.5:1: /,
    owner: 'scenario s1-ops: dt and muted spans keep the dark-scheme ink in print',
  },
  {
    route: '/table',
    item: /^scrollport clips its content: div /,
    owner: 'table: the table scroll area clips in print; the 100-row case is a later Issue',
  },
]

export function classifyPrint(
  route: string,
  failures: readonly string[],
): { unexpected: string[]; matched: KnownPrint[] } {
  const matched = new Set<KnownPrint>()
  const unexpected = failures.filter((line) => {
    const entry = KNOWN_PRINT.find((k) => k.route === route && k.item.test(line))
    if (entry) matched.add(entry)
    return entry === undefined
  })
  return { unexpected, matched: [...matched] }
}
