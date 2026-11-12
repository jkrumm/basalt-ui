/**
 * The table pager (docs/v3/concepts/data-table.md sections 6 and 8; I21): previous and next, the
 * range label and the page-size select. The current page size is always an option, so a size a URL
 * carried that the list does not know still shows; a range is never printed for a page with no rows
 * and "of N" never without an N. The range label is hidden by CSS at the card tier, not removed.
 * A cursor table gets one `Load more` instead of pages.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { NativeSelect } from '../../ui/select'
import type { DataTableInstance } from '../contract'
import { describeRange, pageCount } from '../core/state'
import { modelOf } from '../use-data-table'

const PAGE_SIZES = [10, 25, 50, 100] as const

/** The sizes offered: the list plus the current one, ascending, so the current size is never absent. */
export function pageSizeOptions(current: number): number[] {
  return [...new Set<number>([...PAGE_SIZES, current])].toSorted((a, b) => a - b)
}

function Chevron({ flip }: { flip?: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={flip ? 'size-4 rotate-180' : 'size-4'}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The pager of a table. Pass the instance `useDataTable` returned; `DataTable` composes it when
 * `pager` is not `'none'`.
 *
 * @useWhen a bespoke layout draws the pager apart from the `DataTable` scroller
 * @neverWhen the full `DataTable` fits (it already renders the pager)
 *
 * @example
 * <TablePager table={t} />
 */
export function TablePager<T>({
  table: instance,
}: {
  table: DataTableInstance<T>
}): ReactElement | null {
  const model = modelOf(instance)
  const t = useMessages(table)
  const { request, setRequest } = model.state

  if (model.pager === 'none') return null
  if (model.pager === 'more' || model.cursor !== undefined) {
    if (model.cursor === undefined) return null
    const { hasNext, fetchNext } = model.cursor
    return (
      <nav
        aria-label={t('table.pager')}
        data-slot="table-pager"
        className="flex justify-center py-2"
      >
        <Button size="sm" disabled={!hasNext} onClick={fetchNext}>
          {t('table.loadMore')}
        </Button>
      </nav>
    )
  }

  const last = pageCount(model.count, request.pageSize)
  const inRange = last === undefined || request.page <= last
  const onPage = inRange && model.phase.tag !== 'loading' ? model.rows.length : 0
  const range = describeRange(request, model.count, onPage)
  const label =
    onPage === 0
      ? t('table.rowRangeNone')
      : // `describeRange` names the key (state.ts holds the literal); the unknown form ignores the numbers
        (t as (key: string, ...args: number[]) => string)(
          range.key,
          range.from,
          range.to,
          range.total ?? 0,
        )

  return (
    <nav
      aria-label={t('table.pager')}
      data-slot="table-pager"
      className="flex items-center justify-between gap-3 py-2 text-sm text-muted-foreground"
    >
      <span data-slot="table-pager-range" className="min-w-0 truncate">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {/* theme-allow raw-selection-control — the page size is table state, not a page filter */}
        <NativeSelect
          size="sm"
          aria-label={t('table.pageSize')}
          value={String(request.pageSize)}
          onChange={(event) => setRequest({ pageSize: Number(event.target.value) })}
          options={pageSizeOptions(request.pageSize).map((n) => ({
            value: String(n),
            label: String(n),
          }))}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label={t('table.pagePrev')}
          disabled={request.page <= 1}
          onClick={() => setRequest({ page: request.page - 1 })}
        >
          <Chevron flip />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t('table.pageNext')}
          disabled={last === undefined ? onPage < request.pageSize : request.page >= last}
          onClick={() => setRequest({ page: request.page + 1 })}
        >
          <Chevron />
        </Button>
      </div>
    </nav>
  )
}
