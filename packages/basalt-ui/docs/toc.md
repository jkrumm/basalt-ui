---
name: Toc
use when: 'a long page with h2 and h3 headings needs an on-this-page list that follows the scroll'
never when: 'the page has fewer than three headings or its sections are tabs'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [toc]
---

# Toc

A scroll-spy rail for one article: a `<nav>` of in-page links, the reader's section marked
`aria-current="location"`. Pass `items`, or pass `containerRef` and the rail collects the `h2`/`h3`
(`levels`) that carry an `id` under it, on mount and on every childList mutation. Sticky
positioning is the caller's job.

## Signature

```ts
Toc({ items, containerRef, levels, title, onNavigate, className, }: TocProps): ReactElement | null
  items?: TocItem[]
  containerRef?: RefObject<HTMLElement | null>
  levels?: readonly [number, number]
  title?: string
  onNavigate?: (id: string) => void
  className?: string
```
