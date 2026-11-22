/**
 * The display order of a table's columns (owner review 2, docs/v3/verdicts/table-grid-research.md):
 * pure and total. The plan is computed in declaration order (card places, priorities and tiers keep
 * reading it); this module only rearranges the planned columns for the table to draw.
 *
 * Law:
 * - The identity column is first and `actions` last, whatever the stored order says.
 * - The other columns follow `display.order`; an id it does not name (a column added since) keeps
 *   its declared place after the named ones, and an id the table lacks is ignored.
 * - A pinned column (grid look) sits after the identity column, before the unpinned ones, and takes
 *   `pin: 'start'` with `pinAt`, its offset from the start: the tick column and every pinned
 *   column before it, at their planned widths.
 */
import type { PlannedColumn, TablePlan } from './plan'

/**
 * A planned column as the table draws it: `pinAt` is the inline offset of a start-pinned column in
 * px, `pinEdge` marks the last visible start-pinned column, the one that casts the scroll shadow.
 */
export type ArrangedColumn = PlannedColumn & { pinAt?: number; pinEdge?: boolean }

export type Arranged<S> = {
  specs: S[]
  plan: Omit<TablePlan, 'columns'> & { columns: ArrangedColumn[] }
  /** The ids a reader can move, in drawn order: neither the identity column nor `actions`. */
  movable: string[]
}

/** The ids of `ids` that `order` names, in its order, then the rest in their given order. */
function ordered(ids: readonly string[], order: readonly string[] | undefined): string[] {
  if (order === undefined || order.length === 0) return [...ids]
  const known = new Set(ids)
  const named = order.filter((id, index) => known.has(id) && order.indexOf(id) === index)
  const taken = new Set(named)
  return [...named, ...ids.filter((id) => !taken.has(id))]
}

/**
 * Rearranges `specs` and `plan.columns` (one entry per column, in declaration order) together.
 * `pinned` is honoured only when given: the reading look passes none.
 */
export function arrangeColumns<S extends { id: string; kind: string }>(
  specs: readonly S[],
  plan: TablePlan,
  display: { order?: readonly string[] | undefined; pinned?: readonly string[] | undefined },
  tickPx: number,
): Arranged<S> {
  const indexOf = new Map(specs.map((spec, index) => [spec.id, index]))
  const identity = plan.columns.findIndex((column) => column.identity)
  const isMovable = (index: number): boolean =>
    index !== identity && specs[index]?.kind !== 'actions'
  const movableIds = specs.flatMap((spec, index) => (isMovable(index) ? [spec.id] : []))
  const pins = new Set((display.pinned ?? []).filter((id) => movableIds.includes(id)))
  const inOrder = ordered(movableIds, display.order)
  const movable = [
    ...inOrder.filter((id) => pins.has(id)),
    ...inOrder.filter((id) => !pins.has(id)),
  ]
  const indexes = [
    ...(identity === -1 ? [] : [identity]),
    ...movable.map((id) => indexOf.get(id)!),
    ...specs.flatMap((spec, index) => (spec.kind === 'actions' ? [index] : [])),
  ]
  let at = tickPx
  const columns = indexes.map((index): ArrangedColumn => {
    const planned = plan.columns[index]!
    const pinned = pins.has(planned.id)
    const pin = pinned ? 'start' : planned.pin
    if (pin !== 'start' || !planned.visible) return pinned ? { ...planned, pin } : planned
    const column = { ...planned, pin, pinAt: at }
    at += planned.widthPx
    return column
  })
  const edge = columns.findLastIndex((column) => column.pinAt !== undefined)
  if (edge !== -1) columns[edge] = { ...columns[edge]!, pinEdge: true }
  return {
    specs: indexes.map((index) => specs[index]!),
    plan: { ...plan, columns },
    movable,
  }
}

/** `movable` with `id` moved to index `to` (clamped); the same list when it does not move. */
export function moveColumn(movable: readonly string[], id: string, to: number): string[] {
  const from = movable.indexOf(id)
  const target = Math.max(0, Math.min(movable.length - 1, to))
  if (from === -1 || from === target) return [...movable]
  return movable.toSpliced(from, 1).toSpliced(target, 0, id)
}
