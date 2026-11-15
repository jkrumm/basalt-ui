/**
 * One palette per app (shell cycle 1, shell-1.9): under `BasaltProvider` and a v3 `AppShell`, the
 * provider's 2.x Spotlight stands down even when a 2.x `defineCommands` registered it, so Mod+K and
 * the shell's search row both open the one `CommandPalette`, and it lists every `defineNav` item.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Outlet, createMemoryHistory, createRootRoute, createRoute } from '@tanstack/react-router'
import { spotlight } from '@mantine/spotlight'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import { resetCommandStash } from '../commands/command-stash'
import { defineCommands as defineLegacyCommands } from '../commands/define-commands'
import { AppShell } from '../shell/app-shell'
import { isApplePlatform } from '../shell/commands/chord'
import { CommandPalette } from '../shell/commands/command-palette'
import { defineCommands } from '../shell/commands/define-commands'
import type { AppShellProps } from '../shell/contract'
import { createBasaltRouter } from './create-router'
import { BasaltProvider } from './index'
import { resetSlots } from './slots'

const NAV = {
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'home', label: 'Overview', link: { to: '/' }, mobile: 'tab' },
        { id: 'runs', label: 'Runs', link: { to: '/runs' }, mobile: 'tab' },
      ],
    },
  ],
  pinned: [{ id: 'jobs', label: 'Jobs', link: { to: '/jobs' }, mobile: 'more' }],
} satisfies AppShellProps['nav']

const COMMANDS = defineCommands({ deploy: { label: 'Deploy now', run: () => {} } })

function Root() {
  const [open, setOpen] = useState(false)
  return (
    <AppShell nav={NAV} brand={{ name: 'Basalt' }} search={{ onOpen: () => setOpen(true) }}>
      <Outlet />
      <CommandPalette commands={COMMANDS} open={open} onOpenChange={setOpen} />
    </AppShell>
  )
}

function shellRouter() {
  const root = createRootRoute({ component: Root })
  const page = (path: string) =>
    createRoute({ getParentRoute: () => root, path, component: () => <div>page {path}</div> })
  return createBasaltRouter({
    routeTree: root.addChildren([page('/'), page('/runs'), page('/jobs')]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
}

function pressModK(): void {
  const apple = isApplePlatform()
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        bubbles: true,
        cancelable: true,
        metaKey: apple,
        ctrlKey: !apple,
      }),
    )
  })
}

const rows = (): string[] =>
  [...document.querySelectorAll('[data-slot="autocomplete-item"]')].map(
    (el) => el.querySelector('span')?.textContent ?? '',
  )

const NAV_ROWS = ['Go to Overview', 'Go to Runs', 'Go to Jobs']

describe('one palette under BasaltProvider and a v3 AppShell', () => {
  beforeEach(() => {
    resetSlots()
    resetCommandStash()
    // A 2.x registry, as a migrating app has: it registers the provider's Spotlight slot.
    defineLegacyCommands({ 'legacy:hello': { label: 'Legacy hello', run: () => {} } })
  })
  afterEach(() => {
    cleanup()
    spotlight.close()
    resetSlots()
    resetCommandStash()
  })

  test('Mod+K opens one dialog, the CommandPalette, listing every defineNav item', async () => {
    render(<BasaltProvider router={shellRouter()} />)
    await screen.findByText('page /')
    pressModK()
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    expect(document.querySelectorAll('[data-slot="dialog-content"]')).toHaveLength(1)
    expect(document.querySelector('[data-slot="command-palette"]')).not.toBeNull()
    expect(document.querySelector('.mantine-Spotlight-search')).toBeNull()
    expect(rows()).toEqual(expect.arrayContaining([...NAV_ROWS, 'Deploy now']))
  })

  test('the shell search row opens the same palette', async () => {
    render(<BasaltProvider router={shellRouter()} />)
    await screen.findByText('page /')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    expect(document.querySelectorAll('[data-slot="dialog-content"]')).toHaveLength(1)
    expect(rows()).toEqual(expect.arrayContaining(NAV_ROWS))
  })

  test('the Spotlight is not mounted while the shell is, so spotlight.open() opens nothing', async () => {
    render(<BasaltProvider router={shellRouter()} />)
    await screen.findByText('page /')
    await act(async () => {
      spotlight.open()
    })
    expect(document.querySelector('.mantine-Spotlight-search')).toBeNull()
  })
})
