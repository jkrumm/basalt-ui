/**
 * The table head (docs/v3/concepts/data-table.md sections 4 and 6): one header row of explicit
 * `columnheader` cells inside the scroller, so the sticky head needs no measurement (I13). Every
 * header carries its `aria-colindex`, a sortable one its `aria-sort`, and a kind's alignment,
 * priority and pin go out as `data-*` for the tier CSS.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import { useId, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button, Pressable } from '../../ui/button'
import { Popover, PopoverContent } from '../../ui/popover'
import { TableHead, TableHeader, TableRow } from '../../ui/table'
import type { DataTableInstance } from '../contract'
import { cellAttributes } from '../core/kinds-cells'
import type { KindSpec } from '../core/kinds-spec'
import type { PlannedColumn } from '../core/plan'
import { isUsable } from '../core/filters'
import { modelOf } from '../use-data-table'
import type { SortDirection, TableModel } from '../use-data-table'
import { CategoryOrder } from './category-order'
import { ColumnActionsMenu } from './column-actions'
import { useFilterText } from './filter-text'
import { FilterEditor } from './toolbar-editor'
import { rankableSpecs } from './toolbar-filters'
import type { FilterableSpec } from './toolbar-filters'
import { TriStateHeader } from './tri-state-header'

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
export function tierAttributes(
  planned: PlannedColumn,
  detailListed: boolean,
): Record<string, string | undefined> {
  return {
    'data-priority': planned.priority === null ? undefined : String(planned.priority),
    'data-pin': planned.pin ?? undefined,
    'data-identity': planned.identity ? '' : undefined,
    // A column left off the phone card: hidden by the display state, or placed in the detail (a meter,
    // a spark, or the overflow of the card's six meta values), which the row's derived detail sheet
    // lists; a custom `detail` render lists only what it writes, so there the column stays on the card.
    'data-card':
      planned.place === 'hidden' || (planned.place === 'detail' && detailListed)
        ? 'hidden'
        : undefined,
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

function FunnelGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
      <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" />
    </svg>
  )
}

/**
 * One header's label, sort button and column door: the ▾ menu, the filter mark of a filtered
 * column, and the popover both open, anchored to the header so the editor sits under the column it
 * filters. Focus returns to the ▾ trigger when the popover closes.
 */
function HeaderContent<T>({
  instance,
  model,
  spec,
  numeric,
  direction,
}: {
  instance: DataTableInstance<T>
  model: TableModel<T>
  spec: KindSpec<T>
  numeric: boolean
  direction: SortDirection
}): ReactElement {
  const t = useMessages(table)
  const textOf = useFilterText()
  const titleId = useId()
  const anchor = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [panel, setPanel] = useState<'filter' | 'order' | null>(null)
  const sortable = spec.sort !== null
  const filterable = spec.filter !== null
  const rankable = rankableSpecs([spec]).length > 0
  const active = model.state.request.filters.find(
    (f) => f.id === spec.id && isUsable(f.op, f.values),
  )
  return (
    <div
      ref={anchor}
      className={cn(
        'flex min-w-0 items-center gap-1',
        numeric && 'flex-row-reverse',
        spec.align === 'center' && 'justify-center',
      )}
    >
      {sortable ? (
        <Pressable
          data-slot="table-sort"
          className={cn(
            'group/sort inline-flex min-h-6 min-w-0 items-center gap-1 pointer-coarse:after:-inset-x-1',
            numeric && 'flex-row-reverse',
          )}
          onClick={() => model.toggleSort(spec.id)}
        >
          <span className="truncate" title={spec.header}>
            {spec.header}
          </span>
          <SortMark direction={direction} />
        </Pressable>
      ) : (
        <span className="min-w-0 truncate" title={spec.header}>
          {spec.header}
        </span>
      )}
      {active !== undefined && filterable && (
        <Button
          data-slot="table-filter-mark"
          size="sm"
          shape="icon"
          variant="ghost"
          aria-label={t('table.filterMark', spec.header, textOf(spec, active).value)}
          className="shrink-0 text-brand"
          onClick={() => setPanel('filter')}
        >
          <FunnelGlyph />
        </Button>
      )}
      {/* beside the sort button, never over it: a narrow column truncates the label and keeps both targets; on touch the hit area grows away from the sort button */}
      <ColumnActionsMenu
        table={instance}
        column={spec.id}
        triggerRef={trigger}
        {...(filterable && { onFilter: () => setPanel('filter') })}
        {...(rankable && { onOrder: () => setPanel('order') })}
        className={cn(
          'shrink-0 opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100',
          panel !== null && 'opacity-100',
          numeric
            ? 'pointer-coarse:after:inset-x-auto pointer-coarse:after:right-0 pointer-coarse:after:w-11'
            : 'pointer-coarse:after:inset-x-auto pointer-coarse:after:left-0 pointer-coarse:after:w-11',
        )}
      />
      <Popover
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null)
        }}
      >
        <PopoverContent
          anchor={anchor}
          align={numeric ? 'end' : 'start'}
          finalFocus={trigger}
          aria-labelledby={titleId}
          {...(spec.filter === 'range' && panel === 'filter' && { className: 'w-80' })}
        >
          {panel === 'order' ? (
            <CategoryOrder model={model} spec={spec} titleId={titleId} />
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              <span id={titleId} className="font-medium">
                {t('table.filterOf', spec.header)}
              </span>
              {filterable && (
                <FilterEditor model={model} spec={spec as KindSpec<T> & FilterableSpec} />
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
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
  rowIndex,
}: {
  table: DataTableInstance<T>
  /** `aria-rowindex` in a virtual window, where the head is a row of a longer table. */
  rowIndex?: number
}): ReactElement {
  const model = modelOf(instance)
  const actionsLabel = useActionsLabel()
  const offset = model.selection === undefined ? 1 : 2

  return (
    <TableHeader role="rowgroup">
      <TableRow role="row" {...(rowIndex !== undefined && { 'aria-rowindex': rowIndex })}>
        <TriStateHeader model={model} />
        {visibleColumns(model.specs, model.plan.columns).map(({ spec, planned }, index) => {
          const direction = model.sortOf(spec.id)
          const sortable = spec.sort !== null
          const { numeric, className } = alignProps(spec)
          return (
            <TableHead
              key={spec.id}
              role="columnheader"
              aria-colindex={index + offset}
              {...(sortable && { 'aria-sort': ARIA_SORT[direction], 'aria-label': spec.header })}
              {...cellAttributes(spec)}
              {...tierAttributes(planned, model.detailListed)}
              numeric={numeric}
              className={cn('group/head', className)}
            >
              {spec.kind === 'actions' ? (
                <span className="sr-only">{spec.header === '' ? actionsLabel : spec.header}</span>
              ) : (
                <HeaderContent
                  instance={instance}
                  model={model}
                  spec={spec}
                  numeric={numeric}
                  direction={direction}
                />
              )}
            </TableHead>
          )
        })}
      </TableRow>
    </TableHeader>
  )
}
