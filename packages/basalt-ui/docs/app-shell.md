---
name: AppShell
use when: 'an app has more than one destination and wants one rail, header and tab bar from a single `defineNav`'
never when: 'the app is one screen or keeps its own frame (use Page, PageBar and Section inside your own main)'
subpath: basalt-ui/shell
peers: ['@base-ui/react']
slots: [page-breadcrumb-leaf]
---

# AppShell

The application frame: a header, a rail, the one scrollport, an aside region and, on a phone, a
tab bar, all projections of one `nav` declaration. It owns the markup (a CSS grid in
`@layer basalt`), so there is nothing to override and nothing to fight.

## Signature

```ts
AppShell<Id extends string = string>({ nav, brand, badges, blocks, globalControls, globalActions, settings, account, search, storageKey, compactHeader, children, }: AppShellProps<Id>): ReactElement
  nav: NavConfig
  brand: ShellBrand
  badges?: Partial<Record<Id, NavBadge>>
  blocks?: readonly SidebarBlock[]
  globalControls?: ControlsSlot
  globalActions?: readonly GlobalAction[]
  settings?: SettingsConfig
  account?: Account
  search?: { onOpen: () => void; }
  storageKey?: string
  chrome?: ShellChrome
  compactHeader?: "show" | "hidden"
  children?: ReactNode
```
