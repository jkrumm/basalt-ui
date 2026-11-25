/**
 * The table body (docs/v3/concepts/data-table.md sections 3 and 6): one native `<tbody>` in every
 * phase. Ready and stale draw the rows through the kinds; loading, offline, error and empty draw their arm
 * from `phases.tsx` inside the same body, so the table never swaps its markup. A row activates
 * through `onRowActivate` XOR `detail` (never both, by type), a tick or a row action never does
 * (I2), and a throw in a cell lands in the error arm instead of the page.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- explicit roles keep the table a table under CSS projection (concept section 6, Roselli) */
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { PhaseBoundary } from '../../core/phase-boundary'
import type { DetailHost } from '../../core/ports'
import { Button } from '../../ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '../../ui/context-menu'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu'
import { TableBody, TableCell, TableRow } from '../../ui/table'
import type { DataTableInstance, RowAction } from '../contract'
import { cellAttributes } from '../core/kinds-cells'
import type { CellEnv, KindSpec } from '../core/kinds-spec'
import type { PlannedColumn } from '../core/plan'
import { modelOf } from '../use-data-table'
import type { ModelRow, TableModel } from '../use-data-table'
import {
  alignProps,
  pinEdge,
  pinStyle,
  tierAttributes,
  useActionsLabel,
  visibleColumns,
} from './head'
import { RowNumberCell } from './row-number'
import { GroupRow } from './group-row'
import type { BodyItem } from './group-row-model'
import { useDetailHost } from './detail-sheet'
import { EmptyRow, ErrorRow, LoadingRows, OfflineRow } from './phases'
import { useRowFocusLeave, useRowFocusProps } from './row-focus'
import { SelectCell } from './select-cell'
import { TickCell } from './tick-column'
import type { TreeInfo } from './tree-row-model'

/** The height a `spark` draws in; the table owns the box at every phase. */
const BOX_HEIGHT = 24

/**
 * The `data-density` of a view's row height, on the body and on `DataTable`'s scroller: it rebinds the
 * density row (`--basalt-row-h`), so the body rows (a bespoke layout's `DataTableBody` too) and a
 * `maxRows` height take that step while `table.css` holds the head and the foot at the app's row and
 * control height; nothing when the app's density holds.
 */
export function bodyDensity<T>(model: TableModel<T>): { 'data-density'?: string } {
  return model.rowHeight === undefined ? {} : { 'data-density': model.rowHeight }
}

/** The menu rows of a row's actions: the "..." button and the right-click menu draw the same ones. */
function actionItems<T>(row: T, actions: readonly RowAction<T>[]): ReactNode {
  return actions.map((action) => {
    const Icon = action.icon
    const loading = action.loading?.(row) === true
    return (
      <MenuItem
        key={action.id}
        disabled={loading || action.disabled?.(row) === true}
        aria-busy={loading || undefined}
        onClick={() => action.onClick(row)}
      >
        {action.label}
        {Icon !== undefined && <Icon aria-hidden="true" size={16} />}
      </MenuItem>
    )
  })
}

function RowActions<T>({
  row,
  actions,
  tabbable,
}: {
  row: T
  actions: readonly RowAction<T>[]
  tabbable: boolean
}): ReactElement {
  const label = useActionsLabel()
  return (
    // The menu is portaled, but React still bubbles its clicks through this wrapper to the row, so
    // a click on a menu item must stop here or it activates the row too (I2).
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stops propagation only; the controls inside carry the interaction
    <span data-slot="table-actions" onClick={(event) => event.stopPropagation()}>
      <Menu>
        <MenuTrigger
          render={
            <Button
              size="sm"
              shape="icon"
              variant="ghost"
              aria-label={label}
              tabIndex={tabbable ? undefined : -1}
              className="pointer-coarse:after:-inset-x-2.5"
            />
          }
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        </MenuTrigger>
        <MenuContent align="end">{actionItems(row, actions)}</MenuContent>
      </Menu>
    </span>
  )
}

