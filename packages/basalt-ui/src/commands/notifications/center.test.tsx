/**
 * M4 — `NotificationCenter` used to hardcode `style={{ width: 320, ...style }}` on its own root, a
 * popover-specific dimension baked into a component meant to be mounted anywhere (inline in a card,
 * a Drawer, a consumer's own popover). It now defaults to `width: '100%'` and lets its HOST fix a
 * dimension (`NotificationBell` does this via `<Popover width={320}>`) — this pins that default and
 * the `style` merge order (a caller's own `width` still wins).
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { NotificationCenter } from './center'
import { add, clear } from './store'

function renderCenter(props?: Parameters<typeof NotificationCenter>[0]) {
  return render(
    <MantineProvider>
      <NotificationCenter className="notif-center-under-test" {...props} />
    </MantineProvider>,
  )
}

describe('NotificationCenter width (M4)', () => {
  test('defaults to width: 100% — no fixed popover px baked into the component', () => {
    const { container } = renderCenter()
    const root = container.querySelector('.notif-center-under-test')
    expect(root).not.toBeNull()
    expect((root as HTMLElement).style.width).toBe('100%')
  })

  test('a caller-supplied `style` merges over the default, and can still override width', () => {
    const { container } = renderCenter({ style: { width: 480, marginTop: 4 } })
    const root = container.querySelector('.notif-center-under-test') as HTMLElement
    expect(root.style.width).toBe('480px')
    expect(root.style.marginTop).toBe('4px')
  })
})

afterEach(clear)

describe('NotificationCenter rows state the intent as a visible word, not colour alone', () => {
  const INTENTS = [
    ['success', 'Success'],
    ['error', 'Error'],
    ['warning', 'Warning'],
    ['info', 'Info'],
  ] as const

  function open(intent: (typeof INTENTS)[number][0], title?: string) {
    add({
      id: `intent-${intent}`,
      intent,
      message: 'M',
      createdAt: Date.now(),
      ...(title !== undefined && { title }),
    })
    const view = renderCenter()
    // Only error/warning rows reach the Inbox; the All view lists every intent.
    fireEvent.click(view.getByText('All'))
    return view
  }

  for (const [intent, word] of INTENTS) {
    test(`${intent} → "${word}" beside an aria-hidden status dot, no leading border`, () => {
      const { container } = open(intent, 'T')
      const wordEl = container.querySelector('[data-verdict-word]')
      expect(wordEl?.textContent).toBe(word)
      expect(wordEl?.getAttribute('aria-hidden')).toBeNull()
      const dot = container.querySelector('[data-basalt-status-dot]')
      expect(dot?.getAttribute('aria-hidden')).toBe('true')
      expect(container.innerHTML).not.toContain('border-inline-start')
    })
  }

  test('an untitled row keeps the dot and word inline with the message', () => {
    const { container, getByText } = open('error')
    const word = container.querySelector('[data-verdict-word]')
    expect(word?.textContent).toBe('Error')
    expect(word?.closest('[class*="Group"]')?.contains(getByText('M'))).toBe(true)
  })

  test('the info dot is neutral ink, not the accent', () => {
    const { container } = open('info', 'T')
    const style = container.querySelector('[data-basalt-status-dot]')?.getAttribute('style')
    expect(style).toContain('var(--vx-muted)')
    expect(style).not.toContain('accent')
  })
})
