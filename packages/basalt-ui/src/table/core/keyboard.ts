/**
 * The row keyboard of the table (docs/v3/concepts/data-table.md sections 3 and 6; invariant I10).
 * A roving controller on the row set: exactly one row is a tab stop (`tabIndex` 0), the others are
 * -1, and the arrow keys move the stop and focus.
 *
 * | Key                           | On the focused row                                          |
 * |-|-|
 * | Up, Down, Home, End, PgUp, PgDn | move the stop (PgUp/PgDn by `pageStep` rows)              |
 * | Enter                         | activates, only when the table has an activation            |
 * | Space                         | toggles the tick, only when rows are selectable; NEVER activates |
 * | `/`                           | focuses the table's own search (the root handler, not a global one) |
 * | Escape                        | `onClear` (the selection), unless the key came from a text field |
 * | Right, Left                   | nested rows only: open or step in, close or step to the parent |
 *
 * The grid look passes `cells`: the stop is then one cell, never a row (the WAI-ARIA grid pattern).
 *
 * | Key (grid)                    | On the focused cell                                         |
 * |-|-|
 * | Up, Down, PgUp, PgDn          | the same column, another row                                |
 * | Left, Right                   | the next cell in the row, stopping at its ends; on the identity cell of a nested row, open or close first |
 * | Home, End                     | the row's first or last cell                                |
 * | Ctrl or Cmd with Home, End    | the first cell of the first row, the last cell of the last row |
 * | Enter                         | into the cell's control (tick, editor, row menu); elsewhere activates the row |
 * | F2                            | into the cell's control, whatever the cell                  |
 * | Escape, from a control        | back to its cell                                            |
 * | Space                         | toggles the tick, as on a row                               |
 *
 * A click in the grid focuses the cell it lands on; only a click on the identity cell activates the row.
 *
 * Law: a row handles only its OWN keys. A key from a button, link or input inside the row has
 * `target !== currentTarget` and is left alone, so Enter on a nested control never also activates
 * the row, and an arrow in a cell editor never moves rows. A row is never `role="button"`: it is a
 * row that happens to be focusable. A table with neither activation nor selection has no tab
 * stops at all (its scroller takes the stop).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent, RefObject } from 'react'

export type RowKeyboardOptions = {
  /** The ids of the rows in display order (the page, or the virtual set). */
  rowIds: readonly string[]
  /** Enter on a row, click on a row. Absent: rows are not activatable. */
  onActivate?: ((id: string) => void) | undefined
  /** Space on a row. Absent: rows are not selectable and Space keeps scrolling the page. */
  onToggle?: ((id: string) => void) | undefined
  /** Escape outside a text field. */
  onClear?: (() => void) | undefined
  /** The table's search; `/` focuses it from anywhere inside the table. */
  searchRef?: RefObject<HTMLElement | null> | undefined
  /** @default 10 */
  pageStep?: number | undefined
  /**
   * The grid look: the cells a row has (the tick and every drawn column). The stop is a cell, the
   * rows take no tab stop, and `cellProps` wires each cell.
   */
  cells?: number | undefined
  /** In a grid of nested rows, the cell whose Right and Left open and close the row. */
  treeCell?: number | undefined
  /**
   * Nested rows: Right opens a closed row or steps to its first row below, Left closes an open row
   * or steps to its parent. `open` and `close` return whether they changed the row.
   */
  tree?:
    | {
        open(id: string): boolean
        close(id: string): boolean
        parentOf(id: string): string | undefined
      }
    | undefined
}

export type RowProps = {
  tabIndex?: 0 | -1
  'data-activatable'?: ''
  'data-active'?: ''
  ref?: (el: HTMLElement | null) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onClick?: (event: MouseEvent<HTMLElement>) => void
}

export type CellProps = {
  tabIndex?: 0 | -1
  'data-cell-active'?: ''
  ref?: (el: HTMLElement | null) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
}

export type RowKeyboard = {
  /** `undefined` for an empty set. */
  activeId: string | undefined
  /** For `VirtualLike.keepIndex`, so the focused row is always rendered. */
  activeIndex: number | undefined
  /** Spread on the table root: `/` and Escape. */
  rootProps: { onKeyDown(event: KeyboardEvent<HTMLElement>): void }
  rowProps(id: string): RowProps
  /** The props of a row's cell `col` in the grid look (`cells`); empty otherwise. */
  cellProps(id: string, col: number): CellProps
}

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
const INTERACTIVE = `${EDITABLE}, button, a[href], label, summary, [role="checkbox"], [role="menuitem"], [role="option"]`

const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image',
])

/** The kinds whose cell holds one control: Enter goes into it rather than activating the row. */
const CONTROL_KINDS = new Set(['tick', 'select', 'actions'])

