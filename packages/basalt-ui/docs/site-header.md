---
name: SiteHeader
use when: 'a content site (articles, docs, a landing page) needs its top navigation'
never when: 'the page lives inside `AppShell` (the shell owns the header)'
subpath: basalt-ui/static
peers: [react]
slots: [site-header, site-menu]
---

# SiteHeader

The site's top bar: brand, primary links and trailing actions. The bar is its own container: from
the `wide` size the links sit inline, below it one button opens them in a native popover (the top
layer, light dismiss and Escape come from the platform; no script). Every label is a prop.

## Signature

```ts
SiteHeader({ brand, links, navLabel, menuLabel, actions, menuId, className, }: SiteHeaderProps): ReactElement
  brand?: ReactNode  // The brand mark, usually a link home with a logo and a name (in Astro, a `slot="brand"` child)
  links: readonly SiteLink[]  // The primary links; the one with `current` carries `aria-current="page"`
  navLabel: string  // The navigation landmark's accessible name ("Main")
  menuLabel: string  // The menu button's accessible name on a narrow header ("Menu")
  actions?: ReactNode  // Trailing controls: a theme switch, a repository link
  menuId?: string  // The menu's element id; unique per page
  className?: string
```

`SiteHeaderProps`, `SiteLink` import from `basalt-ui/static`: `import type { SiteHeaderProps, SiteLink } from 'basalt-ui/static'`.

## Example

```tsx
<SiteHeader
  brand={<a href="/">Basalt</a>}
  links={[{ href: '/docs', label: 'Docs', current: true }]}
  navLabel="Main"
  menuLabel="Menu"
  actions={<ThemeSwitch label="Colour scheme" labels={schemeLabels} />}
/>
```
