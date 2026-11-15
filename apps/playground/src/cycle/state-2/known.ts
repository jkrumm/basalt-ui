/**
 * Quality-matrix waivers of /cycle/state-2 (docs/v3/CYCLES.md step 2). The matrix reads `known` from
 * every `cycle/<cycle>/known.ts`; each entry is one failing item of one assertion on one route, owned by
 * the fix row that removes it. The full run fails an entry that matched nothing.
 */
interface KnownFinding {
  route: string
  assertion: string
  item: RegExp
  owner: string
}

const OWNER = 'v3-state-2-visual: the page bar clips its tab and filter pill rings (state-2.12)'

export const known: readonly KnownFinding[] = [
  // every cell: the page tab strip's trigger ring
  {
    route: '/cycle/state-2',
    assertion: 'ringWalk',
    item: /^div\[page-bar-tabs\]>div\[tabs\]>div\[tabs-list\]>button\[tabs-trigger\] "Table": outline is clipped by div$/,
    owner: OWNER,
  },
  // 1800 px: the four filter pills in the page bar
  {
    route: '/cycle/state-2',
    assertion: 'ringWalk',
    item: /^div>div\[filter-pills\]>div\[filter-set-pill\]>button\[button\] "(Opened: Last 30 days|Priority|Search: Subject, request|Unassigned only: Off)": outline is clipped by div$/,
    owner: OWNER,
  },
]
