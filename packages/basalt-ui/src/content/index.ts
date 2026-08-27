/**
 * `basalt-ui/content` — the content/prose surface (docs/CONTENT-SPEC.md).
 *
 * Mantine-coupled (like `./forms`/`./notifications`/`./data`): prose typography, a shiki-backed
 * code block (optional peer, lazy singleton), a semantic callout, a scroll-spy TOC rail, a
 * scroll-driven reading-progress bar, a streaming-aware `Markdown` renderer (react-markdown +
 * remark-gfm + rehype-sanitize + remend, all optional peers) with its fence-renderer registry,
 * `MermaidDiagram` (beautiful-mermaid, optional peer), the MDX
 * component map, the docs-page frame (`ArticleLayout`), overview cards (`ArticleCard`/
 * `ArticleGrid`), the contextual-help drawer (`GuideLink`/`GuideDrawer`), and a re-export of the
 * three `basalt-ui/controls` filters an article list needs (`FilterSet`/`ViewTabs`/
 * `MultiSelectFilter`, which replaced the controlled `ArticleFilterBar`). See
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

export { Markdown, settledOnly } from './markdown'
export type {
  FenceRenderContext,
  FenceRenderer,
  FenceRenderers,
  MarkdownComponents,
  MarkdownContentTrust,
  MarkdownProps,
} from './markdown'

export { BASALT_SANITIZE_SCHEMA, mergeSanitizeSchema } from './sanitize'
export type {
  SanitizePropertyDefinition,
  SanitizeSchema,
  SanitizeSchemaExtension,
  SanitizeSchemaInput,
} from './sanitize'

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

// The article filter UI is no longer content's own: `ArticleFilterBar` (controlled,
// `value`/`onChange`, its own responsive twin) was replaced by the store-bound controls of
// `basalt-ui/controls` (`docs/CONTROLS-SPEC.md` §3, C2/C9). Re-exported here — not merely
// documented as moved — so a content-only consumer that never imports `./controls` still gets the
// three it needs from the surface it was already using. Both spellings are the same module: one
// component, two import paths.
export { FilterSet, MultiSelectFilter, ViewTabs } from '../controls'
export type {
  FilterSetProps,
  MultiSelectFilterProps,
  ViewTabsOption,
  ViewTabsProps,
} from '../controls'

export { GuideDrawer, GuideLink } from './guide'
export type { GuideDrawerProps, GuideLinkProps } from './guide'
