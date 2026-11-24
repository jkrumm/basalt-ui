---
name: SiteNav
use when: 'a guide or docs section outside Starlight needs a sidebar of its sibling pages'
never when: 'the site''s docs run on Starlight (it draws its own sidebar), or the links are the site header''s (use `SiteHeader`)'
subpath: basalt-ui/static
peers: [react]
slots: [site-nav]
---

# SiteNav

A section navigation as static HTML: titled groups of links, nested to any depth, the current page
marked with `aria-current`. It is the shape a content collection yields once mapped
(`entries.map((e) => ({ href, label: e.data.title }))`), and the `nav` of `SiteArticle`, which
supplies the landmark and the narrow-layout disclosure. Outside `SiteArticle` wrap it in a `<nav aria-label>`.

## Signature

```ts
SiteNav({ groups, className }: SiteNavProps): ReactElement
  groups: readonly SiteNavGroup[]
  className?: string
```

`SiteNavGroup`, `SiteNavProps` import from `basalt-ui/static`: `import type { SiteNavGroup, SiteNavProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteArticle title="Setup" nav={<SiteNav groups={[{ title: 'Guides', links: [{ href: '/guides/setup', label: 'Setup', current: true }] }]} />} navLabel="Guides">
  <Content />
</SiteArticle>
```
