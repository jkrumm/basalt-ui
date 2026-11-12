/**
 * `CommandPalette` and the chord listener without a browser layout: the palette opens on Mod+K, ranks
 * with the app's `rank`, Escape closes only the top layer, a bare Enter or Space still reaches the
 * control that has focus, and Mod+N follows the `defineNav` order. Geometry is the layout suite's.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { Page } from '../../page/page'
import { Dialog, DialogContent } from '../../ui/dialog'
import { AppShell } from '../app-shell'
import type { AppShellProps } from '../contract'
import { isApplePlatform } from './chord'
import { CommandPalette } from './command-palette'
import type { CommandPaletteProps } from './command-palette'
import { defineCommands } from './define-commands'
import type { CommandSet } from './define-commands'

const NAV = {
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'home', label: 'Overview', link: { to: '/' }, mobile: 'tab' },
        { id: 'runs', label: 'Runs', link: { to: '/runs' }, mobile: 'tab' },
        { id: 'jobs', label: 'Jobs', link: { to: '/jobs' }, mobile: 'tab' },
      ],
    },
  ],
} satisfies AppShellProps['nav']

afterEach(cleanup)

/** A keydown on the focused element (or the body), with Mod mapped to this platform's key. */
function press(key: string, init: { mod?: boolean; target?: Element } = {}): KeyboardEvent {
  const apple = isApplePlatform()
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    metaKey: init.mod === true && apple,
    ctrlKey: init.mod === true && !apple,
  })
  act(() => {
    ;(init.target ?? document.activeElement ?? document.body).dispatchEvent(event)
  })
  return event
}

type Mount = {
  commands: CommandSet
  rank?: CommandPaletteProps['rank']
  body?: ReactElement
  area?: string
  onOpenChange?: CommandPaletteProps['onOpenChange']
}

