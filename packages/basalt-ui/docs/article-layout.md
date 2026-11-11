---
name: ArticleLayout
use when: 'a docs or note page needs a title header, a table of contents and prev/next links around its body'
never when: 'the page is a dashboard or a form (use Page)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [article-layout]
---

# ArticleLayout

The docs-page frame: a centered article column with a title, description, date and reading-time
header, an optional scroll-spy TOC, an optional reading-progress bar and a prev/next footer. From
1200px the TOC is a sticky right rail; below it an "On this page" button opens the same TOC in a
popover. The meta row renders only when `meta.date` or `meta.readingTime` is given.

## Signature

```ts
ArticleLayout({ children, meta, toc, readingProgress, prev, next, renderLink, density, locale, className, }: ArticleLayoutProps): ReactElement
  children: ReactNode
  meta?: ArticleLayoutMeta
  toc?: boolean
  readingProgress?: boolean
  prev?: ArticleNavTarget
  next?: ArticleNavTarget
  renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode
  density?: ProseDensity
  locale?: string
  className?: string
```
