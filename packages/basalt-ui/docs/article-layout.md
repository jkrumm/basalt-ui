---
name: ArticleLayout
use when: 'a docs or note page needs a title header, a table of contents and prev/next links around its body'
never when: 'the page is a dashboard or a form (use Page)'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
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
  children: ReactNode  // The article body, typically `Markdown` output or plain HTML
  meta?: ArticleLayoutMeta
  toc?: boolean  // Scroll-spy TOC collected from the body: a sticky rail from 1200px, a popover below
  readingProgress?: boolean  // A thin fixed bar at the top that tracks the scroll through the body
  prev?: ArticleNavTarget
  next?: ArticleNavTarget
  renderLink?: (target: ArticleNavTarget, node: ReactNode) => ReactNode  // Overrides how the prev/next cells render
  density?: ProseDensity  // `Prose` density
  locale?: string  // Locale for `meta.date`
  className?: string  // Layout only (`mt-8`)
```

## Example

```tsx
<ArticleLayout
  meta={{ title: 'Reading dashboards', description: '…', date: '2026-07-16', readingTime: 6 }}
  readingProgress
  next={{ label: 'Chart guide', href: '/guides/charts' }}
>
  <h2 id="setup">Setup</h2>
  <p>…</p>
</ArticleLayout>
```
