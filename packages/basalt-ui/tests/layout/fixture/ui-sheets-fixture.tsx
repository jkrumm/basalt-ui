/**
 * The `ui-sheets` fixture: the list overlays on their own markup, no shell and no provider. The
 * test opens it at a phone width with a coarse pointer (a sheet) and at 1440 with a fine one (the
 * anchored popup). Probes, each in a `data-testid` box: `us-select` (an options Select), `us-parts`
 * (the parts form), `us-search` (a searchable Select), `us-forced` (`present="popup"` on a phone),
 * `us-nested` (a Sheet whose body holds a Select), `us-menu` (a Menu with a submenu and a
 * destructive row last), `us-combo` (a Combobox), `us-popover-short` and `us-popover-tall` (a
 * Popover that fits and one that does not), `us-date` (a DatePicker), `us-sheet-menu`
 * (`present="sheet"`, forced).
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { Button } from '../../../src/ui/button'
import { Dock } from '../../../src/page/dock'
import { Combobox } from '../../../src/ui/combobox'
import { Dialog, DialogContent, DialogTrigger } from '../../../src/ui/dialog'
import { Input } from '../../../src/ui/input'
import { DatePicker } from '../../../src/ui/date-picker'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
} from '../../../src/ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../../src/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/ui/select'
import { Sheet, SheetContent, SheetTrigger } from '../../../src/ui/sheet'

const STAGES = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
  { value: 'd', label: 'Delta' },
]
const MANY = Array.from({ length: 40 }, (_, i) => ({
  value: `o${i + 1}`,
  label: `Option ${String(i + 1).padStart(2, '0')}`,
}))
const ROW = 'flex flex-col gap-1 text-sm'

function Controlled(): ReactElement {
  const [value, setValue] = useState<string | null>('b')
  return (
    <Select
      aria-label="Stage"
      options={STAGES}
      value={value}
      onValueChange={(next) => setValue(next)}
    />
  )
}

function DockProbe(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dock</Button>
      {open && (
        <Dock title="Issue 12" onClose={() => setOpen(false)}>
          <p>Record body</p>
        </Dock>
      )}
    </>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Sheets</h1>
      <div className={ROW} data-testid="us-select">
        <span>Select</span>
        <Controlled />
      </div>
      <div className={ROW} data-testid="us-parts">
        <span>Parts</span>
        <Select aria-label="Parts" defaultValue="a">
          <SelectTrigger aria-label="Parts">
            <SelectValue />
          </SelectTrigger>
          <SelectContent aria-label="Parts">
            {STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={ROW} data-testid="us-search">
        <span>Searchable</span>
        <Select aria-label="Searchable" options={MANY} searchable placeholder="Pick one" />
      </div>
      <div className={ROW} data-testid="us-forced">
        <span>Forced popup</span>
        <Select aria-label="Forced" options={STAGES} present="popup" placeholder="Pick one" />
      </div>
      <div className={ROW} data-testid="us-menu">
        <Menu>
          <MenuTrigger render={<Button />}>Actions</MenuTrigger>
          <MenuContent aria-label="Actions">
            <MenuItem>Rename</MenuItem>
            <MenuSub label="Move to">
              <MenuItem>Inbox</MenuItem>
              <MenuItem>Archive</MenuItem>
            </MenuSub>
            <MenuSeparator />
            <MenuItem>Delete</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className={ROW} data-testid="us-sheet-menu">
        <Menu present="sheet">
          <MenuTrigger render={<Button />}>Forced sheet</MenuTrigger>
          <MenuContent aria-label="Forced">
            <MenuItem>One</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className={ROW} data-testid="us-combo">
        <Combobox aria-label="Option" options={MANY} placeholder="Search options" />
      </div>
      <div className={ROW} data-testid="us-popover-short">
        <Popover>
          <PopoverTrigger render={<Button />}>Short</PopoverTrigger>
          <PopoverContent aria-label="Short">A line</PopoverContent>
        </Popover>
      </div>
      <div className={ROW} data-testid="us-popover-tall">
        <Popover>
          <PopoverTrigger render={<Button />}>Tall</PopoverTrigger>
          <PopoverContent aria-label="Tall">
            {Array.from({ length: 60 }, (_, i) => (
              <p key={i}>Line {i + 1}</p>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className={ROW} data-testid="us-date">
        <DatePicker aria-label="Due" defaultValue="2026-11-24" />
      </div>
      <div className={ROW} data-testid="us-dialog-form">
        <Dialog>
          <DialogTrigger render={<Button />}>Edit form</DialogTrigger>
          <DialogContent title="Edit record" form>
            <Input aria-label="Name" />
          </DialogContent>
        </Dialog>
      </div>
      <div className={ROW} data-testid="us-dialog-confirm">
        <Dialog>
          <DialogTrigger render={<Button />}>Confirm</DialogTrigger>
          <DialogContent title="Discard changes" size="sm">
            Sure?
          </DialogContent>
        </Dialog>
      </div>
      <div className={ROW} data-testid="us-dock">
        <DockProbe />
      </div>
      <div className={ROW} data-testid="us-nested">
        <Sheet>
          <SheetTrigger render={<Button />}>Edit</SheetTrigger>
          <SheetContent title="Edit record">
            <Select aria-label="Status" options={STAGES} placeholder="Status" />
          </SheetContent>
        </Sheet>
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
