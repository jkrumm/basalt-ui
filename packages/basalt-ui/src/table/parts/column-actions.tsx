/**
 * The header's column menu, state half (docs/v3/concepts/data-table.md section 3): sort, hide and
 * reset for one column, all written through the table's one state (`setRequest` for the sort and
 * filters, `setDisplay` for visibility), so the chips, the Display popover and the URL stay in
 * step. The identity column never offers Hide, and `actions` has no menu. A filterable column adds
 * `Filter...` and a ranked status column `Order categories...`; each opens its panel where the
 * caller anchors it (`DataTableHead` anchors both to the header cell).
 */
import type { ReactElement, Ref } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Menu, MenuContent, MenuGroup, MenuItem, MenuSeparator, MenuTrigger } from '../../ui/menu'
import type { Aggregate, DataTableInstance } from '../contract'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { useAggregateLabel } from './footer'

/** What a column's menu offers: sort when it sorts, hide unless it is the identity column. */
export function columnActionsOf<T>(
  model: TableModel<T>,
  column: string,
): { sortable: boolean; hideable: boolean } | null {
  const index = model.specs.findIndex((spec) => spec.id === column)
  const spec = model.specs[index]
  const planned = model.plan.columns[index]
  if (spec === undefined || planned === undefined || spec.kind === 'actions') return null
  return { sortable: spec.sort !== null, hideable: !planned.identity }
}

/** Hides a column in the device lane; a hidden column is `visibility[id] === false`. */
function hide<T>(model: TableModel<T>, column: string): void {
  model.state.setDisplay({
    visibility: { ...model.state.display.visibility, [column]: false },
  })
}

/** Drops this column's sort, its filters and its visibility override: the column as declared. */
function reset<T>(model: TableModel<T>, column: string): void {
  const { request, display } = model.state
  const { [column]: _dropped, ...visibility } = display.visibility
  const { [column]: _rank, ...ranks } = request.ranks ?? {}
  model.state.setRequest({
    sort: request.sort.filter((entry) => entry.id !== column),
    filters: request.filters.filter((filter) => filter.id !== column),
    ranks,
  })
  model.state.setDisplay({ visibility })
}

/**
 * The column menu of one header: sort ascending, descending or off, hide, reset.
 *
 * @useWhen a bespoke head offers column actions from the column they act on
 * @neverWhen `DataTableHead` already offers them (it renders this menu), or for the actions column (it renders nothing)
 *
 * @example
 * <ColumnActionsMenu table={t} column="payee" />
 */
