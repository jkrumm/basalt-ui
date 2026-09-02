/**
 * `bun test` preload — registered via `[test].preload` in bunfig.toml.
 * Runs ONCE PER PROCESS before any test file, giving every test file a real DOM.
 *
 * Three non-obvious pieces:
 *
 * 1. `GlobalRegistrator.register()` (from the separate `@happy-dom/global-registrator`
 *    package, not `happy-dom` itself) installs `window`/`document`/etc as globals so
 *    React 19 + Testing Library can render into a real DOM under `bun test`.
 *
 * 2. happy-dom does not implement `ResizeObserver`, `window.matchMedia`, or `document.fonts`,
 *    all of which Mantine v9 components touch during mount — `document.fonts` specifically via
 *    `Textarea`'s autosize implementation (`@mantine/core/components/Textarea/Autosize`), which
 *    calls `document.fonts.addEventListener('loadingdone', ...)` on mount and
 *    `removeEventListener` on unmount to re-measure once web fonts settle. Shimmed here, guarded
 *    by `typeof x === 'undefined'` so a future happy-dom release that ships any of the three wins
 *    over the shim.
 *
 * 3. Testing Library's auto-cleanup silently NO-OPS under `bun test`. RTL registers its
 *    afterEach hook with `if (typeof afterEach === 'function')` checked against the GLOBAL
 *    scope, but Bun does not expose `afterEach` as a global — it only exists as a named
 *    export from `bun:test` — so that branch never fires and every test's DOM leaks into
 *    the next one. Wired by hand below. See oven-sh/bun#7044. Do not delete this thinking
 *    it's redundant with RTL's built-in cleanup — it is the only thing making cleanup run.
 *
 * Note on import order: `@testing-library/react` (and transitively `@testing-library/dom`'s
 * `screen`) reads `typeof document` at MODULE EVALUATION time to decide whether it has a
 * DOM to bind to. Static ES imports are hoisted and evaluate before any top-level statement
 * in this file, so a plain `import { cleanup } from '@testing-library/react'` above
 * `GlobalRegistrator.register()` would see `document` as still undefined and permanently
 * disable `screen`. It is imported dynamically below, after registration, on purpose.
 */

import { afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import {
  ReadableStream as NativeReadableStream,
  TransformStream as NativeTransformStream,
  WritableStream as NativeWritableStream,
} from 'node:stream/web'

// Captured BEFORE `GlobalRegistrator.register()` — `AbortController`/`AbortSignal` are Node
// GLOBALS (not exports of `node:stream/web` or any other module), so the only way to keep a
// reference to the native classes is to read them off `globalThis` before happy-dom overwrites it.
const NativeAbortController = globalThis.AbortController
const NativeAbortSignal = globalThis.AbortSignal

GlobalRegistrator.register()

/**
 * happy-dom's `BrowserWindow` REPLACES a whole family of same-named web-platform globals with its
 * own JS implementations, and restoring only SOME members of a family creates brand mismatches
 * that did not exist before happy-dom was involved at all — two independent instances of this:
 *
 * 1. `TransformStream`/`WritableStream` are replaced with Node's classic (non-web) `stream.Transform`
 *    /`stream.Writable` classes — NOT the web-streams API. (`ReadableStream` happens to stay native
 *    today, since happy-dom itself imports it from `node:stream/web`; restored anyway so this
 *    doesn't silently regress on a happy-dom upgrade.) Those classic-stream shims are incompatible
 *    with code that constructs a real web `new TransformStream()`/`new WritableStream()` and expects
 *    `ReadableStream#pipeThrough` semantics — notably the `ai` package's HTTP transport
 *    (`DefaultChatTransport.processResponseStream`) and `eventsource-parser`'s
 *    `EventSourceParserStream`, both of which any streaming-chat test needs.
 *
 * 2. Restoring the three stream classes to native but leaving `AbortController`/`AbortSignal` as
 *    happy-dom's own JS implementations creates a NEW mismatch that restoring the streams alone
 *    introduced: `<native ReadableStream>.pipeTo(<happy-dom WritableStream>, { signal: <happy-dom
 *    AbortSignal> })` throws `TypeError: options.signal must be AbortSignal`, because the native
 *    `pipeTo` brand-checks its `signal` option against the native `AbortSignal` class, and happy-dom's
 *    `AbortSignal` is a different (same-named) class. The agent layer's entire streaming contract is
 *    abort-based (`ai-sdk-transport.ts` hands `abortSignal: signal` into `ai`'s
 *    `DefaultChatTransport`), so this would surface as a `TypeError` that reads like an `ai`
 *    regression rather than what it is — a harness artifact. Restored alongside the streams so the
 *    whole abort-plus-stream family is consistently native.
 *
 * Restoring the real classes here, once, at the harness level, means every test file gets a working
 * `ai` import for free — do NOT delete this thinking it's redundant with a per-file workaround; it
 * is what makes a per-file workaround unnecessary in the first place.
 */
globalThis.ReadableStream = NativeReadableStream as unknown as typeof ReadableStream
globalThis.TransformStream = NativeTransformStream as unknown as typeof TransformStream
globalThis.WritableStream = NativeWritableStream as unknown as typeof WritableStream
globalThis.AbortController = NativeAbortController
globalThis.AbortSignal = NativeAbortSignal

if (typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  window.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver
}

/**
 * `IntersectionObserver` — happy-dom does not implement it, and `@floating-ui/dom`'s `autoUpdate`
 * mounts one on every open floating element. That means ANY Mantine `Menu`/`Popover`/`Tooltip` test
 * throws on open, with an error that reads like a Mantine bug rather than a missing DOM API. A
 * no-op is correct here: the harness never scrolls, so no intersection ever changes, and every
 * position `autoUpdate` would recompute is untestable under happy-dom anyway (`matchMedia` is
 * pinned to `matches: false` and layout is not evaluated).
 */
if (typeof window.IntersectionObserver === 'undefined') {
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

  window.IntersectionObserver = IntersectionObserverShim as unknown as typeof IntersectionObserver
}

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (typeof document.fonts === 'undefined') {
  // `document.fonts` (the CSS Font Loading API's `FontFaceSet`) is `readonly` on `Document`,
  // so — unlike `window.matchMedia` above — it cannot be restored with a plain assignment;
  // `defineProperty` is the only way to install it. Only `addEventListener`/`removeEventListener`
  // are exercised (Mantine never calls `check`/`load`/`ready`/etc), so this deliberately stops at
  // those two rather than reimplementing the full `FontFaceSet` interface.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  })
}

const { cleanup, configure } = await import('@testing-library/react')

// `waitFor`/`findBy*` default to 1000ms, which the full suite crosses under load (a Menu
// opening took 1007ms inside `make verify`). Ceiling only — a passing wait returns as fast as
// before; only a genuinely stuck one waits longer before failing.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  cleanup()
})
