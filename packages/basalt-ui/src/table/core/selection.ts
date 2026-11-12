/**
 * Row selection (docs/v3/concepts/data-table.md sections 3 and 8; invariants I2 to I4, I22). The
 * state is the contract's union and nothing else:
 *
 * - `{ kind: 'ids', ids }`: the ticked rows, keyed by `getRowId`, so a re-sort, a page change or a
 *   refetch never moves a tick to another row (I4). Ids of rows that are not loaded stay.
 * - `{ kind: 'all-matching', request, excluded, count }`: every row of one request except the
 *   excluded ids. It belongs to the request it was made for; under any other request it is empty.
 *
 * Law: one writer (I3). The functions below are pure; `useSelection` keeps ONE copy of the value,
 * or none when the caller controls it, and never mirrors. `getRowId` is required, with no default
 * index id, because an index id is exactly what moved ticks on a re-sort in 2.x.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Selection, TableRequest } from '../contract'
import { sameScope } from './state'

export const EMPTY_SELECTION: Selection = { kind: 'ids', ids: [] }

const without = (ids: readonly string[], drop: ReadonlySet<string>): string[] =>
  ids.filter((id) => !drop.has(id))

const withIds = (ids: readonly string[], add: readonly string[]): string[] => [
  ...new Set([...ids, ...add]),
]

export function isSelected(selection: Selection, id: string): boolean {
  return selection.kind === 'ids' ? selection.ids.includes(id) : !selection.excluded.includes(id)
}

/** Rows ticked: the ids, or the matching count less the excluded ones. */
export function selectedCount(selection: Selection): number {
  return selection.kind === 'ids'
    ? selection.ids.length
    : Math.max(0, selection.count - selection.excluded.length)
}

export const isEmpty = (selection: Selection): boolean => selectedCount(selection) === 0

/** Every row of `request`; `count` is the total the server (or the client filter) reported. */
export function selectAllMatching(request: TableRequest, count: number): Selection {
  return count > 0 ? { kind: 'all-matching', request, excluded: [], count } : EMPTY_SELECTION
}

/** Ticks or unticks one row; under `all-matching` it moves the row in or out of `excluded`. */
export function toggleRow(selection: Selection, id: string): Selection {
  if (selection.kind === 'ids') {
    return {
      kind: 'ids',
      ids: selection.ids.includes(id)
        ? without(selection.ids, new Set([id]))
        : [...selection.ids, id],
    }
  }
  const excluded = selection.excluded.includes(id)
    ? without(selection.excluded, new Set([id]))
    : [...selection.excluded, id]
  return excluded.length >= selection.count ? EMPTY_SELECTION : { ...selection, excluded }
}

/** The header tick for the rows on screen: all of them selected unticks them, else ticks them. */
export function toggleRows(selection: Selection, ids: readonly string[]): Selection {
  if (ids.length === 0) return selection
  const all = ids.every((id) => isSelected(selection, id))
  if (selection.kind === 'ids') {
    return {
      kind: 'ids',
      ids: all ? without(selection.ids, new Set(ids)) : withIds(selection.ids, ids),
    }
  }
  const excluded = all
    ? withIds(selection.excluded, ids)
    : without(selection.excluded, new Set(ids))
  return excluded.length >= selection.count ? EMPTY_SELECTION : { ...selection, excluded }
}

/**
 * `all-matching` belongs to the rows its request matches (everything but the page): under another
 * `q`, filter, sort or size it is empty, `ids` is untouched.
 */
export function reconcile(selection: Selection, request: TableRequest): Selection {
  if (selection.kind === 'ids' || sameScope(selection.request, request)) return selection
  return EMPTY_SELECTION
}

/**
 * The loaded rows the selection covers, in data order, for `onClick(rows, selection)`. Rows of a
 * selected id that are not loaded are not here; the `Selection` argument carries them.
 */
export function selectedRows<T>(
  selection: Selection,
  data: readonly T[],
  getRowId: (row: T) => string,
): T[] {
  return data.filter((row) => isSelected(selection, getRowId(row)))
}

// ---- The hook -----------------------------------------------------------------------------

export type SelectionOptions<T> = {
  /** Required: the id a tick follows across sort, page and refetch. */
  getRowId: (row: T) => string
  /** The current request; an `all-matching` selection of another request reads as empty. */
  request: TableRequest
  /** The caller owns the value: this hook keeps no copy and only reports. */
  controlled?: { value: Selection; onChange(next: Selection): void } | undefined
}

export type SelectionApi<T> = {
  selection: Selection
  count: number
  isSelected(id: string): boolean
  toggle(id: string): void
  /** The header tick for these rows (the current page). */
  togglePage(ids: readonly string[]): void
  selectAllMatching(count: number): void
  clear(): void
  /** The loaded rows the selection covers, for a bulk action. */
  rows(data: readonly T[]): T[]
}

export function useSelection<T>(options: SelectionOptions<T>): SelectionApi<T> {
  const { controlled, request } = options
  const [own, setOwn] = useState<Selection>(EMPTY_SELECTION)
  const stored = controlled ? controlled.value : own
  const selection = useMemo(() => reconcile(stored, request), [stored, request])

  const commit = useCallback(
    (next: Selection): void => {
      if (controlled) controlled.onChange(next)
      else setOwn(next)
    },
    [controlled],
  )

  // A stale `all-matching` is also cleared in the store, so it cannot wake up when the request
  // returns to the one it was made for. Own state is corrected during render (derived state); a
  // caller's value is reported once the commit is done.
  if (!controlled && selection !== own) setOwn(selection)
  useEffect(() => {
    if (controlled && selection !== controlled.value) controlled.onChange(selection)
  }, [selection, controlled])

  return {
    selection,
    count: selectedCount(selection),
    isSelected: (id) => isSelected(selection, id),
    toggle: (id) => commit(toggleRow(selection, id)),
    togglePage: (ids) => commit(toggleRows(selection, ids)),
    selectAllMatching: (count) => commit(selectAllMatching(request, count)),
    clear: () => commit(EMPTY_SELECTION),
    rows: (data) => selectedRows(selection, data, options.getRowId),
  }
}
