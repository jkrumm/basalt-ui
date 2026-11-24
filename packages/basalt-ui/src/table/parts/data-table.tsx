/**
 * `DataTable`: the table composite (docs/v3/concepts/data-table.md section 4). One native table in
 * a named, native scroller, one DOM at every phase. This Issue renders the full tier; the tiers,
 * the pager and the toolbar compose in later (they edit this file, not the parts).
 *
 * Law: the root takes no `className`, `style` or padding; `data-phase` on the root is the one
 * place CSS and tests read the phase; the scroller is a plain `overflow` node (a ScrollArea
 * viewport broke the sticky head, I13) and takes a tab stop only when it scrolls and holds no
 * focusable row, decided from props alone.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import { Suspense, lazy, useContext, useLayoutEffect } from 'react'
import type { ComponentType, CSSProperties, ReactElement } from 'react'
import type { DetailHost, DragLike, VirtualLike } from '../../core/ports'
import { useDetailHost } from './detail-sheet'
import { cn } from '../../core/cn'
import { FrameArmContext } from '../../core/frame-arm'
import type { FrameArm } from '../../core/frame-arm'
import { useRowsShown } from '../../core/rows-shown'
import type { DataTableProps, TableLayoutSpec, TableLayoutView } from '../contract'
import type { PlannedColumn } from '../core/plan'
import { TableBody, TableCaption, Table } from '../../ui/table'
import { bodyDensity, DataTableBody } from './body'
import { BulkBar } from './bulk-bar'
import { DataTableFooter, hasFooter } from './footer'
import { VirtualTable } from './virtual'
import { DataTableHead, visibleColumns } from './head'
import { LayoutPhase } from '../layouts/layout-phase'
import { FrameArmRow } from './phases'
import { RowFocusProvider, clearOnBlur, rowLinkOf } from './row-focus'
import { TablePager } from './pager'
import {
  markScrolled,
  revealFocus,
  scrollMinWidth,
  tierAttributesOf,
  warnWithoutTierSheet,
} from './tiers'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'

type BoardProps = {
  model: TableModel<unknown>
  drag: DragLike | undefined
  virtual: VirtualLike | undefined
}

/** The board and the gallery load on first use: a table-only page never fetches `./cards`' board. */
const LazyBoard = lazy(async (): Promise<{ default: ComponentType<BoardProps> }> => ({
  default: (await import('../layouts/board-layout')).BoardLayout,
}))
const LazyGallery = lazy(
  async (): Promise<{ default: ComponentType<{ model: TableModel<unknown> }> }> => ({
    default: (await import('../layouts/gallery-layout')).GalleryLayout,
  }),
)

/**
 * An app's layout, drawn as a component of its own so the hooks its `render` calls belong to it; a
 * switch to another layout unmounts it.
 */
function AppLayout<T>({
  render,
  view,
}: {
  render: TableLayoutSpec<T>['render']
  view: TableLayoutView<T>
}): ReactElement {
  return <>{render(view)}</>
}

/** What an app's layout reads of the model: the shown rows and the table's own way to open one. */
function layoutView<T>(
  model: TableModel<T>,
  table: DataTableProps<T>['table'],
): TableLayoutView<T> {
  return {
    rows: model.rows.map((row) => row.original),
    rowId: model.getRowId,
    open: (row) => model.activate(model.getRowId(row)),
    activeId: model.activeId,
    table,
  }
}

/** The render of the view's layout when it is an app's, else `undefined`. */
const appRenderOf = <T,>(model: TableModel<T>): TableLayoutSpec<T>['render'] | undefined =>
  model.layouts.find((layout) => layout.id === model.layout)?.render

/**
 * A ready board, gallery or app layout: the bulk bar, the layout, the pager and the detail host an
 * activation shows into, around the same model the table reads.
 */
function CardLayout<T>({
  table,
  detail,
  drag,
  virtual,
}: {
  table: DataTableProps<T>['table']
  detail: DetailHost | undefined
  drag: DragLike | undefined
  virtual: VirtualLike | undefined
}): ReactElement {
  const model = modelOf(table)
  const sheet = useDetailHost(model, detail)
  const any = model as unknown as TableModel<unknown>
  const render = appRenderOf(model)
  return (
    <div
      data-slot="table-root"
      data-phase={model.phase.tag}
      data-layout={model.layout}
      className="flex w-full max-w-full min-w-0 flex-col"
    >
      <BulkBar table={table} />
      <Suspense fallback={null}>
        {render !== undefined ? (
          <AppLayout key={model.layout} render={render} view={layoutView(model, table)} />
        ) : model.layout === 'board' ? (
          <LazyBoard model={any} drag={drag} virtual={virtual} />
        ) : (
          <LazyGallery model={any} />
        )}
      </Suspense>
      <TablePager table={table} />
      {sheet}
    </div>
  )
}

