/**
 * The active view tab's own menu: Save and Discard while modified, then edit, rename, copy link,
 * duplicate, default, move and export, each gated by what the store can. A chunk of its own, loaded
 * on the first intent on the strip, so a table's toolbar does not carry `ui/menu` at rest.
 */
import type { ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Menu, MenuContent, MenuItem, MenuSeparator } from '../../ui/menu'
import type { View } from '../contract'
import type { ViewsController } from './views'

export type TabMenuProps = {
  c: ViewsController<unknown>
  view: View
  anchor: HTMLElement
  onClose: () => void
}

/** The active tab's own menu: what a view can do, each item gated by what the store can. */
export function TabMenu({ c, view, anchor, onClose }: TabMenuProps): ReactElement {
  const t = useMessages(table)
  const at = c.list.views.findIndex((v) => v.id === view.id)
  const last = c.list.views.length - 1
  return (
    <Menu
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <MenuContent anchor={anchor} align="start" aria-label={t('table.viewMenu', view.name)}>
        {c.modified && (
          <>
            <MenuItem onClick={() => void c.save()}>{t('table.viewMenuSave')}</MenuItem>
            <MenuItem onClick={c.discard}>{t('table.viewMenuDiscard')}</MenuItem>
            <MenuSeparator />
          </>
        )}
        <MenuItem onClick={() => c.show('root')}>{t('table.viewMenuEdit')}</MenuItem>
        <MenuItem onClick={() => c.show('name')}>{t('table.viewRename')}</MenuItem>
        <MenuItem onClick={() => void navigator.clipboard?.writeText(c.link())}>
          {t('table.viewCopyLink')}
        </MenuItem>
        <MenuItem onClick={() => void c.duplicate(view.id)}>{t('table.viewDuplicate')}</MenuItem>
        <MenuItem onClick={() => void c.setDefault(view.default === true ? undefined : view.id)}>
          {view.default === true ? t('table.viewUnsetDefault') : t('table.viewSetDefault')}
        </MenuItem>
        {c.list.canReorder && (
          <>
            <MenuSeparator />
            <MenuItem disabled={at <= 0} onClick={() => void c.move(view.id, -1)}>
              {t('table.viewMoveLeft')}
            </MenuItem>
            <MenuItem disabled={at >= last} onClick={() => void c.move(view.id, 1)}>
              {t('table.viewMoveRight')}
            </MenuItem>
          </>
        )}
        {c.onExport !== undefined && (
          <>
            <MenuSeparator />
            <MenuItem onClick={c.onExport}>{t('table.viewExport')}</MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuItem onClick={() => c.show('remove')}>{t('table.viewDelete')}</MenuItem>
      </MenuContent>
    </Menu>
  )
}
