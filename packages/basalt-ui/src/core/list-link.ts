/**
 * A kit list row that stands for a chart's focus across grains, shared by `DataTable` and
 * `BarList`: a row that holds items of another grain (`focusItems`) or one series of the chart
 * (`focusSeries`). One home, so both lists mark, dim and point alike.
 */
import type { ListFocus, ListFocusItem } from './ports'

/** What `useChartFocus` puts on an item beyond `ListFocusItem`: the kit dims a `data-dimmed` row. */
export type MarkedItem = ListFocusItem & { 'data-chart-mark'?: ''; 'data-dimmed'?: '' }

/** A row that holds every item `holds` accepts, never by position. */
export type ItemsLink<T, I> = {
  focus: ListFocus<I>
  holds: (row: T, item: I) => boolean
}

/** A row that stands for one series of the chart: `key` maps it to the series key. */
export type SeriesLink<T> = {
  focus: {
    readonly setSeries: (key: string | null) => void
    readonly seriesItem: (key: string) => ListFocusItem
  }
  key: (row: T) => string
}

const noRef = (): void => undefined

/** The indexes of every focus item the row holds, in item order. */
export function heldBy<T, I>({ focus, holds }: ItemsLink<T, I>, row: T): number[] {
  return focus.items.flatMap((item, i) => (holds(row, item) ? [i] : []))
}

/**
 * The props of a row that holds items of another grain: pointing at it holds them all, it is marked
 * while any item it holds is focused, and it dims while other items are. A row that holds nothing
 * stands for no item: pointing at it clears the focus.
 */
export function heldItem<T, I>(link: ItemsLink<T, I>, row: T): MarkedItem {
  const { focus, holds } = link
  const indexes = heldBy(link, row)
  const first = indexes[0]
  if (first === undefined)
    return {
      // A row that holds nothing dims with the rest: the dim rule needs the mark too.
      'data-chart-mark': '',
      ...(focus.index !== null && { 'data-dimmed': '' as const }),
      ref: noRef,
      onPointerEnter: () => focus.set(null),
      onPointerDown: () => focus.set(null),
    }
  const marked = focus.span.some((item) => holds(row, item))
  // Per call, so the ref React detaches (the one it attached) holds the refs it attached.
  let refs: readonly ((element: Element | null) => void)[] = []
  return {
    'data-chart-mark': '',
    ...(marked && { 'data-focused': '' as const }),
    ...(focus.index !== null && !marked && { 'data-dimmed': '' as const }),
    // The row stands in for every item it holds: a detach reaches the same item refs it attached.
    ref: (element) => {
      for (const r of refs) r(null)
      refs = element === null ? [] : indexes.map((i) => focus.item(i).ref)
      for (const r of refs) r(element)
    },
    onPointerEnter: () => focus.hold(indexes),
    onPointerDown: () => focus.hold(indexes),
  }
}
