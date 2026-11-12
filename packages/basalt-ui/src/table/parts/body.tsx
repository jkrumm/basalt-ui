/**
 * The table body (docs/v3/concepts/data-table.md sections 3 and 6): one native `<tbody>` in every
 * phase. Ready and stale draw the rows through the kinds; loading, error and empty draw their arm
 * from `phases.tsx` inside the same body, so the table never swaps its markup. A row activates
 * through `onRowActivate` XOR `detail` (never both, by type), a tick or a row action never does
 * (I2), and a throw in a cell lands in the error arm instead of the page.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import { useEffect } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { PhaseBoundary } from '../../core/phase-boundary'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { DetailHost } from '../../core/ports'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu'
import { TableBody, TableCell, TableRow } from '../../ui/table'
import type { DataTableInstance, RowAction } from '../contract'
import { cellAttributes } from '../core/kinds-cells'
import type { CellEnv, KindSpec } from '../core/kinds-spec'
import { modelOf } from '../use-data-table'
import type { ModelRow, TableModel } from '../use-data-table'
import { alignProps, tierAttributes, useActionsLabel, visibleColumns } from './head'
import { GroupRow } from './group-row'
import type { BodyItem } from './group-row-model'
import { EmptyRow, ErrorRow, LoadingRows } from './phases'
import { SelectCell } from './select-cell'

/** The height a `spark` draws in; the table owns the box at every phase. */
const BOX_HEIGHT = 24

function RowActions<T>({
  row,
  actions,
}: {
  row: T
  actions: readonly RowAction<T>[]
}): ReactElement {
  const label = useActionsLabel()
  return (
    // The menu is portaled, but React still bubbles its clicks through this wrapper to the row, so
    // a click on a menu item must stop here or it activates the row too (I2).
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stops propagation only; the controls inside carry the interaction
    <span data-slot="table-actions" onClick={(event) => event.stopPropagation()}>
      <Menu>
        <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={label} />}>
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        </MenuTrigger>
        <MenuContent align="end">
          {actions.map((action) => {
            const Icon = action.icon
            const loading = action.loading?.(row) === true
            return (
              <MenuItem
                key={action.key}
                disabled={loading || action.disabled?.(row) === true}
                aria-busy={loading || undefined}
                onClick={() => action.onClick(row)}
              >
                {action.label}
                {Icon !== undefined && <Icon aria-hidden="true" size={16} />}
              </MenuItem>
            )
          })}
        </MenuContent>
      </Menu>
    </span>
  )
}

function content<T>(spec: KindSpec<T>, row: T, env: CellEnv, tabbable: boolean): ReactNode {
  if (spec.kind === 'actions') return <RowActions row={row} actions={spec.actions ?? []} />
  if (spec.kind === 'select' && spec.edit !== undefined) {
    const value = spec.value(row)
    return (
      <SelectCell
        row={row}
        value={value === null || value === undefined ? '' : String(value)}
        edit={spec.edit}
        tabbable={tabbable}
      />
    )
  }
  return spec.render?.(row, env) ?? null
}

/** What a body cell receives besides the row; one value per render of the body. */
export function cellEnvOf<T>(model: TableModel<T>): CellEnv {
  return {
    format: model.format,
    now: model.now,
    box: { height: BOX_HEIGHT, phase: model.phase.tag === 'stale' ? 'stale' : 'ready' },
  }
}

/**
 * One data row: the tick, then a cell per visible column. The plain body and the virtual window
 * both draw rows through it, so a row is the same markup in either.
 */
export function DataRow<T>({
  model,
  row,
  env,
  rowIndex,
}: {
  model: TableModel<T>
  row: ModelRow<T>
  env: CellEnv
  /** `aria-rowindex` in a virtual window, where the mounted rows are not all the rows. */
  rowIndex?: number
}): ReactElement {
  const t = useMessages(table)
  const { selection, keyboard } = model
  const columns = visibleColumns(model.specs, model.plan.columns)
  const offset = selection === undefined ? 1 : 2
  const ticked = selection?.isSelected(row.id) === true
  const rowProps = keyboard.rowProps(row.id)
  // Controls in a row are tab stops only in the roving stop; a table without one leaves them all.
  const tabbable = rowProps.tabIndex !== -1
  return (
    <TableRow
      role="row"
      data-selected={ticked ? '' : undefined}
      {...(rowIndex !== undefined && { 'aria-rowindex': rowIndex })}
      {...rowProps}
    >
      {selection !== undefined && (
        <TableCell role="cell" aria-colindex={1} data-kind="select">
          <span data-slot="table-select">
            <Checkbox
              aria-label={t('table.selectRow')}
              checked={ticked}
              onCheckedChange={() => selection.toggle(row.id)}
            />
          </span>
        </TableCell>
      )}
      {columns.map(({ spec, planned }, index) => {
        const { numeric, className } = alignProps(spec)
        return (
          <TableCell
            key={spec.id}
            role="cell"
            aria-colindex={index + offset}
            {...cellAttributes(spec)}
            {...tierAttributes(planned)}
            numeric={numeric}
            className={spec.wrap ? `${className ?? ''} whitespace-normal` : className}
          >
            {content(spec, row.original, env, tabbable)}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

/** One body item: a data row, or the group row of a declared grouping. */
export function BodyItemRow<T>({
  model,
  item,
  env,
  rowIndex,
}: {
  model: TableModel<T>
  item: BodyItem<T>
  env: CellEnv
  rowIndex?: number
}): ReactElement {
  const index = rowIndex === undefined ? {} : { rowIndex }
  return item.type === 'group' ? (
    <GroupRow model={model} item={item} env={env} {...index} />
  ) : (
    <DataRow model={model} row={item.row} env={env} {...index} />
  )
}

function Rows<T>({ model }: { model: TableModel<T> }): ReactElement {
  const env = cellEnvOf(model)
  return (
    <>
      {model.items.map((item) => (
        <BodyItemRow key={item.key} model={model} item={item} env={env} />
      ))}
    </>
  )
}

function Arm<T>({ model }: { model: TableModel<T> }): ReactElement {
  const { phase } = model
  switch (phase.tag) {
    case 'loading':
      return <LoadingRows model={model} />
    case 'error':
      return <ErrorRow model={model} phase={phase} />
    case 'empty':
      return (
        <EmptyRow
          model={model}
          cause={phase.empty.cause}
          {...(phase.empty.filtered !== undefined && { reset: phase.empty.filtered.reset })}
        />
      )
    default:
      return <Rows model={model} />
  }
}

/**
 * The `<tbody>` of a table: rows, or the arm of the current phase.
 *
 * @useWhen a bespoke layout draws the table body itself, inside the `DataTable` scroller
 * @neverWhen the full `DataTable` fits (it already renders the body)
 *
 * @example
 * <DataTableBody table={t} detail={asideHost} />
 */
export function DataTableBody<T>({
  table: instance,
  detail,
}: {
  table: DataTableInstance<T>
  /** Where a `detail` activation shows its entry. */
  detail?: DetailHost
}): ReactElement {
  const model = modelOf(instance)
  useEffect(() => {
    model.setHost(detail)
  })
  return (
    <TableBody role="rowgroup" {...model.keyboard.rootProps}>
      <PhaseBoundary fallback={({ reset }) => <ErrorRow model={model} retry={reset} />}>
        <Arm model={model} />
      </PhaseBoundary>
    </TableBody>
  )
}
