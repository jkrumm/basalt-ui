---
name: SiteArticle
use when: 'a long-form page (article, guide, docs entry) is rendered as static HTML'
never when: 'the page is an app screen (use `Page`), or the TOC must follow the scroll (use `ArticleLayout` from `basalt-ui/page`)'
subpath: basalt-ui/static
peers: [react]
slots: [article-layout]
---

# SiteArticle

The frame of an article or a docs page: title block, body in `Prose`, an optional table of
contents and an optional section navigation. The layout keys on its own container: the TOC rail
joins from 64rem, the section column from 80rem; below each, the same list sits in a native
`<details>` above the body. No script, no scroll tracking.

## Signature

```ts
SiteArticle({ title, description, meta, toc, tocLabel, tocDepth, nav, navLabel, children, footer, className, }: SiteArticleProps): ReactElement
  title: ReactNode  // The page's one `h1`
  description?: ReactNode  // The standfirst under the title
  meta?: ReactNode  // A line of facts under the description: a date, a reading time, an author
  toc?: readonly TocEntry[]  // The table of contents: a rail beside the body on a wide layout, a disclosure above it on a narrow one
  tocLabel?: string  // The TOC's heading and landmark name ("On this page"); the TOC renders only with it
  tocDepth?: number  // The deepest heading level the TOC lists
  nav?: ReactNode  // A section navigation (a docs sidebar): a start column on a wide layout, a disclosure on a narrow one
  navLabel?: string  // The section navigation's landmark name and disclosure label ("Docs"); the nav renders only with it
  children: ReactNode  // The article body: Markdown or MDX output, styled by element
  footer?: ReactNode  // Under the body: a `SitePager`, an edit link
  className?: string
```

`SiteArticleProps`, `TocEntry` import from `basalt-ui/static`: `import type { SiteArticleProps, TocEntry } from 'basalt-ui/static'`.

## Example

```tsx
<SiteArticle title="Estimating with story points" toc={entries} tocLabel="On this page">
  <Content />
</SiteArticle>
```
