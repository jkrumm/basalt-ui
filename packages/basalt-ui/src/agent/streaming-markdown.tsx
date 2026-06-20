/**
 * StreamingMarkdown — Tailwind-free markdown renderer over react-markdown + remark-gfm.
 *
 * LAZY-LOADED: react-markdown and remark-gfm are OPTIONAL peers. This module uses React.lazy +
 * dynamic import() so importing 'basalt-ui/agent' does NOT eagerly resolve react-markdown. The
 * packages are loaded only when this component is first rendered and the Suspense boundary fires.
 * This mirrors the pattern in src/query/devtools.tsx.
 *
 * Tailwind-free: all default element overrides use className hooks (e.g. 'basalt-agent-md-h1').
 * The consumer can override any element via the `components` prop (passed through to react-markdown).
 *
 * NOTE: streamdown v2.5.0 REQUIRES Tailwind — do NOT use it here. It is documented in
 * agent/rules/basalt-agent.md as the Tailwind-only alternative but is not a basalt peer.
 *
 * Install optional peers:
 *   bun add react-markdown remark-gfm
 *
 * @example
 * import { StreamingMarkdown } from 'basalt-ui/agent'
 *
 * // Basic usage — uses default headless renderers:
 * <StreamingMarkdown>{markdownText}</StreamingMarkdown>
 *
 * @example
 * // With Mantine component overrides (consumer-side):
 * import { Code } from '@mantine/core'
 * <StreamingMarkdown components={{ code: ({ children }) => <Code>{children}</Code> }}>
 *   {markdownText}
 * </StreamingMarkdown>
 */
import { lazy, Suspense, type JSX } from 'react'

// ── Type for react-markdown Components ────────────────────────────────────────

// Import the type only — erased at runtime (verbatimModuleSyntax safe).
import type { Components } from 'react-markdown'

// ── Lazy-loaded Markdown component ────────────────────────────────────────────

type MarkdownProps = {
  children: string
  components?: Components
}

// The dynamic import chain loads react-markdown + remark-gfm only at render time.
// The default export wrapper satisfies React.lazy's `{ default: ComponentType }` contract.
const LazyMarkdown = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ])

  /**
   * Default headless component overrides: plain HTML elements with className hooks.
   * Consumers override the entire map via `components` to apply Mantine or custom styles.
   * These are typed as `Components` (react-markdown's own type) to avoid type-checking friction.
   */
  const DEFAULT_MD_COMPONENTS: Components = {
    h1: ({ children }) => <h1 className="basalt-agent-md-h1">{children}</h1>,
    h2: ({ children }) => <h2 className="basalt-agent-md-h2">{children}</h2>,
    h3: ({ children }) => <h3 className="basalt-agent-md-h3">{children}</h3>,
    p: ({ children }) => <p className="basalt-agent-md-p">{children}</p>,
    code: ({ children, className }) => (
      <code className={['basalt-agent-md-code', className].filter(Boolean).join(' ')}>
        {children}
      </code>
    ),
    pre: ({ children }) => <pre className="basalt-agent-md-pre">{children}</pre>,
    ul: ({ children }) => <ul className="basalt-agent-md-ul">{children}</ul>,
    ol: ({ children }) => <ol className="basalt-agent-md-ol">{children}</ol>,
    li: ({ children }) => <li className="basalt-agent-md-li">{children}</li>,
    a: ({ children, href }) => (
      <a className="basalt-agent-md-a" href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="basalt-agent-md-blockquote">{children}</blockquote>
    ),
  }

  function MarkdownWithGfm({ children, components }: MarkdownProps): JSX.Element {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components ?? DEFAULT_MD_COMPONENTS}>
        {children}
      </ReactMarkdown>
    )
  }

  return { default: MarkdownWithGfm }
})

// ── StreamingMarkdown ─────────────────────────────────────────────────────────

export type StreamingMarkdownProps = {
  /** The markdown string to render. Safe to update on every character during streaming. */
  readonly children: string
  /**
   * Override the component map passed to react-markdown.
   * If provided, replaces the entire default component map — merge manually if needed.
   */
  readonly components?: Components
}

/**
 * Tailwind-free markdown via react-markdown + remark-gfm, lazily loaded.
 *
 * Falls back to a plain `<span>` while the react-markdown chunk is loading (first render only —
 * subsequent renders hit the module cache). The `children` string streams in safely on each update.
 *
 * react-markdown and remark-gfm must be installed as optional peers to use this component.
 * The plain text fallback works without them installed.
 *
 * @example
 * import { StreamingMarkdown } from 'basalt-ui/agent'
 * <StreamingMarkdown>{markdownText}</StreamingMarkdown>
 */
export function StreamingMarkdown({ children, components }: StreamingMarkdownProps): JSX.Element {
  const lazyProps: MarkdownProps = { children }
  if (components !== undefined) lazyProps.components = components
  return (
    <Suspense fallback={<span className="basalt-agent-md-fallback">{children}</span>}>
      <LazyMarkdown {...lazyProps} />
    </Suspense>
  )
}