/** A flexible `entity` column takes this many shares of the free width, another text-like one takes 1. */
const ENTITY_SHARES = 2

/** The shares of the free width a flexible column of `kind` takes. */
function weight(kind: string): number {
  return kind === 'entity' ? ENTITY_SHARES : 1
}

/**
 * `<col>` widths of the plan, one set at every phase. A figure, a date or a mark keeps its planned px.
 * A flexible (text-like) column takes its floor plus its share of the free width (the scroller's
 * width less every floor), up to its kind's cap in the grid look and without one in the reading look, so the
 * table fills its container; a pinned column of the grid keeps its px, so the
 * offsets of the pinned columns stay sums of known widths. The filler is the one `<col>` without a
 * width: under `table-layout: fixed` it takes exactly what is left at every tier, so the head
 * surface, the hairlines, a group row and the footer run to the scroller's edge (`table.css`).
 */
function Columns<T>({ model }: { model: TableModel<T> }): ReactElement {
  const visible = visibleColumns(model.specs, model.plan.columns)
  const grid = model.look === 'grid'
  // A reading table hides priority 3 below `data-full-at` (always, with none): those floors leave the
  // free width only from the full tier up, a step the clamp draws on the scroller's width, and those
  // columns keep their floor rather than take a share that a narrower tier would hide.
  const tiered = (planned: PlannedColumn): boolean => !grid && planned.priority === 3
  const grows = (planned: PlannedColumn): boolean =>
    planned.flex && !tiered(planned) && !(grid && planned.pin !== null)
  const coreFloors = visible.reduce(
    (sum, { planned }) => (tiered(planned) ? sum : sum + planned.widthPx),
    model.lead.px,
  )
  const tierFloors = visible.reduce(
    (sum, { planned }) => (tiered(planned) ? sum + planned.widthPx : sum),
    0,
  )
  const fullAt = model.plan.fullAt
  const tierStep =
    tierFloors > 0 && fullAt !== null
      ? ` - clamp(0px, (100cqw - ${fullAt - 1}px) * 1000, ${tierFloors}px)`
      : ''
  const shares = visible.reduce(
    (sum, { spec, planned }) => (grows(planned) ? sum + weight(spec.kind) : sum),
    0,
  )
  const widthOf = (kind: string, planned: PlannedColumn): string => {
    if (!grows(planned) || shares === 0) return `${planned.widthPx}px`
    const share = weight(kind) / shares
    const grown = `calc(${planned.widthPx}px + (100cqw - ${coreFloors}px${tierStep}) * ${share})`
    return planned.capPx === null
      ? `max(${planned.widthPx}px, ${grown})`
      : `clamp(${planned.widthPx}px, ${grown}, ${planned.capPx}px)`
  }
  return (
    <colgroup>
      {model.selection !== undefined && <col style={{ width: '2.5rem' }} />}
      {model.lead.numbers && (
        <col data-kind="row-number" style={{ width: `${model.lead.numberPx}px` }} />
      )}
      {visible.map(({ spec, planned }) => (
        <col
          key={spec.id}
          style={{ width: widthOf(spec.kind, planned) }}
          data-flex={grows(planned) ? '' : undefined}
          data-priority={planned.priority === null ? undefined : String(planned.priority)}
          data-phone-drop={planned.phoneKeep ? undefined : ''}
        />
      ))}
      <col data-fill="" />
    </colgroup>
  )
}

function scrollportStyle(height: DataTableProps<unknown>['height']): CSSProperties | undefined {
  if (typeof height === 'object') {
    // The head row at the app's row height (`--table-app-row-h`, which a view's row height never moves)
    // plus `maxRows` body rows at the scroller's, which a view's `data-density` sets.
    return {
      maxHeight: `calc(var(--table-app-row-h, var(--basalt-row-h)) + ${height.maxRows} * var(--table-row-h, var(--basalt-row-h)))`,
    }
  }
  return undefined
}

/** A `maxRows` height that fewer rows than the table holds clips: the card tier names how many show. */
function clippedRows<T>(
  model: TableModel<T>,
  height: DataTableProps<T>['height'],
): { shown: number; total: number } | undefined {
  if (typeof height !== 'object' || (model.phase.tag !== 'ready' && model.phase.tag !== 'stale'))
    return undefined
  const total = model.rows.length
  return total > height.maxRows ? { shown: height.maxRows, total } : undefined
}

/**
 * The table of a frame that has no rows (a `DataPanel` in `empty` or `error`): the same scroller,
 * columns and head, and the frame's arm as the one body row, so the column header row stays.
 */
