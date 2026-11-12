/**
 * `RailSettings`: one footer row opening a Menu of `settings.items`. The 2.x flat-versus-menu split
 * and `settingsMenu` forcing are gone in v3 (one `mode: 'menu'` form), so those tests became the
 * single menu's contract. The ring is the collapsed rail's `progress` block.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { SettingsConfig } from '../contract'
import { RailControlProvider } from './grid'
import type { RailControl } from './grid'
import { RailSettings } from './settings'

afterEach(cleanup)

const control = (collapsed: boolean): RailControl => ({
  state: collapsed ? 'collapsed' : 'expanded',
  collapsed,
  setCollapsed: () => {},
  toggle: () => {},
})

function mount(
  props: Parameters<typeof RailSettings>[0],
  collapsed = false,
): ReturnType<typeof render> {
  const tree = (): ReactElement => (
    <RailControlProvider value={control(collapsed)}>
      <RailSettings {...props} />
    </RailControlProvider>
  )
  return render(tree())
}

const Glyph = (): ReactElement => <svg data-testid="item-icon" />

const three: SettingsConfig = {
  mode: 'menu',
  items: [
    { id: 'settings', label: 'Settings page', onClick: () => {} },
    { id: 'integrations', label: 'Integrations', onClick: () => {} },
    { id: 'invite', label: 'Invite teammates', onClick: () => {} },
  ],
}

const open = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
}

describe('RailSettings', () => {
  test('returns null without settings', () => {
    const { container } = mount({ settings: undefined, ring: undefined })
    expect(container.firstChild).toBeNull()
  })

  test('returns null when there are no items', () => {
    const { container } = mount({ settings: { mode: 'menu', items: [] }, ring: undefined })
    expect(container.firstChild).toBeNull()
  })

  test('renders ONE row, a trigger named Settings, with the menu closed', () => {
    const { container } = mount({ settings: three, ring: undefined })
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild?.getAttribute('data-slot')).toBe('menu-trigger')
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(screen.queryByText('Integrations')).toBeNull()
  })

  test('the single menu lists every item', async () => {
    mount({ settings: three, ring: undefined })
    await open()
    for (const label of ['Settings page', 'Integrations', 'Invite teammates']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(3)
  })

  test('each item fires its own handler', async () => {
    let fired = ''
    mount({
      settings: {
        mode: 'menu',
        items: three.items.map((entry) => ({ ...entry, onClick: () => (fired = entry.id) })),
      },
      ring: undefined,
    })
    await open()
    fireEvent.click(screen.getByText('Invite teammates'))
    expect(fired).toBe('invite')
  })

  test('an item icon renders in its menu row', async () => {
    mount({
      settings: {
        mode: 'menu',
        items: [{ id: 'a', label: 'Theme', icon: Glyph, onClick: () => {} }],
      },
      ring: undefined,
    })
    await open()
    expect(screen.getByTestId('item-icon')).toBeTruthy()
  })

  test('a single item still opens a menu rather than firing', async () => {
    let fired = 0
    mount({
      settings: { mode: 'menu', items: [{ id: 'a', label: 'Only', onClick: () => (fired += 1) }] },
      ring: undefined,
    })
    await open()
    expect(fired).toBe(0)
    expect(screen.getByText('Only')).toBeTruthy()
  })

  test('the ring is a named progressbar around the icon', () => {
    const { container } = mount({ settings: three, ring: { value: 0.4, label: 'Quota' } })
    const ring = container.querySelector('[data-slot="ring"]')
    expect(ring).not.toBeNull()
    expect(ring?.getAttribute('aria-label')).toBe('Quota')
    expect(ring?.getAttribute('aria-valuenow')).toBe('40')
    expect(screen.getByRole('button', { name: 'Settings' }).contains(ring)).toBe(true)
  })

  test('without a ring prop there is no ring', () => {
    const { container } = mount({ settings: three, ring: undefined })
    expect(container.querySelector('[data-slot="ring"]')).toBeNull()
  })

  test('the menu still opens in a collapsed rail', async () => {
    mount({ settings: three, ring: undefined }, true)
    await open()
    expect(screen.getByText('Integrations')).toBeTruthy()
  })
})
