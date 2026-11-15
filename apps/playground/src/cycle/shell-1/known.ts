/**
 * Quality-matrix waivers of /cycle/shell/* (docs/v3/cycles/shell-1.md; docs/v3/CYCLES.md step 2). The
 * matrix reads `known` from every `cycle/<cycle>/known.ts`. Each entry is a finding of a kit part the
 * build composes, owned by the fix row that removes it. The full run fails an entry that matched nothing.
 */
interface KnownFinding {
  route: string
  assertion: string
  item: RegExp
  owner: string
}

// `filterSlot` in a page bar draws the folding `FilterSet` (F2 n12), whose pill row clips at its
// border box; the same finding /overview lists. The row's own clip margin paints the ring, the walk measures the box.
export const known: readonly KnownFinding[] = ['/cycle/shell', '/cycle/shell/services'].map(
  (route) => ({
    route,
    assertion: 'ringWalk',
    item: /filter-set-pill\]>button\[button\] ".*outline is clipped by div/,
    owner: "controls: the FilterSet pill row clips its edge pills' rings (as /overview)",
  }),
)
