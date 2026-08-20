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
