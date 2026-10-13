/**
 * M4 — `NotificationCenter` used to hardcode `style={{ width: 320, ...style }}` on its own root, a
 * popover-specific dimension baked into a component meant to be mounted anywhere (inline in a card,
 * a Drawer, a consumer's own popover). It now defaults to `width: '100%'` and lets its HOST fix a
 * dimension (`NotificationBell` does this via `<Popover width={320}>`) — this pins that default and
 * the `style` merge order (a caller's own `width` still wins).
 */
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { NotificationCenter } from './center'

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
