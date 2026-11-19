/**
 * The tier inputs of a table (docs/v3/concepts/data-table.md section 6). The tiers themselves are
 * CSS container queries in `../table.css`; this file only turns the plan and two props into the
 * attributes that CSS reads, from props alone, so the server HTML already carries the right tier.
 *
 * `data-below` is the inline size under which the table stops being a table: `480`, `720` or `800` (the
 * plan's `reducedFrom`, `800` raised by `cardsBelow: 'wide'`) or `always`.
 */
import type { CSSProperties, FocusEvent } from 'react'
import type { TableModel } from '../use-data-table'

export type TierAttributes = {
  'data-phone': 'cards' | 'scroll'
  'data-below': '480' | '720' | '800' | 'always'
}

export function tierAttributesOf<T>(model: TableModel<T>): TierAttributes {
  const below =
    model.cardsBelow === 'always'
      ? 'always'
      : model.cardsBelow === 'wide'
        ? '800'
        : String(model.plan.reducedFrom)
  return {
    'data-phone': model.phone,
    'data-below': below as TierAttributes['data-below'],
  }
}

let sheetWarned = false

/**
 * A ref for the scroller: in development, names the missing tier sheet. Without
 * `basalt-ui/table.css` (which `basalt()` adds) no tier exists, so a phone table stays a table and its flexible name column
 * takes what the fixed columns leave (14 px in wiring cycle 1). Only a real browser answers `normal`
 * for a scroller with no container type; a test DOM or a browser without container queries answers
 * nothing and is skipped. The check runs once per page, after styles have applied.
 */
export function warnWithoutTierSheet(scroller: HTMLElement | null): void {
  if (process.env.NODE_ENV === 'production' || sheetWarned || scroller === null) return
  requestAnimationFrame(() => {
    if (sheetWarned || getComputedStyle(scroller).containerType !== 'normal') return
    sheetWarned = true
    // oxlint-disable-next-line no-console -- the dev-only warning is the whole point of this function
    console.warn(
      "basalt-ui/table: the tier sheet is not loaded, so the table never becomes cards and its name column can shrink to nothing. Add `basalt()` to the Vite config, or `@import 'basalt-ui/table.css'`.",
    )
  })
}

/** The width of the visible priority 1 and 2 columns pinned to one edge. */
function pinnedPx<T>(model: TableModel<T>, edge: 'start' | 'end'): number {
  return model.plan.columns.reduce(
    (sum, column) =>
      column.visible && column.priority !== 3 && column.pin === edge ? sum + column.widthPx : sum,
    0,
  )
}

/** The scroll tier's table width: priority 1 and 2 columns at their planned size. */
export function scrollMinWidth<T>(model: TableModel<T>): CSSProperties {
  const selectPx = model.selection === undefined ? 0 : 40
  const px = model.plan.columns.reduce(
    (sum, column) => (column.visible && column.priority !== 3 ? sum + column.widthPx : sum),
    selectPx,
  )
  return {
    ['--table-min-scroll' as string]: `${px}px`,
    // A start-pinned column rides beside the tick column when there is one.
    ['--table-pin-start' as string]: `${selectPx}px`,
    // Focus scrolls clear of the pinned columns, which are opaque and sit over the scrolled cells.
    ['--table-scroll-pad-start' as string]: `${selectPx + pinnedPx(model, 'start')}px`,
    ['--table-scroll-pad-end' as string]: `${pinnedPx(model, 'end')}px`,
  }
}

/** Room kept past a revealed control for its focus ring (outline width plus offset). */
const RING_ROOM_PX = 4

/**
 * Brings a focused control fully into the sideways scrollport. Chrome centres a stop that is hidden
 * and leaves a stop that is only partly visible where it is, so the control that follows a centred
 * one (the last column's sort button after its menu) stays half out of view and the scrollport clips
 * its ring. The reveal measures against the scroll padding, so a pinned column never covers it; a
 * pinned control itself is already in place.
 */
export function revealFocus(event: FocusEvent<HTMLElement>): void {
  const target = event.target
  if (target.closest('[data-pin], [data-kind="tick"]') !== null) return
  const port = target.closest<HTMLElement>(
    '[data-slot="virtual-list"], [data-slot="table-scroller"]',
  )
  if (port === null || port.scrollWidth <= port.clientWidth) return
  const box = port.getBoundingClientRect()
  const pad = getComputedStyle(port)
  const rect = target.getBoundingClientRect()
  const start = box.left + (parseFloat(pad.scrollPaddingLeft) || 0)
  const end = box.right - (parseFloat(pad.scrollPaddingRight) || 0) - RING_ROOM_PX
  if (rect.right > end)
    port.scrollLeft += Math.max(0, Math.min(rect.right - end, rect.left - start))
  else if (rect.left < start + RING_ROOM_PX) port.scrollLeft -= start + RING_ROOM_PX - rect.left
}
