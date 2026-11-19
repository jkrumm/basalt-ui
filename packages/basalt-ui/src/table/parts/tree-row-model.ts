/**
 * Nested rows as data: the body's row set becomes a flat list of items in tree order, each row
 * under the row its `parentOf` names, one level deeper. The list is what the body, the virtual
 * window and the row keyboard read, exactly as a grouping's items are, so a nested row keeps the
 * table's fixed row height. Client mode only.
 *
 * Sort and filter keep their meaning inside a level: siblings stand in the order the engine sorted
 * the rows, and a filter keeps every match with the rows above it, drawn as context (`context`),
 * so a match is never shown without the path that leads to it. While a search or filter narrows the
 * rows every path is open; otherwise a row in `collapsed` hides the rows below it.
 */
import { parentsOf } from '../../common/nest'
import type { ModelRow } from '../use-data-table'

/** Where a row sits in the tree: what the body draws as indent and expander and announces. */
export type TreeInfo = {
  /** 1 for a root row (`aria-level`). */
  level: number
  parentId: string | undefined
  /** It has rows below it among the rows drawn. */
  parent: boolean
  /** Its rows below it are drawn. Only meaningful when `parent`. */
  open: boolean
  /** `aria-setsize` and `aria-posinset` among its siblings. */
  setSize: number
  posInSet: number
  /** Drawn only because a row below it matched the filters. */
  context: boolean
}

export type TreeRowItem<T> = { type: 'row'; key: string; row: ModelRow<T>; tree: TreeInfo }

/**
 * The items of a nested table. `matched` are the rows the engine kept, in its sort order; `all`
 * are every row, where the context rows above a match come from.
 */
export function treeItems<T>({
  matched,
  all,
  getRowId,
  parentOf,
  collapsed,
  narrowed,
}: {
  matched: readonly ModelRow<T>[]
  all: readonly T[]
  getRowId: (row: T) => string
  parentOf: (row: T) => string | null | undefined
  collapsed: readonly string[] | undefined
  /** A search or filter narrows the rows: every path to a match is open. */
  narrowed: boolean
}): TreeRowItem<T>[] {
  const parents = parentsOf(all, getRowId, parentOf)
  const byId = new Map<string, T>()
  for (const row of all) byId.set(getRowId(row), row)
  const rank = new Map<string, number>()
  matched.forEach((row, index) => rank.set(row.id, index))

  // The drawn set: every match and every row above one. A context row ranks with its first match.
  const drawn = new Map<string, { row: ModelRow<T>; context: boolean; rank: number }>()
  for (const row of matched) {
    const index = rank.get(row.id) ?? 0
    drawn.set(row.id, { row, context: false, rank: index })
    let up = parents.get(row.id)
    while (up !== undefined) {
      const known = drawn.get(up)
      if (known !== undefined) {
        if (known.context && index < known.rank) known.rank = index
        up = parents.get(up)
        continue
      }
      const original = byId.get(up)
      if (original === undefined) break
      drawn.set(up, { row: { id: up, original }, context: true, rank: index })
      up = parents.get(up)
    }
  }

  const children = new Map<string | undefined, string[]>()
  for (const [id] of drawn) {
    const parent = parents.get(id)
    const list = children.get(parent)
    if (list === undefined) children.set(parent, [id])
    else list.push(id)
  }
  for (const list of children.values()) {
    list.sort((a, b) => (drawn.get(a)?.rank ?? 0) - (drawn.get(b)?.rank ?? 0))
  }

  const closed = new Set(narrowed ? [] : (collapsed ?? []))
  const items: TreeRowItem<T>[] = []
  const visit = (parentId: string | undefined, level: number): void => {
    const siblings = children.get(parentId) ?? []
    siblings.forEach((id, index) => {
      const entry = drawn.get(id)
      if (entry === undefined) return
      const below = children.get(id) ?? []
      const open = !closed.has(id)
      items.push({
        type: 'row',
        key: id,
        row: entry.row,
        tree: {
          level,
          parentId,
          parent: below.length > 0,
          open,
          setSize: siblings.length,
          posInSet: index + 1,
          context: entry.context,
        },
      })
      if (open) visit(id, level + 1)
    })
  }
  visit(undefined, 1)
  return items
}
