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
import { useContext, useLayoutEffect } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { cn } from '../../core/cn'
import { FrameArmContext } from '../../core/frame-arm'
import type { FrameArm } from '../../core/frame-arm'
import { useRowsShown } from '../../core/rows-shown'
import type { DataTableProps } from '../contract'
import { CONTENT_MAX_CH, TICK_COL_PX, widthPx } from '../core/plan'
import { TableBody, TableCaption, Table } from '../../ui/table'
import { DataTableBody } from './body'
import { BulkBar } from './bulk-bar'
import { DataTableFooter, hasFooter } from './footer'
import { VirtualTable } from './virtual'
import { DataTableHead, visibleColumns } from './head'
import { FrameArmRow } from './phases'
import { RowFocusProvider, clearOnBlur, rowLinkOf } from './row-focus'
import { TablePager } from './pager'
import { revealFocus, scrollMinWidth, tierAttributesOf, warnWithoutTierSheet } from './tiers'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'

/** A flexible `entity` column takes this many shares of the free width, a flexible text one takes 1. */
const ENTITY_SHARES = 2

/**
 * The widest a lone flexible title column grows, in `ch`: the kit's own bound for a title sized to
 * its content (`CONTENT_MAX_CH`), or twice that for a title with a sub line (the sub line is the
 * wider text, set smaller). The width beyond it goes to a trailing filler column, so the figures stay
 * beside their labels instead of ending up a screen away from the title.
 */
const ENTITY_MAX_CH = CONTENT_MAX_CH
const ENTITY_SUB_MAX_CH = 2 * CONTENT_MAX_CH

/** The table draws a filler column when its one flexible column is the title; `table.css` paints the filler cells. */
function fillsTail<T>(model: TableModel<T>): boolean {
  return model.look === 'grid' || titleCapPx(model) !== undefined
}

/** The title column's cap in px when it is the table's one flexible column, else `undefined`. */
function titleCapPx<T>(model: TableModel<T>): number | undefined {
  const flexible = visibleColumns(model.specs, model.plan.columns).filter(
    ({ planned }) => planned.flex,
  )
  const title = flexible[0]?.spec
  if (flexible.length !== 1 || title?.kind !== 'entity') return undefined
  return widthPx({ ch: title.sub === true ? ENTITY_SUB_MAX_CH : ENTITY_MAX_CH, flex: false })
}

/** `<col>` widths of the plan: fixed kinds in px, flexible ones share the rest. One set at every phase. */
function Columns<T>({
  model,
  fill = false,
}: {
  model: TableModel<T>
  fill?: boolean
}): ReactElement {
  const visible = visibleColumns(model.specs, model.plan.columns)
  // A grid draws every column at its planned width and leaves the rest to the filler, so the offsets
  // of its pinned columns are sums of known widths.
  const grid = model.look === 'grid'
  const tickPx = model.selection === undefined ? 0 : TICK_COL_PX
  const gridPx = visible.reduce((sum, { planned }) => sum + planned.widthPx, tickPx)
  const fixedPx = visible.reduce(
    (sum, { planned }) => (planned.flex ? sum : sum + planned.widthPx),
    model.selection === undefined ? 0 : TICK_COL_PX,
  )
  const shares = visible.reduce(
    (sum, { spec, planned }) =>
      planned.flex ? sum + (spec.kind === 'entity' ? ENTITY_SHARES : 1) : sum,
    0,
  )
  // The filler takes the width the title does not: the free width above its cap. A priority 3 column
  // counts only where a tier can show it, so a table that stays reduced leaves no strip for it.
  const fillPx = visible.reduce(
    (sum, { planned }) =>
      planned.flex || (planned.priority === 3 && model.plan.fullAt === null)
        ? sum
        : sum + planned.widthPx,
    model.selection === undefined ? 0 : TICK_COL_PX,
  )
  const cap = fill ? titleCapPx(model) : undefined
  return (
    <colgroup>
      {model.selection !== undefined && <col style={{ width: '2.5rem' }} />}
      {visible.map(({ spec, planned }) => {
        const flexible = planned.flex && !grid
        // The title is the row's name: it gets a larger share of the free width, never less than its floor.
        const weighted = flexible && spec.kind === 'entity' && shares > ENTITY_SHARES
        return (
          <col
            key={spec.id}
            {...(weighted && {
              style: {
                width: `max(${planned.widthPx}px, calc((100cqw - ${fixedPx}px) * ${ENTITY_SHARES / shares}))`,
              },
            })}
            {...(!flexible && { style: { width: `${planned.widthPx}px` } })}
            data-flex={flexible ? '' : undefined}
            data-priority={planned.priority === null ? undefined : String(planned.priority)}
          />
        )
      })}
      {grid ? (
        <col data-fill="" style={{ width: `max(0px, calc(100cqw - ${gridPx}px))` }} />
      ) : (
        cap !== undefined && (
          <col data-fill="" style={{ width: `max(0px, calc(100cqw - ${fillPx + cap}px))` }} />
        )
      )}
    </colgroup>
  )
}

