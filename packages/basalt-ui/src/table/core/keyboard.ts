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

export type RowKeyboard = {
  /** `undefined` for an empty set. */
  activeId: string | undefined
  /** For `VirtualLike.keepIndex`, so the focused row is always rendered. */
  activeIndex: number | undefined
  /** Spread on the table root: `/` and Escape. */
  rootProps: { onKeyDown(event: KeyboardEvent<HTMLElement>): void }
  rowProps(id: string): RowProps
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
  const { rowIds, onActivate, onToggle, onClear, searchRef, pageStep } = options
  const enabled = onActivate !== undefined || onToggle !== undefined
  const [stop, setStop] = useState<string | undefined>(undefined)
  const elements = useRef(new Map<string, HTMLElement>())
  const pending = useRef<string | undefined>(undefined)
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>())

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

  // Cached callbacks of rows that left the set would otherwise accumulate.
  useEffect(() => {
    const live = new Set(rowIds)
    for (const id of refs.current.keys()) if (!live.has(id)) refs.current.delete(id)
  }, [rowIds])

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
    rowProps(id) {
      if (!enabled) return {}
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
