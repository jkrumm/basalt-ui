/**
 * The tier inputs of a table (docs/v3/concepts/data-table.md section 6). The tiers themselves are
 * CSS container queries in `../table.css`; this file only turns the plan and two props into the
 * attributes that CSS reads, from props alone, so the server HTML already carries the right tier.
 *
 * `data-below` is the inline size under which the table stops being a table: `480`, `700` or `800` (the
 * plan's `reducedFrom`, `800` raised by `cardsBelow: 'wide'`) or `always`.
 */
import type { CSSProperties, FocusEvent, UIEvent } from 'react'
import { TICK_COL_PX } from '../core/plan'
import type { TableModel } from '../use-data-table'

export type TierAttributes = {
  'data-phone': 'cards' | 'fields' | 'scroll' | 'columns'
  'data-below': '480' | '700' | '800' | 'always'
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
    // The sheet names the scroller's container `table`; an engine without container queries reports no name.
    const name = getComputedStyle(scroller).containerName
    if (sheetWarned || !name || name.includes('table')) return
    sheetWarned = true
    // oxlint-disable-next-line no-console -- the dev-only warning is the whole point of this function
    console.warn(
      "basalt-ui/table: the tier sheet is not loaded, so the table never becomes cards and its name column can shrink to nothing. Add `basalt()` to the Vite config, or `@import 'basalt-ui/table.css'`.",
    )
  })
}

/** Whether a planned column takes width in the sideways scroll: every visible one in a grid, priority 1 and 2 otherwise. */
function scrolled<T>(
  model: TableModel<T>,
  column: TableModel<T>['plan']['columns'][number],
): boolean {
  return column.visible && (model.look === 'grid' || column.priority !== 3)
}

/** The width of the scrolled columns pinned to one edge. */
function pinnedPx<T>(model: TableModel<T>, edge: 'start' | 'end'): number {
  return model.plan.columns.reduce(
    (sum, column) => (scrolled(model, column) && column.pin === edge ? sum + column.widthPx : sum),
    0,
  )
}

/** The sideways scroll's table width: the scrolled columns at their planned size. */
export function scrollMinWidth<T>(model: TableModel<T>): CSSProperties {
  const selectPx = model.lead.px
  const px = model.plan.columns.reduce(
    (sum, column) => (scrolled(model, column) ? sum + column.widthPx : sum),
    selectPx,
  )
  return {
    // The column widths share the scroller's width (`100cqw`): the scroller is that container even
    // where the tier sheet, which also names it `table`, is missing.
    containerType: 'inline-size',
    ['--table-min-scroll' as string]: `${px}px`,
    // A start-pinned column rides beside the tick column when there is one.
    ['--table-pin-start' as string]: `${selectPx}px`,
    // The row-number column rides beside the tick column when there is one.
    ['--table-number-at' as string]: `${model.lead.tick ? TICK_COL_PX : 0}px`,
    // Focus scrolls clear of the pinned columns, which are opaque and sit over the scrolled cells.
    ['--table-scroll-pad-start' as string]: `${selectPx + pinnedPx(model, 'start')}px`,
    ['--table-scroll-pad-end' as string]: `${pinnedPx(model, 'end')}px`,
  }
}

/**
 * Marks the table root `data-scrolled` while its scroller (the plain one or the virtual list) has
 * moved sideways, so the last pinned column casts its edge shadow. One capture listener on the root
 * reads the scroll position; it writes the attribute itself, so a scroll never re-renders the table.
 */
export function markScrolled(event: UIEvent<HTMLElement>): void {
  const port = event.target
  if (!(port instanceof HTMLElement)) return
  if (!port.matches('[data-slot="table-scroller"], [data-slot="virtual-list"]')) return
  const root = event.currentTarget
  const moved = Math.abs(port.scrollLeft) > 0
  if (moved === root.hasAttribute('data-scrolled')) return
  if (moved) root.setAttribute('data-scrolled', '')
  else root.removeAttribute('data-scrolled')
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
