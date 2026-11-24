/**
 * `CommandPalette sources`: record search in the palette's one list, driven by the keyboard alone.
 * Each test names its own source id, so the recents (kept per id) never leak between tests.
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
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Page } from '../../page/page'
import { AppShell } from '../app-shell'
import { isApplePlatform } from './chord'
import { CommandPalette } from './command-palette'
import { defineCommands } from './define-commands'
import { openResult } from './palette-sources'
import type { PaletteResult, PaletteSource } from './palette-sources'
import { defineNav } from '../../../tests/support/router-nav'

const NAV = defineNav({
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
})

afterEach(cleanup)

function press(key: string, init: { mod?: boolean; target?: Element } = {}): void {
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
}

async function mount(sources: readonly PaletteSource[]) {
  const commands = defineCommands({})
  const root = createRootRoute({
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
        <CommandPalette commands={commands} sources={sources} />
      </AppShell>
    ),
  })
  const page = (path: string) =>
    createRoute({ getParentRoute: () => root, path, component: () => <Page>page</Page> })
  const router = createRouter({
    routeTree: root.addChildren([page('/'), page('/runs'), page('/jobs')]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  const view = render(<RouterProvider router={router} />)
  await waitFor(() => expect(document.querySelector('[data-slot="shell"]')).not.toBeNull())
  return { router, view }
}

const labels = (): string[] =>
  [...document.querySelectorAll('[data-slot="option-row"]')].map(
    (el) => el.querySelector('[data-slot="option-label"]')?.textContent ?? '',
  )

const highlighted = (): string | null =>
  document
    .querySelector('[data-slot="option-row"][data-highlighted]')
    ?.querySelector('[data-slot="option-label"]')?.textContent ?? null

async function openAndType(query: string): Promise<HTMLElement> {
  press('k', { mod: true })
  const input = await screen.findByLabelText('Search commands')
  fireEvent.change(input, { target: { value: query } })
  return input
}

const run12 = (extra: Partial<PaletteResult> = {}): PaletteResult => ({
  id: '12',
  title: 'Run 12',
  kind: 'Run',
  detail: 'Finished',
  to: '/jobs',
  ...extra,
})

describe('palette sources', () => {
  test('keyboard only: type, wait for the record, ArrowDown, Enter navigates and closes', async () => {
    const source: PaletteSource = {
      id: 'kbd-runs',
      label: 'Run records',
      search: async () => [run12()],
    }
    const { router } = await mount([source])
    const input = await openAndType('runs')
    await waitFor(() => expect(labels()).toContain('Run 12'))
    // The command rows come first, the source group after them, headed by its label.
    expect(labels().indexOf('Go to Runs')).toBeLessThan(labels().indexOf('Run 12'))
    expect(screen.getByText('Run records')).toBeTruthy()
    expect(screen.getByText('Run')).toBeTruthy()
    await waitFor(() => expect(highlighted()).toBe('Go to Runs'))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(highlighted()).toBe('Run 12'))
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'))
    await waitFor(() => expect(document.querySelector('[data-slot="command-palette"]')).toBeNull())
  })

  test('an empty query shows the recents of a chosen result, also after a remount', async () => {
    const source: PaletteSource = {
      id: 'recent-runs',
      label: 'Run records',
      search: async () => [run12()],
    }
    const first = await mount([source])
    const input = await openAndType('runs')
    await waitFor(() => expect(labels()).toContain('Run 12'))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(highlighted()).toBe('Run 12'))
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(first.router.state.location.pathname).toBe('/jobs'))
    cleanup()

    const search = mock(async () => [] as PaletteResult[])
    await mount([{ ...source, search }])
    press('k', { mod: true })
    await waitFor(() => expect(labels()).toContain('Run 12'))
    expect(screen.getByText('Run records')).toBeTruthy()
    expect(search).not.toHaveBeenCalled()
    const stored = JSON.parse(
      window.localStorage.getItem('basalt:palette-recents:recent-runs') ?? '{}',
    )
    expect(stored.value).toEqual([
      { id: '12', title: 'Run 12', kind: 'Run', detail: 'Finished', to: '/jobs' },
    ])
  })

  test('a newer query aborts the older search', async () => {
    const signals: AbortSignal[] = []
    const source: PaletteSource = {
      id: 'abort-runs',
      label: 'Run records',
      search: (_query, signal) => {
        signals.push(signal)
        return new Promise(() => {})
      },
    }
    await mount([source])
    const input = await openAndType('a')
    await waitFor(() => expect(signals.length).toBe(1))
    expect(signals[0]?.aborted).toBe(false)
    fireEvent.change(input, { target: { value: 'ab' } })
    expect(signals[0]?.aborted).toBe(true)
    await waitFor(() => expect(signals.length).toBe(2))
    expect(signals[1]?.aborted).toBe(false)
  })

  test('a rejected search yields no rows for its source and leaves the others', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await mount([
        { id: 'broken', label: 'Broken', search: async () => Promise.reject(new Error('down')) },
        { id: 'fine-runs', label: 'Fine', search: async () => [run12()] },
      ])
      await openAndType('runs')
      await waitFor(() => expect(labels()).toContain('Run 12'))
      expect(screen.queryByText('Broken')).toBeNull()
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('limit caps the rows of a source', async () => {
    const many = Array.from({ length: 6 }, (_, i) => run12({ id: String(i), title: `Many ${i}` }))
    await mount([{ id: 'many', label: 'Many', limit: 2, search: async () => many }])
    await openAndType('many')
    await waitFor(() =>
      expect(labels().filter((l) => l.startsWith('Many '))).toEqual(['Many 0', 'Many 1']),
    )
  })

  test('Mod+Enter on a highlighted result runs its first action and closes', async () => {
    const first = mock(() => {})
    const second = mock(() => {})
    const source: PaletteSource = {
      id: 'action-runs',
      label: 'Run records',
      search: async () => [
        run12({
          actions: [
            { id: 'rerun', label: 'Rerun', run: first },
            { id: 'cancel', label: 'Cancel', run: second },
          ],
        }),
      ],
    }
    const { router } = await mount([source])
    const input = await openAndType('runs')
    await waitFor(() => expect(labels()).toContain('Run 12'))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(highlighted()).toBe('Run 12'))
    press('Enter', { mod: true, target: input })
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1))
    expect(second).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/')
    await waitFor(() => expect(document.querySelector('[data-slot="command-palette"]')).toBeNull())
  })
})

describe('openResult', () => {
  const fakeRouter = () => ({ navigate: mock(() => Promise.resolve()) })

  test('an in-app path goes through the router', () => {
    const router = fakeRouter()
    openResult(router as never, '/jobs/7')
    expect(router.navigate).toHaveBeenCalledWith({ href: '/jobs/7' })
  })

  test('a script, a protocol-relative or a plain-http URL from a source never leaves the app', () => {
    const assign = spyOn(window.location, 'assign').mockImplementation(() => undefined)
    const router = fakeRouter()
    for (const to of ['javascript:alert(1)', '//evil.example/p', 'data:text/html,x', '/\\evil']) {
      openResult(router as never, to)
    }
    expect(assign).not.toHaveBeenCalled()
    openResult(router as never, 'https://example.com/a')
    expect(assign).toHaveBeenCalledWith('https://example.com/a')
    assign.mockRestore()
  })
})
