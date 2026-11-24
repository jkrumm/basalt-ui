import type { PartEntry } from '../types'

/** The content family: one entry per demo module in this folder. */
export const PARTS: readonly PartEntry[] = [
  {
    id: 'markdown',
    family: 'content',
    module: 'content/markdown',
    covers: ['Markdown'],
    interaction: 'enhance',
    why: 'the code is colored in the static HTML; mermaid fences need JS',
  },
  {
    id: 'code-block',
    family: 'content',
    module: 'content/code-block',
    covers: ['CodeBlock'],
    interaction: 'enhance',
    why: 'the code is colored in the static HTML; the copy button needs JS',
  },
  {
    id: 'article-layout',
    family: 'content',
    module: 'content/article-layout',
    covers: ['ArticleLayout', 'Prose'],
    interaction: 'enhance',
    why: 'the scroll-spy TOC and reading progress need JS',
  },
  {
    id: 'toc',
    family: 'content',
    module: 'content/toc',
    covers: ['Toc'],
    interaction: 'enhance',
    why: 'the scroll-spy marks the current section with JS',
  },
  {
    id: 'site-header',
    family: 'content',
    module: 'content/site-header',
    covers: ['SiteHeader'],
    interaction: 'none',
    why: 'the panels are native popovers placed by CSS and the bar is the whole static picture; no component script',
  },
  {
    id: 'callout',
    family: 'content',
    module: 'content/callout',
    covers: ['Callout'],
    interaction: 'none',
    why: 'a static note; no behaviour',
  },
]
