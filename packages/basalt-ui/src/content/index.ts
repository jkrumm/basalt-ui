/**
 * `basalt-ui/content` — the content/prose surface (docs/CONTENT-SPEC.md).
 *
 * Mantine-coupled (like `./forms`/`./notifications`/`./data`): prose typography, a shiki-backed
 * code block (optional peer, lazy singleton), a semantic callout, a scroll-spy TOC rail, a
 * scroll-driven reading-progress bar, a streaming-aware `Markdown` renderer (react-markdown +
 * remark-gfm, optional peers), `MermaidDiagram` (beautiful-mermaid, optional peer), the MDX
 * component map, the docs-page frame (`ArticleLayout`), overview cards (`ArticleCard`/
 * `ArticleGrid`), and the contextual-help drawer (`GuideLink`/`GuideDrawer`). See
 * `agent/rules/basalt-content.md` for the full doctrine + the content-collections recipe.
 */
export { Prose } from './prose'
export type { ProseDensity, ProseProps } from './prose'

export { CodeBlock } from './code-block'
export type { CodeBlockProps } from './code-block'

export { Callout } from './callout'
export type { CalloutKind, CalloutProps } from './callout'

export { TableOfContents } from './toc'
export type { TableOfContentsProps, TocItem } from './toc'

export { ReadingProgress } from './reading-progress'
export type { ReadingProgressProps } from './reading-progress'

export { headingSlug, readingTime, SlugTracker } from './slug'
export type { ReadingTime } from './slug'

export { HeadingAnchor } from './heading-anchor'
export type { HeadingAnchorProps } from './heading-anchor'

export { Markdown } from './markdown'
export type { MarkdownComponents, MarkdownProps } from './markdown'

export { MermaidDiagram } from './mermaid'
export type { MermaidDiagramProps } from './mermaid'

export { blockSplit } from './block-split'

export { createMdxComponents, mdxComponents } from './mdx'
export type { CreateMdxComponentsOptions } from './mdx'

export { ArticleLayout } from './article-layout'
export type { ArticleLayoutMeta, ArticleLayoutProps, ArticleNavTarget } from './article-layout'

export { ArticleCard, ArticleGrid } from './article-card'
export type { ArticleCardProps, ArticleGridProps } from './article-card'

export { filterArticles, formatArticleDate, sortArticles } from './article-model'
export type { Article, ArticleFilterQuery, ArticleOrder } from './article-model'

export { toArticleActions } from './article-actions'
export type { ToArticleActionsOptions } from './article-actions'

export { ArticleFilterBar } from './article-filter-bar'
export type { ArticleFilterBarProps } from './article-filter-bar'

export { GuideDrawer, GuideLink } from './guide'
export type { GuideDrawerProps, GuideLinkProps } from './guide'
