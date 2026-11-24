/**
 * The shortcut list `CommandPalette` renders, without a browser layout: `?` opens it outside a field, it lists what the
 * `defineCommands` set and the nav declare (a sequence as its steps), and it follows the area focus is in.
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
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { Page } from '../../page/page'
import { AppShell } from '../app-shell'
import { isApplePlatform } from './chord'
import { CommandPalette } from './command-palette'
import { defineCommands } from './define-commands'
import type { CommandSet } from './define-commands'
import { defineNav } from '../../../tests/support/router-nav'

const NAV = defineNav({
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
})

afterEach(cleanup)

function press(
  key: string,
  init: { shift?: boolean; mod?: boolean; target?: Element } = {},
): KeyboardEvent {
  const apple = isApplePlatform()
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    shiftKey: init.shift === true,
    metaKey: init.mod === true && apple,
    ctrlKey: init.mod === true && !apple,
  })
  act(() => {
    ;(init.target ?? document.activeElement ?? document.body).dispatchEvent(event)
  })
  return event
}

async function mount(commands: CommandSet, options: { area?: string; body?: ReactElement } = {}) {
  const root = createRootRoute({
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
        <CommandPalette commands={commands} />
      </AppShell>
    ),
  })
  const page = (path: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => (
        <Page {...(options.area !== undefined && { area: options.area })}>
          {options.body ?? 'page'}
        </Page>
      ),
    })
  const router = createRouter({
    routeTree: root.addChildren([page('/'), page('/runs')]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(document.querySelector('[data-slot="shell"]')).not.toBeNull())
}

const run = (): void => {}
const overlay = (): HTMLElement | null => document.querySelector('[data-slot="shortcut-overlay"]')
const rows = (): string[] =>
  [...(overlay()?.querySelectorAll('li') ?? [])].map((li) => li.textContent ?? '')

const COMMANDS = defineCommands({
  'file.save': { label: 'Save', chord: 'Mod+S', group: 'File', run },
  'go.next': { label: 'Next page', chord: 'g n', group: 'Go', run },
  'runs.next': { label: 'Next run', chord: 'j', area: 'runs', run },
})

describe('ShortcutOverlay', () => {
  test('? opens it and ? again closes it', async () => {
    await mount(COMMANDS)
    expect(overlay()).toBeNull()
    const event = press('?', { shift: true })
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(overlay()).not.toBeNull())
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy()
    press('?', { shift: true })
    // A failed `toBeNull` prints the open overlay's DOM on every poll: 2.7 GiB resident and 6 s for one test.
    await waitFor(() => expect(overlay() === null).toBe(true))
  })

  test('? typed into a text field opens nothing', async () => {
    await mount(COMMANDS, { body: <input aria-label="name" /> })
    const input = screen.getByLabelText('name')
    input.focus()
    press('?', { shift: true, target: input })
    expect(overlay()).toBeNull()
  })

  test('lists declared chords, a sequence as its steps, and the nav and shell chords', async () => {
    await mount(COMMANDS)
    press('?', { shift: true })
    await waitFor(() => expect(overlay()).not.toBeNull())
    // `Kbd` draws Mod as ⌘ on Apple and Ctrl elsewhere.
    const text = rows().join('|').replaceAll('Ctrl', 'Mod').replaceAll('⌘', 'Mod')
    expect(text).toContain('SaveModS')
    expect(text).toContain('Next pageGthenN')
    expect(text).toContain('Go to OverviewMod1')
    expect(text).toContain('Toggle sidebarModB')
    expect(text).toContain('Command paletteModK')
    expect(text).toContain('Keyboard shortcuts?')
    const headings = [...(overlay()?.querySelectorAll('h3') ?? [])].map((h) => h.textContent)
    expect(headings).toEqual(['Shell', 'File', 'Go', 'Navigate'])
  })

  test('an area command is listed only while focus is in its area', async () => {
    await mount(COMMANDS, { area: 'runs', body: <button type="button">inside</button> })
    screen.getByText('inside').focus()
    press('?', { shift: true })
    await waitFor(() => expect(overlay()).not.toBeNull())
    expect(rows().join('|')).toContain('Next run')
    cleanup()
    await mount(COMMANDS, { area: 'jobs', body: <button type="button">inside</button> })
    screen.getByText('inside').focus()
    press('?', { shift: true })
    await waitFor(() => expect(overlay()).not.toBeNull())
    expect(rows().join('|')).not.toContain('Next run')
  })

  test('the palette lists Keyboard shortcuts and its row opens the list', async () => {
    await mount(COMMANDS)
    press('k', { mod: true })
    const row = await screen.findByText('Keyboard shortcuts')
    expect(overlay()).toBeNull()
    act(() => {
      fireEvent.click(row)
    })
    await waitFor(() => expect(overlay()).not.toBeNull())
  })
})
