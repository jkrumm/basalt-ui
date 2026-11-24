---
name: SiteFooter
use when: 'a content site needs its closing navigation and fine print'
never when: 'the page lives inside `AppShell`'
subpath: basalt-ui/static
peers: [react]
slots: [site-footer]
---

# SiteFooter

The site footer: a brand block, link columns and a fine-print row. Columns wrap by their own
width, so the footer needs no breakpoint. Every heading and label is a prop.

## Signature

```ts
SiteFooter({ brand, groups, children, label, className, }: SiteFooterProps): ReactElement
  brand?: ReactNode  // The brand block: a logo, a name, one line on what the site is
  groups?: readonly SiteLinkGroup[]  // Link columns, each with its own title
  children?: ReactNode  // The fine print under the columns: copyright, legal links
  label?: string  // The landmark's accessible name when a page has more than one `contentinfo`
  className?: string
```

`SiteFooterProps`, `SiteLinkGroup` import from `basalt-ui/static`: `import type { SiteFooterProps, SiteLinkGroup } from 'basalt-ui/static'`.

## Example

```tsx
<SiteFooter brand={<Brand />} groups={[{ title: 'Docs', links: [{ href: '/docs', label: 'Start' }] }]}>
  © 2026 Basalt
</SiteFooter>
```