/**
 * The `table-expand` door: where a tier hides a column and `onRowActivate` takes the tap, this opens
 * the sheet derived from the row. The tier CSS shows it only while a column is hidden.
 */
function ExpandButton({
  onOpen,
  tabbable,
}: {
  onOpen: () => void
  tabbable: boolean
}): ReactElement {
  const label = useMessages(table)('table.details')
  return (
    <span data-slot="table-expand">
      <Button
        shape="icon"
        variant="ghost"
        aria-label={label}
        tabIndex={tabbable ? undefined : -1}
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
      >
        <svg
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path d="m5 6 3 3 3-3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
    </span>
  )
}

/**
 * The disclosure of a nested row: the indent of its level, then a chevron that opens or closes the
 * rows below it, or the chevron's room on a row with none, so every title starts on its level's line.
 * The row's own keys (Right, Left) do the same, so the chevron is a pointer target, not a tab stop.
 */
function TreeLead({ tree, onToggle }: { tree: TreeInfo; onToggle: () => void }): ReactElement {
  const label = useMessages(table)('table.rowsBelow')
  return (
    <span data-slot="table-tree-lead" className="flex shrink-0 items-center">
      {tree.parent ? (
        <Button
          shape="icon"
          size="sm"
          variant="ghost"
          aria-label={label}
          aria-expanded={tree.open}
          // A search or filter holds every path open: the chevron waits until it clears.
          disabled={tree.pinned}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
        >
          <svg
            viewBox="0 0 16 16"
            className={tree.open ? 'size-4 rotate-90' : 'size-4'}
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M6 4l4 4-4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      ) : (
        <span data-slot="table-tree-spacer" aria-hidden="true" className="size-7 shrink-0" />
      )}
    </span>
  )
}

