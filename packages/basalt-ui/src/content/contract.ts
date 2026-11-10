/**
 * Content contract: the public props of `Markdown` and `CodeBlock`. Types only, no value
 * symbols. Pinned by `check-contract-frozen`; a change needs a `chore: contract amendment`
 * commit. Sketched in docs/v3/concepts/ai-mdx.md section 4 (the `basalt-ui/content` block).
 * `MDXComponents` (the `mdxComponents` type) lives in `src/page/contract.ts`.
 */
import type { ReactNode } from 'react'

// minimal; concept elides it (react-markdown `Components`)
export type Components = Readonly<Record<string, (props: never) => ReactNode>>

// minimal; concept elides it (unified `PluggableList`)
export type PluggableList = readonly unknown[]

// minimal; concept elides it
export type FenceRenderers = Readonly<
  Record<string, (p: { code: string; lang: string; settled?: boolean }) => ReactNode>
>

/** Components see sanitized nodes. */
export type MarkdownBase = {
  children: string
  streaming?: boolean
  fenceRenderers?: FenceRenderers
  components?: Components
  remarkPlugins?: PluggableList
}

/** Model or agent output: no sanitize, no rehypePlugins. */
export type UntrustedMarkdownProps = MarkdownBase & {
  contentTrust: 'untrusted'
  images?: 'none' | 'same-origin'
}

export type TrustedMarkdownProps = MarkdownBase & {
  contentTrust: 'trusted'
  sanitize?: { allowTags?: string[]; allowAttrs?: Record<string, string[]> }
  rehypePlugins?: PluggableList
}

export type MarkdownProps = UntrustedMarkdownProps | TrustedMarkdownProps

export type CodeBlockProps = { lang?: string; code: string; settled?: boolean }
