/**
 * `AppBrand` — the header's leading zone.
 *
 * These assertions moved here verbatim from `app-sidebar.test.tsx` when the brand row moved out of
 * the sidebar and into the header (the row had become a second 48px band under a now-full-width
 * header seam). The COMPONENT did not change, which is the point of testing it in its new home
 * against the same three cases: no menu is plain text, a menu is a `Name ▾` trigger, and an empty
 * menu array is not a trigger that opens nothing.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { AppBrand } from './app-brand'
import type { AppBrandProps } from './app-brand'

function renderBrand(props: Partial<AppBrandProps> = {}) {
  return render(
    <MantineProvider>
      <AppBrand brand={{ name: 'Argo' }} collapsed={false} onToggleCollapse={() => {}} {...props} />
    </MantineProvider>,
  )
}

describe('brand.menu — the workspace switcher', () => {
  const MENU = [
    { key: 'switch', label: 'Switch workspace', onClick: () => {} },
    { key: 'new', label: 'New workspace', onClick: () => {} },
  ]

  test('no menu: the brand name is plain text, not a control', () => {
    renderBrand()
    expect(screen.queryByLabelText('Argo workspace')).toBeNull()
  })

  test('with a menu the brand becomes a `Name ▾` trigger opening the entries', async () => {
    let picked = 0
    renderBrand({
      brand: { name: 'Argo', menu: [{ ...MENU[0]!, onClick: () => (picked += 1) }, MENU[1]!] },
    })

    fireEvent.click(screen.getByLabelText('Argo workspace'))
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    expect(screen.getByText('New workspace')).toBeTruthy()

    fireEvent.click(screen.getByText('Switch workspace'))
    expect(picked).toBe(1)
  })

  test('an empty menu array is no menu — never a trigger that opens nothing', () => {
    renderBrand({ brand: { name: 'Argo', menu: [] } })
    expect(screen.queryByLabelText('Argo workspace')).toBeNull()
  })
})

describe('the collapse toggle — the sidebar rail, driven from the header', () => {
  test('it announces which direction it moves, and reports the toggle', () => {
    let toggles = 0
    const { rerender } = render(
      <MantineProvider>
        <AppBrand
          brand={{ name: 'Argo' }}
          collapsed={false}
          onToggleCollapse={() => (toggles += 1)}
        />
      </MantineProvider>,
    )
    fireEvent.click(screen.getByLabelText('Collapse sidebar'))
    expect(toggles).toBe(1)

    rerender(
      <MantineProvider>
        <AppBrand brand={{ name: 'Argo' }} collapsed onToggleCollapse={() => (toggles += 1)} />
      </MantineProvider>,
    )
    expect(screen.getByLabelText('Expand sidebar')).toBeTruthy()
  })
})
