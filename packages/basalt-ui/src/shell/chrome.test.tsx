/**
 * `AppShell chrome` without a browser layout: what the markup and the root carry under
 * `native-overlay`, and what `useWindowChrome` reads. Heights and insets are measured in
 * `tests/layout/shell-native.layout.test.ts`.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
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
import { AppShell } from './app-shell'
import { useWindowChrome } from './chrome'
import type { AppShellProps, ShellChrome } from './contract'

const NAV = {
  sections: [
    { id: 'main', label: 'Main', items: [{ id: 'home', label: 'Overview', link: { to: '/' } }] },
  ],
} satisfies AppShellProps['nav']

afterEach(cleanup)

function Probe(): ReactElement {
  const { chrome, leadInset } = useWindowChrome()
  return <span data-testid="probe">{`${chrome}:${leadInset}`}</span>
}

function HeaderProbe(): ReactElement {
  const { chrome, leadInset } = useWindowChrome()
  return <span data-testid="header-probe">{`${chrome}:${leadInset}`}</span>
}

async function mountShell(chrome: ShellChrome | undefined) {
  const root = createRootRoute({
    component: () => (
      <AppShell
        nav={NAV}
        brand={{ name: 'Basalt' }}
        {...(chrome !== undefined && { chrome })}
        globalControls={{ render: () => <HeaderProbe /> }}
        globalActions={[
          { kind: 'button', id: 'a', label: 'Act', icon: () => <svg />, onClick: () => {} },
        ]}
      >
        <Outlet />
      </AppShell>
    ),
  })
  const home = createRoute({ getParentRoute: () => root, path: '/', component: Probe })
  const router = createRouter({
    routeTree: root.addChildren([home]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(document.querySelector('[data-slot="shell"]')).not.toBeNull())
  return document.querySelector<HTMLElement>('[data-slot="shell"]') as HTMLElement
}

describe('chrome native-overlay', () => {
  test('the header is the one deep drag region and no button carries the attribute', async () => {
    const shell = await mountShell('native-overlay')
    const regions = [...document.querySelectorAll('[data-tauri-drag-region]')]
    expect(regions).toHaveLength(1)
    expect(regions[0]?.getAttribute('data-slot')).toBe('shell-header')
    expect(regions[0]?.getAttribute('data-tauri-drag-region')).toBe('deep')
    expect(document.querySelectorAll('button[data-tauri-drag-region]')).toHaveLength(0)
    expect(shell.style.getPropertyValue('--shell-header-h')).toBe('52px')
    expect(shell.style.getPropertyValue('--chrome-lead-inset')).toBe('80px')
    expect(document.querySelector('[data-slot="shell-titlebar"]')).not.toBeNull()
  })

  test('useWindowChrome reads the chrome and the lead inset', async () => {
    await mountShell('native-overlay')
    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe('native-overlay:80')
  })

  test('useWindowChrome reads the same chrome from a component in the header', async () => {
    await mountShell('native-overlay')
    expect(document.querySelector('[data-testid="header-probe"]')?.textContent).toBe(
      'native-overlay:80',
    )
  })
})

describe('chrome web', () => {
  test('is the default: no drag region, no titlebar, no overridden geometry', async () => {
    const shell = await mountShell(undefined)
    expect(document.querySelector('[data-tauri-drag-region]')).toBeNull()
    expect(document.querySelector('[data-slot="shell-titlebar"]')).toBeNull()
    expect(shell.style.getPropertyValue('--shell-header-h')).toBe('')
    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe('web:0')
  })
})
