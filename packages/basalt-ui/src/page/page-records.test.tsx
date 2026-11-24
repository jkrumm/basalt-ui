/**
 * `PageBar records`: a routed record page steps through the list it was opened from with the panels'
 * previous and next, closes back to the list, and `k` and `j` step it through the shell's
 * `record.previous` and `record.next` commands, declared beside the app's own in `defineCommands`.
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
import { useState } from 'react'
import type { ReactElement } from 'react'
import { AppShell } from '../shell/app-shell'
import { CommandPalette } from '../shell/commands/command-palette'
import { RECORD_NEXT, RECORD_PREVIOUS, defineCommands } from '../shell/commands/define-commands'
import { defineNav } from '../../tests/support/router-nav'
import { Page } from './page'
import { PageBar } from './page-bar'

const NAV = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'deals', label: 'Deals', link: { to: '/' }, mobile: 'tab' }],
    },
  ],
})

const IDS = ['a', 'b', 'c'] as const

const run = (): void => undefined

afterEach(cleanup)

function press(key: string): void {
  act(() => {
    ;(document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    )
  })
}

function DealPage(): ReactElement {
  const [id, setId] = useState<string>('a')
  return (
    <Page area="deal">
      <PageBar
        title={`Deal ${id}`}
        parent={{ label: 'Deals', href: '/' }}
        records={{ ids: IDS, id, onStep: setId }}
      />
      <output data-testid="shown">{id}</output>
    </Page>
  )
}

async function mount(): Promise<void> {
  const root = createRootRoute({
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
        <CommandPalette commands={defineCommands({})} />
      </AppShell>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/', component: () => <Page>list</Page> }),
      createRoute({ getParentRoute: () => root, path: '/deal', component: DealPage }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/deal'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(screen.getByTestId('shown')).toBeTruthy())
}

const shown = (): string | null => screen.getByTestId('shown').textContent

describe('PageBar records', () => {
  test('j and k step through the list, and stop at its ends', async () => {
    await mount()
    press('k')
    expect(shown()).toBe('a')
    press('j')
    expect(shown()).toBe('b')
    press('j')
    expect(shown()).toBe('c')
    press('j')
    expect(shown()).toBe('c')
    press('k')
    expect(shown()).toBe('b')
  })

  test('previous and next are the panel steps, disabled at the ends', async () => {
    await mount()
    const previous = await screen.findByRole('button', { name: 'Previous record' })
    const next = screen.getByRole('button', { name: 'Next record' })
    expect(previous.hasAttribute('disabled')).toBe(true)
    fireEvent.click(next)
    expect(shown()).toBe('b')
    expect(previous.hasAttribute('disabled')).toBe(false)
  })

  test('close goes back to the list, the parent when records name no close', async () => {
    await mount()
    const close = await screen.findByRole('link', { name: 'Close record' })
    expect(close.getAttribute('href')).toBe('/')
  })
})

describe('the record commands', () => {
  test('are declared with every set, unlisted while no record page is on screen', () => {
    const set = defineCommands({})
    const ids = set.entries.map((entry) => entry.id)
    expect(ids).toContain(RECORD_PREVIOUS)
    expect(ids).toContain(RECORD_NEXT)
    expect(set.entries.find((entry) => entry.id === RECORD_NEXT)?.enabled?.()).toBe(false)
  })

  test("an app's global j collides with them; one in an area does not", () => {
    expect(() => defineCommands({ down: { label: 'Down', chord: 'j', run } })).toThrow(
      /record\.next/,
    )
    expect(() =>
      defineCommands({ down: { label: 'Down', chord: 'j', area: 'runs', run } }),
    ).not.toThrow()
  })
})
