/**
 * The table head (docs/v3/concepts/data-table.md sections 4 and 6): one header row of explicit
 * `columnheader` cells inside the scroller, so the sticky head needs no measurement (I13). Every
 * header carries its `aria-colindex`, a sortable one its `aria-sort`, and a kind's alignment,
 * priority and pin go out as `data-*` for the tier CSS.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Checkbox } from '../../ui/checkbox'
import { Pressable } from '../../ui/button'
import { TableHead, TableHeader, TableRow } from '../../ui/table'
import type { DataTableInstance } from '../contract'
import { cellAttributes } from '../core/kinds-cells'
import type { KindSpec } from '../core/kinds-spec'
import type { PlannedColumn } from '../core/plan'
import { modelOf } from '../use-data-table'
import type { SortDirection } from '../use-data-table'

/** The accessible name of the row-actions column and of each row's trigger. */
export function useActionsLabel(): string {
  return useMessages(table)('table.actions')
}

/** The columns the table draws, in order: the plan's visible ones with their spec. */
export function visibleColumns<T>(
  specs: readonly KindSpec<T>[],
  planned: readonly PlannedColumn[],
): { spec: KindSpec<T>; planned: PlannedColumn }[] {
  return planned.flatMap((p, index) => {
    const spec = specs[index]
    return p.visible && spec !== undefined ? [{ spec, planned: p }] : []
  })
}

/** Alignment and numerals of a kind as the `ui/table` cell props. */
export function alignProps(spec: Pick<KindSpec<never>, 'align' | 'numerals'>): {
  numeric: boolean
  className: string
} {
  return {
    numeric: spec.align === 'end',
    className: cn(
      spec.align === 'center' && 'text-center',
      spec.align === 'start' && spec.numerals === 'tabular' && 'tabular-nums',
    ),
  }
}

/** The `data-*` the tier CSS reads off a header or body cell. */
export function tierAttributes(planned: PlannedColumn): Record<string, string | undefined> {
  return {
    'data-priority': planned.priority === null ? undefined : String(planned.priority),
    'data-pin': planned.pin ?? undefined,
    'data-identity': planned.identity ? '' : undefined,
  }
}

const ARIA_SORT: Record<SortDirection, 'ascending' | 'descending' | 'none'> = {
  asc: 'ascending',
  desc: 'descending',
  none: 'none',
}

function SortMark({ direction }: { direction: SortDirection }): ReactElement {
  return (
    <svg
      viewBox="0 0 8 12"
      className={cn(
        'size-2 shrink-0',
        direction === 'none' && 'opacity-0 group-hover/sort:opacity-40',
      )}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 0 8 5H0z" className={direction === 'desc' ? 'opacity-30' : undefined} />
      <path d="M4 12 0 7h8z" className={direction === 'asc' ? 'opacity-30' : undefined} />
    </svg>
  )
}

/**
 * The header row of a table. Pass the instance `useDataTable` returned; `DataTable` composes it.
 *
 * @useWhen a bespoke layout draws the table's head itself, inside the `DataTable` scroller
 * @neverWhen the full `DataTable` fits (it already renders the head)
 *
 * @example
 * <DataTableHead table={t} />
 */
export function DataTableHead<T>({
  table: instance,
}: {
  table: DataTableInstance<T>
}): ReactElement {
  const model = modelOf(instance)
  const t = useMessages(table)
  const actionsLabel = useActionsLabel()
  const { selection, rows } = model
  const ids = rows.map((row) => row.id)
  const ticked = ids.filter((id) => selection?.isSelected(id)).length
  const offset = selection === undefined ? 1 : 2

  return (
    <TableHeader role="rowgroup">
      <TableRow role="row">
        {selection !== undefined && (
          <TableHead
            role="columnheader"
            aria-colindex={1}
            data-slot="table-head"
            data-kind="select"
            className="w-10"
          >
            <Checkbox
              aria-label={t('table.selectAll')}
              checked={ids.length > 0 && ticked === ids.length}
              indeterminate={ticked > 0 && ticked < ids.length}
              disabled={ids.length === 0}
              onCheckedChange={() => selection.togglePage(ids)}
            />
          </TableHead>
        )}
        {visibleColumns(model.specs, model.plan.columns).map(({ spec, planned }, index) => {
          const direction = model.sortOf(spec.id)
          const sortable = spec.sort !== null
          const { numeric, className } = alignProps(spec)
          return (
            <TableHead
              key={spec.id}
              role="columnheader"
              aria-colindex={index + offset}
              {...(sortable && { 'aria-sort': ARIA_SORT[direction] })}
              {...cellAttributes(spec)}
              {...tierAttributes(planned)}
              numeric={numeric}
              className={className}
            >
              {spec.kind === 'actions' ? (
                <span className="sr-only">{spec.header === '' ? actionsLabel : spec.header}</span>
              ) : sortable ? (
                <Pressable
                  data-slot="table-sort"
                  className={cn(
                    'group/sort inline-flex items-center gap-1',
                    numeric && 'flex-row-reverse',
                  )}
                  onClick={() => model.toggleSort(spec.id)}
                >
                  <span>{spec.header}</span>
                  <SortMark direction={direction} />
                </Pressable>
              ) : (
                spec.header
              )}
            </TableHead>
          )
        })}
      </TableRow>
    </TableHeader>
  )
}
