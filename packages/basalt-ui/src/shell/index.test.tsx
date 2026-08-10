/**
 * `BasaltShell`'s `sidebarNavExtra` forwarding path — `AppSidebar` (exercised directly in
 * `app-sidebar.test.tsx`) is not the only place this prop can break. `BasaltShell` destructures
 * `sidebarNavExtra` and hands it to `AppSidebar` as `navExtra`; a typo'd destructure key, a dropped
 * prop, or a `sidebarFooterExtra`/`sidebarNavExtra` mix-up in that hand-off would ship silently
 * without a test that renders `BasaltShell` itself.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { BasaltShell } from './index'
import type { SidebarSection } from './index'

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
