/**
 * A table's link to a chart's shared focus (`DataTable focus`). `DataTable` provides it; a data row
 * reads it, so `DataRow` stays one markup with or without a focus. A row maps to its focus item by
 * `getRowId`, never by position, so a sort or a filter keeps the link.
 */
import { createContext, useContext } from 'react'
import type { FocusEvent, PointerEvent, ReactElement, ReactNode } from 'react'
import type { ListFocus } from '../../core/ports'
import type { RowProps } from '../core/keyboard'

type RowFocus = {
  focus: ListFocus<unknown>
  indexOf: (id: string) => number | undefined
}

export type FocusedRowProps = RowProps & {
  'data-focused'?: ''
  onPointerEnter?: () => void
  onPointerDown?: () => void
}

const RowFocusContext = createContext<RowFocus | undefined>(undefined)

export function RowFocusProvider<T>({
  focus,
  getRowId,
  children,
}: {
  focus: ListFocus<T> | undefined
  getRowId: (row: T) => string
  children: ReactNode
}): ReactElement {
  if (focus === undefined) return <>{children}</>
  const ids = new Map<string, number>()
  focus.items.forEach((item, i) => ids.set(getRowId(item), i))
  const value: RowFocus = { focus: focus as ListFocus<unknown>, indexOf: (id) => ids.get(id) }
  return <RowFocusContext.Provider value={value}>{children}</RowFocusContext.Provider>
}

/** The row props with the focus item merged in; a row with no item, or no focus, is `base` as it is. */
export function useRowFocusProps(id: string, base: RowProps): FocusedRowProps {
  const link = useContext(RowFocusContext)
  const index = link?.indexOf(id)
  if (link === undefined || index === undefined) return base
  const { focus } = link
  const item = focus.item(index)
  return {
    ...base,
    ...(item['data-focused'] !== undefined && { 'data-focused': '' as const }),
    ref: (el) => {
      base.ref?.(el)
      item.ref(el)
    },
    onPointerEnter: item.onPointerEnter,
    onPointerDown: item.onPointerDown,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      base.onFocus?.(event)
      if (event.target === event.currentTarget) focus.set(index)
    },
  }
}

/** The body's pointer leave: a mouse leaving the rows clears the focus; a tap's leave keeps it. */
export function useRowFocusLeave(): ((event: PointerEvent<Element>) => void) | undefined {
  const link = useContext(RowFocusContext)
  if (link === undefined) return undefined
  return (event) => {
    if (event.pointerType !== 'touch') link.focus.set(null)
  }
}

/** The table root's blur: focus leaving the table entirely clears the focus. */
export function clearOnBlur(
  focus: ListFocus<unknown> | undefined,
): ((event: FocusEvent<Element>) => void) | undefined {
  if (focus === undefined) return undefined
  return (event) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    focus.set(null)
  }
}
