---
name: AppShell
use when: 'an app has more than one destination and wants one rail, header and tab bar from a single `defineNav`'
never when: 'the app is one screen or keeps its own frame (use Page, PageBar and Section inside your own main)'
subpath: basalt-ui/shell
peers: ['@base-ui/react', '@tanstack/react-router']
slots: [page-breadcrumb-leaf]
---

# AppShell

The application frame: a header, a rail, the one scrollport, an aside region and, on a phone, a
tab bar, all projections of one `nav` declaration. It owns the markup (a CSS grid in
`@layer basalt`), so there is nothing to override and nothing to fight. The crumb trail is the nav
section, then the page's `PageBar` `parent`, then its `title`; a selection such as
`/services?service=checkout` is `Fleet / Services / checkout` from
`<PageBar title={service.name} parent={{ label: 'Services', href: '/services' }} />`. A phone
shows no ancestors, a page with no bar shows its nav label, and a path no route matches shows
`Not found`, in the crumb and in the document title.

## Signature

```ts
AppShell<Id extends string = string>({ nav, brand, badges, blocks, globalControls, globalActions, settings, account, search, storageKey, compactHeader, chrome, children, }: AppShellProps<Id>): ReactElement
  nav: NavConfig
  brand: ShellBrand
  badges?: Partial<Record<Id, NavBadge>>
  blocks?: readonly SidebarBlock[]
  globalControls?: { readonly kind: "controls-slot"; readonly count: number; readonly compact?: boolean; render(): ReactNode; }
  globalActions?: readonly GlobalAction[]
  settings?: SettingsConfig
  account?: Account
  search?: { onOpen: () => void; }
  storageKey?: string
  chrome?: ShellChrome
  compactHeader?: "hidden" | "show"
  children?: ReactNode
```

## Example

```tsx
<AppShell nav={NAV} brand={{ name: 'Argo', logo: Mark }} storageKey="argo-sidebar" badges={{ jobs: { dot: true } }}>
  <Outlet />
</AppShell>
```
