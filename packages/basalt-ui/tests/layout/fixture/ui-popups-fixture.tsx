/**
 * The `ui-popups` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 15 to 17): a
 * popover, a tooltip, a menu with every part, a trigger-less menu on a virtual anchor, and a dialog
 * that holds a popover, on their own markup, no shell and no provider. It is the entry the
 * `ui-popups` layout test bundles; the harness is told to "mount" it by a no-op
 * `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each a `data-testid`:
 * - `up-open-popover`, `up-open-menu`, `up-tip`, `up-open-virtual`, `up-open-dialog`: the triggers
 *   (`up-tip` is the tooltip's trigger, opened by hover or keyboard focus);
 * - `up-popover-input`: the field inside the popover; `up-virtual-first`: the first item of the
 *   virtual menu; `up-nested-popover`: the popover trigger inside the dialog;
 * - `up-page`: the page content behind every overlay.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { Button } from '../../../src/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '../../../src/ui/dialog'
import { Input } from '../../../src/ui/input'
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
} from '../../../src/ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../../src/ui/popover'
import { Tooltip } from '../../../src/ui/tooltip'

/** The viewport-space point the virtual menu opens at. */
const POINT = { x: 120, y: 260 }

function VirtualMenu(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button data-testid="up-open-virtual" onClick={() => setOpen(true)}>
        Context
      </Button>
      <Menu open={open} onOpenChange={setOpen}>
        <MenuContent
          aria-label="Photo actions"
          anchor={{
            getBoundingClientRect: () => new DOMRect(POINT.x, POINT.y, 0, 0),
          }}
        >
          <MenuItem data-testid="up-virtual-first">Open</MenuItem>
          <MenuItem>Rename</MenuItem>
        </MenuContent>
      </Menu>
    </>
  )
}

function Fixture(): ReactElement {
  const [sort, setSort] = useState('name')
  return (
    <main
      className="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground"
      data-testid="up-page"
    >
      <h1 className="text-lg font-medium">Popups</h1>
      <div className="flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger render={<Button data-testid="up-open-popover" />}>Filters</PopoverTrigger>
          <PopoverContent aria-label="Filters" align="start">
            <Input aria-label="Name" defaultValue="basalt" data-testid="up-popover-input" />
          </PopoverContent>
        </Popover>
        <Tooltip label="Copy link">
          <Button size="icon" aria-label="Copy link" data-testid="up-tip">
            #
          </Button>
        </Tooltip>
        <Menu>
          <MenuTrigger render={<Button data-testid="up-open-menu" />}>Actions</MenuTrigger>
          <MenuContent align="start">
            <MenuItem>Rename</MenuItem>
            <MenuGroup label="Move to">
              <MenuItem>Inbox</MenuItem>
              <MenuSub label="Folder">
                <MenuItem>Archive</MenuItem>
                <MenuItem>Trash</MenuItem>
              </MenuSub>
            </MenuGroup>
            <MenuSeparator />
            <MenuCheckboxItem defaultChecked>Show grid</MenuCheckboxItem>
            <MenuRadioGroup value={sort} onValueChange={setSort}>
              <MenuRadioItem value="name">Name</MenuRadioItem>
              <MenuRadioItem value="date">Date</MenuRadioItem>
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <VirtualMenu />
        <Dialog>
          <DialogTrigger render={<Button data-testid="up-open-dialog" />}>Rename</DialogTrigger>
          <DialogContent title="Rename project">
            <Popover>
              <PopoverTrigger render={<Button data-testid="up-nested-popover" />}>
                Hint
              </PopoverTrigger>
              <PopoverContent aria-label="Hint">Letters and dashes only.</PopoverContent>
            </Popover>
          </DialogContent>
        </Dialog>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        The page behind the overlays: it must answer again once an overlay is closed.
      </p>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
