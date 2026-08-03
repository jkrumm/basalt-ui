/**
 * FenceBlock — renders a fenced code block's hast `pre` node through the fence-renderer registry
 * (docs/CONTENT-SPEC.md §2 decision 4 / §6). Shared by every `pre` override `./markdown` builds
 * (one per streamed block, each with its own `settled` flag).
 *
 * ONE mechanism, two sources: a consumer's `fenceRenderers[language]` is consulted first, then
 * `BUILT_IN_FENCE_RENDERERS[language]`, then the plain `CodeBlock` fallback. `mermaid` is no longer
 * a hardcoded branch — it is a built-in entry defined with `settledOnly`, exactly the helper a
 * consumer uses for its own heavyweight renderer.
 *
 * `settledOnly` renderers (mermaid included) render a plain `CodeBlock` while `settled` is `false`
 * (the in-flight streaming tail) and upgrade once the fence's block settles — no flicker, no wasted
 * parse pass on a still-changing diagram. Every fenced language hides its copy action while
 * unsettled for the same reason (copying a still-streaming block is misleading).
 *
 * NEITHER a decline nor a throw may take the message down — a model-authored fence body (JSON for a
 * `vega-lite` renderer, a payload for a `card` renderer, …) is routinely malformed, and this is a
 * render path: the same invariant that made `spliceText` clamp instead of throw and dropped the
 * runtime `assertNever` from `coalesceParts` applies here. `CodeBlock` is always a correct rendering
 * of any fence, which is what makes it safe as the universal fallback:
 *  - A renderer returns `undefined` to DECLINE ("I cannot render this, use the default"). `null` is
 *    a different, deliberate result — "render nothing" — and is passed through unchanged.
 *  - A renderer that THROWS is contained two different ways depending on where the throw happens —
 *    see `renderFenceSafely` (a throw from the renderer function itself) and `FenceRenderBoundary` (a
 *    throw from a component the renderer merely returns) below — and both fall back to `CodeBlock`
 *    with a once-per-fence dev warning (`warnFenceRendererThrew`).
 *
 * `FenceBlock` itself is not part of the public surface; `FenceRenderer`/`FenceRenderContext`/
 * `settledOnly` are, re-exported through `./markdown` (the props that carry them live on
 * `MarkdownProps`).
 */
import { Component, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Element } from 'hast'
import { CodeBlock } from './code-block'
import { extractFenceInfo } from './markdown-hast'
import { MermaidDiagram } from './mermaid'

// ── Public registry types ─────────────────────────────────────────────────────────────────────

export type FenceRenderContext = {
  /** The fence body, without the surrounding fence markers. */
  readonly code: string
  /** The info string's first word (` ```ts title="x" ` → `'ts'`), absent on a bare fence. */
  readonly language?: string
  /** Raw meta string after the language on the opening fence line (`'title="x"'` above). */
  readonly meta?: string
  /** Parsed `title="…"` out of `meta` — the filename tab `CodeBlock` renders. */
  readonly title?: string
  /** `false` only for the in-flight tail block of a streaming message. Monotone: never true→false. */
  readonly settled: boolean
}

/**
 * `undefined` DECLINES — the fence falls back to the default `CodeBlock` rendering, no different
 * from an unclaimed language. `null` is NOT a decline; it is a deliberate "render nothing" result
 * and is used as-is. A renderer that THROWS is also contained and falls back to `CodeBlock` (see the
 * module doc above) — no renderer needs its own try/parse/fallback scaffolding to survive malformed,
 * model-authored fence bodies.
 */
export type FenceRenderer = (ctx: FenceRenderContext) => ReactNode

/** Fence renderers keyed by language. */
export type FenceRenderers = Readonly<Record<string, FenceRenderer>>

/** The registry's terminal fallback — also what an unsettled `settledOnly` renderer shows. */
const defaultFenceRenderer: FenceRenderer = ({ code, language, title, settled }) => (
  <CodeBlock
    code={code}
    showCopy={settled}
    {...(language !== undefined && { language })}
    {...(title !== undefined && { title })}
  />
)

