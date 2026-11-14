/**
 * The phase arms of the table body (docs/v3/concepts/data-table.md sections 3 and 6; I20): every
 * phase draws inside the same table, so the head, the column widths and the root stay put. A
 * loading table is skeleton rows sized by kind, an error with no rows is one row inside `tbody`
 * with Retry, and an empty table is one row with its cause.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement, ReactNode } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { ResolvedPhase } from '../../core/phase'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import { TableCell, TableRow } from '../../ui/table'
import type { TableModel } from '../use-data-table'
import { TickSkeleton } from './tick-column'
import { alignProps, tierAttributes, visibleColumns } from './head'

/** Skeleton rows of a table that has shown none yet; once it has, the loading arm keeps the last height. */
export const SKELETON_ROWS = 6

/** The bar width of a kind: text runs long, figures and badges short, `actions` nothing. */
const BAR: Record<string, string> = {
  entity: 'w-2/3',
  text: 'w-3/4',
  status: 'w-16',
  spark: 'w-full',
  actions: 'hidden',
}

export function barClass(kind: string): string {
  return BAR[kind] ?? 'w-12'
}

/** Columns the phase rows span: every drawn column plus the tick column. */
function span<T>(model: TableModel<T>): number {
  return (
    visibleColumns(model.specs, model.plan.columns).length + (model.selection === undefined ? 0 : 1)
  )
}

export function LoadingRows<T>({ model }: { model: TableModel<T> }): ReactElement {
  const columns = visibleColumns(model.specs, model.plan.columns)
  const offset = model.selection === undefined ? 1 : 2
  return (
    <>
      {Array.from({ length: model.skeletonRows ?? SKELETON_ROWS }, (_, row) => (
        <TableRow key={row} role="row" data-slot="table-row" data-skeleton="">
          {model.selection !== undefined && <TickSkeleton />}
          {columns.map(({ spec, planned }, index) => {
            const { numeric, className } = alignProps(spec)
            return (
              <TableCell
                key={spec.id}
                role="cell"
                aria-colindex={index + offset}
                data-kind={spec.kind}
                data-align={spec.align}
                {...tierAttributes(planned)}
                numeric={numeric}
                className={className}
              >
                <Skeleton className={`${barClass(spec.kind)} ${numeric ? 'ml-auto' : ''}`} />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}

/** One full-width row carrying a message and an optional button; the body of every non-row arm. */
function MessageRow<T>({
  model,
  slot,
  children,
}: {
  model: TableModel<T>
  slot: 'table-error' | 'table-empty'
  children: ReactNode
}): ReactElement {
  return (
    <TableRow role="row" data-slot="table-row">
      <TableCell
        role="cell"
        aria-colindex={1}
        colSpan={span(model)}
        className="h-24 text-center whitespace-normal text-muted-foreground"
      >
        <div
          data-slot={slot}
          role={slot === 'table-error' ? 'alert' : undefined}
          className="flex flex-col items-center gap-2"
        >
          {children}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ErrorRow<T>({
  model,
  phase,
  retry,
}: {
  model: TableModel<T>
  phase?: Extract<ResolvedPhase, { tag: 'error' }>
  /** A caught render error resets through here when the phase has no retry of its own. */
  retry?: () => void
}): ReactElement {
  const t = useMessages(table)
  const run = phase?.retry ?? retry
  const text =
    phase?.kind === 'forbidden'
      ? t('table.forbidden')
      : phase?.kind === 'not-found'
        ? t('table.notFound')
        : t('table.error')
  return (
    <MessageRow model={model} slot="table-error">
      <span className="text-foreground">{text}</span>
      {phase?.message !== undefined && phase.kind === undefined && <span>{phase.message}</span>}
      {run !== undefined && (
        <Button size="sm" onClick={run}>
          {t('table.retry')}
        </Button>
      )}
    </MessageRow>
  )
}

export function EmptyRow<T>({
  model,
  cause,
  reset,
}: {
  model: TableModel<T>
  cause: string
  reset?: () => void
}): ReactElement {
  const t = useMessages(table)
  return (
    <MessageRow model={model} slot="table-empty">
      <span>{cause}</span>
      {reset !== undefined && (
        <Button size="sm" onClick={reset}>
          {t('table.clearFilters')}
        </Button>
      )}
    </MessageRow>
  )
}
