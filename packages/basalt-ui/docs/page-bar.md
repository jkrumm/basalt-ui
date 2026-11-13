---
name: PageBar
use when: 'a screen needs a title, tabs, filters, a refresh button or page-level actions in one sticky band'
never when: 'the screen has none of those (leave the bar out) or the title belongs to a card (use the card title)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [page-bar, page-bar-controls, page-bar-tabs, page-breadcrumb-parent]
---

# PageBar

The page's band: the title and breadcrumb, the page tabs, the controls, the refresh button and
the actions. One per `Page`; a second renders nothing and raises a dev warning, so nested layouts
that each render a bar fail loudly instead of stacking two bands.

## Signature

```ts
PageBar({ title, parent, controls, tabs, refresh, actions, }: PageBarProps): ReactElement | null
  title?: string
  parent?: { label: string; href: string | NavTarget; }
  controls?: { readonly kind: "controls-slot"; readonly count: number; r…
  tabs?: { readonly kind: "controls-slot"; readonly count: number; r…
  refresh?: { scope: "page" | "global"; } & { syncing: boolean; lastCom…
  actions?: readonly [PageAction?, PageAction?, PageAction?, PageAction…
```
