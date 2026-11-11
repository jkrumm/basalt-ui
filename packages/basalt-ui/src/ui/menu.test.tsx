import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuTrigger,
  menuParts,
} from './menu'

afterEach(cleanup)

const slots = (): string[] =>
  [...document.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('menu module', () => {
  test('closed, it renders its trigger and no popup', () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Rename</MenuItem>
        </MenuContent>
      </Menu>,
    )
    expect(slots()).toEqual(['menu-trigger'])
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  test('open, every part renders its slot, all of them listed', () => {
    render(
      <Menu defaultOpen>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuGroup label="Move to">
            <MenuItem>Inbox</MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuCheckboxItem defaultChecked>Show grid</MenuCheckboxItem>
          <MenuRadioGroup defaultValue="a">
            <MenuRadioItem value="a">Name</MenuRadioItem>
          </MenuRadioGroup>
          <MenuSub label="More">
            <MenuItem>Archive</MenuItem>
          </MenuSub>
        </MenuContent>
      </Menu>,
    )
    const found = new Set(slots())
    for (const slot of menuParts) expect(found.has(slot)).toBe(true)
    for (const slot of found) expect(menuParts as readonly string[]).toContain(slot)
    expect(
      document.querySelector('[data-slot="menu-content"]')?.parentElement?.className,
    ).toContain('z-50')
  })

  test('a checkbox item keeps the menu open by default and the check follows its state', () => {
    render(
      <Menu defaultOpen>
        <MenuContent>
          <MenuCheckboxItem checked>Show grid</MenuCheckboxItem>
          <MenuCheckboxItem checked={false} closeOnClick>
            Show axes
          </MenuCheckboxItem>
        </MenuContent>
      </Menu>,
    )
    const items = [...document.querySelectorAll('[data-slot="menu-checkbox-item"]')]
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false'])
  })

  test('a controlled menu with a virtual anchor needs no trigger', () => {
    render(
      <Menu open>
        <MenuContent anchor={{ getBoundingClientRect: () => new DOMRect(10, 20, 0, 0) }}>
          <MenuItem>Rename</MenuItem>
        </MenuContent>
      </Menu>,
    )
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    expect(slots()).not.toContain('menu-trigger')
  })
})
