---
name: AppShell
use when: 'an app has more than one destination and wants one rail, header and tab bar from a single `defineNav`'
never when: 'the app is one screen or keeps its own frame (use Page, PageBar and Section inside your own main)'
subpath: basalt-ui/shell
peers: ['@base-ui/react', '@tanstack/react-hotkeys', '@tanstack/react-router']
slots: [page-breadcrumb-leaf, page-breadcrumb-parent]
---

# AppShell

The application frame: a header, a rail, the one scrollport, an aside region and, on a phone, a
tab bar, all projections of one `nav` declaration. Two planes: the frame carries the brand zone
and the rail, one work surface carries the identity row (the crumb and the actions) and the page,
with the aside and the dock inside it. `frame="panel"` (the default) insets and rounds that
surface from `md` up; `frame="flush"` meets the window's edges, as every phone does. It owns the markup (a CSS grid in
`@layer basalt`), so there is nothing to override and nothing to fight. The crumb trail is the nav
section, then the page's `PageBar` `parent`, then its `title`; a selection such as
`/services?service=checkout` is `Fleet / Services / checkout` from
`<PageBar title={service.name} parent={{ label: 'Services', href: navTarget({ to: '/services', ...services.field.service.link('') }) }} />`.
The parent is a link through the provider's `link`, a path string or a `NavTarget` alike, so a
click keeps the document; the `NavTarget` form shown clears the selection and keeps the params the
page's store `retain`s (`services` is that store). A phone drops the nav section and keeps the
page's parent and title, so the way up stays one tap away. The parent is the way up, never the
current page: it carries no `aria-current`, and a click hands focus to main. A page with no bar
shows its nav label, and a path no route matches shows `Not found`, in the crumb and in the document title.

## Signature

```ts
AppShell<Id extends string = string>({ nav, brand, badges, blocks, globalControls, globalActions, settings, account, search, workspace, favourites, storageKey, compactHeader, chrome, frame, children, }: AppShellProps<Id>): ReactElement
  nav: NavConfig
  brand: ShellBrand
  badges?: Partial<Record<Id, NavBadge>>
  blocks?: readonly SidebarBlock[]
  globalControls?: { readonly kind: "controls-slot"; readonly count: number; readonly compact?: boolean; render(): ReactNode; }
  globalActions?: readonly GlobalAction[]
  settings?: SettingsConfig
  account?: Account
  search?: { onOpen: () => void; }
  workspace?: WorkspaceSwitcher  // A workspace switcher in the brand zone; on a phone its options are rows of the More surface
  favourites?: FavouritesStore  // Where the rail's Favourites section keeps its entries
  storageKey?: string  // The key the rail's collapse is stored under; the width the reader dragged it to lives beside it under `<storageKey>-width`
  chrome?: ShellChrome
  frame?: ShellFrame  // Default `panel`
  compactHeader?: "hidden" | "show"
  children?: ReactNode
```

`FavouritesStore` import from `basalt-ui/page`: `import type { FavouritesStore } from 'basalt-ui/page'`.

## Example

```tsx
<AppShell nav={NAV} brand={{ name: 'Argo', logo: Mark }} storageKey="argo-sidebar" badges={{ jobs: { dot: true } }}>
  <Outlet />
</AppShell>
```
