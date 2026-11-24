---
name: PageBar
use when: 'a screen needs a title, tabs, search, filters, a layout toggle, a refresh button or page-level actions in one band'
never when: 'the screen has none of those (leave the bar out) or the title belongs to a card (use the card title)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [page-bar, page-bar-controls, page-bar-end, page-bar-row, page-bar-search-line, page-bar-tabs, page-bar-tabs-row, page-breadcrumb-parent, page-header-actions]
---

# PageBar

The page's band: the title and breadcrumb, then the view row of a list page. On its start the
page tabs, each a named view with an optional count and tone dot; on its end, in this order, the
search, the controls (the filters), the connection indicator, the refresh button, the layout
toggle, the view-settings button and the actions, the one primary last. One per `Page`; a second
renders nothing and raises a dev warning, so nested layouts that each render a bar fail loudly
instead of stacking two bands.

## Signature

```ts
PageBar<K extends string = string, L extends string = string>({ title, identity, parent, controls, tabs, search, connection, refresh, layout, settings, favorite, actions, }: PageBarProps<K, L>): ReactElement | null
  title?: string  // Breadcrumb leaf and `h1` in a shell; the visible `h1` without one
  identity?: PageIdentity  // A record page's identity: the band draws the title as a heading with its face, subtitle and tags (the title is then the visible `h1` in a shell too, and the breadcrumb leaf is kept)
  parent?: { label: string; href: string | NavTarget; }
  controls?: { readonly kind: "controls-slot"; readonly count: number; readonly compact?: boolean; render(): ReactNode; }
  tabs?: PageTabs<K>
  search?: PageSearch  // Before `controls`; below `@wide` it takes a line of its own
  layout?: PageLayout<L>  // After `refresh`, before `settings`; `undefined` draws none (`useTableViews().layout` with one layout)
  settings?: PageSettings  // After `layout`, before `actions`
  connection?: ConnectionView  // `useConnection()`: draws `ConnectionIndicator` in the end slot, before `refresh`
  refresh?: { scope: "page" | "global"; } & { syncing: boolean; lastCompletedAt?: number; onSync(): void; error?: string; }
  favorite?: FavoriteInput  // The record this page is: a star that adds it to the shell rail's Favorites
  actions?: readonly [PageAction?, PageAction?, PageAction?, PageAction?, PageAction?]  // At most 5, at most one `primary`, none required
```

`ConnectionView` import from `basalt-ui/data`: `import type { ConnectionView } from 'basalt-ui/data'`.

`FavoriteInput`, `PageAction`, `PageBarProps`, `PageIdentity`, `PageLayout`, `PageSearch`, `PageSettings`, `PageTabs` import from `basalt-ui/page`: `import type { FavoriteInput, PageAction, PageBarProps, PageIdentity, PageLayout, PageSearch, PageSettings, PageTabs } from 'basalt-ui/page'`.

`NavTarget` import from `basalt-ui`: `import type { NavTarget } from 'basalt-ui'`.

## Example

```tsx
<PageBar
  tabs={{ state: store.field.status, label: 'Invoices', badges: { all: { count: 236 }, overdue: { count: 17, attention: true } } }}
  search={{ state: store.field.q, label: 'Search invoices' }}
  controls={filterSlot([customerSpec, methodSpec, issuedSpec], { match: { shown, total } })}
  layout={{ state: store.field.layout, label: 'Layout', options: [{ value: 'table', label: 'Table', icon: Rows3 }, { value: 'cards', label: 'Cards', icon: LayoutGrid }] }}
  settings={{ label: 'View settings', onClick: openView }}
  actions={[{ id: 'new', label: 'New invoice', icon: Plus, primary: true, onClick: create }]}
/>
```

## Example

```tsx
<PageBar
  title={run.name}
  parent={{ label: 'Runs', href: '/runs' }}
  controls={filterSlot([rangeSpec, envSpec])}
  refresh={{ scope: 'page', ...freshness.button }}
/>
```

## Example

```tsx
// A record page: the band carries the record's face, type line and tag, so the body never repeats its name.
<PageBar
  title={supplier.name}
  identity={{ avatar: { shape: 'object', icon: Factory }, subtitle: 'Hamburg, DE', tags: <Lozenge tone="good">Preferred</Lozenge> }}
  parent={{ label: 'Suppliers', href: '/suppliers' }}
  tabs={{ state: store.field.tab, label: 'Supplier' }}
/>
```

## Example

```tsx
// Date navigation: grouped actions that stay in the phone bar and a text action that does not.
<PageBar
  actions={[
    { id: 'prev', label: 'Previous week', group: 'date', mobile: 'bar', onClick: prev },
    { id: 'next', label: 'Next week', group: 'date', mobile: 'bar', onClick: next },
    { kind: 'text', id: 'range', text: 'Nov 3 to 9', mobile: 'hidden' },
  ]}
/>
```