function scrollportStyle(height: DataTableProps<unknown>['height']): CSSProperties | undefined {
  if (typeof height === 'object') {
    // The head row plus `maxRows` body rows, in the table's own row height.
    return { maxHeight: `calc(${height.maxRows + 1} * var(--table-row-h, var(--basalt-row-h)))` }
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
}: {
  table: DataTableProps<T>['table']
  frame: FrameArm
}): ReactElement {
  const model = modelOf(table)
  const { claim } = frame
  useLayoutEffect(claim, [claim])
  const colcount =
    visibleColumns(model.specs, model.plan.columns).length + (model.selection === undefined ? 0 : 1)
  return (
    <div
      data-slot="table-root"
      data-phase={frame.arm.tag}
      data-contained=""
      data-fill={fillsTail(model) ? '' : undefined}
      data-look={model.look === 'grid' ? 'grid' : undefined}
      data-full-at={model.look === 'grid' ? undefined : (model.plan.fullAt ?? undefined)}
      {...tierAttributesOf(model)}
      className="flex w-full max-w-full min-w-0 flex-col"
    >
      <div
        data-slot="table-scroller"
        ref={warnWithoutTierSheet}
        role="region"
        aria-label={model.label}
        style={scrollMinWidth(model)}
      >
        <Table role="table" aria-colcount={colcount} look={model.look} className="table-fixed">
          <TableCaption className="sr-only">{model.label}</TableCaption>
          <Columns model={model} fill />
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
 * A column's `priority` is decided against the table's container, not the viewport. A column is
 * `ch` x 8 px + 24 px wide (an icon column 44 px). Priority 3 shows only from `data-full-at`, the
 * smallest of 800, 1000, 1200, 1440 or 1800 px that holds every visible column; above 1800 px of
 * columns the table stays reduced. Priority 1 and 2 show from 480 px, from 720 px once they sum
 * above 480 px and fit 720, or from 800 px above that. While they sum above 800 px the last priority 2 columns drop to 3 whatever the
 * container, so a table in a half-width cell (about 900 px at 1800) shows a priority 3 column only
 * when every column sums to 800 px or less. When the title is the one flexible column it grows to 40
 * characters (80 with a `sub` line) and no further: the width above that is a filler at the end of
 * the table, so the figures stay beside the title and the head, the hairlines and the row tint still
 * span the table.
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
}: DataTableProps<T, I>): ReactElement {
  const frame = useContext(FrameArmContext)
  const model = modelOf(table)
  const scrolls = typeof height === 'object' || height === 'fill' || model.phone === 'scroll'
  const columns = visibleColumns(model.specs, model.plan.columns).length
  const colcount = columns + (model.selection === undefined ? 0 : 1)
  const { phase } = model
  // A row is a tab stop (roving) once there are rows to activate; before that the scroller is.
  const focusable = model.rows.length > 0 && (phase.tag === 'ready' || phase.tag === 'stale')
  const footerShown = hasFooter(model) && phase.tag === 'ready'
  const rowsShown = useRowsShown()
  const clipped = clippedRows(model, height)
  const link = rowLinkOf({ focus, focusSeries, focusItems }, model.getRowId)
  const onBlur = clearOnBlur(link)
  const windowed = virtual !== undefined && (phase.tag === 'ready' || phase.tag === 'stale')

  if (frame !== undefined) return <FramedArm table={table} frame={frame} />

  if (windowed) {
    return (
      <RowFocusProvider link={link}>
        <div
          data-slot="table-root"
          data-phase={phase.tag}
          data-contained=""
          data-virtual=""
          data-fill={model.look === 'grid' ? '' : undefined}
          data-look={model.look === 'grid' ? 'grid' : undefined}
          data-full-at={model.look === 'grid' ? undefined : (model.plan.fullAt ?? undefined)}
          {...tierAttributesOf(model)}
          onFocus={revealFocus}
          onBlur={onBlur}
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
                  <Columns model={model} fill={model.look === 'grid'} />
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
        data-fill={fillsTail(model) ? '' : undefined}
        data-look={model.look === 'grid' ? 'grid' : undefined}
        data-full-at={model.look === 'grid' ? undefined : (model.plan.fullAt ?? undefined)}
        {...tierAttributesOf(model)}
        onFocus={revealFocus}
        onBlur={onBlur}
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
            <TableCaption className="sr-only">{model.label}</TableCaption>
            <Columns model={model} fill />
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