export function ColumnActionsMenu<T>({
  table: instance,
  column,
  className,
  onFilter,
  onOrder,
  triggerRef,
}: {
  table: DataTableInstance<T>
  /** The column id, as given to the kind constructor. */
  column: string
  /** Layout of the trigger (where it sits in its header). */
  className?: string
  /** Adds `Filter...`, which calls it: the caller opens the column's filter editor. */
  onFilter?: () => void
  /** Adds `Order categories...`, which calls it: the caller opens the column's order list. */
  onOrder?: () => void
  /** The menu's trigger, where focus returns when a panel it opened closes. */
  triggerRef?: Ref<HTMLButtonElement>
}): ReactElement | null {
  const model = modelOf(instance)
  const t = useMessages(table)
  const aggregateLabel = useAggregateLabel()
  const offered = columnActionsOf(model, column)
  const spec = model.specs.find((s) => s.id === column)
  if (offered === null || spec === undefined) return null
  const direction = model.sortOf(column)
  const { sortable, hideable } = offered
  // A move steps over the columns the reader sees in the same group (pinned or not), so every
  // click changes the drawn order; the identity column and `actions` never move.
  const shown = new Set(model.plan.columns.flatMap((c) => (c.visible ? [c.id] : [])))
  const pinned = model.look === 'grid' && model.pinnedOf(column)
  const peers = model.movable.filter(
    (id) => shown.has(id) && (model.look === 'grid' && model.pinnedOf(id)) === pinned,
  )
  const at = peers.indexOf(column)
  const before = at > 0 ? peers[at - 1] : undefined
  const after = at >= 0 ? peers[at + 1] : undefined
  const moveNext = (to: string | undefined): void => {
    if (to !== undefined) model.moveColumn(column, model.movable.indexOf(to))
  }
  const { request } = model.state
  const groupable = model.groupable(column)
  const grouped = model.groupBy === column
  const aggregates = model.aggregatesOf(column)
  const widened = model.state.display.widths?.[column] !== undefined
  const touched =
    direction !== 'none' ||
    request.filters.some((f) => f.id === column) ||
    request.ranks?.[column] !== undefined ||
    model.state.display.visibility[column] !== undefined
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            {...(triggerRef !== undefined && { ref: triggerRef })}
            size="sm"
            shape="icon"
            variant="ghost"
            {...(className !== undefined && { className })}
            aria-label={t('table.columnActions', spec.header)}
          />
        }
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M3 5l5 6 5-6z" />
        </svg>
      </MenuTrigger>
      <MenuContent align="end">
        {sortable && (
          <>
            <MenuItem
              disabled={direction === 'asc'}
              onClick={() => model.state.setRequest({ sort: [{ id: column, desc: false }] })}
            >
              {t('table.sortAsc')}
            </MenuItem>
            <MenuItem
              disabled={direction === 'desc'}
              onClick={() => model.state.setRequest({ sort: [{ id: column, desc: true }] })}
            >
              {t('table.sortDesc')}
            </MenuItem>
            <MenuItem
              disabled={direction === 'none'}
              onClick={() => model.state.setRequest({ sort: [] })}
            >
              {t('table.sortClear')}
            </MenuItem>
            <MenuSeparator />
          </>
        )}
        {(onFilter !== undefined || onOrder !== undefined) && (
          <>
            {onFilter !== undefined && (
              <MenuItem onClick={onFilter}>{t('table.headerFilter')}</MenuItem>
            )}
            {onOrder !== undefined && (
              <MenuItem onClick={onOrder}>{t('table.orderCategories')}</MenuItem>
            )}
            <MenuSeparator />
          </>
        )}
        {at >= 0 && (
          <>
            <MenuItem disabled={before === undefined} onClick={() => moveNext(before)}>
              {t('table.moveLeft')}
            </MenuItem>
            <MenuItem disabled={after === undefined} onClick={() => moveNext(after)}>
              {t('table.moveRight')}
            </MenuItem>
            {model.look === 'grid' && (
              <MenuItem onClick={() => model.setPinned(column, !model.pinnedOf(column))}>
                {model.pinnedOf(column) ? t('table.unpinColumn') : t('table.pinColumn')}
              </MenuItem>
            )}
            <MenuSeparator />
          </>
        )}
        {(groupable || aggregates.length > 0) && (
          <>
            {groupable && (
              <MenuItem onClick={() => model.setGroupBy(grouped ? null : column)}>
                {grouped ? t('table.groupNone') : t('table.groupBy', spec.header)}
              </MenuItem>
            )}
            {aggregates.length > 0 && (
              // The column's summary: the one it prints is disabled, as the sort it has is.
              <MenuGroup label={t('table.summaryMenu')}>
                {[...aggregates, 'none' as const].map((fn: Aggregate | 'none') => (
                  <MenuItem
                    key={fn}
                    disabled={(model.aggregateOf(column) ?? 'none') === fn}
                    onClick={() => model.setAggregate(column, fn)}
                  >
                    {aggregateLabel(fn)}
                  </MenuItem>
                ))}
              </MenuGroup>
            )}
            <MenuSeparator />
          </>
        )}
        {hideable && (
          <MenuItem onClick={() => hide(model, column)}>{t('table.hideColumn')}</MenuItem>
        )}
        {widened && (
          <MenuItem onClick={() => model.setWidth(column, undefined)}>
            {t('table.resetWidth')}
          </MenuItem>
        )}
        <MenuItem disabled={!touched} onClick={() => reset(model, column)}>
          {t('table.resetColumn')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
