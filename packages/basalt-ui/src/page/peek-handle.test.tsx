/**
 * The `Peek` width handle: a keyboard- and pointer-driven `role="separator"` that sets `--peek-w`.
 * happy-dom lays nothing out, so the panel's box and its computed `max-width` are stubbed; what is
 * tested is the maths and the contract (clamps, steps, the saved value), geometry is
 * `tests/layout/peek.layout.test.ts`'s.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { PageHostContext, ShellOverlayContext } from './page'
import { fakeHost } from './page.test-support'
import { Peek } from './peek'
import { PEEK_MIN } from './peek-handle'

const original = window.matchMedia
const proto = HTMLElement.prototype
const rect = proto.getBoundingClientRect
let width = 600

beforeEach(() => {
  width = 600
  // Every width query matches: the panel is not compact.
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
  proto.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    const w =
      this.dataset['slot'] === 'peek'
        ? parseFloat(this.style.getPropertyValue('--peek-w')) || width
        : 0
    return { width: w, height: 0, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 0, toJSON() {} }
  }
})

const realStyle = window.getComputedStyle

afterEach(() => {
  cleanup()
  window.getComputedStyle = realStyle
  for (const stray of document.body.querySelectorAll(':scope > div:empty')) stray.remove()
  window.matchMedia = original
  proto.getBoundingClientRect = rect
})

function mountShelled(props: {
  defaultWidth?: number
  onWidthChange?: (px: number | null) => void
}) {
  // The computed max-width is the content area less 3rem: stub the read for the peek.
  const real = window.getComputedStyle
  window.getComputedStyle = ((node: Element) =>
    (node as HTMLElement).dataset?.['slot'] === 'peek'
      ? ({ maxWidth: '1000px' } as CSSStyleDeclaration)
      : real(node)) as typeof real
  const { host } = fakeHost()
  const region = document.createElement('div')
  document.body.append(region)
  render(
    <PageHostContext value={host}>
      <ShellOverlayContext value={region}>
        <Peek title="Issue 12" onClose={() => {}} {...props} />
      </ShellOverlayContext>
    </PageHostContext>,
  )
  const el = region.querySelector<HTMLElement>('[data-slot="peek"]')
  if (el === null) throw new Error('peek not mounted')
  return {
    el,
    handle: screen.getByRole('separator', { name: 'Resize panel' }),
    done: () => {
      window.getComputedStyle = real
      region.remove()
    },
  }
}

describe('PeekHandle', () => {
  test('is a focusable vertical separator with a name and a px value', () => {
    const { handle, done } = mountShelled({})
    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    expect(handle.getAttribute('tabindex')).toBe('0')
    expect(handle.getAttribute('aria-valuemin')).toBe(String(PEEK_MIN))
    expect(handle.getAttribute('aria-valuemax')).toBe('1000')
    done()
  })

  test('ArrowLeft widens and ArrowRight narrows by 16px, 64px with Shift, and saves each', () => {
    const onWidthChange = mock((_px: number | null) => {})
    const { el, handle, done } = mountShelled({ defaultWidth: 600, onWidthChange })
    expect(el.style.getPropertyValue('--peek-w')).toBe('600px')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(el.style.getPropertyValue('--peek-w')).toBe('616px')
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
    expect(el.style.getPropertyValue('--peek-w')).toBe('552px')
    expect(onWidthChange.mock.calls.map((c) => c[0])).toEqual([616, 552])
    done()
  })

  test('Home and End go to the narrowest and the widest, and nothing goes past them', () => {
    const { el, handle, done } = mountShelled({ defaultWidth: 600 })
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(el.style.getPropertyValue('--peek-w')).toBe(`${PEEK_MIN}px`)
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
    expect(el.style.getPropertyValue('--peek-w')).toBe(`${PEEK_MIN}px`)
    fireEvent.keyDown(handle, { key: 'End' })
    expect(el.style.getPropertyValue('--peek-w')).toBe('1000px')
    done()
  })

  test('Enter and a double click go back to the default and save null', () => {
    const onWidthChange = mock((_px: number | null) => {})
    const { el, handle, done } = mountShelled({ defaultWidth: 700, onWidthChange })
    fireEvent.keyDown(handle, { key: 'Enter' })
    expect(el.style.getPropertyValue('--peek-w')).toContain('min(')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.doubleClick(handle)
    expect(el.style.getPropertyValue('--peek-w')).toContain('min(')
    expect(onWidthChange.mock.calls.map((c) => c[0])).toEqual([null, 616, null])
    done()
  })

  test('a drag toward the start widens the panel and saves once, on release', () => {
    const onWidthChange = mock((_px: number | null) => {})
    const { el, handle, done } = mountShelled({ defaultWidth: 600, onWidthChange })
    handle.setPointerCapture = () => {}
    handle.releasePointerCapture = () => {}
    handle.hasPointerCapture = () => true
    fireEvent.pointerDown(handle, { button: 0, clientX: 800, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 700, pointerId: 1 })
    expect(el.style.getPropertyValue('--peek-w')).toBe('700px')
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 })
    expect(el.style.getPropertyValue('--peek-w')).toBe('1000px')
    expect(onWidthChange).toHaveBeenCalledTimes(0)
    fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 })
    expect(onWidthChange.mock.calls.map((c) => c[0])).toEqual([1000])
    done()
  })

  test('a click that never moves the edge saves nothing', () => {
    const onWidthChange = mock((_px: number | null) => {})
    const { handle, done } = mountShelled({ onWidthChange })
    handle.setPointerCapture = () => {}
    handle.releasePointerCapture = () => {}
    handle.hasPointerCapture = () => true
    fireEvent.pointerDown(handle, { button: 0, clientX: 800, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientX: 800, pointerId: 1 })
    expect(onWidthChange).toHaveBeenCalledTimes(0)
    done()
  })

  test('a saved width that is not a number is no choice, and one under the narrowest is raised to it', () => {
    const bad = mountShelled({ defaultWidth: Number.NaN })
    expect(bad.el.style.getPropertyValue('--peek-w')).toContain('min(')
    cleanup()
    bad.done()
    const small = mountShelled({ defaultWidth: 0 })
    expect(small.el.style.getPropertyValue('--peek-w')).toBe(`${PEEK_MIN}px`)
    small.done()
  })

  test('draws no handle outside a shell, and none on a compact screen', () => {
    render(<Peek title="Issue 12" onClose={() => {}} />)
    expect(screen.queryByRole('separator')).toBeNull()
    cleanup()
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
    const { host } = fakeHost()
    const region = document.createElement('div')
    document.body.append(region)
    render(
      <PageHostContext value={host}>
        <ShellOverlayContext value={region}>
          <Peek title="Issue 12" onClose={() => {}} />
        </ShellOverlayContext>
      </PageHostContext>,
    )
    expect(screen.queryByRole('separator')).toBeNull()
    region.remove()
  })
})
