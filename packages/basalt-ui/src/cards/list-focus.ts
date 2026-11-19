import type { FocusEvent, KeyboardEvent, LiHTMLAttributes, PointerEvent } from 'react'
import { releaseOf } from '../core/focus-release'
import { heldBy, heldItem } from '../core/list-link'
import type { ItemsLink, MarkedItem, SeriesLink } from '../core/list-link'
import type { ListFocus } from '../core/ports'

/** The row's share of a chart's focus: only the keys a list row takes (never the chart's dimming). */
export function rowFocus(
  focus: ListFocus<unknown>,
  i: number,
): LiHTMLAttributes<HTMLLIElement> & {
  ref: (element: Element | null) => void
} {
  const item = focus.item(i)
  return {
    ref: item.ref,
    onPointerEnter: item.onPointerEnter,
    onPointerOver: item.onPointerEnter,
    onPointerDown: item.onPointerDown,
    onFocus: () => focus.set(i),
    ...((item as MarkedItem)['data-chart-mark'] !== undefined && { 'data-chart-mark': '' }),
    ...((item as MarkedItem)['data-dimmed'] !== undefined && { 'data-dimmed': '' }),
    ...(item['data-focused'] !== undefined && { 'data-focused': '' }),
  } as LiHTMLAttributes<HTMLLIElement> & { ref: (element: Element | null) => void }
}

/** The list's own keys, when it is one tab stop for the shared focus. */
export function listFocus(focus: ListFocus<unknown>): {
  tabIndex: 0
  onKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  onBlur: (event: FocusEvent<HTMLUListElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLUListElement>) => void
} {
  return {
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget) return
      const next = focus.step(event.key)
      if (next === undefined) return
      event.preventDefault()
      focus.set(next)
    },
    onBlur: (event) => {
      const to = event.relatedTarget
      if (to instanceof Node && event.currentTarget.contains(to)) return
      focus.set(null)
    },
    // The shared focus releases after a grace: the pointer crossing to the next list keeps it.
    onPointerLeave: (event) => {
      if (event.pointerType !== 'touch') releaseOf(focus)(() => focus.set(null))
    },
  }
}

/**
 * A list whose rows stand for a chart's series or for items of another grain (`focusSeries`,
 * `focusItems`): the props of each row, what entering a row does and the clear.
 */
export type RowsLink = {
  /** Every row's props in row order; with a row marked, the rows that are not dim. */
  items: readonly MarkedItem[]
  /**
   * Whether row `i` still stands for the focus: its items are focused, or it holds none and nothing is
   * focused. A pointer elsewhere, or a focus set by the chart, silences the row the keys stepped to.
   */
  stands: (row: number) => boolean
  enter: (row: number) => void
  clear: () => void
  /** Clears after the focus's grace, for a pointer leave: the pointer crossing to the next list keeps it. */
  release?: (clear: () => void) => void
}

/** The link of a list's `focusItems`: a row holds every item `holds` accepts. */
export function itemsRows<T, I>(link: ItemsLink<T, I>, rows: readonly T[]): RowsLink {
  const items = rows.map((row) => heldItem(link, row))
  return {
    items,
    stands: (i) => {
      const row = rows[i]
      if (row === undefined) return false
      if (heldBy(link, row).length === 0) return link.focus.index === null
      return items[i]?.['data-focused'] !== undefined
    },
    // `hold` of no index clears, so stepping onto a row that holds nothing clears the focus too.
    enter: (i) => {
      const row = rows[i]
      link.focus.hold(row === undefined ? [] : heldBy(link, row))
    },
    clear: () => link.focus.set(null),
    release: releaseOf(link.focus),
  }
}

/**
 * The link of a list's `focusSeries`: a row emphasises its series; while a series a row stands for
 * is emphasised (from a row, the legend or a table), that row is marked and the others dim.
 */
export function seriesRows<T>(link: SeriesLink<T>, rows: readonly T[]): RowsLink {
  const own = rows.map((row) => link.focus.seriesItem(link.key(row)))
  const lit = own.some((item) => item['data-focused'] !== undefined)
  const items = own.map((item) => ({
    ...item,
    'data-chart-mark': '' as const,
    ...(lit && item['data-focused'] === undefined && { 'data-dimmed': '' as const }),
  }))
  return {
    items,
    stands: (i) => items[i]?.['data-focused'] !== undefined,
    enter: (i) => {
      const row = rows[i]
      link.focus.setSeries(row === undefined ? null : link.key(row))
    },
    clear: () => link.focus.setSeries(null),
    release: releaseOf(link.focus),
  }
}

/** The row a key moves a list's own cursor to (`null` clears, `undefined` is not ours). */
export function stepRow(key: string, at: number | null, count: number): number | null | undefined {
  if (count === 0) return undefined
  const last = count - 1
  const by = (delta: number, from: number): number =>
    at === null ? from : Math.min(last, Math.max(0, at + delta))
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return by(1, 0)
    case 'ArrowUp':
    case 'ArrowLeft':
      return by(-1, last)
    case 'Home':
      return 0
    case 'End':
      return last
    case 'Escape':
      return null
    default:
      return undefined
  }
}

/** A linked row's share of its list's link: its props, and its own focus entering it (`enter`). */
export function linkedRow(
  link: RowsLink,
  i: number,
  enter: (row: number) => void,
): LiHTMLAttributes<HTMLLIElement> & { ref: (element: Element | null) => void } {
  const item = link.items[i] as MarkedItem
  return {
    ref: item.ref,
    onPointerEnter: item.onPointerEnter,
    // `pointerover` too: a chart's crosshair node can leave the DOM under the pointer, so no `pointerout`
    // names the arrival and React drops the row's `pointerenter` (its related target is still a React node).
    onPointerOver: item.onPointerEnter,
    onPointerDown: item.onPointerDown,
    // A link or a button row takes focus itself: entering it is the row's step.
    onFocus: (event) => {
      if (event.target !== event.currentTarget) enter(i)
    },
    ...(item['data-chart-mark'] !== undefined && { 'data-chart-mark': '' }),
    ...(item['data-dimmed'] !== undefined && { 'data-dimmed': '' }),
    ...(item['data-focused'] !== undefined && { 'data-focused': '' }),
  } as LiHTMLAttributes<HTMLLIElement> & { ref: (element: Element | null) => void }
}

/**
 * The list's own keys over a linked list: one tab stop whose arrows, Home and End step a row cursor
 * of its own (the chart's items are another grain) and enter that row; Escape, a blur out and a
 * mouse leaving clear.
 */
export function linkedList(
  link: RowsLink,
  at: number | null,
  setAt: (row: number | null) => void,
): {
  tabIndex: 0
  onKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  onBlur: (event: FocusEvent<HTMLUListElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLUListElement>) => void
} {
  const clear = (): void => {
    setAt(null)
    link.clear()
  }
  return {
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget) return
      const next = stepRow(event.key, at, link.items.length)
      if (next === undefined) return
      event.preventDefault()
      if (next === null) return clear()
      setAt(next)
      link.enter(next)
    },
    onBlur: (event) => {
      const to = event.relatedTarget
      if (to instanceof Node && event.currentTarget.contains(to)) return
      clear()
    },
    onPointerLeave: (event) => {
      if (event.pointerType === 'touch') return
      setAt(null)
      if (link.release === undefined) link.clear()
      else link.release(link.clear)
    },
  }
}
