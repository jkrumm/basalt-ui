/**
 * Hand-off paths that only `BasaltShell` can break — the sub-components are exercised directly in
 * `app-sidebar.test.tsx` / `app-mobile-nav.test.tsx`, but the shell is where the props are
 * destructured and where `extraMoreRows` is COMPUTED. A typo'd destructure key or a row count that
 * disagrees with the renderer ships silently without a test that renders `BasaltShell` itself.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { BasaltShell } from './index'
import type { BasaltAccountProps, SidebarSection } from './index'

const BRAND = { name: 'Argo' }
const ONE_SECTION: SidebarSection[] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

describe('BasaltShell sidebarNavExtra', () => {
  test("reaches AppSidebar's nav scroll region through the BasaltShell -> AppSidebar hand-off", () => {
    const { container } = render(
      <MantineProvider>
        <BasaltShell
          brand={BRAND}
          sections={ONE_SECTION}
          sidebarNavExtra={<div data-testid="nav-extra">Extra</div>}
        />
      </MantineProvider>,
    )
    const extra = screen.getByTestId('nav-extra')
    const stack = container.querySelector('.mantine-ScrollArea-content > .mantine-Stack-root')
    expect(stack).not.toBeNull()
    expect(stack?.contains(extra)).toBe(true)
  })
})

/**
 * §2.2's arithmetic guarantee is that a `menu` never exceeds `menuMax` rows — six rows at 44px fit
 * the headroom above the bar, and the menu runs `flip: false`, so a menu that overflows has no way
 * to escape upward and simply renders off-screen. The guarantee is only as good as the row count
 * the shell feeds `projectMobileNav`: counting `account` as ONE row while `accountRows` expands it
 * into up to seven is what let a nine-row More surface pick `menu`.
 */
describe('BasaltShell extraMoreRows', () => {
  const NAV: SidebarSection[] = [
    { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null, mobile: 'tab' }] },
  ]

  /** Seven account rows: manage + billing + upgrade + three extras + sign out. */
  const FAT_ACCOUNT: BasaltAccountProps = {
    state: {
      status: 'authenticated',
      identity: { id: 'u1', name: 'Jo', email: 'jo@example.com' },
      plan: { key: 'free', label: 'Free', isFree: true },
    },
    actions: {
      onManageAccount: () => {},
      onManageBilling: () => {},
      onUpgrade: () => {},
      onSignOut: () => {},
      extraMenuItems: [
        { key: 'a', label: 'Extra A', onClick: () => {} },
        { key: 'b', label: 'Extra B', onClick: () => {} },
        { key: 'c', label: 'Extra C', onClick: () => {} },
      ],
    },
  }

  test('an account expanding past menuMax raises the SHEET, not an overflowing menu', async () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={NAV} account={FAT_ACCOUNT} />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('More'))
    await waitFor(() => expect(document.querySelector('.mantine-Drawer-content')).not.toBeNull())
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  /** A `loading` account renders NO rows, so it must not conjure a More slot that opens empty. */
  test('a loading account produces no More slot at all', () => {
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={NAV} account={{ state: { status: 'loading' } }} />
      </MantineProvider>,
    )

    expect(screen.queryByLabelText('More')).toBeNull()
  })
})

/**
 * Collapse persistence goes through the HOUSE api, not `@mantine/hooks`.
 *
 * Round 4 filed the reference consumer's raw `localStorage.getItem('basalt-sidebar-collapsed')` as
 * consumer drift; round 5 corrected it — the shell itself used `useLocalStorage`, so the raw read
 * was the only way to mirror what the shell wrote. These tests pin the shape a consumer now reads.
 */
describe('BasaltShell collapse persistence', () => {
  const COLLAPSE_TOGGLE =
    'button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]'

  const renderShell = (storageKey: string) =>
    render(
      <MantineProvider>
        <BasaltShell brand={BRAND} sections={ONE_SECTION} storageKey={storageKey} />
      </MantineProvider>,
    )

  test('writes the namespaced, versioned envelope — not a bare boolean at a bare key', () => {
    const key = 'collapse-envelope'
    localStorage.clear()
    const { container } = renderShell(key)

    fireEvent.click(container.querySelector(COLLAPSE_TOGGLE) as HTMLElement)

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: true }))
    expect(localStorage.getItem(key)).toBeNull()
  })

  test('adopts a pre-1.20.1 raw value once, so an upgrade keeps the sidebar collapsed', () => {
    const key = 'collapse-legacy'
    localStorage.clear()
    // Exactly what `@mantine/hooks`' useLocalStorage wrote: JSON at the un-namespaced key.
    localStorage.setItem(key, 'true')

    renderShell(key)

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: true }))
  })

  test('a value already in the house key wins over a stale legacy one', () => {
    const key = 'collapse-both'
    localStorage.clear()
    localStorage.setItem(key, 'true')
    localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: 1, value: false }))

    renderShell(key)

    expect(localStorage.getItem(`basalt:${key}`)).toBe(JSON.stringify({ v: 1, value: false }))
  })
})
