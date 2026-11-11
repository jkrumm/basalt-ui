/** `pickActive` and friends — the TOC spy's pure half (`toc-spy.ts`). */
import { describe, expect, test } from 'bun:test'
import { ACTIVATION_TOP_PX, canScroll, isAtBottom, pickActive } from './toc-spy'
import type { ScrollMetrics } from './toc-spy'

const metrics = (over: Partial<ScrollMetrics> = {}): ScrollMetrics => ({
  top: 0,
  scrollTop: 500,
  clientHeight: 500,
  scrollHeight: 3000,
  ...over,
})

function heading(id: string, top: number): HTMLElement {
  const el = document.createElement('h2')
  el.id = id
  el.getBoundingClientRect = () => ({ top }) as DOMRect
  return el
}

const none: ReadonlySet<string> = new Set()

describe('canScroll / isAtBottom', () => {
  test('content that fits has no range, hence no bottom', () => {
    const fits = metrics({ scrollTop: 0, scrollHeight: 500 })
    expect(canScroll(fits)).toBe(false)
    expect(isAtBottom(fits)).toBe(false)
  })

  test('the end is within 2px of the max scroll', () => {
    expect(isAtBottom(metrics({ scrollTop: 2500 }))).toBe(true)
    expect(isAtBottom(metrics({ scrollTop: 2498 }))).toBe(true)
    expect(isAtBottom(metrics({ scrollTop: 2497 }))).toBe(false)
  })
})

describe('pickActive', () => {
  const els = [heading('a', -900), heading('b', -300), heading('c', 900)]

  test('nothing to scroll: the first heading, whatever intersects', () => {
    expect(pickActive(els, new Set(['c']), metrics({ scrollTop: 0, scrollHeight: 500 }))).toBe('a')
  })

  test('at the end: the last heading', () => {
    expect(pickActive(els, new Set(['a']), metrics({ scrollTop: 2500 }))).toBe('c')
  })

  test('the topmost intersecting heading wins', () => {
    expect(pickActive(els, new Set(['b', 'c']), metrics())).toBe('b')
  })

  test('nothing intersecting: the last heading at or above the activation line', () => {
    expect(pickActive(els, none, metrics())).toBe('b')
  })

  test(`the line is inclusive: ${ACTIVATION_TOP_PX}px is reached, ${ACTIVATION_TOP_PX + 1}px is not`, () => {
    const at = [heading('a', -50), heading('b', ACTIVATION_TOP_PX)]
    const past = [heading('a', -50), heading('b', ACTIVATION_TOP_PX + 1)]
    expect(pickActive(at, none, metrics())).toBe('b')
    expect(pickActive(past, none, metrics())).toBe('a')
  })

  test('the line is measured from the scrollport’s top, not the viewport’s', () => {
    const shifted = [heading('a', 100), heading('b', 300)]
    expect(pickActive(shifted, none, metrics({ top: 250 }))).toBe('b')
    expect(pickActive(shifted, none, metrics({ top: 0 }))).toBe('a')
  })

  test('every heading below the line: the first', () => {
    const below = [heading('a', 400), heading('b', 900)]
    expect(pickActive(below, none, metrics())).toBe('a')
  })

  test('no headings: nothing', () => {
    expect(pickActive([], none, metrics())).toBeUndefined()
  })
})
