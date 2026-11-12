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
import { DataTableFooter, hasFooter } from './footer'
import { VirtualTable } from './virtual'
import { DataTableHead, visibleColumns } from './head'
import { TablePager } from './pager'
import { scrollMinWidth, tierAttributesOf } from './tiers'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'

/** `<col>` widths of the plan: fixed kinds in px, flexible ones share the rest. One set at every phase. */
function Columns<T>({ model }: { model: TableModel<T> }): ReactElement {
  return (
    <colgroup>
      {model.selection !== undefined && <col style={{ width: '2.5rem' }} />}
      {visibleColumns(model.specs, model.plan.columns).map(({ spec, planned }) => {
        const flexible = spec.width !== 'icon' && spec.width.flex
        return (
          <col
            key={spec.id}
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
 * @useWhen a page lists records that sort, filter, page, select or open in a detail
 * @neverWhen the rows are static with no behaviour (use `ui/table`) or a chart says it better
 *
 * @example
 * <DataTable table={t} detail={asideHost} height="fill" />
 */
export function DataTable<T>({
  table,
  detail,
  height = 'auto',
  virtual,
}: DataTableProps<T>): ReactElement {
  const model = modelOf(table)
  const scrolls = typeof height === 'object' || height === 'fill' || model.phone === 'scroll'
  const focusable = model.activation.kind !== 'none' || model.selection !== undefined
  const columns = visibleColumns(model.specs, model.plan.columns).length
  const colcount = columns + (model.selection === undefined ? 0 : 1)
  const { phase } = model
  const footerShown = hasFooter(model) && phase.tag === 'ready'
  const windowed = virtual !== undefined && (phase.tag === 'ready' || phase.tag === 'stale')

  if (windowed) {
    return (
      <div
        data-slot="table-root"
        data-phase={phase.tag}
        data-contained=""
        data-virtual=""
        data-full-at={model.plan.fullAt ?? undefined}
        {...tierAttributesOf(model)}
        data-refresh-failed={phase.tag === 'stale' && phase.refreshFailed ? '' : undefined}
        // A windowed body needs a bounded port: a `fill` table takes the height of its parent.
        className={cn(
          'flex max-w-full min-w-0 flex-col',
          height === 'fill' && 'h-full min-h-0 flex-1',
        )}
      >
        {/* theme-allow hidden-inline-style — the scrollport height and the scroll tier's min width are per-table values */}
        <div
          data-slot="table-scroller"
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
                <DataTableHead table={table} />
              </>
            }
            footer={<DataTableFooter table={table} />}
            footerShown={footerShown}
            colcount={colcount}
            tabStop={!focusable}
          />
        </div>
        <TablePager table={table} />
      </div>
    )
  }

  return (
    <div
      data-slot="table-root"
      data-phase={phase.tag}
      data-contained=""
      data-full-at={model.plan.fullAt ?? undefined}
      {...tierAttributesOf(model)}
      data-refresh-failed={phase.tag === 'stale' && phase.refreshFailed ? '' : undefined}
      className="flex max-w-full min-w-0 flex-col"
    >
      {/* theme-allow hidden-inline-style — the scrollport height and the scroll tier's min width are per-table values */}
      <div
        data-slot="table-scroller"
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
  )
}
