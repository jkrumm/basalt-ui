---
name: SiteHero
use when: 'a landing or product page opens with what the product is and what to do next'
never when: 'the page is an article or a docs entry (use `SiteArticle`)'
subpath: basalt-ui/static
peers: [react]
slots: [site-hero]
---

# SiteHero

The top of a landing page: eyebrow, title, standfirst, actions and an optional media column.
The block is its own container: from 64rem the media sits beside the text, below that under it.
No gradient and no ornament; the media slot carries the picture, and it may hold an island.

## Signature

```ts
SiteHero({ title, eyebrow, description, actions, children, media, className, }: SiteHeroProps): ReactElement
  title: ReactNode  // The page's one `h1`
  eyebrow?: ReactNode  // A short line above the title: a product name, a version
  description?: ReactNode  // The standfirst under the title
  actions?: readonly SiteAction[]  // The calls to action, as links; at most one `primary`
  children?: ReactNode  // Under the actions: an install command, a line of fine print
  media?: ReactNode  // Beside the text on a wide layout, under it on a narrow one: an image, a static part, or an island
  className?: string
```

`SiteAction` import from `basalt-ui/static`: `import type { SiteAction } from 'basalt-ui/static'`.

## Example

```tsx
<SiteHero
  title="Plan a sprint in one call"
  description="Estimate together, without an account."
  actions={[{ href: '/room', label: 'Start a room', primary: true }]}
  media={<img src="/room.png" alt="A planning room" />}
/>
```
