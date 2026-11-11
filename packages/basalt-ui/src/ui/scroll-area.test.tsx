import { cleanup, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ScrollArea, scrollAreaParts } from './scroll-area'

afterEach(cleanup)

/** happy-dom has no geometry: report the sizes a real scroller would. */
function withGeometry(
  sizes: { scrollHeight: number; clientHeight: number },
  run: () => void,
): void {
  const proto = HTMLElement.prototype
  const saved = ['scrollHeight', 'clientHeight'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const,
  )
  for (const [key, value] of Object.entries(sizes)) {
    Object.defineProperty(proto, key, { value, configurable: true })
  }
  try {
    run()
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(proto, key, descriptor)
      else Reflect.deleteProperty(proto, key)
    }
  }
}

describe('scroll-area module', () => {
  test('renders with no provider; the part carries data-slot and scrollAreaParts lists it', () => {
    const { container } = render(<ScrollArea>rows</ScrollArea>)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...scrollAreaParts])
  })

  test('server render keeps the slot and carries no tabindex', () => {
    const html = renderToString(<ScrollArea>rows</ScrollArea>)
    expect(html).toContain('data-slot="scroll-area"')
    expect(html).not.toContain('tabindex')
  })

  test('orientation picks the overflow axis', () => {
    const { container } = render(
      <>
        <ScrollArea>a</ScrollArea>
        <ScrollArea orientation="horizontal">b</ScrollArea>
        <ScrollArea orientation="both">c</ScrollArea>
      </>,
    )
    const [v, h, both] = [...container.querySelectorAll<HTMLElement>('[data-slot]')]
    expect(v?.className).toContain('overflow-y-auto')
    expect(h?.className).toContain('overflow-x-auto')
    expect(both?.className).toContain('overflow-auto')
  })

  test('content that fits adds no tab stop', () => {
    withGeometry({ scrollHeight: 100, clientHeight: 100 }, () => {
      const { container } = render(<ScrollArea aria-label="Rows">rows</ScrollArea>)
      const el = container.firstElementChild as HTMLElement
      expect(el.hasAttribute('tabindex')).toBe(false)
      expect(el.hasAttribute('role')).toBe(false)
    })
  })

  test('content that overflows takes tabindex 0 and, named, reads as a region', () => {
    withGeometry({ scrollHeight: 400, clientHeight: 100 }, () => {
      const { container } = render(<ScrollArea aria-label="Rows">rows</ScrollArea>)
      const el = container.firstElementChild as HTMLElement
      expect(el.getAttribute('tabindex')).toBe('0')
      expect(el.getAttribute('role')).toBe('region')
    })
  })

  test('an unnamed scroller is focusable but claims no role', () => {
    withGeometry({ scrollHeight: 400, clientHeight: 100 }, () => {
      const { container } = render(<ScrollArea>rows</ScrollArea>)
      const el = container.firstElementChild as HTMLElement
      expect(el.getAttribute('tabindex')).toBe('0')
      expect(el.hasAttribute('role')).toBe(false)
    })
  })

  test('forwards its ref to the scroller', () => {
    const ref = createRef<HTMLDivElement>()
    const { container } = render(<ScrollArea ref={ref}>rows</ScrollArea>)
    expect(ref.current).toBe(container.firstElementChild as HTMLDivElement)
  })
})
