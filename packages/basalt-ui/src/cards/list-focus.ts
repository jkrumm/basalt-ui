import type { FocusEvent, KeyboardEvent, LiHTMLAttributes, PointerEvent } from 'react'
import type { ListFocus } from '../core/ports'

/** What `useChartFocus` puts on an item beyond `ListFocusItem`: the kit dims a `data-dimmed` row. */
type MarkedItem = { 'data-chart-mark'?: ''; 'data-dimmed'?: '' }

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
    onPointerLeave: (event) => {
      if (event.pointerType !== 'touch') focus.set(null)
    },
  }
}
