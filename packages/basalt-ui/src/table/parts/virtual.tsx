/**
 * The virtual body (docs/v3/concepts/data-table.md section 3, Virtualization; spike S2). The port
 * `virtual` (`VirtualList` from `ui/virtual-list`, never imported here) owns the scroller and the
 * window; the table hands it the head, the item count and a row renderer, and the rows left out are
 * spacer `<tr>`s in the same `<tbody>`, so the head stays a sticky row of the same table.
 *
 * - Items are keyed by row id (a group row by its value), so a sort moves a row, never remounts it.
 * - The focused row is `keepIndex`: it stays mounted however far the window scrolls, and a sort that
 *   moves it keeps the same node, so focus stays (S2, Chrome).
 * - `aria-rowcount` counts every row of the table (head, body, foot); each mounted row carries its
 *   `aria-rowindex`, so a reader hears "row 4,812 of 10,002" in a window of 30.
 * - One row size: read from the first mounted row and re-read when the table resizes. It is exact
 *   because every row is one line: `DataTable` keeps a windowed table out of the card tier (it
 *   scrolls sideways when narrow) and its cells do not wrap, and a group row has the row height.
 * - A request change (sort, filter, search, page) scrolls back to the first row.
 *
 * The port renders the `<table>` and `<tbody>`; the table hands it their attributes (`tableProps`,
 * `bodyProps`) as markup, so a server render already carries the roles and counts.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, ComponentType, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { DetailHost, VirtualItem, VirtualLike } from '../../core/ports'
import { TableCaption, tableVariants } from '../../ui/table'
import type { TableModel } from '../use-data-table'
import { BodyItemRow, cellEnvOf } from './body'

/** The row height until the first row is measured: `--vx-row-h` at the default density. */
export const FALLBACK_ROW_PX = 40

/** The attributes the table puts on the port's `<table>` and `<tbody>`. */
type HostElementProps<E extends 'table' | 'tbody'> = Omit<
  ComponentProps<E>,
  'className' | 'ref'
> & {
  [name: `data-${string}`]: string | undefined
  className?: string
}

/** What the table passes the port beyond `VirtualLike`; `VirtualList` reads it, a stub ignores it. */
type HostProps = Parameters<VirtualLike>[0] & {
  spacer: 'tr'
  columns: number
  head: ReactNode
  tableProps: HostElementProps<'table'>
  bodyProps: HostElementProps<'tbody'>
  className: string
  role: 'region'
  'aria-label': string
  tabIndex?: 0
  onKeyDown(event: KeyboardEvent<HTMLElement>): void
}

/** The item index the port must keep mounted: the roving stop's row. */
export function keptIndex<T>(model: TableModel<T>): number | undefined {
  const id = model.keyboard.activeId
  if (id === undefined) return undefined
  const index = model.items.findIndex((item) => item.type === 'row' && item.key === id)
  return index === -1 ? undefined : index
}

/** `aria-rowcount`: the head row, every body item and the foot row when there is one. */
export function rowCountOf<T>(model: TableModel<T>, footer: boolean): number {
  return 1 + model.items.length + (footer ? 1 : 0)
}

/**
 * The virtual table: the port as scroller, with the head, the windowed body and the foot.
 *
 * @useWhen `DataTable` gets `virtual` and a bounded `height` (it renders this; apps pass the port)
 * @neverWhen the rows fit a page (use the pager) or the table has no bounded height
 *
 * @example
 * <VirtualTable model={model} virtual={VirtualList} head={head} footer={foot} footerShown />
 */
export function VirtualTable<T>({
  model,
  virtual,
  detail,
  head,
  footer,
  footerShown,
  colcount,
  tabStop,
}: {
  model: TableModel<T>
  virtual: VirtualLike
  /** Where a `detail` activation shows its entry. */
  detail: DetailHost | undefined
  /** The `<colgroup>` and `<thead>`; the caption is added here. */
  head: ReactNode
  /** The `<tfoot>`, or `null`. */
  footer: ReactNode
  footerShown: boolean
  colcount: number
  /** The scroller is a tab stop (no focusable row inside). */
  tabStop: boolean
}): ReactElement {
  const Host = virtual as unknown as ComponentType<HostProps>
  const caption = useRef<HTMLTableCaptionElement | null>(null)
  const [rowPx, setRowPx] = useState(FALLBACK_ROW_PX)
  const scroller = (): HTMLElement | null =>
    caption.current?.closest<HTMLElement>('[data-slot="virtual-list"]') ?? null

  useEffect(() => {
    model.setHost(detail)
  })

  const rowcount = rowCountOf(model, footerShown)
  const busy = model.phase.tag === 'loading'

  // One row size, from the first mounted row, re-read when the table's box changes size.
  useLayoutEffect(() => {
    const tableEl = caption.current?.parentElement
    if (!(tableEl instanceof HTMLTableElement)) return undefined
    const measure = (): void => {
      const row = tableEl.querySelector(':scope > tbody > tr[role="row"]')
      const px = row?.getBoundingClientRect().height ?? 0
      if (px > 0) setRowPx((current) => (Math.abs(current - px) < 0.5 ? current : px))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(tableEl)
    return () => observer.disconnect()
  }, [])

  // A new request is a new result: start at its first row.
  const { request } = model.state
  const seen = useRef(request)
  useEffect(() => {
    if (seen.current === request) return
    seen.current = request
    const el = scroller()
    if (el !== null) el.scrollTop = 0
  })

  const env = cellEnvOf(model)
  const { items } = model
  const kept = keptIndex(model)
  return (
    <Host
      count={items.length}
      estimateSize={() => rowPx}
      getItemKey={(index) => items[index]?.key ?? index}
      {...(kept !== undefined && { keepIndex: kept })}
      spacer="tr"
      columns={colcount}
      tableProps={{
        'data-slot': 'table',
        role: 'table',
        'aria-rowcount': rowcount,
        'aria-colcount': colcount,
        'aria-busy': busy || undefined,
        className: cn(tableVariants(), 'table-fixed'),
      }}
      bodyProps={{ 'data-slot': 'table-body', role: 'rowgroup' }}
      head={
        <>
          <TableCaption ref={caption} className="sr-only">
            {model.label}
          </TableCaption>
          {head}
          {footer}
        </>
      }
      className="min-h-0 flex-1"
      role="region"
      aria-label={model.label}
      {...(tabStop && { tabIndex: 0 as const })}
      onKeyDown={model.keyboard.rootProps.onKeyDown}
    >
      {(window: readonly VirtualItem[]) =>
        window.map((entry) => {
          const item = items[entry.index]
          if (item === undefined) return null
          return (
            <BodyItemRow
              key={item.key}
              model={model}
              item={item}
              env={env}
              rowIndex={entry.index + 2}
            />
          )
        })
      }
    </Host>
  )
}
