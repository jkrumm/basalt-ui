/**
 * The table footer (docs/v3/concepts/data-table.md section 3, Footer): one `tfoot` row under the
 * columns that print a reduce. Which reduce a column prints is the view's: a reader's pick from what
 * its kind allows (`display.aggregates`), else the declared `footer`. Client mode reduces every row
 * matching the request (not the page), and a cell is a button that steps to the next reduce the kind
 * allows; server mode prints the server's `totals`, takes no pick and renders nothing without them,
 * so a page sum is never labelled a total. Each value is a `dl` item, which the card tier projects as
 * the table's summary under the cards, the same DOM.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement, ReactNode } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { TableMessages } from '../../core/messages/table'
import { Pressable } from '../../ui/button'
import { TableCell, TableRow } from '../../ui/table'
import type { DataTableInstance } from '../contract'
import { Absent, cellAttributes } from '../core/kinds-cells'
import type { Aggregate, CellEnv, KindSpec } from '../core/kinds-spec'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { footerValue, nextAggregate } from './footer-model'
import type { FooterValue } from './footer-model'
import { alignProps, pinEdge, pinStyle, tierAttributes, visibleColumns } from './head'
import { RowNumberCell } from './row-number'

const AGGREGATE_KEY: Record<Aggregate | 'none', keyof TableMessages> = {
  sum: 'table.aggSum',
  mean: 'table.aggMean',
  min: 'table.aggMin',
  max: 'table.aggMax',
  count: 'table.aggCount',
  none: 'table.aggNone',
}

/**
 * How a footer or group value reads: `count` is a plain number, the rest in the column's kind (its
 * declared footer's format, else the kind's own total format).
 */
export function drawAggregate<T>(
  spec: KindSpec<T>,
  value: FooterValue,
  env: CellEnv,
  fn: Aggregate | undefined = spec.footer?.fn,
): ReactNode {
  if (value === null) return <Absent />
  if (value.kind === 'text') return value.value
  if (fn === undefined || fn === 'count') return env.format.number(value.value)
  const draw = spec.footer?.draw ?? spec.drawTotal
  return draw === undefined ? env.format.number(value.value) : draw(value.value, env)
}

/** The aggregate's name (`Sum`, `Average`, ..., `None`). */
export function useAggregateLabel(): (fn: Aggregate | 'none') => string {
  const t = useMessages(table)
  return (fn) => t(AGGREGATE_KEY[fn]) as string
}

/** Whether the table draws a footer row at all: a column with a reduce to show. */
export function hasFooter<T>(model: TableModel<T>): boolean {
  if (!model.server) return model.specs.some((spec) => model.aggregateOf(spec.id) !== undefined)
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
  rowIndex,
}: {
  table: DataTableInstance<T>
  /** `aria-rowindex` in a virtual window, where the foot is not after every body row in the DOM. */
  rowIndex?: number
}): ReactElement | null {
  const model = modelOf(instance)
  const t = useMessages(table)
  const label = useAggregateLabel()
  if (!hasFooter(model) || model.phase.tag !== 'ready') return null

  const env: CellEnv = { format: model.format, now: model.now, box: { height: 24, phase: 'ready' } }
  const source = model.server
    ? ({ kind: 'server', totals: model.totals } as const)
    : ({ kind: 'client', rows: model.matched } as const)
  const offset = model.lead.cols + 1
  const cells = visibleColumns(model.specs, model.plan.columns).map((column) => {
    const fn = model.aggregateOf(column.spec.id)
    const value = fn === undefined ? null : footerValue(column.spec, source, fn)
    const shown = fn !== undefined && (!model.server || value !== null)
    return { ...column, fn, value, shown, allowed: model.aggregatesOf(column.spec.id) }
  })
  // The first cell without a value names the row once; the other empty pickers show on hover or focus.
  const nameAt = cells.findIndex((cell) => !cell.shown)

  return (
    <tfoot data-slot="table-footer" className="font-medium">
      <TableRow
        role="row"
        data-footer=""
        {...(rowIndex !== undefined && { 'aria-rowindex': rowIndex })}
      >
        {model.selection !== undefined && <TableCell role="cell" aria-colindex={1} />}
        <RowNumberCell model={model} />
        {cells.map(({ spec, planned, fn, value, shown, allowed }, index) => {
          const { numeric, className } = alignProps(spec)
          const name = index === nameAt ? t('table.footer') : null
          // An empty picker other than the row's name stays quiet until the row is pointed at or focused.
          const quiet = !shown && index !== nameAt
          const item =
            shown && fn !== undefined ? (
              <dl data-slot="table-footer-item" className="m-0 min-w-0">
                <dt className="truncate text-xs font-normal text-muted-foreground">
                  <span className="sr-only">{spec.header === '' ? spec.id : spec.header}, </span>
                  {label(fn)}
                </dt>
                <dd className="m-0 truncate">{drawAggregate(spec, value, env, fn)}</dd>
              </dl>
            ) : null
          const next = allowed.length === 0 ? undefined : nextAggregate(allowed, fn)
          return (
            <TableCell
              key={spec.id}
              role="cell"
              aria-colindex={index + offset}
              {...cellAttributes(spec)}
              {...tierAttributes(planned, model.detailListed)}
              {...pinEdge(planned)}
              style={pinStyle(planned)}
              numeric={numeric}
              className={className}
            >
              {next === undefined ? (
                (item ?? name)
              ) : (
                // The pick is named by what it shows: a value reads as its header, reduce and figure;
                // an empty pick as the column's summary, its visible word hidden until pointed at.
                <Pressable
                  data-footer-pick=""
                  data-quiet={quiet ? '' : undefined}
                  className="block w-full min-w-0 [text-align:inherit]"
                  onClick={() => model.setAggregate(spec.id, next)}
                >
                  {item ?? (
                    <>
                      <span className="sr-only">
                        {t('table.summaryOf', spec.header === '' ? spec.id : spec.header)}
                      </span>
                      <span
                        data-reveal=""
                        aria-hidden="true"
                        className={
                          name === null ? 'text-xs font-normal text-muted-foreground' : undefined
                        }
                      >
                        {name ?? t('table.footer')}
                      </span>
                    </>
                  )}
                </Pressable>
              )}
            </TableCell>
          )
        })}
      </TableRow>
    </tfoot>
  )
}
