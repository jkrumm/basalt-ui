/**
 * `basalt-ui/content` — prose, markdown and the docs-page frame (docs/CONTENT-SPEC.md).
 *
 * Mantine-coupled. `Markdown` renders code and mermaid fences itself (`CodeBlock` and
 * `MermaidDiagram` are internal); `fenceRenderers` is the extension point. Optional peers
 * (shiki, react-markdown stack, beautiful-mermaid) load lazily; the sanitizer is always on.
 */

export { Prose } from './prose'
export { Callout } from './callout'
export type { CalloutKind } from './callout'
export { TableOfContents } from './toc'
export type { TocItem } from './toc'
export { Markdown, settledOnly } from './markdown'
export type { FenceRenderer, FenceRenderers, MarkdownComponents, MarkdownProps } from './markdown'
export { mergeSanitizeSchema } from './sanitize'
export type { SanitizeSchemaExtension, SanitizeSchemaInput } from './sanitize'
export { ArticleLayout } from './article-layout'
export type { ArticleLayoutMeta } from './article-layout'
export { GuideLink } from './guide'
