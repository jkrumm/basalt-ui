/**
 * The isomorphic smoke runner — Blueprint's `generateIsomorphicTests` (audit-blueprint.md §4),
 * ported to bun:test + happy-dom.
 *
 * The shape of the idea: a design system's real contract is not "each component has a unit test",
 * it is "every export a consumer can reach renders, says nothing on the console, unmounts, and
 * passes a `className` through". Those four are cheap per component and only interesting in
 * aggregate — which is why this enumerates BARRELS rather than naming components.
 *
 * Three deliberate choices:
 *
 * 1. **Detection is structural, never a list.** A new export is picked up by the next run with no
 *    edit here; `props.tsx` is the only file that ever needs one. That is the whole leverage.
 * 2. **`console.error`/`console.warn` are failures, not noise.** React logs a key warning, a bad
 *    DOM attribute, a `useLayoutEffect`-on-server, and every act() violation there. A component
 *    that logs under MINIMAL props is a defect in the component, so the spy collects rather than
 *    silences — the message reaches the failure text.
 * 3. **No JSX in this file.** `createElement` keeps the runner a plain `.ts` module the spec can
 *    import without dragging a wrapper tree along; the JSX (fixtures, providers, prop values)
 *    lives in `props.tsx` where it belongs.
 */
import { spyOn } from 'bun:test'
import { createElement, isValidElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'

/** The class we hand every component and then look for in its rendered output (audit item C8). */
export const CLASSNAME_PROBE = 'basalt-iso-probe'

export type Detected = {
  readonly name: string
  readonly component: ComponentType<Record<string, unknown>>
}

/**
 * React's own component brands. `memo`/`forwardRef`/`lazy` are OBJECTS, not functions, so a
 * `typeof === 'function'` test alone misses every composite basalt wraps — and `Symbol.for` is the
 * documented way to read them without importing react-is (which basalt does not depend on).
 */
const REACT_ELEMENT_BRANDS: ReadonlySet<symbol> = new Set([
  Symbol.for('react.memo'),
  Symbol.for('react.forward_ref'),
  Symbol.for('react.lazy'),
])

/**
 * A function whose name starts uppercase, or a branded composite object. Deliberately loose: a
 * false positive costs one `SKIP` entry, a false negative costs silent coverage.
 *
 * The one narrowing: a PLAIN ES class is not a component. `BasaltErrorBoundary` is a React class
 * component (`prototype.isReactComponent`, React's own brand) and must be caught; `SlugTracker` on
 * `basalt-ui/content` is an ordinary utility class with a PascalCase name and must not be, because
 * calling it without `new` throws a `TypeError` that reads like a component defect. Nothing else
 * distinguishes the two at runtime — `Function.prototype.toString` is the only signal, and React
 * itself uses the same `isReactComponent` marker.
 */
export function isComponentExport(name: string, value: unknown): boolean {
  if (!/^[A-Z]/.test(name)) return false
  if (typeof value === 'function') return !isPlainClass(value)
  if (typeof value !== 'object' || value === null) return false
  const brand = (value as { $$typeof?: unknown }).$$typeof
  return typeof brand === 'symbol' && REACT_ELEMENT_BRANDS.has(brand)
}

function isPlainClass(value: Function): boolean {
  if (!Function.prototype.toString.call(value).startsWith('class ')) return false
  const proto = (value as { prototype?: { isReactComponent?: unknown } }).prototype
  return proto?.isReactComponent === undefined
}

/** Every component export of a barrel, name-sorted so the emitted test order is stable. */
export function detectComponents(mod: Record<string, unknown>): Detected[] {
  return Object.entries(mod)
    .filter(([name, value]) => isComponentExport(name, value))
    .map(([name, component]) => ({
      name,
      component: component as ComponentType<Record<string, unknown>>,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
}

export type ConsoleCapture = {
  readonly messages: string[]
  restore: () => void
}

/**
 * Collect-and-forward-nothing spies on both console lanes. Bun's `spyOn` replaces the
 * implementation, so the original is captured and restored explicitly — a leaked spy would make
 * every LATER test in the process silently swallow its own diagnostics.
 */
export function captureConsole(): ConsoleCapture {
  const messages: string[] = []
  const record =
    (lane: 'error' | 'warn') =>
    (...args: unknown[]) => {
      messages.push(`${lane}: ${args.map(formatArg).join(' ')}`)
    }
  const errorSpy = spyOn(console, 'error').mockImplementation(record('error'))
  const warnSpy = spyOn(console, 'warn').mockImplementation(record('warn'))
  return {
    messages,
    restore: () => {
      errorSpy.mockRestore()
      warnSpy.mockRestore()
    },
  }
}

export type RenderOutcome = {
  readonly renderError: Error | null
  readonly unmountError: Error | null
  readonly consoleMessages: readonly string[]
  readonly html: string
  /** `null` when the component threw before producing any DOM. */
  readonly hasClassNameProbe: boolean | null
}

type RenderApi = {
  render: (ui: ReactElement) => { container: HTMLElement; unmount: () => void }
}

/**
 * One mount → assert → unmount cycle with both console lanes captured across the WHOLE cycle
 * (unmount included — an effect cleanup that throws logs there, and that is exactly the class of
 * defect a smoke pass exists to find).
 *
 * `render` is injected rather than imported so this module stays free of `@testing-library/react`,
 * which binds to `document` at module-evaluation time and would make the runner un-importable from
 * the SSR half of the suite.
 */
export function renderProbe(api: RenderApi, ui: ReactElement): RenderOutcome {
  const capture = captureConsole()
  let renderError: Error | null = null
  let unmountError: Error | null = null
  let html = ''
  let hasClassNameProbe: boolean | null = null

  try {
    const view = api.render(ui)
    html = view.container.innerHTML
    hasClassNameProbe = html.includes(CLASSNAME_PROBE)
    try {
      view.unmount()
    } catch (error) {
      unmountError = toError(error)
    }
  } catch (error) {
    renderError = toError(error)
  } finally {
    capture.restore()
  }

  return { renderError, unmountError, consoleMessages: capture.messages, html, hasClassNameProbe }
}

export type SsrOutcome = {
  readonly error: Error | null
  readonly html: string
  readonly consoleMessages: readonly string[]
}

/**
 * The server half. `renderToString` is the honest form of "render with no `document`": React DOM
 * cannot be made to run against a deleted global, but the server renderer genuinely never touches
 * one — so anything reaching `window`/`document` during render (as opposed to in an effect) throws
 * here and nowhere else.
 */
export function ssrProbe(
  renderToString: (ui: ReactElement) => string,
  ui: ReactElement,
): SsrOutcome {
  const capture = captureConsole()
  let error: Error | null = null
  let html = ''
  try {
    html = renderToString(ui)
  } catch (caught) {
    error = toError(caught)
  } finally {
    capture.restore()
  }
  return { error, html, consoleMessages: capture.messages }
}

/** Build the element under test: minimal props, plus the `className` probe. */
export function probeElement(
  component: ComponentType<Record<string, unknown>>,
  props: Record<string, unknown>,
): ReactElement {
  const { children, ...rest } = props
  return createElement(
    component,
    { className: CLASSNAME_PROBE, ...rest },
    children as ReactNode | undefined,
  )
}

/** A one-line failure message that names the component and quotes what actually went wrong. */
export function describeOutcome(label: string, outcome: RenderOutcome): string {
  const parts: string[] = []
  if (outcome.renderError) parts.push(`render threw: ${outcome.renderError.message}`)
  if (outcome.unmountError) parts.push(`unmount threw: ${outcome.unmountError.message}`)
  if (outcome.consoleMessages.length > 0) {
    parts.push(`console: ${outcome.consoleMessages.join(' | ')}`)
  }
  return parts.length === 0 ? `${label}: clean` : `${label} — ${parts.join('; ')}`
}

/**
 * React logs through `console.error('%o', error)`, so `String(arg)` alone yields a useless
 * `"%o [object Object]"`. Unwrapping the Error and collapsing newlines is what makes the failure
 * text name the actual defect on one grep-able line.
 */
function formatArg(arg: unknown): string {
  const text = arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg)
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 400 ? `${flat.slice(0, 400)}…` : flat
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(String(value))
}

export { isValidElement }
