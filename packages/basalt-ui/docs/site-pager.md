---
name: SitePager
use when: 'a page sits in an ordered series (docs, a multi-part guide) and the reader moves to its neighbours'
never when: 'the page stands alone, or the series lives in an app (use the router''s links)'
subpath: basalt-ui/static
peers: [react]
slots: [pager]
---

# SitePager

Previous and next links at the foot of a docs page or a guide, each with its own eyebrow word.

## Signature

```ts
SitePager({ prev, next, prevLabel, nextLabel, label, }: SitePagerProps): ReactElement
  prev?: SiteLink
  next?: SiteLink
  prevLabel: string  // The eyebrow words over each link ("Previous", "Next")
  nextLabel: string
  label: string  // The landmark's accessible name ("Pages")
```

`SiteLink`, `SitePagerProps` import from `basalt-ui/static`: `import type { SiteLink, SitePagerProps } from 'basalt-ui/static'`.

## Example

```tsx
<SitePager label="Pages" prevLabel="Previous" nextLabel="Next" next={{ href: '/docs/tokens', label: 'Tokens' }} />
```
