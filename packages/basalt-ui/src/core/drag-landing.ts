import type { DragEdge } from './ports'

/**
 * Where a dragged row lands in its own list: the slot `edge` of row `over` names, less one when
 * the row came from above it, so the result is its final index, the number `onMove` takes. A row
 * from another list (`from` -1) lands on the slot itself. `Board` and `SortableList` share it.
 */
export function landing(from: number, over: number, edge: DragEdge): number {
  const slot = edge === 'before' ? over : over + 1
  return from >= 0 && slot > from ? slot - 1 : slot
}
