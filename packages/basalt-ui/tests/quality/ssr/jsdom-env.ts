/**
 * `bun test` preload for the jsdom lane: registers a jsdom window as the globals, the same job
 * `tests/setup/dom.ts` does for happy-dom.
 *
 * Only names Bun does not already own are copied, so `fetch`, timers, streams, `URL` and
 * `AbortController` stay native. The exceptions are the event classes: a jsdom node only accepts a
 * jsdom `Event`, so `Event`, `EventTarget` and `CustomEvent` are replaced. Lower-case window
 * functions are bound to the window, because a bare `getComputedStyle(el)` loses its receiver.
 */
import { afterEach } from 'bun:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const win = dom.window as unknown as Record<string, unknown>
const target = globalThis as Record<string, unknown>

const REPLACE = new Set(['Event', 'EventTarget', 'CustomEvent', 'navigator', 'window', 'self'])

for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in target && !REPLACE.has(key)) continue
  const value = win[key]
  const bound =
    typeof value === 'function' && /^[a-z]/.test(key)
      ? (value as (...args: unknown[]) => unknown).bind(dom.window)
      : value
  Object.defineProperty(target, key, { configurable: true, writable: true, value: bound })
}
Object.defineProperty(target, 'window', { configurable: true, writable: true, value: dom.window })
Object.defineProperty(target, 'self', { configurable: true, writable: true, value: dom.window })

const { cleanup, configure } = await import('@testing-library/react')
configure({ asyncUtilTimeout: 5000 })

// Testing Library's own auto-cleanup no-ops under `bun test` (oven-sh/bun#7044).
afterEach(() => {
  cleanup()
})