function content<T>(
  spec: KindSpec<T>,
  row: T,
  env: CellEnv,
  tabbable: boolean,
  grid = false,
): ReactNode {
  // The row menu stays a tab stop on every row of a reading table, as before the grid look; a grid
  // reaches it through its cell.
  if (spec.kind === 'actions')
    return <RowActions row={row} actions={spec.actions ?? []} tabbable={!grid} />
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

/**
 * The column name a phone card prints before a value: every value but the title (the identity
 * column) and the row actions is labelled by its header, a headerless column by its id. The unit
 * rides on the cell (`data-unit`), so the header's `(EUR)` is dropped.
 */
function labelOf<T>(planned: PlannedColumn, spec: KindSpec<T>): string {
  if (planned.identity || spec.kind === 'actions') return ''
  if (spec.header === '') return spec.id
  return spec.unit === undefined ? spec.header : spec.header.replace(` (${spec.unit})`, '')
}

/** What a body cell receives besides the row; one value per render of the body. */
export function cellEnvOf<T>(model: TableModel<T>): CellEnv {
  return {
    format: model.format,
    now: model.now,
    zone: model.zone,
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
  tree,
}: {
  model: TableModel<T>
  row: ModelRow<T>
  env: CellEnv
  /** `aria-rowindex` in a virtual window, where the mounted rows are not all the rows. */
  rowIndex?: number
  /** The row's place among nested rows. */
  tree?: TreeInfo | undefined
}): ReactElement {
  const { selection, keyboard } = model
  const columns = visibleColumns(model.specs, model.plan.columns)
  const offset = model.lead.cols + 1
  const ticked = selection?.isSelected(row.id) === true
  const active = model.activeId === row.id
  const rowProps = useRowFocusProps(row.id, row.original, keyboard.rowProps(row.id))
  // Controls in a row are tab stops only in the roving stop; a table without one leaves them all. A
  // grid roves its cells, so a control is reached through its cell (Enter or F2), never by Tab.
  const grid = model.look === 'grid'
  const tabbable = !grid && rowProps.tabIndex !== -1
  const lead = model.lead.cols
  const menu = model.rowMenu
  const hasMenu = menu !== undefined && menu.length > 0
  // The popup sits in the first cell: a tbody or tr cannot hold the portal's focus guards.
  const popup = hasMenu ? (
    <ContextMenuContent>{actionItems(row.original, menu)}</ContextMenuContent>
  ) : null
  const line = (
    <TableRow
      role="row"
      data-selected={ticked || active ? '' : undefined}
      aria-current={active ? 'true' : undefined}
      {...(rowIndex !== undefined && { 'aria-rowindex': rowIndex })}
      {...(tree !== undefined && {
        'aria-level': tree.level,
        'aria-setsize': tree.setSize,
        'aria-posinset': tree.posInSet,
        ...(tree.parent && { 'aria-expanded': tree.open }),
        'data-level': String(tree.level),
        style: { '--table-level': tree.level } as CSSProperties,
        ...(tree.context && { 'data-context': '' }),
      })}
      {...rowProps}
    >
      {selection !== undefined && (
        <TickCell
          selection={selection}
          id={row.id}
          ticked={ticked}
          tabbable={!grid}
          {...(grid && { cellProps: keyboard.cellProps(row.id, 0) })}
        />
      )}
      <RowNumberCell
        model={model}
        id={row.id}
        {...(grid && { cellProps: keyboard.cellProps(row.id, model.lead.tick ? 1 : 0) })}
      />
      {columns.map(({ spec, planned }, index) => {
        const { numeric, className } = alignProps(spec)
        const label = labelOf(planned, spec)
        return (
          <TableCell
            key={spec.id}
            role={grid ? 'gridcell' : 'cell'}
            aria-colindex={index + offset}
            {...keyboard.cellProps(row.id, index + lead)}
            {...cellAttributes(spec)}
            {...tierAttributes(planned, model.detailListed)}
            {...pinEdge(planned)}
            style={pinStyle(planned)}
            data-unit={spec.unit}
            {...(label !== '' && { 'data-label': label })}
            numeric={numeric}
            className={spec.wrap ? `${className ?? ''} whitespace-normal` : className}
          >
            {index === 0 && popup}
            {planned.identity && tree !== undefined ? (
              <div className="flex min-w-0 items-center gap-1">
                <TreeLead tree={tree} onToggle={() => model.toggleRow(row.id)} />
                <div className="min-w-0 flex-1 overflow-hidden text-ellipsis">
                  {content(spec, row.original, env, tabbable, grid)}
                </div>
                {model.expandable && (
                  <ExpandButton onOpen={() => model.openDetails(row.id)} tabbable={tabbable} />
                )}
              </div>
            ) : planned.identity && model.expandable ? (
              <div className="flex min-w-0 items-center gap-1">
                <div className="min-w-0 flex-1 overflow-hidden text-ellipsis">
                  {content(spec, row.original, env, tabbable, grid)}
                </div>
                <ExpandButton onOpen={() => model.openDetails(row.id)} tabbable={tabbable} />
              </div>
            ) : (
              content(spec, row.original, env, tabbable, grid)
            )}
          </TableCell>
        )
      })}
    </TableRow>
  )
  if (!hasMenu) return line
  // The row is the trigger: a right click, a long press or Shift+F10 opens the actions the "..."
  // button lists, from the same data.
  return (
    <ContextMenu>
      <ContextMenuTrigger render={line} />
    </ContextMenu>
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
    <DataRow model={model} row={item.row} env={env} tree={item.tree} {...index} />
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
    case 'offline':
      return <OfflineRow model={model} />
    case 'error':
      return <ErrorRow model={model} phase={phase} />
    case 'empty':
      return (
        <EmptyRow
          model={model}
          cause={phase.empty.cause}
          {...(phase.empty.action !== undefined && { action: phase.empty.action })}
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
  const sheet = useDetailHost(model, detail)
  const onPointerLeave = useRowFocusLeave()
  return (
    <TableBody
      role="rowgroup"
      {...bodyDensity(model)}
      {...model.keyboard.rootProps}
      {...(onPointerLeave !== undefined && { onPointerLeave })}
    >
      <PhaseBoundary fallback={({ reset }) => <ErrorRow model={model} retry={reset} />}>
        <Arm model={model} />
      </PhaseBoundary>
      {sheet}
    </TableBody>
  )
}
