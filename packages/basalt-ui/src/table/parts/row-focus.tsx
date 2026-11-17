/**
 * A table's link to a chart's shared focus (`DataTable focus` or `focusSeries`). `DataTable`
 * provides it; a data row reads it, so `DataRow` stays one markup with or without a focus. A row
 * maps to its focus item by `getRowId`, or to its series by `focusSeries.key`, never by position,
 * so a sort or a filter keeps the link.
 */
import { createContext, useContext } from 'react'
import type { FocusEvent, PointerEvent, ReactElement, ReactNode } from 'react'
import type { ListFocus, ListFocusItem } from '../../core/ports'
import type { DataTableProps } from '../contract'
import type { RowProps } from '../core/keyboard'

/** What a row of a linked table reads: its item's props, the keyboard's entry and the clear. */
type RowLink = {
  /** The props of the row's item or series, or `undefined` when it stands for nothing. */
  item: (id: string, row: unknown) => ListFocusItem | undefined
  /** The table's own row focus moved onto the row. */
  enter: (id: string, row: unknown) => void
  clear: () => void
}

/** What `useChartFocus` puts on an item beyond `ListFocusItem`: the kit dims a `data-dimmed` row. */
type MarkedItem = { 'data-chart-mark'?: ''; 'data-dimmed'?: '' }

export type FocusedRowProps = RowProps & {
  'data-chart-mark'?: ''
  'data-dimmed'?: ''
  'data-focused'?: ''
  onPointerEnter?: () => void
  onPointerDown?: () => void
}

type SeriesLink<T> = NonNullable<DataTableProps<T>['focusSeries']>
type ItemsLink<T, I> = NonNullable<DataTableProps<T, I>['focusItems']>

/**
 * A row that stands for items of another grain: it holds every item `holds` accepts, pointing at it
 * holds them all, and it is marked while any item it holds is focused.
 */
function itemsLink<T, I>({ focus, holds }: ItemsLink<T, I>): RowLink {
  const heldBy = (row: T): number[] =>
    focus.items.flatMap((item, i) => (holds(row, item) ? [i] : []))
  return {
    item: (_, row) => {
      const indexes = heldBy(row as T)
      const first = indexes[0]
      if (first === undefined) return undefined
      const marked = focus.span.some((item) => holds(row as T, item))
      const props: ListFocusItem & MarkedItem = {
        'data-chart-mark': '',
        ...(marked && { 'data-focused': '' as const }),
        ...(focus.index !== null && !marked && { 'data-dimmed': '' as const }),
        // The row stands in for its first item, so a chart's keyboard step onto it scrolls the row.
        ref: focus.item(first).ref,
        onPointerEnter: () => focus.hold(indexes),
        onPointerDown: () => focus.hold(indexes),
      }
      return props
    },
    enter: (_, row) => {
      const indexes = heldBy(row as T)
      if (indexes.length > 0) focus.hold(indexes)
    },
    clear: () => focus.set(null),
  }
}

/** The link of a table's focus props, or `undefined` without one. */
export function rowLinkOf<T, I>(
  links: {
    focus: ListFocus<T> | undefined
    focusSeries: SeriesLink<T> | undefined
    focusItems: ItemsLink<T, I> | undefined
  },
  getRowId: (row: T) => string,
): RowLink | undefined {
  const { focus, focusSeries, focusItems } = links
  if (focusItems !== undefined) return itemsLink(focusItems)
  if (focusSeries !== undefined) {
    const { focus: series, key } = focusSeries
    return {
      item: (_, row) => series.seriesItem(key(row as T)),
      enter: (_, row) => series.setSeries(key(row as T)),
      clear: () => series.setSeries(null),
    }
  }
  if (focus === undefined) return undefined
  const ids = new Map<string, number>()
  focus.items.forEach((item, i) => ids.set(getRowId(item), i))
  return {
    item: (id) => {
      const index = ids.get(id)
      return index === undefined ? undefined : focus.item(index)
    },
    enter: (id) => {
      const index = ids.get(id)
      if (index !== undefined) focus.set(index)
    },
    clear: () => focus.set(null),
  }
}

const RowFocusContext = createContext<RowLink | undefined>(undefined)

export function RowFocusProvider({
  link,
  children,
}: {
  link: RowLink | undefined
  children: ReactNode
}): ReactElement {
  if (link === undefined) return <>{children}</>
  return <RowFocusContext.Provider value={link}>{children}</RowFocusContext.Provider>
}

/** The row props with the focus item merged in; a row with no item, or no focus, is `base` as it is. */
export function useRowFocusProps(id: string, row: unknown, base: RowProps): FocusedRowProps {
  const link = useContext(RowFocusContext)
  const item = link?.item(id, row)
  if (link === undefined || item === undefined) return base
  return {
    ...base,
    ...((item as MarkedItem)['data-chart-mark'] !== undefined && {
      'data-chart-mark': '' as const,
    }),
    ...((item as MarkedItem)['data-dimmed'] !== undefined && { 'data-dimmed': '' as const }),
    ...(item['data-focused'] !== undefined && { 'data-focused': '' as const }),
    ref: (el) => {
      base.ref?.(el)
      item.ref(el)
    },
    onPointerEnter: item.onPointerEnter,
    onPointerDown: item.onPointerDown,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      base.onFocus?.(event)
      if (event.target === event.currentTarget) link.enter(id, row)
    },
  }
}

/** The body's pointer leave: a mouse leaving the rows clears the focus; a tap's leave keeps it. */
export function useRowFocusLeave(): ((event: PointerEvent<Element>) => void) | undefined {
  const link = useContext(RowFocusContext)
  if (link === undefined) return undefined
  return (event) => {
    if (event.pointerType !== 'touch') link.clear()
  }
}

/** The table root's blur: focus leaving the table entirely clears the focus. */
export function clearOnBlur(
  link: RowLink | undefined,
): ((event: FocusEvent<Element>) => void) | undefined {
  if (link === undefined) return undefined
  return (event) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    link.clear()
  }
}
