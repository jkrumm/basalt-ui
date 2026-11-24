/**
 * The overlays on a phone (Issue 3207): each list overlay opens as a bottom sheet on a compact
 * viewport with a coarse pointer, and as the anchored popup on a desktop. Open this page at 390 wide
 * with a touch pointer, and at 1440 with a mouse, to see both forms of every part. A part's
 * `present` prop forces `popup` or `sheet`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { FormField } from 'basalt-ui/controls'
import { Dock, Page, Section } from 'basalt-ui/page'
import { Button } from 'basalt-ui/ui/button'
import { Card } from 'basalt-ui/ui/card'
import { Combobox } from 'basalt-ui/ui/combobox'
import { DatePicker } from 'basalt-ui/ui/date-picker'
import { Dialog, DialogContent, DialogTrigger } from 'basalt-ui/ui/dialog'
import { Field } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuTrigger } from 'basalt-ui/ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from 'basalt-ui/ui/popover'
import { Select } from 'basalt-ui/ui/select'
import { Sheet, SheetContent, SheetTrigger } from 'basalt-ui/ui/sheet'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { openPalette } from '../../lib/palette-open'
import { useSpecimen } from './forms/-specimen'

const STAGES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'build', label: 'Build' },
  { value: 'review', label: 'Review' },
  { value: 'shipped', label: 'Shipped' },
]
const OWNERS = Array.from({ length: 40 }, (_, i) => ({
  value: `owner-${i + 1}`,
  label: `Owner ${String(i + 1).padStart(2, '0')}`,
}))

function StageField(): ReactElement {
  const field = useSpecimen<string | null>('build')
  return (
    <FormField label="Stage" field={field}>
      <Select aria-label="Stage" options={STAGES} />
    </FormField>
  )
}

function OwnerField(): ReactElement {
  const field = useSpecimen<string | null>(null)
  return (
    <FormField label="Owner" field={field}>
      <Select aria-label="Owner" options={OWNERS} searchable placeholder="Pick an owner" />
    </FormField>
  )
}

function AssigneeField(): ReactElement {
  const field = useSpecimen<string | null>(null)
  return (
    <FormField label="Assignee" field={field}>
      <Combobox aria-label="Assignee" options={OWNERS} placeholder="Search people" />
    </FormField>
  )
}

function StatusField(): ReactElement {
  const field = useSpecimen<string | null>(null)
  return (
    <FormField label="Status" field={field}>
      <Select aria-label="Status" options={STAGES} placeholder="Status" />
    </FormField>
  )
}

function Case({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
        {children}
      </div>
    </Card>
  )
}

function DockCase(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the dock</Button>
      {open && (
        <Dock title="Issue 12" tag="#12" onClose={() => setOpen(false)}>
          <p className="text-sm text-muted-foreground">
            The record rests at half height on a phone and drags to full.
          </p>
        </Dock>
      )}
    </>
  )
}

function OverlaysRoute(): ReactElement {
  return (
    <Page area="kit-overlays">
      <Section
        title="Pickers"
        summary="A list opens as a sheet from the bottom on a phone: rows at 44 px, the search field on top."
      >
        <div className="grid gap-2">
          <Case title="Select" note="Four options, the check on the chosen one.">
            <StageField />
          </Case>
          <Case title="Select, searchable" note="The search field sits at the top of the sheet.">
            <OwnerField />
          </Case>
          <Case
            title="Combobox"
            note="The field on the page opens the sheet; the keyboard rises with its search field."
          >
            <AssigneeField />
          </Case>
          <Case title="Menu" note="An action sheet: the destructive row last.">
            <Menu>
              <MenuTrigger render={<Button />}>Actions</MenuTrigger>
              <MenuContent aria-label="Actions">
                <MenuItem>Rename</MenuItem>
                <MenuItem>Duplicate</MenuItem>
                <MenuSub label="Move to">
                  <MenuItem>Inbox</MenuItem>
                  <MenuItem>Archive</MenuItem>
                </MenuSub>
                <MenuSeparator />
                <MenuItem>Delete</MenuItem>
              </MenuContent>
            </Menu>
          </Case>
          <Case title="DatePicker" note="The calendar in a sheet with Done.">
            <DatePicker aria-label="Due date" defaultValue="2026-11-24" />
          </Case>
        </div>
      </Section>
      <Section
        title="Panels"
        summary="A popover stays anchored unless it does not fit; a form dialog and the palette take the whole height."
      >
        <div className="grid gap-2">
          <Case title="Popover, short" note="Fits next to its trigger: stays a popover.">
            <Popover>
              <PopoverTrigger render={<Button />}>Filters</PopoverTrigger>
              <PopoverContent aria-label="Filters">Three filters fit here.</PopoverContent>
            </Popover>
          </Case>
          <Case
            title="Popover, tall"
            note="Taller than the viewport leaves it: lifts into a sheet."
          >
            <Popover>
              <PopoverTrigger render={<Button />}>Release notes</PopoverTrigger>
              <PopoverContent aria-label="Release notes">
                {Array.from({ length: 40 }, (_, i) => (
                  <p key={i}>Note {i + 1}</p>
                ))}
              </PopoverContent>
            </Popover>
          </Case>
          <Case
            title="Dialog, form"
            note="A form takes the full height from the bottom on a phone; a confirm stays centred."
          >
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger render={<Button />}>Edit record</DialogTrigger>
                <DialogContent title="Edit record" form>
                  <Field label="Name">
                    <Input autoComplete="off" />
                  </Field>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger render={<Button variant="secondary" />}>Discard</DialogTrigger>
                <DialogContent title="Discard changes" size="sm">
                  The edits are lost.
                </DialogContent>
              </Dialog>
            </div>
          </Case>
          <Case title="Command palette" note="A full-height sheet with the field on top.">
            <Button onClick={openPalette}>Open the palette</Button>
          </Case>
          <Case title="Dock" note="A sheet with two rests, half and full.">
            <DockCase />
          </Case>
          <Case title="Select inside a Sheet" note="Opens a nested sheet; both close in order.">
            <Sheet>
              <SheetTrigger render={<Button />}>Edit in a sheet</SheetTrigger>
              <SheetContent title="Edit record">
                <StatusField />
              </SheetContent>
            </Sheet>
          </Case>
        </div>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/overlays')({ component: OverlaysRoute })