/**
 * Wraps a renderer that is only worth running on finished text: renders the plain `CodeBlock`
 * while the fence is still streaming, then `render` once its block settles. The built-in `mermaid`
 * entry IS this — a consumer's own heavyweight fence (a chart spec, a diagram DSL) wants the same
 * deal.
 *
 * @example
 * import { settledOnly } from 'basalt-ui/content'
 *
 * <Markdown fenceRenderers={{ vega: settledOnly(({ code }) => <VegaChart spec={code} />) }}>
 */
export function settledOnly(render: FenceRenderer): FenceRenderer {
  return (ctx) => (ctx.settled ? render(ctx) : defaultFenceRenderer(ctx))
}

/** basalt's own fence renderers. A consumer entry for the same key wins over these. */
export const BUILT_IN_FENCE_RENDERERS: FenceRenderers = {
  mermaid: settledOnly(({ code }) => <MermaidDiagram code={code} />),
}

// ── FenceBlock ────────────────────────────────────────────────────────────────────────────────

/**
 * The raw meta string lives on the `code` child's `data.meta` (mdast-util-to-hast puts it there,
 * never on the surrounding `pre`). `extractFenceInfo` parses `title="…"` out of it but does not
 * surface the raw string, and widening `FenceInfo` is not this module's call — so read it here.
 */
function extractFenceMeta(preNode: Element): string | undefined {
  const codeNode = preNode.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'code',
  )
  const data = codeNode?.data as { meta?: string } | undefined
  return data?.meta
}

export type FenceBlockProps = {
  readonly node?: Element
  readonly settled: boolean
  /** Consumer overrides, consulted BEFORE `BUILT_IN_FENCE_RENDERERS`. */
  readonly renderers?: FenceRenderers
}

/**
 * Registry lookup restricted to OWN keys — the only safe way to index either registry.
 *
 * `language` is the fence info string, so it is MODEL-CONTROLLED: `markdown-hast.ts` reads it off
 * the `language-*` class, and `defaultSchema.attributes.code` (`[['className', /^language-./]]`)
 * lets any such class through the sanitize pass. Both registries are plain object literals, so a
 * bare `map[language]` resolves `Object.prototype` members and the `??` fallback never fires:
 * ` ```valueOf `, ` ```hasOwnProperty ` and ` ```isPrototypeOf ` THREW when the resolved method was
 * called unbound, ` ```__proto__ ` threw on a non-callable, and ` ```toString `/` ```constructor `
 * rendered garbage. `Object.hasOwn` also rejects `__proto__` in a consumer literal (that key sets
 * the prototype rather than defining an own property), and the `typeof` gate covers a consumer map
 * that reached here through a cast with a non-function value.
 */
function lookupFenceRenderer(
  registry: FenceRenderers | undefined,
  language: string,
): FenceRenderer | undefined {
  if (registry === undefined || !Object.hasOwn(registry, language)) return undefined
  const candidate = registry[language]
  return typeof candidate === 'function' ? candidate : undefined
}

// ── Throw containment ────────────────────────────────────────────────────────────────────────────

/** A `useRef(false)` handle, mutated in place — same per-instance "warn once" idiom as
 * `useHoverSync`'s `warnedRef` (`charts/hooks/useHoverSync.ts`) rather than a module-level
 * singleton: a singleton would make the FIRST fence anywhere in the process to throw silence the
 * warning for every OTHER, unrelated broken fence for the rest of the run (and, worse, for every
 * later test in this suite — this file has module-singleton order-dependence history). Scoping the
 * gate to one `FenceBlock`'s `useRef` means each rendered fence position gets its own warning, reset
 * only on remount, and unrelated fences/tests never interact through it. */
type WarnedGate = { current: boolean }

/**
 * Formats + emits the dev-only "a fence renderer threw" warning at most once per `warned` gate.
 * Shared by BOTH containment paths below (`renderFenceSafely`'s try/catch and
 * `FenceRenderBoundary.componentDidCatch`) so a fence that throws via either mechanism still only
 * warns once. Mirrors the `process.env['NODE_ENV'] + console.warn('[basalt] …')` idiom used by
 * `agent/merge.ts`'s `clampOffset` — including leaving the resulting oxlint `no-console` warning
 * unsuppressed, the established convention in this package.
 */
