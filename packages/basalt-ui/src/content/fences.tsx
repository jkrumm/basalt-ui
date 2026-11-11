import { Component, createContext, useContext, useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import type { ExtraProps } from 'react-markdown'
import { CodeBlock } from './code-block'
import type { FenceRenderers } from './contract'
import { extractFenceInfo } from './markdown-hast'
import { MermaidDiagram } from './mermaid'

export type { FenceRenderers } from './contract'

type FenceRenderer = FenceRenderers[string]

/**
 * Wraps a renderer that is only worth running on finished text: while the fence is still streaming
 * the plain `CodeBlock` shows, once its block settles `render` takes over. It reads nothing but
 * `settled`, so the same input always picks the same branch (no timer, no measuring).
 */
export function settledOnly(render: FenceRenderer): FenceRenderer {
  return (p) =>
    p.settled === false ? <CodeBlock lang={p.lang} code={p.code} settled={false} /> : render(p)
}

/** basalt's own renderers. A consumer entry for the same key wins. */
const BUILT_IN: FenceRenderers = {
  mermaid: settledOnly(({ code }) => <MermaidDiagram code={code} />),
}

/**
 * The registry lookup, restricted to OWN keys. The language is the fence's info string, so it is
 * model-controlled, and both registries are plain objects: a bare `registry[lang]` resolves
 * `Object.prototype` members (`constructor`, `toString`, `__proto__`) and hands them to the render
 * path. `Object.hasOwn` rejects them, and the `typeof` gate covers a map forced past the types.
 */
function lookup(registry: FenceRenderers | undefined, lang: string): FenceRenderer | undefined {
  if (registry === undefined || !Object.hasOwn(registry, lang)) return undefined
  const candidate = registry[lang]
  return typeof candidate === 'function' ? candidate : undefined
}

type Gate = { current: boolean }

function warnOnce(gate: Gate, error: unknown): void {
  if (gate.current) return
  gate.current = true
  if (process.env['NODE_ENV'] !== 'production') {
    console.warn('[basalt] Markdown: a fence renderer threw; the fence shows as code.', error)
  }
}

type BoundaryProps = { fallback: ReactNode; gate: Gate; children: ReactNode }

/**
 * Contains a throw from the subtree a renderer RETURNS (`<Chart spec={code} />` is only a
 * descriptor when the renderer returns it; React runs `Chart` later, outside the try/catch in
 * `Fence`). `key={code}` at the call site remounts it when the body changes, so a fence that
 * starts malformed and becomes valid gets a retry.
 */
class FenceBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    warnOnce(this.props.gate, error)
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export type FenceProps = {
  code: string
  lang?: string | undefined
  settled?: boolean
  renderers?: FenceRenderers | undefined
}

/**
 * One fenced block through the registry: the consumer's renderer for the language, else the
 * built-in one (`mermaid`), else `CodeBlock`. A renderer returning `undefined` declines (the block
 * shows as code), `null` renders nothing, and a throw, from the function or from what it returns,
 * leaves the block's text on screen.
 *
 * @example
 * <Fence lang="vega" code={body} renderers={{ vega: settledOnly(({ code }) => <Vega spec={code} />) }} />
 */
export function Fence({ code, lang, settled = true, renderers }: FenceProps): ReactElement {
  const [gate] = useState<Gate>(() => ({ current: false }))
  const fallback = <CodeBlock code={code} settled={settled} {...(lang !== undefined && { lang })} />
  const render =
    lang === undefined ? undefined : (lookup(renderers, lang) ?? lookup(BUILT_IN, lang))
  if (render === undefined || lang === undefined) return fallback

  let rendered: ReactNode
  try {
    rendered = render({ code, lang, settled })
  } catch (error) {
    warnOnce(gate, error)
    return fallback
  }
  if (rendered === undefined) return fallback
  return (
    <FenceBoundary key={code} fallback={fallback} gate={gate}>
      {rendered}
    </FenceBoundary>
  )
}

/**
 * Whether the fences below are final text. `Markdown` provides it per streamed block: false for
 * the tail the model is still writing, true for every block before it and for a finished message.
 */
export const FenceSettled = createContext(true)

/**
 * The `pre` component for react-markdown's `components`: it reads the fence off the hast node and
 * hands it to `Fence` with the nearest `FenceSettled`. Build it once per pipeline (not per render)
 * so React keeps the component's identity.
 *
 * @example
 * const components = { pre: createFencePre({ vega: settledOnly(renderVega) }) }
 */
export function createFencePre(
  renderers?: FenceRenderers,
): (props: ComponentProps<'pre'> & ExtraProps) => ReactNode {
  return function FencePre({ node }) {
    const settled = useContext(FenceSettled)
    const fence = node === undefined ? undefined : extractFenceInfo(node)
    if (fence === undefined) return null
    // the newline that closes the fence is not part of the code
    return (
      <Fence
        code={fence.code.replace(/\n$/, '')}
        lang={fence.language}
        settled={settled}
        renderers={renderers}
      />
    )
  }
}
