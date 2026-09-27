/**
 * `CodeBlock` — the trailing-edge overflow fade (docs/MATURATION-LEDGER.md): `[data-code-
 * overflow]` is the one DOM-observable hook the CSS module's `mask-image` reads, toggled from a
 * `scrollWidth > clientWidth` + `scrollLeft` measurement rather than React state driving the mask
 * itself. happy-dom computes no real layout (both read `0` by default, which trivially satisfies
 * "no overflow"), so — same idiom as `reading-progress.test.tsx` — every geometry number is stubbed
 * by hand and `fireEvent.scroll` re-triggers the measurement (the shimmed `ResizeObserver` is a
 * no-op under `tests/setup/dom.ts`, so a scroll event is the only way to re-drive it here).
 */
import type { ReactElement } from 'react'
import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { CodeBlock } from './code-block'

afterEach(cleanup)

const restorers: Array<() => void> = []

afterEach(() => {
  while (restorers.length > 0) restorers.pop()?.()
})

function stubProp(target: object, prop: PropertyKey, value: unknown): void {
  const original = Object.getOwnPropertyDescriptor(target, prop)
  Object.defineProperty(target, prop, { value, configurable: true })
  restorers.push(() => {
    if (original) Object.defineProperty(target, prop, original)
    else Reflect.deleteProperty(target, prop)
  })
}

function renderCodeBlock(ui: ReactElement): ReturnType<typeof render> {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('CodeBlock — the overflow fade', () => {
  test('absent by default (unstubbed geometry never overflows)', () => {
    const { container } = renderCodeBlock(<CodeBlock code="const x = 1" />)
    const body = container.querySelector('pre')
    if (!body) throw new Error('unreachable — no `language` renders the plain <pre> fallback')

    expect(body.hasAttribute('data-code-overflow')).toBe(false)
  })

  test('appears once the block is wider than its box, and clears once scrolled to the end', () => {
    const { container } = renderCodeBlock(<CodeBlock code="const x = 1" />)
    const body = container.querySelector('pre')
    if (!body) throw new Error('unreachable — no `language` renders the plain <pre> fallback')

    stubProp(body, 'scrollWidth', 400)
    stubProp(body, 'clientWidth', 200)
    stubProp(body, 'scrollLeft', 0)
    fireEvent.scroll(body)
    expect(body.hasAttribute('data-code-overflow')).toBe(true)

    // 200 + 200 = 400 >= 400 - 1 — scrolled all the way to the trailing edge.
    stubProp(body, 'scrollLeft', 200)
    fireEvent.scroll(body)
    expect(body.hasAttribute('data-code-overflow')).toBe(false)
  })

  test('never appears when the content already fits (scrollWidth === clientWidth)', () => {
    const { container } = renderCodeBlock(<CodeBlock code="const x = 1" />)
    const body = container.querySelector('pre')
    if (!body) throw new Error('unreachable — no `language` renders the plain <pre> fallback')

    stubProp(body, 'scrollWidth', 200)
    stubProp(body, 'clientWidth', 200)
    fireEvent.scroll(body)
    expect(body.hasAttribute('data-code-overflow')).toBe(false)
  })
})