async function mountShell({ commands, rank, body, area, onOpenChange }: Mount) {
  const root = createRootRoute({
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
        <CommandPalette
          commands={commands}
          {...(rank !== undefined && { rank })}
          {...(onOpenChange !== undefined && { onOpenChange })}
        />
      </AppShell>
    ),
  })
  const page = (path: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => <Page {...(area !== undefined && { area })}>{body ?? 'page'}</Page>,
    })
  const router = createRouter({
    routeTree: root.addChildren([page('/'), page('/runs'), page('/jobs')]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(document.querySelector('[data-slot="shell"]')).not.toBeNull())
  return router
}

const labels = (): string[] =>
  [...document.querySelectorAll('[data-slot="autocomplete-item"]')].map(
    (el) => el.querySelector('span')?.textContent ?? '',
  )

describe('chords', () => {
  test('a chord runs its command and prevents the default', async () => {
    const run = mock(() => {})
    await mountShell({ commands: defineCommands({ save: { label: 'Save', chord: 'Mod+J', run } }) })
    const event = press('j', { mod: true })
    expect(run).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  test('enabled() is read at the key press', async () => {
    let on = false
    const run = mock(() => {})
    await mountShell({
      commands: defineCommands({ save: { label: 'Save', chord: 'Mod+J', enabled: () => on, run } }),
    })
    press('j', { mod: true })
    expect(run).toHaveBeenCalledTimes(0)
    on = true
    press('j', { mod: true })
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('an area command fires only while focus is inside that Page area', async () => {
    const run = mock(() => {})
    await mountShell({
      area: 'runs',
      body: <button type="button">inside</button>,
      commands: defineCommands({ next: { label: 'Next', chord: 'Mod+J', area: 'jobs', run } }),
    })
    screen.getByText('inside').focus()
    press('j', { mod: true })
    expect(run).toHaveBeenCalledTimes(0)
  })

  test('an area command fires in its area', async () => {
    const run = mock(() => {})
    await mountShell({
      area: 'runs',
      body: <button type="button">inside</button>,
      commands: defineCommands({ next: { label: 'Next', chord: 'Mod+J', area: 'runs', run } }),
    })
    screen.getByText('inside').focus()
    press('j', { mod: true })
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('Enter and Space on a focused button and input still reach the control', async () => {
    const run = mock(() => {})
    const seen: string[] = []
    await mountShell({
      body: (
        <>
          <button type="button" onKeyDown={(e) => seen.push(`button:${e.key}`)}>
            go
          </button>
          <input aria-label="name" onKeyDown={(e) => seen.push(`input:${e.key}`)} />
        </>
      ),
      commands: defineCommands({
        enter: { label: 'Enter', chord: 'Enter', run },
        space: { label: 'Space', chord: 'Space', run },
      }),
    })
    for (const target of [screen.getByText('go'), screen.getByLabelText('name')]) {
      for (const key of ['Enter', ' ']) {
        const event = press(key, { target })
        expect(event.defaultPrevented).toBe(false)
      }
    }
    expect(run).toHaveBeenCalledTimes(0)
    expect(seen).toEqual(['button:Enter', 'button: ', 'input:Enter', 'input: '])
  })

  test('a bare Enter with nothing interactive focused still runs its command', async () => {
    const run = mock(() => {})
    await mountShell({
      commands: defineCommands({ enter: { label: 'Enter', chord: 'Enter', run } }),
    })
    press('Enter', { target: document.body })
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('shell commands', () => {
  test('Mod+2 goes to the second defineNav item', async () => {
    const router = await mountShell({ commands: defineCommands({}) })
    press('2', { mod: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs'))
    press('3', { mod: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'))
  })

  test('Mod+B toggles the rail', async () => {
    await mountShell({ commands: defineCommands({}) })
    const shell = document.querySelector('[data-slot="shell"]')
    const before = shell?.getAttribute('data-rail')
    press('b', { mod: true })
    await waitFor(() => expect(shell?.getAttribute('data-rail')).not.toBe(before))
  })
})

function Under(): ReactElement {
  const [open, setOpen] = useState(true)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Underneath">body</DialogContent>
    </Dialog>
  )
}

describe('palette', () => {
  const COMMANDS = defineCommands({
    deploy: { label: 'Deploy now', chord: 'Mod+J', group: 'Ops', run: () => {} },
    secret: { label: 'Secret', listed: false, run: () => {} },
    off: { label: 'Off', enabled: () => false, run: () => {} },
  })

  test('opens on Mod+K and lists commands and nav destinations, not unlisted or disabled ones', async () => {
    await mountShell({ commands: COMMANDS })
    expect(document.querySelector('[data-slot="command-palette"]')).toBeNull()
    press('k', { mod: true })
    await waitFor(() => expect(labels().length).toBeGreaterThan(0))
    const rows = labels()
    expect(rows).toContain('Deploy now')
    expect(rows).toContain('Go to Runs')
    expect(rows).toContain('Toggle sidebar')
    expect(rows).not.toContain('Secret')
    expect(rows).not.toContain('Off')
    expect(rows).not.toContain('Command palette')
  })

  test('ranks with the default rank: a prefix beats a later substring', async () => {
    await mountShell({ commands: COMMANDS })
    press('k', { mod: true })
    const input = await screen.findByLabelText('Search commands')
    fireEvent.change(input, { target: { value: 'dep' } })
    await waitFor(() => expect(labels()[0]).toBe('Deploy now'))
  })

  test('ranks with a custom rank()', async () => {
    const rank = mock((query: string, items: readonly { label: string }[]) =>
      items.filter((item) => item.label.startsWith('Go to')).toReversed(),
    )
    await mountShell({ commands: COMMANDS, rank: rank as never })
    press('k', { mod: true })
    await waitFor(() => expect(labels()).toEqual(['Go to Jobs', 'Go to Runs', 'Go to Overview']))
    expect(rank).toHaveBeenCalled()
  })

  test('choosing a row closes the palette and runs the command', async () => {
    const run = mock(() => {})
    await mountShell({ commands: defineCommands({ x: { label: 'Do it', run } }) })
    press('k', { mod: true })
    fireEvent.click(await screen.findByText('Do it'))
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('[data-slot="command-palette"]')).toBeNull())
  })

  test('Mod+K again closes it, and only the palette chord works while it is open', async () => {
    const run = mock(() => {})
    const onOpenChange = mock((_open: boolean) => {})
    await mountShell({
      commands: defineCommands({ x: { label: 'X', chord: 'Mod+J', run } }),
      onOpenChange,
    })
    press('k', { mod: true })
    await screen.findByLabelText('Search commands')
    press('j', { mod: true })
    expect(run).toHaveBeenCalledTimes(0)
    press('k', { mod: true })
    // Asserted on the state change: waiting for the exit transition to unmount costs seconds in happy-dom.
    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  })

  test('Escape closes the palette first and the dialog under it stays', async () => {
    const onOpenChange = mock((_open: boolean) => {})
    await mountShell({ commands: COMMANDS, body: <Under />, onOpenChange })
    await screen.findByText('Underneath')
    press('k', { mod: true })
    await screen.findByLabelText('Search commands')
    const event = press('Escape', { target: screen.getByLabelText('Search commands') })
    // Asserted on the state change: waiting for the exit transition to unmount costs seconds in happy-dom.
    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
    expect(event.defaultPrevented).toBe(true)
    expect(screen.queryByText('Underneath')).not.toBeNull()
  })

  test('controlled open follows the prop and reports changes', async () => {
    const seen: boolean[] = []
    function Host(): ReactElement {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            search
          </button>
          <CommandPalette
            commands={COMMANDS}
            open={open}
            onOpenChange={(next) => {
              seen.push(next)
              setOpen(next)
            }}
          />
        </>
      )
    }
    const root = createRootRoute({
      component: () => (
        <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
          <Host />
        </AppShell>
      ),
    })
    const router = createRouter({
      routeTree: root.addChildren([]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    await router.load()
    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByText('search'))
    await screen.findByLabelText('Search commands')
    press('Escape')
    expect(seen).toEqual([false])
  })
})
