/**
 * The table footer (docs/v3/concepts/data-table.md section 3, Footer): one `tfoot` row under the
 * columns that declare `footer` on a numeric kind. Client mode reduces every row matching the
 * request (not the page); server mode prints the server's `totals` and renders nothing without
 * them, so a page sum is never labelled a total. Each value is a `dl` item, which the card tier
 * projects as the table's summary under the cards, the same DOM.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement, ReactNode } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { TableMessages } from '../../core/messages/table'
import { TableCell, TableRow } from '../../ui/table'
import type { DataTableInstance } from '../contract'
import { Absent, cellAttributes } from '../core/kinds-cells'
import type { Aggregate, CellEnv, KindSpec } from '../core/kinds-spec'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { footerValue } from './footer-model'
import type { FooterValue } from './footer-model'
import { alignProps, tierAttributes, visibleColumns } from './head'

const AGGREGATE_KEY: Record<Aggregate, keyof TableMessages> = {
  sum: 'table.aggSum',
  mean: 'table.aggMean',
  min: 'table.aggMin',
  max: 'table.aggMax',
  count: 'table.aggCount',
}

/** How a footer or group value reads: `count` is a plain number, the rest in the column's kind. */
export function drawAggregate<T>(spec: KindSpec<T>, value: FooterValue, env: CellEnv): ReactNode {
  if (value === null) return <Absent />
  if (value.kind === 'text') return value.value
  const footer = spec.footer
  if (footer === undefined || footer.fn === 'count') return env.format.number(value.value)
  return footer.draw(value.value, env)
}

/** The aggregate's name (`Sum`, `Average`, ...). */
export function useAggregateLabel(): (fn: Aggregate) => string {
  const t = useMessages(table)
  return (fn) => t(AGGREGATE_KEY[fn]) as string
}

/** Whether the table draws a footer row at all: a footer column with something to show. */
export function hasFooter<T>(model: TableModel<T>): boolean {
  const declared = model.specs.some((spec) => spec.footer !== undefined)
  if (!declared) return false
  if (!model.server) return true
  const { totals } = model
  if (totals === undefined) return false
  return model.specs.some((spec) => {
    const value = totals[spec.id]
    return spec.footer !== undefined && value !== undefined && value !== null
  })
}

/**
 * The `tfoot` of a table: one summary row, or nothing.
 *
 * @useWhen a bespoke layout draws the table itself, inside the `DataTable` scroller
 * @neverWhen the full `DataTable` fits (it already renders the footer)
 *
 * @example
 * <DataTableFooter table={t} />
 */
export function DataTableFooter<T>({
  table: instance,
}: {
  table: DataTableInstance<T>
}): ReactElement | null {
  const model = modelOf(instance)
  const t = useMessages(table)
  const label = useAggregateLabel()
  if (!hasFooter(model) || model.phase.tag !== 'ready') return null

  const env: CellEnv = { format: model.format, now: model.now, box: { height: 24, phase: 'ready' } }
  const source = model.server
    ? ({ kind: 'server', totals: model.totals } as const)
    : ({ kind: 'client', rows: model.matched } as const)
  const offset = model.selection === undefined ? 1 : 2
  const cells = visibleColumns(model.specs, model.plan.columns).map((column) => {
    const value = column.spec.footer === undefined ? null : footerValue(column.spec, source)
    const shown = column.spec.footer !== undefined && (!model.server || value !== null)
    return { ...column, value, shown }
  })
  // The first cell without a value names the row once.
  const nameAt = cells.findIndex((cell) => !cell.shown)

  return (
    <tfoot data-slot="table-footer" className="font-medium">
      <TableRow role="row" data-footer="">
        {model.selection !== undefined && <TableCell role="cell" aria-colindex={1} />}
        {cells.map(({ spec, planned, value, shown }, index) => {
          const { numeric, className } = alignProps(spec)
          const footer = spec.footer
          const name = index === nameAt ? t('table.footer') : null
          return (
            <TableCell
              key={spec.id}
              role="cell"
              aria-colindex={index + offset}
              {...cellAttributes(spec)}
              {...tierAttributes(planned)}
              numeric={numeric}
              className={className}
            >
              {shown && footer !== undefined ? (
                <dl data-slot="table-footer-item" className="m-0 min-w-0">
                  <dt className="truncate text-xs font-normal text-muted-foreground">
                    <span className="sr-only">{spec.header}, </span>
                    {label(footer.fn)}
                  </dt>
                  <dd className="m-0 truncate">{drawAggregate(spec, value, env)}</dd>
                </dl>
              ) : (
                name
              )}
            </TableCell>
          )
        })}
      </TableRow>
    </tfoot>
  )
}
