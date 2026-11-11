/**
 * `bar-measure.ts`: the band measure against happy-dom with a stubbed rect and a ResizeObserver the
 * test fires itself (the shim never lays out).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PAGE_BAR_HEIGHT_VAR, observeBarHeight, publishBarHeight } from './bar-measure'

let target: HTMLElement
let nativeResizeObserver: typeof ResizeObserver | undefined
let observers: { node: Element; fire: () => void; disconnected: boolean }[] = []

function installFakeResizeObserver(): void {
  observers = []
  class FakeResizeObserver {
    private entry?: (typeof observers)[number]
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(node: Element): void {
      this.entry = {
        node,
        fire: () => this.callback([], this as unknown as ResizeObserver),
        disconnected: false,
      }
      observers.push(this.entry)
    }
    unobserve(): void {}
    disconnect(): void {
      if (this.entry) this.entry.disconnected = true
    }
  }
  window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
}

function band(height: number): HTMLElement {
  const node = document.createElement('div')
  document.body.append(node)
  setHeight(node, height)
  return node
}

function setHeight(node: HTMLElement, height: number): void {
  Object.defineProperty(node, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0 }),
  })
}

const published = () => target.style.getPropertyValue(PAGE_BAR_HEIGHT_VAR)

beforeEach(() => {
  nativeResizeObserver = window.ResizeObserver
  installFakeResizeObserver()
  target = document.createElement('div')
  document.body.append(target)
  location.hash = ''
})

afterEach(() => {
  window.ResizeObserver = nativeResizeObserver as typeof ResizeObserver
  document.body.replaceChildren()
  document.documentElement.style.removeProperty(PAGE_BAR_HEIGHT_VAR)
})

describe('publishBarHeight', () => {
  test('writes the measured height, fractions included, onto the target', () => {
    expect(publishBarHeight(band(44.5), target)).toBe(true)
    expect(published()).toBe('44.5px')
  })

  test('defaults to the document root', () => {
    publishBarHeight(band(40))
    expect(document.documentElement.style.getPropertyValue(PAGE_BAR_HEIGHT_VAR)).toBe('40px')
  })

  test('ignores height 0 and keeps the last good value', () => {
    const node = band(40)
    publishBarHeight(node, target)
    setHeight(node, 0)
    expect(publishBarHeight(node, target)).toBe(false)
    expect(published()).toBe('40px')
  })

  test('a first publish of 0 publishes nothing', () => {
    expect(publishBarHeight(band(0), target)).toBe(false)
    expect(published()).toBe('')
  })

  test('the first publish re-aims location.hash once, instantly', () => {
    const heading = document.createElement('h2')
    heading.id = 'runs'
    const calls: unknown[] = []
    heading.scrollIntoView = ((arg: unknown) =>
      void calls.push(arg)) as typeof heading.scrollIntoView
    document.body.append(heading)
    location.hash = '#runs'
    const node = band(40)
    publishBarHeight(node, target)
    setHeight(node, 52)
    publishBarHeight(node, target)
    expect(calls).toEqual([{ behavior: 'instant' }])
    expect(published()).toBe('52px')
  })

  test('a hash naming nothing, or a malformed one, is ignored', () => {
    location.hash = '#missing'
    expect(publishBarHeight(band(40), target)).toBe(true)
    target.style.removeProperty(PAGE_BAR_HEIGHT_VAR)
    location.hash = '#%E0%A4%A'
    expect(publishBarHeight(band(40), target)).toBe(true)
  })
})

describe('observeBarHeight', () => {
  test('publishes now, re-publishes on resize and skips a zero box', () => {
    const node = band(40)
    const stop = observeBarHeight(node, target)
    expect(published()).toBe('40px')
    setHeight(node, 64)
    observers[0]!.fire()
    expect(published()).toBe('64px')
    setHeight(node, 0)
    observers[0]!.fire()
    expect(published()).toBe('64px')
    stop()
  })

  test('cleanup disconnects and removes the property', () => {
    const stop = observeBarHeight(band(40), target)
    stop()
    expect(observers[0]!.disconnected).toBe(true)
    expect(published()).toBe('')
  })

  test('without a ResizeObserver the one-shot publish still runs', () => {
    ;(window as { ResizeObserver?: unknown }).ResizeObserver = undefined
    const original = globalThis.ResizeObserver
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined
    try {
      const stop = observeBarHeight(band(40), target)
      expect(published()).toBe('40px')
      stop()
      expect(published()).toBe('')
    } finally {
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = original
    }
  })
})
