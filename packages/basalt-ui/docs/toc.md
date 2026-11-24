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
Toc({ items, containerRef, levels, title, startAt, onNavigate, className, }: TocProps): ReactElement | null
  items?: TocItem[]  // Explicit item list
  containerRef?: RefObject<HTMLElement | null>  // The article container to auto-collect headings from (ignored when `items` is provided)
  levels?: readonly [number, number]  // Heading levels to collect when auto-collecting
  title?: string
  startAt?: string  // The id marked current until the spy resolves one
  onNavigate?: (id: string) => void  // Called after a rail item is clicked and the target has been scrolled to
  className?: string
```

## Example

```tsx
const articleRef = useRef<HTMLDivElement>(null)
<div ref={articleRef}><h2 id="setup">Setup</h2></div>
<Toc containerRef={articleRef} />
```
