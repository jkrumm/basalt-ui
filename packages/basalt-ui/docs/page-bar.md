---
name: PageBar
use when: 'a screen needs a title, tabs, filters, a refresh button or page-level actions in one sticky band'
never when: 'the screen has none of those (leave the bar out) or the title belongs to a card (use the card title)'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: [page-bar, page-bar-controls, page-bar-tabs, page-breadcrumb-parent]
---

# PageBar

The page's band: the title and breadcrumb, the page tabs, the controls, the connection indicator,
the refresh button and the actions. One per `Page`; a second renders nothing and raises a dev warning, so nested layouts
that each render a bar fail loudly instead of stacking two bands.

## Signature

```ts
PageBar<K extends string = string>({ title, parent, controls, tabs, connection, refresh, actions, }: PageBarProps<K>): ReactElement | null
  title?: string  // Breadcrumb leaf and `h1` in a shell; the visible `h1` without one
  parent?: { label: string; href: string | NavTarget; }
  controls?: { readonly kind: "controls-slot"; readonly count: number; readonly compact?: boolean; render(): ReactNode; }
  tabs?: PageTabs<K>
  connection?: ConnectionView  // `useConnection()`: draws `ConnectionIndicator` in the end slot, before `refresh`
  refresh?: { scope: "page" | "global"; } & { syncing: boolean; lastCompletedAt?: number; onSync(): void; error?: string; }
  actions?: readonly [PageAction?, PageAction?, PageAction?, PageAction?, PageAction?]  // At most 5, at most one `primary`, none required
```

## Example

```tsx
<PageBar
  title={run.name}
  parent={{ label: 'Runs', href: '/runs' }}
  controls={filterSlot([rangeSpec, envSpec])}
  refresh={{ scope: 'page', ...freshness.button }}
  actions={[{ id: 'new', label: 'New run', icon: Plus, primary: true, onClick: create }]}
/>
```

## Example

```tsx
<PageBar title="Orders" tabs={{ state: store.field.view, label: 'Orders view' }} />
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
