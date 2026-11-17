/**
 * Quality-matrix waivers of /cycle/dogfood-5, the console Overview slice (docs/v3/cycles/dogfood-5.md;
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

export const known: readonly KnownFinding[] = []
