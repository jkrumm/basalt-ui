/**
 * The one parent of every row of a nested set, by id: what `DataTable`'s nested rows and
 * `ChainView`'s narrow list both draw under. A parent id that names no row, the row itself, or a
 * row below it (a cycle) makes the row a root, so every row is drawn exactly once.
 */
export function parentsOf<T>(
  all: readonly T[],
  getId: (row: T) => string,
  parentOf: (row: T) => string | null | undefined,
): Map<string, string | undefined> {
  const byId = new Map<string, T>()
  for (const row of all) byId.set(getId(row), row)
  const parents = new Map<string, string | undefined>()
  for (const [id, row] of byId) {
    const named = parentOf(row) ?? undefined
    parents.set(id, named !== undefined && named !== id && byId.has(named) ? named : undefined)
  }
  // Break cycles: walk up from each row; a walk that meets itself cuts the link it started on.
  for (const id of parents.keys()) {
    const seen = new Set<string>([id])
    let at = parents.get(id)
    while (at !== undefined) {
      if (seen.has(at)) {
        parents.set(id, undefined)
        break
      }
      seen.add(at)
      at = parents.get(at)
    }
  }
  return parents
}
