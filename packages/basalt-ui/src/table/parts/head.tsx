/**
 * The table head (docs/v3/concepts/data-table.md sections 4 and 6): one header row of explicit
 * `columnheader` cells inside the scroller, so the sticky head needs no measurement (I13). Every
 * header carries its `aria-colindex`, a sortable one its `aria-sort`, and a kind's alignment,
 * priority and pin go out as `data-*` for the tier CSS.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import { useId, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
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
export function visibleColumns<T, C extends PlannedColumn>(
  specs: readonly KindSpec<T>[],
  planned: readonly C[],
): { spec: KindSpec<T>; planned: C }[] {
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
    'data-col': planned.id,
    'data-priority': planned.priority === null ? undefined : String(planned.priority),
    'data-pin': planned.pin ?? undefined,
    'data-identity': planned.identity ? '' : undefined,
    // A column `phone: 'columns'` leaves off the phone row (the tier CSS reads it only there).
    'data-phone-drop': planned.phoneKeep ? undefined : '',
    // A column left off the phone card: hidden by the display state, or placed in the detail (a meter,
    // a spark, or the overflow of the card's six meta values), which the row's derived detail sheet
    // lists; a custom `detail` render lists only what it writes, so there the column (the overflow
    // past six meta values included) stays on the card rather than become unreachable.
    'data-card':
      planned.place === 'hidden' || (planned.place === 'detail' && detailListed)
        ? 'hidden'
        : undefined,
    // The column named no card slot and fell to the detail: no phone card shows it (`shot detect` names it).
    'data-card-left':
      planned.place === 'detail' && detailListed && !planned.cardNamed ? '' : undefined,
  }
}

/**
 * The inline offset of a start-pinned cell (`--table-pin-at`): the tick column and the pinned columns
 * before it. The grid look reads it, so several pinned columns stack instead of overlapping.
 */
export function pinStyle(planned: PlannedColumn & { pinAt?: number }): CSSProperties | undefined {
  if (planned.pin !== 'start' || planned.pinAt === undefined) return undefined
  return { ['--table-pin-at' as string]: `${planned.pinAt}px` }
}

const ARIA_SORT: Record<SortDirection, 'ascending' | 'descending' | 'none'> = {
  asc: 'ascending',
  desc: 'descending',
  none: 'none',
}

/**
 * The sort mark, drawn at rest so a reader sees the column sorts: faint ink until it sorts, brand
 * ink once it does. Its box never changes, so the header keeps its width in every state.
 */
function SortMark({ direction }: { direction: SortDirection }): ReactElement {
  return (
    <svg
      data-slot="table-sort-mark"
      viewBox="0 0 8 12"
      className={cn(
        'size-2 shrink-0',
        direction === 'none'
          ? 'text-muted-foreground opacity-60 group-hover/sort:opacity-100'
          : 'text-brand',
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

/** The header's label: the column's icon, when it declares one, then its text. */
function HeaderLabel<T>({ spec }: { spec: KindSpec<T> }): ReactElement {
  const Icon = spec.headerIcon
  const text = (
    <span className="min-w-0 truncate" title={spec.header}>
      {spec.header}
    </span>
  )
  if (Icon === undefined) return text
  return (
    <span data-slot="table-head-label" className="inline-flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden="true" size={14} className="shrink-0 text-muted-foreground" />
      {text}
    </span>
  )
}

/** The ink of a header control: faint at rest, brand while it holds state. */
const restInk = 'text-muted-foreground hover:text-foreground data-popup-open:text-foreground'

/**
 * One header's controls, in one fixed order: the label with its sort mark (a sortable column), the
 * filter button (a filterable column), the ▾ column menu. Every control shows at rest on a fine
 * pointer, so a reader sees what the column does without hovering it; on a coarse pointer the menu
 * stays the door and the filter button shows only while the column is filtered. The filter button
 * and the menu's `Filter...` open one popover, anchored to the header so the editor sits under the
 * column it filters; focus returns to the control that opened it.
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
  const returnTo = useRef<HTMLButtonElement | null>(null)
  const [panel, setPanel] = useState<'filter' | 'order' | null>(null)
  const openFrom = (from: HTMLButtonElement | null, next: 'filter' | 'order'): void => {
    returnTo.current = from
    setPanel(next)
  }
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
          <HeaderLabel spec={spec} />
          <SortMark direction={direction} />
        </Pressable>
      ) : (
        <HeaderLabel spec={spec} />
      )}
      {filterable && (
        <Button
          data-active={active === undefined ? undefined : ''}
          size="sm"
          shape="icon"
          variant="ghost"
          aria-label={
            active === undefined
              ? t('table.filterOf', spec.header)
              : t('table.filterMark', spec.header, textOf(spec, active).value)
          }
          aria-haspopup="dialog"
          aria-expanded={panel === 'filter'}
          className={cn(
            'shrink-0',
            active === undefined
              ? cn(restInk, 'pointer-coarse:hidden', panel === 'filter' && 'text-foreground')
              : 'text-brand',
          )}
          onClick={(event) => openFrom(event.currentTarget, 'filter')}
        >
          <FunnelGlyph />
        </Button>
      )}
      {/* beside the sort button, never over it: a narrow column truncates the label and keeps both targets; on touch the hit area grows away from the sort button */}
      <ColumnActionsMenu
        table={instance}
        column={spec.id}
        triggerRef={trigger}
        {...(filterable && { onFilter: () => openFrom(trigger.current, 'filter') })}
        {...(rankable && { onOrder: () => openFrom(trigger.current, 'order') })}
        className={cn(
          'shrink-0',
          restInk,
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
          finalFocus={returnTo}
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
              style={pinStyle(planned)}
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
