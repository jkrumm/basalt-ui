/**
 * The `ui-context-menu` fixture: one row whose "..." menu and right-click menu are drawn from one
 * action list, a row with a text field, and a row pinned to the bottom-right corner. No shell and
 * no provider. The harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each a `data-testid`: `cm-row` (the trigger, focusable), `cm-more` (its "..." button),
 * `cm-field` (a text field inside the row), `cm-corner` (a trigger at the viewport's bottom right).
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { Button } from '../../../src/ui/button'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '../../../src/ui/context-menu'
import { Input } from '../../../src/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../../src/ui/menu'

const ACTIONS = ['Rename', 'Duplicate', 'Archive', 'Delete']

const items = (): ReactElement[] => ACTIONS.map((label) => <MenuItem key={label}>{label}</MenuItem>)

function Fixture(): ReactElement {
  return (
    <main className="relative flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
      <h1 className="text-lg font-medium">Context menu</h1>
      <ContextMenu>
        <ContextMenuTrigger
          data-testid="cm-row"
          tabIndex={0}
          className="flex h-10 items-center gap-2 rounded-ctrl border border-border px-3 data-popup-open:bg-accent"
        >
          <span>Invoice 1042</span>
          <Input aria-label="Note" defaultValue="paid" data-testid="cm-field" className="w-32" />
          <Menu>
            <MenuTrigger render={<Button data-testid="cm-more" />}>More</MenuTrigger>
            <MenuContent align="end">{items()}</MenuContent>
          </Menu>
        </ContextMenuTrigger>
        <ContextMenuContent>{items()}</ContextMenuContent>
      </ContextMenu>
      <ContextMenu>
        <ContextMenuTrigger
          data-testid="cm-corner"
          tabIndex={0}
          className="fixed right-0 bottom-0 flex h-10 w-40 items-center bg-card px-3"
        >
          Corner
        </ContextMenuTrigger>
        <ContextMenuContent>{items()}</ContextMenuContent>
      </ContextMenu>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
