import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import type { Range } from '@tanstack/react-virtual'
import { cva } from 'class-variance-authority'
import { Fragment, useRef } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { VirtualItem } from '../core/ports'

/**
 * The `VirtualList` cva table: the scroller. It is a native overflow box with a thin scrollbar in
 * the line token; the caller bounds its height (`max-h-96`, or a flex parent) and the rows scroll
 * inside it.
 *
 * @example
 * virtualListVariants() // class string for a non-`VirtualList` scroller
 */
export const virtualListVariants = cva(
  'relative min-h-0 min-w-0 overflow-y-auto overscroll-contain [scrollbar-color:var(--vx-line)_transparent] [scrollbar-width:thin]',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const virtualListParts = ['virtual-list'] as const

const DEFAULT_OVERSCAN = 6

export type VirtualListProps = Omit<ComponentProps<'div'>, 'className' | 'children' | 'ref'> & {
  /** Layout and the bound that makes it scroll (`max-h-96`, `flex-1`). */
  className?: string
  /** How many rows there are, windowed or not. */
  count: number
  /**
   * The height of row `index` in px. Rows are positioned by these heights and never measured, so
   * give the real row height (the `h-row` token); a row that differs drifts the scroll length.
   */
  estimateSize(index: number): number
  /** The stable id of row `index` (its record id), never the index: a prepend keeps every row. */
  getItemKey(index: number): string | number
  /** A row that stays rendered however far it scrolls (the focused one). */
  keepIndex?: number | undefined
  /** Rows rendered beyond the viewport on each side. Defaults to 6. */
  overscan?: number | undefined
  /**
   * What fills the space of the rows that are not rendered: `div` (the default) for a list of
   * blocks, `tr` for table rows, which wraps the rows in a `<table><tbody>`.
   */
  spacer?: 'div' | 'tr' | undefined
  /** The column count a `tr` spacer spans. Only read with `spacer="tr"`. */
  columns?: number | undefined
  /** A `<thead>` for `spacer="tr"`, kept inside the scroller so its columns line up with the rows. */
  head?: ReactNode
  /** Called once per rendered row with that row alone; the list keys each call by `getItemKey`. */
  children(items: readonly VirtualItem[], totalSize: number): ReactNode
}

/** The rendered range plus the kept row, in index order. */
const withKept =
  (keepIndex: number | undefined, count: number) =>
  (range: Range): number[] => {
    const indexes = defaultRangeExtractor(range)
    if (keepIndex === undefined || keepIndex < 0 || keepIndex >= count) return indexes
    if (indexes.includes(keepIndex)) return indexes
    return [...indexes, keepIndex].toSorted((a, b) => a - b)
  }

/**
 * A windowed list on `@tanstack/react-virtual` (the one primitive that needs the peer). Only the
 * rows near the viewport are in the DOM, each keyed by `getItemKey` so a prepend keeps its row and
 * its focus; `keepIndex` holds one row mounted wherever the scroll is. The space of the rows left
 * out is a spacer, a `div` or (with `spacer="tr"`) a table row, so the rows stay real siblings.
 * `children` is called once per rendered row with `[item]`. Works with no provider; assignable to
 * the `VirtualLike` port of `src/core/ports.ts`.
 *
 * @example
 * <VirtualList className="max-h-96" count={rows.length} estimateSize={() => 32}
 *   getItemKey={(i) => rows[i].id} keepIndex={focusedIndex}>
 *   {([item]) => <Row row={rows[item.index]} />}
 * </VirtualList>
 */
export function VirtualList({
  className,
  count,
  estimateSize,
  getItemKey,
  keepIndex,
  overscan = DEFAULT_OVERSCAN,
  spacer = 'div',
  columns = 1,
  head,
  children,
  ...props
}: VirtualListProps): ReactElement {
  const scroller = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- the rows read the virtualizer in this render and nothing memoized receives it
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scroller.current,
    estimateSize,
    getItemKey,
    overscan,
    rangeExtractor: withKept(keepIndex, count),
  })
  const total = virtualizer.getTotalSize()
  const items: VirtualItem[] = virtualizer.getVirtualItems().map(({ index, key, start, size }) => ({
    index,
    key: typeof key === 'bigint' ? Number(key) : key,
    start,
    size,
  }))

  const rows: ReactNode[] = []
  let cursor = 0
  for (const item of items) {
    if (item.start > cursor)
      rows.push(gap(spacer, `gap-before-${String(item.key)}`, item.start - cursor, columns))
    rows.push(<Fragment key={item.key}>{children([item], total)}</Fragment>)
    cursor = item.start + item.size
  }
  if (total > cursor) rows.push(gap(spacer, 'gap-end', total - cursor, columns))

  return (
    <div
      {...props}
      ref={scroller}
      data-slot="virtual-list"
      className={cn(virtualListVariants(), className)}
    >
      {spacer === 'tr' ? (
        <table className="w-full">
          {head}
          <tbody>{rows}</tbody>
        </table>
      ) : (
        rows
      )}
    </div>
  )
}

function gap(kind: 'div' | 'tr', key: string, height: number, columns: number): ReactElement {
  // theme-allow hidden-inline-style — the height is per-render window data, not a style choice
  const style = { height }
  if (kind === 'tr') {
    return (
      <tr key={key} aria-hidden="true" style={style}>
        {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- an aria-hidden spacer cell has no content */}
        <td colSpan={columns} className="p-0" />
      </tr>
    )
  }
  // theme-allow hidden-inline-style — the height is per-render window data, not a style choice
  return <div key={key} aria-hidden="true" style={style} />
}
