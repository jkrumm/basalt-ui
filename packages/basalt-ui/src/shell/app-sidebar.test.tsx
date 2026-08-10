/**
 * `navExtra` — the seam that lets a consumer put arbitrary content (a tree, a filter panel,
 * a project list) inside the sidebar's nav scroll region instead of rendering a second column
 * beside the shell. Four invariants:
 *
 *  1. It renders INSIDE the nav `ScrollArea`'s content (Mantine's own `.mantine-ScrollArea-content`
 *     class, stable across runs — CSS-module class hashes are not available under `bun test`, see
 *     `stat-card.test.tsx`/`use-basalt-spacing.test.tsx` for the same constraint elsewhere), as the
 *     LAST child, so a long tree scrolls with the nav instead of fighting it for height.
 *  2. It STAYS MOUNTED when `collapsed` — `collapsed` is one value shared by the desktop rail AND
 *     the mobile drawer (`AppShell.Navbar`'s `collapsed: { mobile: !mobileOpened }` never touches
 *     the desktop side), and the rail-vs-drawer split lives entirely in a `min-width: sm` CSS media
 *     query, never in JS. A JS gate on `collapsed` would silently drop `navExtra` from the mobile
 *     drawer too, which opens at full width regardless of the persisted rail state. jsdom does not
 *     evaluate the media query, so this asserts presence in the DOM, not computed visibility — the
 *     CSS half (`.root[data-collapsed] .navExtra { display: none }`) is exercised by the guard rules
 *     it shares with `.childList`/`.sectionBand`, not by this test.
 *  3. `sections={[]}` plus only `navExtra` renders cleanly: the nav Stack holds exactly the
 *     extra content, no orphan section wrapper.
 *  4. Omitting the prop reproduces today's DOM exactly — the nav Stack's child count matches
 *     `sections.length`, with no stray wrapper appended for the (absent) slot. This is the
 *     regression guard for every existing consumer.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import type { AppSidebarProps } from './app-sidebar'

const BRAND = { name: 'Argo' }
const ONE_SECTION: AppSidebarProps['sections'] = [
  { label: 'Main', items: [{ key: 'home', label: 'Home', icon: null }] },
]

function renderSidebar(props: Partial<AppSidebarProps> & { navExtra?: ReactNode }) {
  return render(
    <MantineProvider>
      <AppSidebar
        brand={BRAND}
        sections={ONE_SECTION}
        collapsed={false}
        onToggleCollapse={() => {}}
        onClose={() => {}}
        {...props}
      />
    </MantineProvider>,
  )
}

/** The nav `ScrollArea`'s content Stack — the direct parent of `sections` and `navExtra`. */
function navStack(container: HTMLElement): Element {
  const stack = container.querySelector('.mantine-ScrollArea-content > .mantine-Stack-root')
  if (!stack) throw new Error('expected the nav ScrollArea content Stack to render')
  return stack
}

describe('navExtra', () => {
  test('renders inside the nav scroll region, as the last child, when expanded', () => {
    const { container } = renderSidebar({
      navExtra: <div data-testid="nav-extra">Extra</div>,
    })
    const extra = screen.getByTestId('nav-extra')
    const stack = navStack(container)
    expect(stack.contains(extra)).toBe(true)
    expect(stack.lastElementChild?.contains(extra)).toBe(true)
  })

  test('stays mounted in the DOM when collapsed — hiding it is CSS-only, not a JS gate', () => {
    const { container } = renderSidebar({
      collapsed: true,
      navExtra: <div data-testid="nav-extra">Extra</div>,
    })
    const extra = screen.getByTestId('nav-extra')
    const stack = navStack(container)
    // Presence, not visibility — jsdom never evaluates the `min-width: sm` media query that hides
    // this in the rail. A regression here (reintroducing `!collapsed &&` in app-sidebar.tsx) would
    // fail this assertion instead of only breaking silently in a real mobile-drawer browser.
    expect(stack.contains(extra)).toBe(true)
  })

  test('sections={[]} plus only navExtra renders cleanly — no orphan section wrapper', () => {
    const { container } = renderSidebar({
      sections: [],
      navExtra: <div data-testid="nav-extra">Extra</div>,
    })
    const stack = navStack(container)
    expect(screen.getByTestId('nav-extra')).toBeTruthy()
    expect(stack.children.length).toBe(1)
  })

  test("omitting the prop reproduces today's DOM — no stray wrapper for the unused slot", () => {
    const { container } = renderSidebar({})
    expect(screen.queryByTestId('nav-extra')).toBeNull()
    const stack = navStack(container)
    expect(stack.children.length).toBe(ONE_SECTION.length)
  })
})
