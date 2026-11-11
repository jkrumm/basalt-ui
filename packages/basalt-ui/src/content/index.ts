/**
 * `basalt-ui/content` — `Markdown` and `CodeBlock`, the renderers for model and author text.
 * `Markdown` requires `contentTrust`; the untrusted arm shows no images and accepts no sanitize or
 * rehype plugin additions. Code fences render as `CodeBlock`, headings carry anchors, and the
 * fence registry prop is the extension point. Needs react-markdown, remark-gfm, rehype-sanitize and
 * remend (all imported statically); shiki and beautiful-mermaid load on first use. The article
 * parts (typography, callout, table of contents, article frame) live in `basalt-ui/page`.
 */
export { Markdown } from './markdown'
export type { MarkdownProps } from './markdown'
export { CodeBlock } from './code-block'
