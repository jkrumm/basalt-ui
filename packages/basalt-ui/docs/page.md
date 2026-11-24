---
name: Page
use when: 'a route renders a screen: its bar, its sections and an optional aside live under one Page'
never when: 'the screen is a long-form article (use ArticleLayout) or only a fragment of a screen (use Section)'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: [page, page-aside-slot, page-main]
---

# Page

The root of a screen, in a shell or not. It is the page's one container (`@container`), publishes
`--page-bar-h` (the measured `PageBar` band, written by the bar) and `--page-sticky-top` (the
offset anything sticky inside the page clears: the band while it sticks, else zero), and owns the claims
that keep it to one `PageBar` and one `PageAside`.

## Signature

```ts
Page({ area, fill, landmark, children }: PageProps): ReactElement
  area?: string  // Scopes commands
  fill?: boolean | { min: number; }  // Fills the work surface: a definite height, no gutter and no gap, so the one main part (a table, a split page, a canvas) meets the surface's edges; `{ min }` keeps a floor in px
  landmark?: boolean  // Renders `<main>` with no `PageHost`
  children?: ReactNode
```

`PageProps` import from `basalt-ui/page`: `import type { PageProps } from 'basalt-ui/page'`.

## Example

```tsx
<Page area="runs" fill>
  <PageBar title="Runs" actions={[{ id: 'new', label: 'New run', primary: true, onClick: create }]} />
  <Section title="Latency">…</Section>
</Page>
```

## Example

```tsx
// A route outside any shell: a landmark with the visible h1.
<Page landmark>
  <PageBar title="Sign in" />
  <form>…</form>
</Page>
```
