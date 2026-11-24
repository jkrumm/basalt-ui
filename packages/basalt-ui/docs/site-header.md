---
name: SiteHeader
use when: 'a content site (articles, docs, a landing page) needs its top navigation, with or without menus'
never when: 'the page lives inside `AppShell` (the shell owns the header)'
subpath: basalt-ui/static
peers: [react]
slots: [site-header, site-menu]
---

# SiteHeader

The site's top bar: brand, primary items and trailing actions. An item is a link or a menu: a menu
opens a panel of link rows and tiles (picture, title, one line) under it, on hover and focus (with a
short delay), click and Enter; Escape, a click outside or leaving closes it, and the arrow keys move
between the items. The panels are native popovers placed by CSS anchor positioning, so a static
page needs no component script; the head script only fills in hover and the arrow keys. The bar is
its own container: from the `wide` size the items sit inline, below it one button opens them in a
full-height sheet where each menu is a titled section. Every string is a prop.

## Signature

```ts
SiteHeader({ brand, links, navLabel, menuLabel, actions, menuId, className, }: SiteHeaderProps): ReactElement
  brand?: ReactNode  // The brand mark, usually a link home with a logo and a name (in Astro, a `slot="brand"` child)
  links: readonly SiteNavItem[]  // The primary items in order: a link, or a menu (`{ label, menu }`) that opens a panel of link rows and tiles under it
  navLabel: string  // The navigation landmark's accessible name ("Main")
  menuLabel: string  // The menu button's accessible name on a narrow header ("Menu")
  actions?: ReactNode  // Trailing controls: a theme switch, a repository link
  menuId?: string  // The id prefix of the sheet and the panels; unique per page
  className?: string
```

`SiteHeaderProps`, `SiteNavItem` import from `basalt-ui/static`: `import type { SiteHeaderProps, SiteNavItem } from 'basalt-ui/static'`.

## Example

```tsx
<SiteHeader
  brand={<a href="/">Basalt</a>}
  links={[
    { href: '/docs', label: 'Docs', current: true },
    {
      label: 'Product',
      menu: [
        {
          entries: [
            { href: '/charts', label: 'Charts', description: 'Marks that read at a glance', image: { src: '/charts.svg' } },
            { href: '/tables', label: 'Tables', description: 'Dense, sortable, keyboard first' },
          ],
        },
      ],
    },
  ]}
  navLabel="Main"
  menuLabel="Menu"
  actions={<ThemeSwitch label="Colour scheme" labels={schemeLabels} />}
/>
```
