/** A right click on a card opens the popover of its "..." button at the pointer. */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { ChartCard } from '../charts'

const menu = [
  { id: 'a', label: 'Export', onClick: () => undefined },
  { id: 'b', label: 'Share', onClick: () => undefined },
] as const

let shown: HTMLElement[]
beforeEach(() => {
  shown = []
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement) {
      shown.push(this)
    },
    hidePopover: () => undefined,
  })
})
afterEach(cleanup)

const card = (): HTMLElement => document.querySelector('[data-slot="card"]') as HTMLElement

describe('CardMenu context menu', () => {
  test('a right click shows the same popover the button shows, at the pointer', () => {
    render(<ChartCard title="Requests" menu={menu} chart={() => null} />)
    const popover = document.querySelector('[popover]') as HTMLElement
    expect(fireEvent.contextMenu(card(), { clientX: 50, clientY: 70 })).toBe(false)
    expect(shown).toEqual([popover])
    expect(popover.style.left).toBe('50px')
    expect(popover.style.top).toBe('70px')
    expect([...popover.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Export',
      'Share',
    ])
    expect(card().hasAttribute('data-popup-open')).toBe(true)
  })

  test('Shift+F10 inside the card opens it; Shift+right click does not', () => {
    render(<ChartCard title="Requests" menu={menu} chart={() => null} />)
    const button = document.querySelector('[data-slot="stat-menu"]') as HTMLElement
    expect(fireEvent.contextMenu(card(), { shiftKey: true })).toBe(true)
    expect(shown).toHaveLength(0)
    fireEvent.keyDown(button, { key: 'F10', shiftKey: true })
    expect(shown).toHaveLength(1)
  })

  test('contextMenu={false} leaves the browser menu', () => {
    render(<ChartCard title="Requests" menu={menu} contextMenu={false} chart={() => null} />)
    expect(fireEvent.contextMenu(card())).toBe(true)
    expect(shown).toHaveLength(0)
  })
})