function warnFenceRendererThrew(warned: WarnedGate, error: unknown): void {
  if (warned.current) return
  warned.current = true
  if (process.env['NODE_ENV'] !== 'production') {
    console.warn(
      '[basalt] FenceBlock: a fence renderer threw — falling back to the default CodeBlock rendering.',
      error,
    )
  }
}

/**
 * Calls `render(ctx)` inside a try/catch — contains a SYNCHRONOUS throw from the renderer FUNCTION
 * itself (e.g. `JSON.parse(code)` failing before the renderer ever returns anything). This catch
 * sits in the same call stack as the invocation, so it only ever sees a throw that happens INSIDE
 * this call — never one from a component the renderer merely returns as a descriptor (React invokes
 * that component's own function body later, in a stack frame this function has already returned
 * from — see `FenceRenderBoundary` for that case).
 *
 * Also resolves the decline convention here: `undefined` falls back to `defaultFenceRenderer`;
 * `null` (or any other `ReactNode`) passes through unchanged.
 */
function renderFenceSafely(
  render: FenceRenderer,
  ctx: FenceRenderContext,
  warned: WarnedGate,
): ReactNode {
  let rendered: ReactNode
  try {
    rendered = render(ctx)
  } catch (error) {
    warnFenceRendererThrew(warned, error)
    return defaultFenceRenderer(ctx)
  }
  return rendered === undefined ? defaultFenceRenderer(ctx) : rendered
}

type FenceRenderBoundaryProps = {
  readonly ctx: FenceRenderContext
  readonly warned: WarnedGate
  readonly children: ReactNode
}
type FenceRenderBoundaryState = { hasError: boolean }

/**
 * Contains a throw from the SUBTREE a `FenceRenderer` RETURNS — e.g.
 * `settledOnly(({ code }) => <VegaChart spec={code} />)` where `VegaChart` itself throws while
 * parsing `code` during ITS OWN render. `renderFenceSafely`'s try/catch cannot reach this case:
 * `<VegaChart spec={code} />` is only a descriptor at the point the renderer returns it — React
 * invokes `VegaChart`'s function body later, during its own render pass, outside the stack frame
 * `renderFenceSafely` controls. An error boundary is the only mechanism that reaches a render-phase
 * throw at that depth.
 *
 * `key={ctx.code}` at the call site (below) remounts this boundary — fresh `hasError: false` — every
 * time the fence body changes, so a still-streaming fence that starts malformed and later becomes
 * valid gets a genuine retry instead of staying permanently tripped.
 *
 * KNOWN GAP (standard React error-boundary limits): a throw from an event handler, from an effect
 * running after an already-successful commit, or from asynchronous code is NOT caught here — only a
 * throw during the RENDER of the returned subtree is contained.
 */
class FenceRenderBoundary extends Component<FenceRenderBoundaryProps, FenceRenderBoundaryState> {
  constructor(props: FenceRenderBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): FenceRenderBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown): void {
    warnFenceRendererThrew(this.props.warned, error)
  }

  override render(): ReactNode {
    return this.state.hasError ? defaultFenceRenderer(this.props.ctx) : this.props.children
  }
}

export function FenceBlock({ node, settled, renderers }: FenceBlockProps) {
  const warned = useRef(false)
  const fence = node ? extractFenceInfo(node) : undefined
  if (!fence) return null

  const meta = node ? extractFenceMeta(node) : undefined
  const ctx: FenceRenderContext = {
    code: fence.code,
    settled,
    ...(fence.language !== undefined && { language: fence.language }),
    ...(fence.title !== undefined && { title: fence.title }),
    ...(meta !== undefined && { meta }),
  }

  const language = fence.language
  const render =
    language === undefined
      ? undefined
      : (lookupFenceRenderer(renderers, language) ??
        lookupFenceRenderer(BUILT_IN_FENCE_RENDERERS, language))
  const active = render ?? defaultFenceRenderer

  return (
    <FenceRenderBoundary key={ctx.code} ctx={ctx} warned={warned}>
      {renderFenceSafely(active, ctx, warned)}
    </FenceRenderBoundary>
  )
}
