/**
 * `useKeyboardInsetRef` — happy-dom ships no `visualViewport` implementation at all (confirmed:
 * `grep -rl visualViewport node_modules/happy-dom` finds nothing), so every case here installs a
 * fake `VisualViewport`-shaped `EventTarget` on `window` rather than relying on the real thing —
 * the same reason `use-size-class.test.tsx` hand-builds a `MediaQueryList`.
 */
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useKeyboardInsetRef } from './use-keyboard-inset'

afterEach(cleanup)

class FakeVisualViewport extends EventTarget {
  height: number
  offsetTop: number

  constructor(height: number, offsetTop = 0) {
    super()
    this.height = height
    this.offsetTop = offsetTop
  }

  shrinkTo(height: number, offsetTop = 0): void {
    this.height = height
    this.offsetTop = offsetTop
    this.dispatchEvent(new Event('resize'))
  }
}

/** Installs a fake `visualViewport` + a fixed `clientHeight`, restoring both on return. */
function withVisualViewport<T>(
  viewport: FakeVisualViewport | undefined,
  clientHeight: number,
  fn: () => T,
): T {
  const originalViewport = window.visualViewport
  const originalClientHeight = Object.getOwnPropertyDescriptor(
    document.documentElement,
    'clientHeight',
  )
  Object.defineProperty(window, 'visualViewport', {
    value: viewport,
    configurable: true,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: clientHeight,
    configurable: true,
  })
  try {
    return fn()
  } finally {
    Object.defineProperty(window, 'visualViewport', {
      value: originalViewport,
      configurable: true,
    })
    if (originalClientHeight !== undefined) {
      Object.defineProperty(document.documentElement, 'clientHeight', originalClientHeight)
    }
  }
}

function Probe({ testId }: { testId: string }) {
  const ref = useKeyboardInsetRef()
  return (
    <div ref={ref} data-testid={testId}>
      probe
    </div>
  )
}

function renderProbe(testId: string) {
  return render(
    <MantineProvider>
      <Probe testId={testId} />
    </MantineProvider>,
  )
}

describe('useKeyboardInsetRef', () => {
  test('publishes 0px when the visual viewport matches the layout viewport', () => {
    withVisualViewport(new FakeVisualViewport(800), 800, () => {
      const { getByTestId } = renderProbe('a')
      expect(getByTestId('a').style.getPropertyValue('--vx-keyboard-inset')).toBe('0px')
    })
  })

  test('publishes the shrink as the keyboard opens, and updates on resize', () => {
    const viewport = new FakeVisualViewport(800)
    withVisualViewport(viewport, 800, () => {
      const { getByTestId } = renderProbe('b')
      const node = getByTestId('b')
      expect(node.style.getPropertyValue('--vx-keyboard-inset')).toBe('0px')

      act(() => {
        viewport.shrinkTo(500)
      })
      expect(node.style.getPropertyValue('--vx-keyboard-inset')).toBe('300px')
    })
  })

  test('subtracts offsetTop too (a scrolled visual viewport origin)', () => {
    const viewport = new FakeVisualViewport(750, 20)
    withVisualViewport(viewport, 800, () => {
      const { getByTestId } = renderProbe('c')
      // 800 - 750 - 20 = 30
      expect(getByTestId('c').style.getPropertyValue('--vx-keyboard-inset')).toBe('30px')
    })
  })

  test('never publishes a negative inset', () => {
    const viewport = new FakeVisualViewport(820, 5)
    withVisualViewport(viewport, 800, () => {
      const { getByTestId } = renderProbe('d')
      expect(getByTestId('d').style.getPropertyValue('--vx-keyboard-inset')).toBe('0px')
    })
  })

  test('removes the property on unmount', () => {
    const viewport = new FakeVisualViewport(500)
    withVisualViewport(viewport, 800, () => {
      const { getByTestId, unmount } = renderProbe('e')
      const node = getByTestId('e')
      expect(node.style.getPropertyValue('--vx-keyboard-inset')).toBe('300px')
      unmount()
      expect(node.style.getPropertyValue('--vx-keyboard-inset')).toBe('')
    })
  })

  test('is a no-op with no visualViewport support — nothing throws, no property is set', () => {
    withVisualViewport(undefined, 800, () => {
      const { getByTestId } = renderProbe('f')
      expect(getByTestId('f').style.getPropertyValue('--vx-keyboard-inset')).toBe('')
    })
  })
})
