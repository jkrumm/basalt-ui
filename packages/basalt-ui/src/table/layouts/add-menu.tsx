/**
 * `+ View`'s menu when a table offers more than one layout: one entry per layout, its glyph in a tile,
 * its name and a one-line hint. A chunk of its own, loaded with the tab menu on the first intent.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Menu, MenuContent, MenuItem } from '../../ui/menu'
import type { TableModel } from '../use-data-table'
import { useLayoutOptions } from './toggle'

export type AddViewMenuProps = {
  model: TableModel<unknown>
  anchor: HTMLElement
  /** The id of the picked layout. */
  onPick: (layout: string) => void
  onClose: () => void
}

/** The layouts a new view may start in; picking one saves the view in it. */
export function AddViewMenu({ model, anchor, onPick, onClose }: AddViewMenuProps): ReactElement {
  const t = useMessages(table)
  const options = useLayoutOptions(model)
  return (
    <Menu
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <MenuContent anchor={anchor} align="start" aria-label={t('table.viewAddLayout')}>
        {options.map(({ value, label, hint, icon: Icon }) => (
          <MenuItem key={value} className="items-center gap-3 py-1.5" onClick={() => onPick(value)}>
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-inset bg-secondary text-muted-foreground"
            >
              <Icon className="size-icon" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm text-foreground">{label}</span>
              {hint !== undefined && <span className="text-xs text-muted-foreground">{hint}</span>}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
