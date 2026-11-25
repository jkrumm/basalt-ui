import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { LONG_PRESS_MS } from '../core/context-trigger'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  contextMenuParts,
} from './context-menu'
import { MenuItem } from './menu'

afterEach(cleanup)

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function Fixture({ disabled }: { disabled?: boolean }): React.ReactElement {
  return (
    <ContextMenu disabled={disabled === true}>
      <ContextMenuTrigger render={<li />}>
        <span data-testid="label">Invoice 1042</span>
        <input data-testid="field" defaultValue="x" />
        <input data-testid="box" type="checkbox" />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItem>Rename</MenuItem>
        <MenuItem>Delete</MenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

const items = (): string[] =>
  [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent ?? '')

describe('context-menu module', () => {
  test('closed, it renders its trigger element and no popup', () => {
    render(<Fixture />)
    const trigger = document.querySelector('[data-slot="context-menu-trigger"]')
    expect(trigger?.tagName).toBe('LI')
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(trigger?.hasAttribute('data-popup-open')).toBe(false)
  })

  test('a right click opens the items and marks the trigger while it is open', () => {
    const { getByTestId } = render(<Fixture />)
    const allowed = fireEvent.contextMenu(getByTestId('label'), { clientX: 40, clientY: 60 })
    expect(allowed).toBe(false)
    expect(items()).toEqual(['Rename', 'Delete'])
    expect(
      document.querySelector('[data-slot="context-menu-trigger"]')?.hasAttribute('data-popup-open'),
    ).toBe(true)
    expect(document.querySelector('[data-slot="context-menu-content"]')).not.toBeNull()
    for (const slot of contextMenuParts) {
      expect(document.querySelector(`[data-slot="${slot}"]`)).not.toBeNull()
    }
  })

  test('Shift+right click and a click inside a text field keep the browser menu', () => {
    const { getByTestId } = render(<Fixture />)
    expect(fireEvent.contextMenu(getByTestId('label'), { shiftKey: true })).toBe(true)
    expect(fireEvent.contextMenu(getByTestId('field'))).toBe(true)
    expect(document.querySelector('[role="menu"]')).toBeNull()
    // a checkbox is a control of the row, not a field
    expect(fireEvent.contextMenu(getByTestId('box'))).toBe(false)
    expect(items()).toEqual(['Rename', 'Delete'])
  })

  test('Shift+F10 and the context-menu key open it on the focused part', () => {
    const { getByTestId } = render(<Fixture />)
    expect(fireEvent.keyDown(getByTestId('label'), { key: 'F10' })).toBe(true)
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(fireEvent.keyDown(getByTestId('label'), { key: 'F10', shiftKey: true })).toBe(false)
    expect(items()).toEqual(['Rename', 'Delete'])
    cleanup()
    const again = render(<Fixture />)
    fireEvent.keyDown(again.getByTestId('label'), { key: 'ContextMenu' })
    expect(items()).toEqual(['Rename', 'Delete'])
  })

  test("Shift+F10 inside a text field is the browser's", () => {
    const { getByTestId } = render(<Fixture />)
    expect(fireEvent.keyDown(getByTestId('field'), { key: 'F10', shiftKey: true })).toBe(true)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  test('a long press opens it and the click after it is swallowed', async () => {
    const { getByTestId } = render(<Fixture />)
    const touch = [{ clientX: 10, clientY: 10, identifier: 1, target: getByTestId('label') }]
    fireEvent.touchStart(getByTestId('label'), { touches: touch })
    await wait(LONG_PRESS_MS + 60)
    expect(items()).toEqual(['Rename', 'Delete'])
    fireEvent.touchEnd(getByTestId('label'), { touches: [] })
    expect(fireEvent.click(getByTestId('label'))).toBe(false)
  })

  test('a finger that moves is a scroll, not a press', async () => {
    const { getByTestId } = render(<Fixture />)
    const at = (y: number) => [
      { clientX: 10, clientY: y, identifier: 1, target: getByTestId('label') },
    ]
    fireEvent.touchStart(getByTestId('label'), { touches: at(10) })
    fireEvent.touchMove(getByTestId('label'), { touches: at(60) })
    await wait(LONG_PRESS_MS + 60)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  test('disabled, nothing is intercepted', () => {
    const { getByTestId } = render(<Fixture disabled />)
    expect(fireEvent.contextMenu(getByTestId('label'))).toBe(true)
    expect(fireEvent.keyDown(getByTestId('label'), { key: 'F10', shiftKey: true })).toBe(true)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })
})
