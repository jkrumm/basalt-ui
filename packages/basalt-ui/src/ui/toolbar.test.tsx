import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { buttonVariants } from './button'
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  toolbarGroupVariants,
  toolbarParts,
} from './toolbar'

afterEach(cleanup)

const bar = (
  <Toolbar aria-label="View">
    <ToolbarButton>One</ToolbarButton>
    <ToolbarSeparator />
    <ToolbarGroup aria-label="Pair">
      <ToolbarButton>Two</ToolbarButton>
      <ToolbarButton variant="primary">Three</ToolbarButton>
    </ToolbarGroup>
  </Toolbar>
)

describe('toolbar module', () => {
  test('every part carries data-slot and toolbarParts lists them', () => {
    const { container } = render(bar)
    const found = new Set(
      [...container.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot')),
    )
    expect([...found].toSorted()).toEqual([...toolbarParts].toSorted())
  })

  test('the root is a toolbar, the group is role=group and the separator is vertical', () => {
    const { container } = render(bar)
    expect(container.querySelector('[data-slot="toolbar"]')?.getAttribute('role')).toBe('toolbar')
    expect(container.querySelector('[data-slot="toolbar-group"]')?.getAttribute('role')).toBe(
      'group',
    )
    expect(
      container.querySelector('[data-slot="toolbar-separator"]')?.getAttribute('aria-orientation'),
    ).toBe('vertical')
  })

  test('a button shares the height classes of ui/button and the group matches its height', () => {
    const { container } = render(bar)
    const button = container.querySelector<HTMLElement>('[data-slot="toolbar-button"]')!
    expect(button.className).toContain('h-ctl')
    expect(button.className).toContain(buttonVariants({ variant: 'ghost' }))
    expect(toolbarGroupVariants()).toContain('h-ctl')
  })

  // Arrow-key travel needs real focus geometry: tests/layout/ui-bar.layout.test.ts drives it in Chrome.
  test('roving focus: one tab stop in the row', () => {
    const { container } = render(bar)
    const buttons = [...container.querySelectorAll<HTMLElement>('[data-slot="toolbar-button"]')]
    const stops = buttons.filter((b) => b.tabIndex === 0)
    expect(stops).toHaveLength(1)
  })

  test('a button with render keeps the rendered element its own classes', () => {
    const { container } = render(
      <Toolbar aria-label="V">
        <ToolbarButton
          render={<a href="/x" aria-label="Link" className="mine" />}
          nativeButton={false}
        >
          Link
        </ToolbarButton>
      </Toolbar>,
    )
    const el = container.querySelector<HTMLElement>('[data-slot="toolbar-button"]')!
    expect(el.tagName).toBe('A')
    expect(el.className).toContain('mine')
    expect(el.className).not.toContain('h-ctl')
  })

  test('server render keeps the slots', () => {
    expect(renderToString(bar)).toContain('data-slot="toolbar-group"')
  })
})
