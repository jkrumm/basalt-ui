---
name: SiteBento
use when: 'a landing page shows what a product does, each claim with a real part as its picture'
never when: 'the tiles are records or figures of an app (use `CardGrid` with cards)'
subpath: basalt-ui/static
peers: [react]
slots: [site-bento]
---

# SiteBento

A grid of feature tiles of mixed size. The grid keys on its own container: one column, two from
40rem, three from 64rem; a `wide` tile spans two columns and a `tall` one two rows, and the grid
packs the gaps densely.

## Signature

```ts
SiteBento({ title, description, children, className, }: SiteBentoProps): ReactElement
  title?: ReactNode  // The section's `h2`
  description?: ReactNode
  children: ReactNode  // The tiles: `SiteFeature` elements
  className?: string
```

## Example

```tsx
<SiteBento title="What you get">
  <SiteFeature title="Static parts" description="Zero client JavaScript." span="wide">
    <SiteCodeBlock copyLabel="Copy" copiedLabel="Copied"><pre><code>bun add basalt-ui</code></pre></SiteCodeBlock>
  </SiteFeature>
</SiteBento>
```
