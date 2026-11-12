/**
 * Declared grouping as data (docs/v3/concepts/data-table.md section 3, Grouping): the body's row
 * set becomes a flat list of items, one group row per value in first-seen order followed by its
 * rows, a collapsed group without them. The list is what the body, the virtual window and the row
 * keyboard all read, so a group row has the same fixed height as a data row and `virtual` holds.
 * Client mode only; the rows keep the request's sort inside their group.
 */
import type { KindSpec } from '../core/kinds-spec'
import type { ModelRow as BodyRow } from '../use-data-table'

export type BodyItem<T> =
  | { type: 'row'; key: string; row: BodyRow<T> }
  | {
      type: 'group'
      key: string
      /** The group's value as the column renders it, `''` for rows without one. */
      value: string
      rows: readonly BodyRow<T>[]
      collapsed: boolean
    }

const GROUP_PREFIX = 'group:'

/** The item key of a group row; never collides with a row id, which the virtual window keys by. */
export function groupKey(value: string): string {
  return `${GROUP_PREFIX}${value}`
}

function groupValue(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

/** The body's items: rows as they are, or grouped by `by` with `collapsed` groups closed. */
export function bodyItems<T>(
  rows: readonly BodyRow<T>[],
  by: KindSpec<T> | undefined,
  collapsed: readonly string[] | undefined,
): BodyItem<T>[] {
  if (by === undefined) return rows.map((row) => ({ type: 'row', key: row.id, row }))
  const groups = new Map<string, BodyRow<T>[]>()
  for (const row of rows) {
    const value = groupValue(by.value(row.original))
    const members = groups.get(value)
    if (members === undefined) groups.set(value, [row])
    else members.push(row)
  }
  const closed = new Set(collapsed ?? [])
  const items: BodyItem<T>[] = []
  for (const [value, members] of groups) {
    const shut = closed.has(value)
    items.push({ type: 'group', key: groupKey(value), value, rows: members, collapsed: shut })
    if (!shut) for (const row of members) items.push({ type: 'row', key: row.id, row })
  }
  return items
}

/** `collapsed` with `value` flipped. */
export function toggled(collapsed: readonly string[] | undefined, value: string): string[] {
  const current = collapsed ?? []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}
