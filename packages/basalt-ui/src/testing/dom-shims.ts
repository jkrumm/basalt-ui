/**
 * `installDomShims()`: the browser APIs Base UI and floating-ui touch on mount that jsdom and
 * happy-dom do not ship (docs/v3/concepts/quality-contract.md section 7). A consumer calls it once
 * from its test preload instead of hand-rolling `ResizeObserver` and `matchMedia` stubs.
 *
 * Idempotent: every shim installs only where the API is missing (or, for `scrollTo`, where jsdom's
 * "not implemented" stub sits), so a second call, or a runtime that ships the API itself, leaves
 * the globals exactly as they were. Geometry stays zero: the shims make a mount not throw, they do
 * not lay anything out, which is why floating geometry is a browser-lane assertion.
 *
 * Only jsdom and happy-dom are supported. Any other runtime (a real browser, `node` with no DOM)
 * throws at once: shimming a browser would hide the real API, and a missing document is a setup bug.
 */

type Win = typeof globalThis & Window

const INSTALLED = Symbol.for('basalt-ui.testing.dom-shims')

type Shimmed = { [INSTALLED]?: true }

const mark = <T extends object>(value: T): T => {
  ;(value as Shimmed)[INSTALLED] = true
  return value
}

const isMarked = (value: unknown): boolean =>
  (typeof value === 'function' || (typeof value === 'object' && value !== null)) &&
  (value as Shimmed)[INSTALLED] === true

/** Which supported DOM runner owns `window`, or `null` when it is neither. */
export function domRunner(): 'jsdom' | 'happy-dom' | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  if ((window as { happyDOM?: unknown }).happyDOM !== undefined) return 'happy-dom'
  if (/\bjsdom\b/i.test(window.navigator?.userAgent ?? '')) return 'jsdom'
  return null
}

class ResizeObserverShim {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverShim {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds: ReadonlyArray<number> = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

/** The 2.x harness' `matches: false` list, minus the deprecated pair no code path of ours calls. */
function matchMediaShim(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }
}

/** Enough of `PointerEvent` for Base UI's press handling: it is a `MouseEvent` plus the pointer fields. */
function makePointerEvent(win: Win): typeof PointerEvent {
  class PointerEventShim extends win.MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    readonly isPrimary: boolean
    readonly width: number
    readonly height: number
    readonly pressure: number

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
      this.isPrimary = init.isPrimary ?? true
      this.width = init.width ?? 1
      this.height = init.height ?? 1
      this.pressure = init.pressure ?? 0
    }
  }
  return PointerEventShim as unknown as typeof PointerEvent
}

/** Defines `key` on `target` only when it is absent; reports whether it wrote. */
function define(target: object, key: string, value: unknown): void {
  if ((target as Record<string, unknown>)[key] !== undefined) return
  Object.defineProperty(target, key, { configurable: true, writable: true, value })
}

/**
 * Installs `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `scrollTo` (window and element)
 * and `PointerEvent` on the current `window` and `globalThis`. Call it before the first render.
 *
 * @useWhen a jsdom or happy-dom test mounts a Base UI popup and the runner lacks a browser API it touches
 * @neverWhen the test runs in a real browser, or the runner is neither jsdom nor happy-dom (it throws)
 *
 * @example
 * // test preload, once
 * installDomShims()
 */
export function installDomShims(): void {
  const runner = domRunner()
  if (runner === null) {
    throw new Error(
      'installDomShims() runs under jsdom or happy-dom only: no supported DOM global was found. ' +
        'Register one in your test preload first (a real browser needs no shims).',
    )
  }
  const win = window as Win
  const g = globalThis as Record<string, unknown>
  const both = (key: string, value: unknown): void => {
    define(win, key, value)
    if (g[key] === undefined) g[key] = (win as unknown as Record<string, unknown>)[key]
  }

  both('ResizeObserver', ResizeObserverShim)
  both('IntersectionObserver', IntersectionObserverShim)
  both('matchMedia', matchMediaShim)
  both('PointerEvent', makePointerEvent(win))

  // jsdom ships `window.scrollTo` as a "not implemented" stub that logs through the virtual console
  // (a `console.error` the isomorphic harness counts as a failure), so it is replaced once; happy-dom
  // ships a working one and keeps it.
  if (runner === 'jsdom' && !isMarked(win.scrollTo)) {
    const noop = mark(() => {})
    Object.defineProperty(win, 'scrollTo', { configurable: true, writable: true, value: noop })
  }
  define(
    win.Element.prototype,
    'scrollTo',
    mark(() => {}),
  )
  define(
    win.Element.prototype,
    'scrollIntoView',
    mark(() => {}),
  )
}
