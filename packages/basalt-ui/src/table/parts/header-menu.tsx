/**
 * The header's column menu, filter half (docs/v3/concepts/data-table.md section 3): a `Menu`
 * whose `Filter...` item opens the SAME kind editor the toolbar's `+ Filter` does, anchored to the
 * header, so a column is filtered where the user is looking at it. Sort, hide and reset join this
 * menu with the tri-state header (v3-table-t3b); this part is the filter item only.
 */
import { useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu'
import { Popover, PopoverContent } from '../../ui/popover'
import type { DataTableInstance } from '../contract'
import { modelOf } from '../use-data-table'
import { FilterEditor } from './toolbar-editor'
import { filterableSpecs } from './toolbar-filters'

/**
 * The column menu of one header with its `Filter...` item. Renders nothing for a column that has
 * no `f.<col>` field (a kind with no filter).
 *
 * @useWhen a bespoke header offers filtering from the column it filters
 * @neverWhen the kind of the column is not filterable (it renders nothing) or `DataTableHead` already offers it
 *
 * @example
 * <HeaderFilterMenu table={t} column="payee" />
 */
export function HeaderFilterMenu<T>({
  table: instance,
  column,
}: {
  table: DataTableInstance<T>
  /** The column id, as given to the kind constructor. */
  column: string
}): ReactElement | null {
  const model = modelOf(instance)
  const t = useMessages(table)
  const anchor = useRef<HTMLButtonElement | null>(null)
  const [editing, setEditing] = useState(false)
  const spec = filterableSpecs(model.specs).find((s) => s.id === column)
  if (spec === undefined) return null
  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              ref={anchor}
              size="icon-sm"
              variant="ghost"
              aria-label={t('table.headerMenu', spec.header)}
            />
          }
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
            <path d="M3 5l5 6 5-6z" />
          </svg>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onClick={() => setEditing(true)}>{t('table.headerFilter')}</MenuItem>
        </MenuContent>
      </Menu>
      <Popover open={editing} onOpenChange={setEditing}>
        <PopoverContent anchor={anchor} aria-label={t('table.headerFilter')} align="start">
          <FilterEditor model={model} spec={spec} />
        </PopoverContent>
      </Popover>
    </>
  )
}
