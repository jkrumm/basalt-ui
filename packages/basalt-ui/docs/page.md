---
name: Page
use when: 'a route renders a screen: its bar, its sections and an optional aside live under one Page'
never when: 'the screen is a long-form article (use ArticleLayout) or only a fragment of a screen (use Section)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [page, page-aside-slot, page-main]
---

# Page

The root of a screen, in a shell or not. It is the page's one container (`@container`), publishes
`--page-bar-h` (the measured `PageBar` band, written by the bar) and `--page-sticky-top` (the
offset anything sticky inside the page clears: the band, zero without one), and owns the claims
that keep it to one `PageBar` and one `PageAside`.

## Signature

```ts
Page({ area, fill, landmark, children }: PageProps): ReactElement
  area?: string
  fill?: boolean | { min: number; }
  landmark?: boolean
  children?: ReactNode
```
