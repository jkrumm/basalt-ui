/**
 * mdxComponents / createMdxComponents — the element map for MDX runtimes (docs/CONTENT-SPEC.md
 * §2 decision 7 / §3). Wires an MDX pipeline's compiled output (`@content-collections/mdx/react`'s
 * `MDXContent components={...}`, or any `useMDXComponents`) onto the SAME basalt primitives
 * `Markdown` uses: slugged + anchored headings (`./heading-components`, shared — not duplicated),
 * `CodeBlock`/`MermaidDiagram` fenced code, and GFM-alert-aware `Callout` blockquotes
 * (`./callout-alert`, also shared).
 *
 * Unlike `Markdown`, links/images are NOT hardened here — MDX is authored content compiled at
 * build time, not untrusted streamed text, so `a` only gets the external-link `target`/`rel`
 * treatment. `img`, `table`, and every other tag pass through untouched (`Prose`'s CSS already
 * styles them).
 *
 * MDX compiles a fenced code block to `<pre><code className="language-x">…</code></pre>` — there
 * is no hast `node` prop available here the way react-markdown provides one (`./markdown-hast`),
 * so extraction reads the compiled `code` element's `className`/`children` directly instead. A
 * consequence: unlike `Markdown`, an MDX fence's ` ```ts title="…" ` meta string is NOT recovered
 * (MDX's own compiler drops it without an extra rehype plugin) — only the language is.
 *
 * MDX pages must be wrapped in `<Prose>` by the consumer, or via `ArticleLayout` (the docs-page
 * frame) — this module ships element overrides only, not a layout.
 *
 * @example
 * import { mdxComponents } from 'basalt-ui/content'
 * import { MDXContent } from '@content-collections/mdx/react'
 *
 * <Prose><MDXContent code={article.mdx} components={mdxComponents} /></Prose>
 */
import type { JSX, ReactNode } from 'react'
import { isValidElement } from 'react'
import type { Components, ExtraProps } from 'react-markdown'
import { ALERT_CALLOUT_KIND, ALERT_TITLE, detectAlert, stripAlertMarker } from './callout-alert'
import { Callout } from './callout'
import { CodeBlock } from './code-block'
import { createHeadingComponents } from './heading-components'
import { MermaidDiagram } from './mermaid'
import { SlugTracker } from './slug'

type MdxPreProps = JSX.IntrinsicElements['pre'] & ExtraProps
type MdxBlockquoteProps = JSX.IntrinsicElements['blockquote'] & ExtraProps
type MdxLinkProps = JSX.IntrinsicElements['a'] & ExtraProps
type MdxCodeProps = { className?: string; children?: ReactNode }

function nodeToText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join('')
  if (isValidElement(node)) return nodeToText((node.props as { children?: ReactNode }).children)
  return ''
}

type MdxFence = { readonly code: string; readonly language?: string }

function extractMdxFence(preChildren: ReactNode): MdxFence | undefined {
  const codeElement = Array.isArray(preChildren) ? preChildren[0] : preChildren
  if (!isValidElement(codeElement)) return undefined

  const props = codeElement.props as MdxCodeProps
  const language = props.className
    ?.split(/\s+/)
    .find((name) => name.startsWith('language-'))
    ?.slice('language-'.length)

  return { code: nodeToText(props.children), ...(language !== undefined && { language }) }
}

function MdxPre({ children }: MdxPreProps) {
  const fence = extractMdxFence(children)
  if (!fence) return <pre>{children}</pre>
  if (fence.language === 'mermaid') return <MermaidDiagram code={fence.code} />
  return (
    <CodeBlock
      code={fence.code}
      {...(fence.language !== undefined && { language: fence.language })}
    />
  )
}

function MdxBlockquote({ children }: MdxBlockquoteProps) {
  const alert = detectAlert(children)
  if (!alert) return <blockquote>{children}</blockquote>
  return (
    <Callout kind={ALERT_CALLOUT_KIND[alert.kind]} title={ALERT_TITLE[alert.kind]}>
      {stripAlertMarker(children, alert.marker)}
    </Callout>
  )
}

function MdxLink({ href, children }: MdxLinkProps) {
  const external = href !== undefined && /^https?:\/\//.test(href)
  return (
    <a
      {...(href !== undefined && { href })}
      {...(external && { target: '_blank', rel: 'noreferrer noopener' })}
    >
      {children}
    </a>
  )
}

export type CreateMdxComponentsOptions = {
  /** Reuse an existing tracker — e.g. to share heading ids with a `TableOfContents` collecting
   * over the same rendered document. Omit for a fresh, page-scoped tracker. */
  readonly slugTracker?: SlugTracker
}

/** Builds the MDX element map (slugged/anchored headings, code/mermaid fences, alert-aware
 * blockquotes, external-link treatment). Pass `slugTracker` to share ids across components
 * rendering the same document; omit it to get a fresh tracker per call. */
export function createMdxComponents(options: CreateMdxComponentsOptions = {}): Components {
  const tracker = options.slugTracker ?? new SlugTracker()
  return {
    ...createHeadingComponents(tracker),
    pre: MdxPre,
    blockquote: MdxBlockquote,
    a: MdxLink,
  }
}

/**
 * A ready-to-use element map for simple cases. Built ONCE at module scope with its own
 * `SlugTracker` — every consumer of this constant shares that single tracker for the lifetime of
 * the app, so a heading text repeated across two DIFFERENT MDX documents will get a `-1`-suffixed
 * id on the second document, not a fresh `overview` on both. Reach for `createMdxComponents()`
 * (called per document/render) instead when that matters — e.g. a multi-document docs site.
 */
export const mdxComponents: Components = createMdxComponents()
