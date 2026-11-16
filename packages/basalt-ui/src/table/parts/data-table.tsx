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
import type { CSSProperties, ReactElement } from 'react'
import { cn } from '../../core/cn'
import type { DataTableProps } from '../contract'
import { TableCaption, Table } from '../../ui/table'
import { DataTableBody } from './body'
import { BulkBar } from './bulk-bar'
import { DataTableFooter, hasFooter } from './footer'
import { VirtualTable } from './virtual'
import { DataTableHead, visibleColumns } from './head'
import { RowFocusProvider, clearOnBlur } from './row-focus'
import { TablePager } from './pager'
import { revealFocus, scrollMinWidth, tierAttributesOf, warnWithoutTierSheet } from './tiers'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'

/** A flexible `entity` column takes this many shares of the free width, a flexible text one takes 1. */
const ENTITY_SHARES = 2
const SELECTION_COL_PX = 40

/** `<col>` widths of the plan: fixed kinds in px, flexible ones share the rest. One set at every phase. */
function Columns<T>({ model }: { model: TableModel<T> }): ReactElement {
  const visible = visibleColumns(model.specs, model.plan.columns)
  const isFlexible = (spec: (typeof visible)[number]['spec']) =>
    spec.width !== 'icon' && spec.width.flex && spec.content === undefined
  const fixedPx = visible.reduce(
    (sum, { spec, planned }) => (isFlexible(spec) ? sum : sum + planned.widthPx),
    model.selection === undefined ? 0 : SELECTION_COL_PX,
  )
  const shares = visible.reduce(
    (sum, { spec }) =>
      isFlexible(spec) ? sum + (spec.kind === 'entity' ? ENTITY_SHARES : 1) : sum,
    0,
  )
  return (
    <colgroup>
      {model.selection !== undefined && <col style={{ width: '2.5rem' }} />}
      {visible.map(({ spec, planned }) => {
        const flexible = isFlexible(spec)
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
    </colgroup>
  )
}

function scrollportStyle(height: DataTableProps<unknown>['height']): CSSProperties | undefined {
  if (typeof height === 'object') {
    // The head row plus `maxRows` body rows, in the table's own row height.
    return { maxHeight: `calc(${height.maxRows + 1} * var(--table-row-h, var(--vx-row-h)))` }
  }
  return undefined
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
 * @useWhen a page lists records that sort, filter, page, select or open in a detail
 * @neverWhen the rows are static with no behaviour (use `ui/table`) or a chart says it better
 *
 * @example
 * <DataTable table={t} height="fill" />
 */
export function DataTable<T>({
  table,
  detail,
  height = 'auto',
  virtual,
  focus,
}: DataTableProps<T>): ReactElement {
  const model = modelOf(table)
  const scrolls = typeof height === 'object' || height === 'fill' || model.phone === 'scroll'
  const columns = visibleColumns(model.specs, model.plan.columns).length
  const colcount = columns + (model.selection === undefined ? 0 : 1)
  const { phase } = model
  // A row is a tab stop (roving) once there are rows to activate; before that the scroller is.
  const focusable = model.rows.length > 0 && (phase.tag === 'ready' || phase.tag === 'stale')
  const footerShown = hasFooter(model) && phase.tag === 'ready'
  const onBlur = clearOnBlur(focus)
  const windowed = virtual !== undefined && (phase.tag === 'ready' || phase.tag === 'stale')

  if (windowed) {
    return (
      <RowFocusProvider focus={focus} getRowId={model.getRowId}>
        <div
          data-slot="table-root"
          data-phase={phase.tag}
          data-contained=""
          data-virtual=""
          data-full-at={model.plan.fullAt ?? undefined}
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
    <RowFocusProvider focus={focus} getRowId={model.getRowId}>
      <div
        data-slot="table-root"
        data-phase={phase.tag}
        data-contained=""
        data-full-at={model.plan.fullAt ?? undefined}
        {...tierAttributesOf(model)}
        onFocus={revealFocus}
        onBlur={onBlur}
        data-refresh-failed={phase.tag === 'stale' && phase.refreshFailed ? '' : undefined}
        className="flex max-w-full min-w-0 flex-col"
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
            role="table"
            aria-colcount={colcount}
            aria-busy={phase.tag === 'loading' || undefined}
            className="table-fixed"
          >
            <TableCaption className="sr-only">{model.label}</TableCaption>
            <Columns model={model} />
            <DataTableHead table={table} />
            <DataTableBody table={table} {...(detail !== undefined && { detail })} />
            <DataTableFooter table={table} />
          </Table>
        </div>
        <TablePager table={table} />
      </div>
    </RowFocusProvider>
  )
}
