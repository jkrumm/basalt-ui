---
name: SiteFeature
use when: 'a bento tile states one claim and shows it'
never when: 'the tile is a record an app opens (use `Card`)'
subpath: basalt-ui/static
peers: [react]
slots: [site-feature]
---

# SiteFeature

One tile of a `SiteBento`: a title, a line of text and a body slot for the real thing the claim
is about. Inert: a tile is never a link, so the part in its body keeps its own controls.

## Signature

```ts
SiteFeature({ title, description, children, span, className, }: SiteFeatureProps): ReactElement
  title: ReactNode  // The tile's `h3`
  description?: ReactNode
  children?: ReactNode  // The tile's body: a real part, an image or an island, set in an inset well under the text
  span?: "tall" | "wide" | "large"  // `wide` spans two columns, `tall` two rows, `large` both; from the grid's two-column size
  className?: string
```

## Example

```tsx
<SiteFeature title="Your words" description="Every label is a prop."><ThemeSwitch {...labels} /></SiteFeature>
```
