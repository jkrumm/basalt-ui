/**
 * The table head (docs/v3/concepts/data-table.md sections 4 and 6): one header row of explicit
 * `columnheader` cells inside the scroller, so the sticky head needs no measurement (I13). Every
 * header carries its `aria-colindex`, a sortable one its `aria-sort`, and a kind's alignment,
 * priority and pin go out as `data-*` for the tier CSS.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement } from 'react'
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
import { RowNumberHead } from './row-number'
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

/** The name a column is read by: its header, or its id when the header is empty. */
export function columnName(spec: Pick<KindSpec<never>, 'header' | 'id'>): string {
  return spec.header === '' ? spec.id : spec.header
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
    // The column is in the detail without asking for it (its kind's default, or its slot was full): no phone card shows it, and `shot detect` names it.
    'data-card-left':
      planned.place === 'detail' && detailListed && !planned.cardDetail ? '' : undefined,
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

/** `data-pin-edge` on the cells of the last start-pinned column: the one that casts the scroll shadow. */
export function pinEdge(planned: PlannedColumn & { pinEdge?: boolean }): {
  'data-pin-edge'?: ''
} {
  return planned.pinEdge === true ? { 'data-pin-edge': '' } : {}
}

/** One arrow press moves a column edge this far; with Shift, `RESIZE_STEP_WIDE_PX`. */
export const RESIZE_STEP_PX = 8
export const RESIZE_STEP_WIDE_PX = 40

/**
 * The resize handle on a header's end edge: a focusable separator whose value is the column's width.
 * A drag previews the width and writes it to the view on release; Left and Right move the edge by
 * 8 px (Shift 40), Home and End go to the kind's minimum and the maximum, Enter and a double-click
 * return the column to its kind's width. In a right-to-left table the edge moves the other way.
 */
/** The width the header cell of a handle is drawn at, or `fallback` where it has no box (a hidden head). */
function drawnWidth(handle: HTMLElement, fallback: number): number {
  const cell = handle.closest('th')
  const width = cell === null ? 0 : Math.round(cell.getBoundingClientRect().width)
  return width > 0 ? width : fallback
}

function ResizeHandle<T>({
  model,
  spec,
}: {
  model: TableModel<T>
  spec: KindSpec<T>
}): ReactElement {
  const t = useMessages(table)
  const { px: planned, min, max } = model.widthOf(spec.id)
  const stored = model.state.display.widths?.[spec.id]
  const resized = stored !== undefined
  const drag = useRef<{ x: number; px: number; sign: 1 | -1; moved: boolean } | null>(null)
  const [active, setActive] = useState(false)
  // A flexible column is drawn wider than its planned floor: an edge moves from the width on screen,
  // read from the header cell when the handle is focused or pressed, never measured to lay out.
  const [drawn, setDrawn] = useState<number | null>(null)
  const widthOn = (handle: HTMLElement): number => (resized ? planned : drawnWidth(handle, planned))
  // An unresized column reads the width the plan draws, after every layout that can move it: a reset
  // from here or the column menu, a preview, a cancelled drag.
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const handle = ref.current
    if (handle !== null && stored === undefined) setDrawn(drawnWidth(handle, planned))
  }, [stored, planned])
  const px = resized ? planned : (drawn ?? planned)
  const widthAt = (event: PointerEvent<HTMLElement>): number | null => {
    const start = drag.current
    if (start === null) return null
    const delta = (event.clientX - start.x) * start.sign
    if (Math.abs(delta) >= 1) start.moved = true
    return start.px + delta
  }
  const end = (event: PointerEvent<HTMLElement>, commit: boolean): void => {
    const next = widthAt(event)
    const moved = drag.current?.moved === true
    drag.current = null
    setActive(false)
    if (commit && moved && next !== null) model.setWidth(spec.id, next)
    else model.previewWidth(spec.id, null)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const px = widthOn(event.currentTarget)
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const step = (event.shiftKey ? RESIZE_STEP_WIDE_PX : RESIZE_STEP_PX) * (rtl ? -1 : 1)
    const next =
      event.key === 'ArrowRight'
        ? px + step
        : event.key === 'ArrowLeft'
          ? px - step
          : event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : event.key === 'Enter'
                ? undefined
                : null
    if (next === null) return
    event.preventDefault()
    event.stopPropagation()
    model.setWidth(spec.id, next)
  }
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- a focusable separator is the WAI-ARIA window-splitter pattern: its value moves with the keys
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('table.resizeColumn', columnName(spec))}
      aria-valuenow={Math.round(px)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onFocus={(event) => setDrawn(widthOn(event.currentTarget))}
      data-slot="table-resize"
      data-active={active ? '' : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
        drag.current = {
          x: event.clientX,
          px: widthOn(event.currentTarget),
          sign: rtl ? -1 : 1,
          moved: false,
        }
        setActive(true)
      }}
      onPointerMove={(event) => {
        const next = widthAt(event)
        if (next !== null && drag.current?.moved === true) model.previewWidth(spec.id, next)
      }}
      onPointerUp={(event) => end(event, true)}
      onPointerCancel={(event) => end(event, false)}
      onDoubleClick={(event) => {
        event.stopPropagation()
        model.setWidth(spec.id, undefined)
      }}
      onKeyDown={onKeyDown}
    />
  )
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
  const offset = model.lead.cols + 1

  return (
    <TableHeader role="rowgroup">
      <TableRow role="row" {...(rowIndex !== undefined && { 'aria-rowindex': rowIndex })}>
        <TriStateHeader model={model} />
        <RowNumberHead model={model} />
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
              {...pinEdge(planned)}
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
              {model.resizable(spec.id) && <ResizeHandle model={model} spec={spec} />}
            </TableHead>
          )
        })}
      </TableRow>
    </TableHeader>
  )
}