function FramedArm<T>({
  table,
  frame,
  windowed,
}: {
  table: DataTableProps<T>['table']
  frame: FrameArm
  /** The ready table is windowed: it never projects to cards, so neither does its arm. */
  windowed: boolean
}): ReactElement {
  const model = modelOf(table)
  const { claim } = frame
  useLayoutEffect(claim, [claim])
  const colcount = visibleColumns(model.specs, model.plan.columns).length + model.lead.cols
  return (
    <div
      data-slot="table-root"
      data-phase={frame.arm.tag}
      data-contained=""
      data-fill=""
      data-look={model.look === 'grid' ? 'grid' : undefined}
      data-full-at={model.look === 'grid' ? undefined : (model.plan.fullAt ?? undefined)}
      {...tierAttributesOf(model)}
      // A windowed ready table keeps one row size and scrolls sideways when narrow, so its head stays.
      {...(windowed && { 'data-phone': 'scroll' as const })}
      className="flex w-full max-w-full min-w-0 flex-col"
    >
      <div
        data-slot="table-scroller"
        {...bodyDensity(model)}
        ref={warnWithoutTierSheet}
        role="region"
        aria-label={model.label}
        style={scrollMinWidth(model)}
      >
        <Table role="table" aria-colcount={colcount} look={model.look} className="table-fixed">
          <TableCaption className="sr-only p-0">{model.label}</TableCaption>
          <Columns model={model} />
          <DataTableHead table={table} />
          <TableBody role="rowgroup">
            <FrameArmRow model={model} frame={frame} />
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * The data table: head, body and the phase arms of one `useDataTable` instance.
 *
 * Under a `Page` that mounts a `PageAside`, a row's `detail` opens in the aside with no wiring; pass
 * `detail` (a `DetailHost`) only to send it somewhere else. Outside a `Page` it opens a sheet.
 *
 * The table tiers (cards on a phone) are `basalt-ui/table.css`. `basalt()` imports it for any module
 * that imports `basalt-ui/table`, so the app adds nothing; without the plugin, import it once beside
 * `basalt-ui/tailwind.css`, or a phone table stays a table.
 *
 * A column's `priority` is decided against the table's container, not the viewport; the rule, with the
 * column widths it adds, is in `useDataTable`'s doc. In the reading look the text-like columns (the title, text,
 * links, people, tags) share the free width, so the table fills its container and the last column ends at its
 * edge, while figures and dates keep their fitted width; a header keeps to its label, with no kind icon. In the
 * grid look every column is drawn roomier, the text-like ones grow up to a cap per kind (the title 40
 * characters, 80 with a `sub` line), headers carry their kind icon, and the table
 * scrolls sideways under its pinned columns instead of shrinking them.
 *
 * The view is the reader's: a header's end edge resizes its column (drag, arrow keys, double-click
 * resets), the column menu groups the rows by a column whose kind groups and picks its summary, and a
 * footer cell steps through the summaries its kind allows. Widths, the row height (`rowHeight`), the
 * grouping and the summaries live in the table's display state on the device and in a saved view,
 * never in the URL. A server table neither groups nor takes a picked summary: its `totals` are the server's.
 *
 * @useWhen a page lists records that sort, filter, page, select or open in a detail
 * @neverWhen the rows are static with no behaviour (use `ui/table`) or a chart says it better
 *
 * @example
 * <DataTable table={t} height="fill" />
 */
export function DataTable<T, I = unknown>({
  table,
  detail,
  height = 'auto',
  virtual,
  focus,
  focusSeries,
  focusItems,
  drag,
}: DataTableProps<T, I>): ReactElement {
  const frame = useContext(FrameArmContext)
  const model = modelOf(table)
  const list = model.layout === 'list'
  // A list draws the phone card projection below the regular tier, whatever the table's own tier.
  const listTier = list
    ? ({ 'data-layout': 'list', 'data-below': '480', 'data-phone': 'cards' } as const)
    : {}
  const scrolls = typeof height === 'object' || height === 'fill' || model.phone === 'scroll'
  const columns = visibleColumns(model.specs, model.plan.columns).length
  const colcount = columns + model.lead.cols
  const { phase } = model
  // A row is a tab stop (roving) once there are rows to activate; before that the scroller is.
  const focusable = model.rows.length > 0 && (phase.tag === 'ready' || phase.tag === 'stale')
  const footerShown = hasFooter(model) && phase.tag === 'ready'
  const rowsShown = useRowsShown()
  const clipped = clippedRows(model, height)
  const link = rowLinkOf({ focus, focusSeries, focusItems }, model.getRowId)
  const onBlur = clearOnBlur(link)
  const windowed = virtual !== undefined && (phase.tag === 'ready' || phase.tag === 'stale')

  // A board, a gallery and an app's layout draw their own frames while they have no cards: never the
  // table's head over its rows.
  const cardLayout =
    model.layout === 'board' || model.layout === 'gallery' || appRenderOf(model) !== undefined
  if (cardLayout && (frame !== undefined || (phase.tag !== 'ready' && phase.tag !== 'stale')))
    return (
      <LayoutPhase
        model={model as unknown as TableModel<unknown>}
        {...(frame !== undefined && { frame })}
      />
    )

  if (frame !== undefined)
    return <FramedArm table={table} frame={frame} windowed={virtual !== undefined} />

  if (cardLayout && (phase.tag === 'ready' || phase.tag === 'stale'))
    return <CardLayout table={table} detail={detail} drag={drag} virtual={virtual} />

  if (windowed) {
    return (
      <RowFocusProvider link={link}>
        <div
          data-slot="table-root"
          data-phase={phase.tag}
          data-contained=""
          data-virtual=""
          data-fill=""
          data-look={model.look === 'grid' ? 'grid' : undefined}
          data-full-at={model.look === 'grid' ? undefined : (model.plan.fullAt ?? undefined)}
          {...tierAttributesOf(model)}
          {...(list && { 'data-layout': 'list' })}
          onFocus={revealFocus}
          onBlur={onBlur}
          onScrollCapture={markScrolled}
          // One row size holds the window exact: a windowed table never projects to cards (a card
          // is as tall as its content) and its cells hold one line; narrow, it scrolls sideways.
          data-phone="scroll"
          data-refresh-failed={phase.tag === 'stale' && phase.refreshFailed ? '' : undefined}
          // A windowed body needs a bounded port: a `fill` table takes the height of its parent.
          className={cn(
            'flex max-w-full min-w-0 flex-col [&_[data-slot=table-cell]]:whitespace-nowrap',
            height === 'fill' && 'h-full min-h-0 flex-1',
          )}
        >
          <BulkBar table={table} />
          <div
            data-slot="table-scroller"
            {...bodyDensity(model)}
            ref={warnWithoutTierSheet}
            style={{ ...scrollportStyle(height), ...scrollMinWidth(model) }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <VirtualTable
              model={model}
              virtual={virtual}
              detail={detail}
              head={
                <>
                  <Columns model={model} />
                  <DataTableHead table={table} rowIndex={1} />
                </>
              }
              footer={<DataTableFooter table={table} rowIndex={model.items.length + 2} />}
              footerShown={footerShown}
              colcount={colcount}
              tabStop={!focusable}
            />
          </div>
          <TablePager table={table} />
        </div>
      </RowFocusProvider>
    )
  }

  return (
    <RowFocusProvider link={link}>
      <div
        data-slot="table-root"
        data-phase={phase.tag}
        data-contained=""
        data-fill=""
        data-look={model.look === 'grid' ? 'grid' : undefined}
        data-full-at={model.look === 'grid' ? undefined : (model.plan.fullAt ?? undefined)}
        {...tierAttributesOf(model)}
        {...listTier}
        onFocus={revealFocus}
        onBlur={onBlur}
        onScrollCapture={markScrolled}
        data-refresh-failed={phase.tag === 'stale' && phase.refreshFailed ? '' : undefined}
        // A `fill` table takes its parent's height, so its scroller is a bounded region, as in the windowed path.
        className={cn(
          'flex w-full max-w-full min-w-0 flex-col',
          height === 'fill' && 'h-full min-h-0 flex-1',
        )}
      >
        <BulkBar table={table} />
        <div
          data-slot="table-scroller"
          {...bodyDensity(model)}
          ref={warnWithoutTierSheet}
          role="region"
          aria-label={model.label}
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be keyboard reachable (axe scrollable-region-focusable)
          tabIndex={scrolls && !focusable ? 0 : undefined}
          style={{ ...scrollportStyle(height), ...scrollMinWidth(model) }}
          className={
            typeof height === 'object' || height === 'fill'
              ? 'min-h-0 flex-1 overflow-auto overscroll-contain'
              : undefined
          }
        >
          <Table
            // Nested rows make the table a tree grid: its rows carry a level and open or close.
            role={model.nested ? 'treegrid' : model.look === 'grid' ? 'grid' : 'table'}
            aria-colcount={colcount}
            aria-busy={phase.tag === 'loading' || undefined}
            look={model.look}
            className="table-fixed"
          >
            <TableCaption className="sr-only p-0">{model.label}</TableCaption>
            <Columns model={model} />
            <DataTableHead table={table} />
            <DataTableBody table={table} {...(detail !== undefined && { detail })} />
            <DataTableFooter table={table} />
          </Table>
          {clipped !== undefined && (
            <div data-slot="table-rows-shown" aria-live="polite">
              {rowsShown(clipped.shown, clipped.total)}
            </div>
          )}
        </div>
        <TablePager table={table} />
      </div>
    </RowFocusProvider>
  )
}