/** The first control in a cell, or `null`. */
function controlOf(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [role="checkbox"], [role="combobox"]',
  )
}

/** Whether typing goes into the target: a text field, `textarea`, `select` or contenteditable. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const el = target.closest(EDITABLE)
  if (el === null) return false
  return !(el instanceof HTMLInputElement) || !NON_TEXT_INPUTS.has(el.type)
}

/** The index a navigation key lands on; `undefined` when the key is not a navigation key. */
export function nextIndex(
  key: string,
  current: number,
  count: number,
  pageStep = 10,
): number | undefined {
  if (count <= 0) return undefined
  const last = count - 1
  switch (key) {
    case 'ArrowUp':
      return Math.max(0, current - 1)
    case 'ArrowDown':
      return Math.min(last, current + 1)
    case 'Home':
      return 0
    case 'End':
      return last
    case 'PageUp':
      return Math.max(0, current - pageStep)
    case 'PageDown':
      return Math.min(last, current + pageStep)
    default:
      return undefined
  }
}

export function useRowKeyboard(options: RowKeyboardOptions): RowKeyboard {
  const { rowIds, onActivate, onToggle, onClear, searchRef, pageStep, tree, cells, treeCell } =
    options
  const grid = cells !== undefined && cells > 0
  const enabled = grid || onActivate !== undefined || onToggle !== undefined || tree !== undefined
  const [stop, setStop] = useState<string | undefined>(undefined)
  const elements = useRef(new Map<string, HTMLElement>())
  const pending = useRef<string | undefined>(undefined)
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>())
  const [stopCol, setStopCol] = useState(0)
  const cellEls = useRef(new Map<string, HTMLElement>())
  const pendingCell = useRef<string | undefined>(undefined)
  const cellRefs = useRef(new Map<string, (el: HTMLElement | null) => void>())
  const lastCell = Math.max(0, (cells ?? 1) - 1)
  const activeCol = Math.min(stopCol, lastCell)
  const cellKey = (id: string, col: number): string => `${id}\u0000${col}`

  // The stop is a remembered id, resolved against the current rows: a row that left the set (a
  // refetch, a sort) hands the stop to the first row instead of leaving the table with none.
  const found = stop === undefined ? -1 : rowIds.indexOf(stop)
  const activeIndex = rowIds.length === 0 ? undefined : Math.max(0, found)
  const activeId = activeIndex === undefined ? undefined : rowIds[activeIndex]

  const focusRow = useCallback((id: string): void => {
    setStop(id)
    const el = elements.current.get(id)
    if (el) el.focus()
    else pending.current = id
  }, [])

  const refFor = useCallback((id: string) => {
    let ref = refs.current.get(id)
    if (ref) return ref
    ref = (el: HTMLElement | null): void => {
      if (el === null) {
        elements.current.delete(id)
        return
      }
      elements.current.set(id, el)
      if (pending.current === id) {
        pending.current = undefined
        el.focus()
      }
    }
    refs.current.set(id, ref)
    return ref
  }, [])

  const focusCell = useCallback((id: string, col: number): void => {
    setStop(id)
    setStopCol(col)
    const el = cellEls.current.get(cellKey(id, col))
    if (el) el.focus()
    else pendingCell.current = cellKey(id, col)
  }, [])

  const cellRefFor = (id: string, col: number): ((el: HTMLElement | null) => void) => {
    const key = cellKey(id, col)
    let ref = cellRefs.current.get(key)
    if (ref) return ref
    ref = (el: HTMLElement | null): void => {
      if (el === null) {
        cellEls.current.delete(key)
        return
      }
      cellEls.current.set(key, el)
      if (pendingCell.current === key) {
        pendingCell.current = undefined
        el.focus()
      }
    }
    cellRefs.current.set(key, ref)
    return ref
  }

  // Cached callbacks of rows that left the set would otherwise accumulate.
  useEffect(() => {
    const live = new Set(rowIds)
    for (const id of refs.current.keys()) if (!live.has(id)) refs.current.delete(id)
    for (const key of cellRefs.current.keys())
      if (!live.has(key.slice(0, key.indexOf('\u0000')))) cellRefs.current.delete(key)
  }, [rowIds])

  const onCellKey = (event: KeyboardEvent<HTMLElement>, id: string, col: number): void => {
    const cell = event.currentTarget
    if (event.target !== cell) {
      // A control inside the cell owns its keys; Escape brings focus back to the cell. A key from a
      // portaled popup (a select's list) is not inside the cell's DOM and is left to the popup.
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (!(event.target instanceof Node) || !cell.contains(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      cell.focus()
      return
    }
    const index = rowIds.indexOf(id)
    const lastRow = rowIds.length - 1
    const mod = event.ctrlKey || event.metaKey
    if (event.altKey) return
    if (mod) {
      if (event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const target = event.key === 'Home' ? rowIds[0] : rowIds[lastRow]
      if (target !== undefined) focusCell(target, event.key === 'Home' ? 0 : lastCell)
      return
    }
    const into = (): boolean => {
      const control = controlOf(cell)
      if (control === null) return false
      control.focus()
      return true
    }
    switch (event.key) {
      case 'Enter': {
        event.preventDefault()
        const kind = cell.getAttribute('data-kind')
        if (kind !== null && CONTROL_KINDS.has(kind) && into()) return
        onActivate?.(id)
        return
      }
      case 'F2':
        event.preventDefault()
        into()
        return
      case ' ':
        if (!onToggle) return
        event.preventDefault()
        onToggle(id)
        return
      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault()
        const right = event.key === 'ArrowRight'
        if (tree !== undefined && col === treeCell) {
          if (right ? tree.open(id) : tree.close(id)) return
          const parent = right ? undefined : tree.parentOf(id)
          if (parent !== undefined) {
            focusCell(parent, col)
            return
          }
        }
        focusCell(id, Math.max(0, Math.min(lastCell, col + (right ? 1 : -1))))
        return
      }
      case 'Home':
      case 'End':
        event.preventDefault()
        focusCell(id, event.key === 'Home' ? 0 : lastCell)
        return
      default: {
        const next = nextIndex(event.key, index, rowIds.length, pageStep)
        const nextId = next === undefined ? undefined : rowIds[next]
        if (nextId === undefined) return
        event.preventDefault()
        focusCell(nextId, col)
      }
    }
  }

  return {
    activeId,
    activeIndex,
    rootProps: {
      onKeyDown(event) {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key === '/' && searchRef?.current && !isEditable(event.target)) {
          event.preventDefault()
          searchRef.current.focus()
        } else if (event.key === 'Escape' && onClear && !isEditable(event.target)) {
          onClear()
        }
      },
    },
    cellProps(id, col) {
      if (!grid) return {}
      const active = id === activeId && col === activeCol
      return {
        tabIndex: active ? 0 : -1,
        ...(active ? { 'data-cell-active': '' as const } : {}),
        ref: cellRefFor(id, col),
        // A click on a control inside the cell moves the stop to that cell too.
        onFocus() {
          setStop(id)
          setStopCol(col)
        },
        onKeyDown: (event) => onCellKey(event, id, col),
      }
    },
    rowProps(id) {
      if (!enabled) return {}
      if (grid) {
        return {
          ...(onActivate ? { 'data-activatable': '' as const } : {}),
          ...(id === activeId ? { 'data-active': '' as const } : {}),
          // A click on a working cell focuses it; the row opens from its name (the identity cell).
          onClick(event) {
            if (!onActivate) return
            const target = event.target as Element
            if (target.closest('[data-identity]') === null) return
            const hit = target.closest(INTERACTIVE)
            if (hit !== null && hit !== event.currentTarget && event.currentTarget.contains(hit))
              return
            onActivate(id)
          },
        }
      }
      return {
        tabIndex: id === activeId ? 0 : -1,
        ...(onActivate ? { 'data-activatable': '' as const } : {}),
        ...(id === activeId ? { 'data-active': '' as const } : {}),
        ref: refFor(id),
        onFocus(event) {
          if (event.target === event.currentTarget) setStop(id)
        },
        onClick(event) {
          if (!onActivate) return
          // A click on a control inside the row belongs to that control, not to the row.
          const hit = (event.target as Element).closest(INTERACTIVE)
          if (hit !== null && hit !== event.currentTarget && event.currentTarget.contains(hit))
            return
          onActivate(id)
        },
        onKeyDown(event) {
          if (event.target !== event.currentTarget) return
          if (event.ctrlKey || event.metaKey || event.altKey) return
          if (event.key === 'Enter') {
            if (!onActivate) return
            event.preventDefault()
            onActivate(id)
            return
          }
          if (event.key === ' ') {
            if (!onToggle) return
            event.preventDefault()
            onToggle(id)
            return
          }
          const index = rowIds.indexOf(id)
          if (tree !== undefined && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
            event.preventDefault()
            if (event.key === 'ArrowRight') {
              if (tree.open(id)) return
              const below = rowIds[index + 1]
              if (below !== undefined && tree.parentOf(below) === id) focusRow(below)
              return
            }
            if (tree.close(id)) return
            const parent = tree.parentOf(id)
            if (parent !== undefined) focusRow(parent)
            return
          }
          const next = nextIndex(event.key, index, rowIds.length, pageStep)
          const nextId = next === undefined ? undefined : rowIds[next]
          if (nextId === undefined) return
          event.preventDefault()
          focusRow(nextId)
        },
      }
    },
  }
}
