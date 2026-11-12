/** `installDomShims`: idempotent, fills the gaps, and refuses a runtime it does not know. */
import { describe, expect, spyOn, test } from 'bun:test'

import { domRunner, installDomShims } from './dom-shims'

const NAMES = ['ResizeObserver', 'IntersectionObserver', 'matchMedia', 'PointerEvent'] as const

const snapshot = (): unknown[] => [
  ...NAMES.map((name) => (globalThis as Record<string, unknown>)[name]),
  ...NAMES.map((name) => (window as unknown as Record<string, unknown>)[name]),
  window.scrollTo,
  Element.prototype.scrollTo,
  Element.prototype.scrollIntoView,
]

describe('installDomShims', () => {
  test('runs under a supported runner', () => {
    expect(['jsdom', 'happy-dom']).toContain(domRunner() ?? 'none')
  })

  test('the jsdom lane really runs jsdom', () => {
    const expected = process.env['BASALT_EXPECT_DOM']
    if (expected !== undefined) expect(domRunner() as string).toBe(expected)
  })

  test('installs every API a Base UI mount touches', () => {
    installDomShims()
    for (const name of NAMES)
      expect(typeof (globalThis as Record<string, unknown>)[name]).toBe('function')
    expect(typeof window.scrollTo).toBe('function')
    expect(typeof Element.prototype.scrollIntoView).toBe('function')
    // happy-dom evaluates the query itself; the shim answers `false`. Either way it returns a list.
    expect(typeof window.matchMedia('(min-width: 1px)').matches).toBe('boolean')
    const observer = new ResizeObserver(() => {})
    observer.observe(document.body)
    observer.disconnect()
  })

  test('a second call leaves the globals unchanged', () => {
    installDomShims()
    const first = snapshot()
    installDomShims()
    const second = snapshot()
    expect(second).toHaveLength(first.length)
    second.forEach((value, i) => expect(value).toBe(first[i]))
  })

  test('PointerEvent carries the pointer fields', () => {
    installDomShims()
    const event = new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 7 })
    expect(event.pointerType).toBe('touch')
    expect(event.pointerId).toBe(7)
    expect(event).toBeInstanceOf(MouseEvent)
  })

  test('scrollTo does not log "not implemented"', () => {
    installDomShims()
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      window.scrollTo(0, 10)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
