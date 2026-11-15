/**
 * Quality-matrix waivers of /cycle/state (docs/v3/CYCLES.md step 2). The matrix reads `known` from every
 * `cycle/<cycle>/known.ts`; each entry is one failing item of one assertion on one route, owned by the
 * fix row that removes it. The full run fails an entry that matched nothing.
 */
interface KnownFinding {
  route: string
  assertion: string
  item: RegExp
  owner: string
}

const OWNER = 'v3-state-1-visual: the state cycle build (kit parts it composes)'
const PILL = 'div>div[filter-pills]>div[filter-set-pill]>button[button]'

function ringWalk(items: readonly string[]): KnownFinding[] {
  return items.map((item) => ({
    route: '/cycle/state',
    assertion: 'ringWalk',
    item: new RegExp(`^${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    owner: OWNER,
  }))
}

export const known: readonly KnownFinding[] = [
  // desktop, light: the view tab and the pills sit in the page bar's clip
  ...ringWalk([
    'div[view-tabs]>div[tabs]>div[tabs-list]>button[tabs-trigger] "Table": outline is clipped by div',
    `${PILL} "Date: Last 30 days": outline is clipped by div`,
    `${PILL} "Status": outline is clipped by div`,
    `${PILL} "Search: Customer or orde": outline is clipped by div`,
    `${PILL} "Flagged only: Off": outline is clipped by div`,
  ]),
]
