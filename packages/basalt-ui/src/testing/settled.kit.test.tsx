/**
 * `testing.kit` (quality-contract section 10): `renderApp` plus `settled` drive Dialog, Popover,
 * Select, Menu, Tooltip and Tabs under `bun test`. The file runs in whichever DOM the process
 * registered: happy-dom in the plain run, jsdom in the child run `settled.kit.jsdom.test.ts` starts
 * with `tests/quality/ssr/bunfig.toml`. Each test is also a worked example of a rule `docs/testing.md`
 * teaches: popups need `findBy*`, Tooltip needs `delay={0}`, an open modal hides the rest.
 */
import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Select } from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Tooltip } from '../ui/tooltip'
import { installDomShims } from './dom-shims'
import { cleanupApp, renderApp } from './render-app'
import { settled } from './settled'
import { SLOTS } from './slots'

beforeAll(installDomShims)
afterEach(cleanupApp)

const slot = (name: string): Element | null => document.querySelector(`[data-slot="${name}"]`)

/** Base UI opens a menu on pointer down, a dialog and popover on click: send the whole press. */
function press(el: Element): void {
  fireEvent.pointerDown(el)
  fireEvent.mouseDown(el)
  fireEvent.pointerUp(el)
  fireEvent.mouseUp(el)
  fireEvent.click(el)
}

describe('testing.kit', () => {
  test('Dialog: opens on click, names itself, and hides the page behind it', async () => {
    renderApp(
      <Dialog>
        <DialogTrigger>Open rename</DialogTrigger>
        <DialogContent title="Rename" description="Shown in the sidebar.">
          Body
        </DialogContent>
      </Dialog>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    press(screen.getByRole('button', { name: 'Open rename' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename' })
    await settled()
    expect(dialog.getAttribute('data-slot')).toBe('dialog-content')
    // An open modal aria-hides the rest of the page: the trigger only resolves with `hidden: true`.
    expect(screen.queryByRole('button', { name: 'Open rename' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open rename', hidden: true })).toBeTruthy()
  })

  test('Popover: content is absent until the trigger is pressed', async () => {
    renderApp(
      <Popover>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent aria-label="Details panel">Popover body</PopoverContent>
      </Popover>,
    )
    expect(screen.queryByText('Popover body')).toBeNull()
    press(screen.getByRole('button', { name: 'Details' }))
    expect(await screen.findByText('Popover body')).toBeTruthy()
    await settled()
    expect(slot('popover-content')?.textContent).toContain('Popover body')
  })

  test('Select: the options form shows the label, and the list opens on press', async () => {
    renderApp(
      <Select
        aria-label="Stage"
        defaultValue="b"
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
      />,
    )
    const trigger = screen.getByRole('combobox', { name: 'Stage' })
    // `items` is how Select.Value maps "b" to "Beta"; without it the trigger would read "b".
    expect(trigger.textContent).toContain('Beta')
    press(trigger)
    const options = await screen.findAllByRole('option')
    await settled()
    expect(options.map((o) => o.textContent)).toEqual(['Alpha', 'Beta'])
  })

  test('Menu: items appear after the trigger is pressed', async () => {
    renderApp(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Rename</MenuItem>
          <MenuItem>Delete</MenuItem>
        </MenuContent>
      </Menu>,
    )
    expect(screen.queryByRole('menuitem')).toBeNull()
    press(screen.getByRole('button', { name: 'Actions' }))
    const items = await screen.findAllByRole('menuitem')
    await settled()
    expect(items.map((i) => i.textContent)).toEqual(['Rename', 'Delete'])
  })

  test('Tooltip: delay 0 opens on hover with no wait', async () => {
    renderApp(
      <Tooltip label="Copy link" delay={0}>
        <button type="button">Copy</button>
      </Tooltip>,
    )
    expect(slot('tooltip')).toBeNull()
    const trigger = screen.getByRole('button', { name: 'Copy' })
    fireEvent.pointerEnter(trigger)
    fireEvent.mouseEnter(trigger)
    fireEvent.pointerMove(trigger)
    fireEvent.mouseMove(trigger)
    expect((await screen.findByText('Copy link')).getAttribute('data-slot')).toBe('tooltip')
    await settled()
  })

  test('Tabs: selecting a tab swaps the panel', async () => {
    renderApp(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
      </Tabs>,
    )
    expect(screen.getByText('First panel')).toBeTruthy()
    press(screen.getByRole('tab', { name: 'Two' }))
    expect(await screen.findByText('Second panel')).toBeTruthy()
    await settled()
    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('settled', () => {
  test('waits for a router and a query client to go idle, then ends on a quiet tick', async () => {
    const router = { state: { isLoading: true, isTransitioning: false } }
    let fetching = 2
    const queryClient = { isFetching: () => fetching, isMutating: () => 0 }
    setTimeout(() => {
      router.state.isLoading = false
    }, 20)
    setTimeout(() => {
      fetching = 0
    }, 40)
    await settled({ router, queryClient })
    expect(router.state.isLoading).toBe(false)
    expect(fetching).toBe(0)
  })

  test('times out with the pending work named', async () => {
    const queryClient = { isFetching: () => 1, isMutating: () => 0 }
    await expect(settled({ queryClient, timeoutMs: 60 })).rejects.toThrow('1 queries fetching')
  })

  test('with no options it is the Base UI mount tick and resolves', async () => {
    await settled()
  })
})

describe('SLOTS', () => {
  test('re-exports the generated table, so selectors never name a class', async () => {
    expect(SLOTS.dialog).toContain('dialog-content')
    renderApp(
      <Dialog defaultOpen>
        <DialogContent title="Rename">Body</DialogContent>
      </Dialog>,
    )
    await settled()
    for (const part of ['dialog-content', 'dialog-title']) {
      expect(SLOTS.dialog as readonly string[]).toContain(part)
      expect(slot(part)).not.toBeNull()
    }
  })
})
