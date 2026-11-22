/**
 * The group row of a declared grouping (docs/v3/concepts/data-table.md section 3, Grouping): one
 * row per value, in the same columns as the data rows. The first column holds the disclosure (the
 * value as its column draws it, and the row count) and the `summary` box slot; a column with a
 * `footer` holds the same reduce over the group's rows. One line at the table's row height, so a
 * virtual window keeps one row size; in the card tier the row is the section header above its
 * cards. The collapsed set lives in `display.collapsed`, so it survives a reload and a saved view.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Pressable } from '../../ui/button'
import { TableCell, TableRow } from '../../ui/table'
import { Absent, cellAttributes } from '../core/kinds-cells'
import type { CellEnv } from '../core/kinds-spec'
import type { TableModel } from '../use-data-table'
import { drawAggregate, useAggregateLabel } from './footer'
import { footerValue } from './footer-model'
import type { BodyItem } from './group-row-model'
import { alignProps, pinEdge, pinStyle, tierAttributes, visibleColumns } from './head'
import { RowNumberCell } from './row-number'

export type GroupItem<T> = Extract<BodyItem<T>, { type: 'group' }>

function Chevron({ open }: { open: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * One group row of a grouped table.
 *
 * @useWhen the body draws a `group: { by }` table (the body does this; apps declare `group`)
 * @neverWhen grouping a server table (it needs every row: group on the server instead)
 *
 * @example
 * <GroupRow model={model} item={item} env={env} />
 */
export function GroupRow<T>({
  model,
  item,
  env,
  rowIndex,
}: {
  model: TableModel<T>
  item: GroupItem<T>
  env: CellEnv
  /** `aria-rowindex` in a virtual window, where the mounted rows are not all the rows. */
  rowIndex?: number
}): ReactElement {
  const t = useMessages(table)
  const aggregateLabel = useAggregateLabel()
  const group = model.group
  const quiet = model.look === 'reading'
  const columns = visibleColumns(model.specs, model.plan.columns)
  const offset = model.lead.cols + 1
  // Count, reduce and summary read every matching row of the group, not only this page.
  const { members } = item
  const first = members[0]
  const drawn =
    item.value === '' || first === undefined ? (
      <Absent />
    ) : (
      (group?.spec.render?.(first, env) ?? item.value)
    )

  return (
    <TableRow
      role="row"
      data-group=""
      data-collapsed={item.collapsed ? '' : undefined}
      {...(rowIndex !== undefined && { 'aria-rowindex': rowIndex })}
      data-quiet={quiet ? '' : undefined}
      // The grid look tints the band, through `--row-tint` the opaque pinned cell's too, so it runs the
      // whole row; the reading look draws a quiet label and count with no tint and no rule but the row's own.
      {...(!quiet && {
        className:
          'bg-muted/40 [--row-tint:color-mix(in_oklab,var(--color-muted)_40%,transparent)]',
      })}
    >
      {model.selection !== undefined && <TableCell role="cell" aria-colindex={1} />}
      <RowNumberCell model={model} />
      {columns.map(({ spec, planned }, index) => {
        const { numeric, className } = alignProps(spec)
        const fn = model.aggregateOf(spec.id)
        return (
          <TableCell
            key={spec.id}
            role="cell"
            aria-colindex={index + offset}
            {...cellAttributes(spec)}
            {...tierAttributes(planned, model.detailListed)}
            // a cell that draws nothing is off the phone card, so its grid gap leaves no blank band under the label
            {...(index > 0 && fn === undefined && { 'data-card': 'hidden' })}
            {...pinEdge(planned)}
            style={pinStyle(planned)}
            numeric={numeric}
            className={cn(className, 'font-medium', quiet && 'text-muted-foreground')}
          >
            {index === 0 ? (
              <span
                data-slot="table-group"
                className="flex min-w-0 items-center gap-2 whitespace-nowrap"
              >
                <Pressable
                  aria-expanded={!item.collapsed}
                  className="inline-flex min-h-6 min-w-0 items-center gap-1"
                  onClick={() => model.toggleGroup(item.value)}
                >
                  <Chevron open={!item.collapsed} />
                  <span className="min-w-0 truncate">{drawn}</span>
                  <span
                    data-slot="table-group-count"
                    className="shrink-0 font-normal text-muted-foreground"
                  >
                    {t('table.groupRows', members.length)}
                  </span>
                </Pressable>
                {group?.summary !== undefined && (
                  <span
                    data-slot="table-group-summary"
                    className="flex min-w-0 flex-1 items-center"
                  >
                    {group.summary(members, { height: env.box.height, phase: env.box.phase })}
                  </span>
                )}
              </span>
            ) : fn === undefined ? null : (
              // The reduce names itself, as the footer's does: a bare figure in a group row reads as a value.
              <span
                data-slot="table-group-reduce"
                className="inline-flex min-w-0 items-baseline gap-1.5"
              >
                <span className="text-xs font-normal text-muted-foreground">
                  {aggregateLabel(fn)}
                </span>
                <span className="min-w-0 truncate">
                  {drawAggregate(
                    spec,
                    footerValue(spec, { kind: 'client', rows: members }, fn),
                    env,
                    fn,
                  )}
                </span>
              </span>
            )}
          </TableCell>
        )
      })}
    </TableRow>
  )
}
