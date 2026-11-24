---
name: EmptyState
use when: 'a settled query or a filter left a page or region with nothing to list'
never when: 'the data failed to load or is still loading (use `QueryState`, or a frame `phase`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [empty-state, empty-state-action, empty-state-icon, empty-state-title, empty-state-why]
---

# EmptyState

The state of a region that has nothing to show: one line of cause and at most one action. With
active filters it is the filtered variant, whose action is Clear filters; the line says what the
filters hid. It never says "No data": the line names the cause, so a failed load cannot pass for
an empty list (a failed query is `QueryState`'s error arm, not this).

## Signature

```ts
EmptyState(props: EmptyStateProps): ReactElement
  // either action or filtered
  cause: string  // One line: the cause, and the next step when there is one
  title?: string  // What is empty, in a few words (`No runs yet`), on the line above `cause`
  icon?: IconComponent
  tier?: "page" | "section"  // `page` for a whole route body (generous space), `section` for a region inside a card or panel; default 'page'
  action?: CardAction
  filtered?: { reset: () => void; }
```

`CardAction` import from `basalt-ui/cards`: `import type { CardAction } from 'basalt-ui/cards'`.

`IconComponent` import from `basalt-ui`: `import type { IconComponent } from 'basalt-ui'`.

## Example

```tsx
<EmptyState
  cause="The queue is filtered to Blocked; clear it to see all 12."
  filtered={{ reset: clearFilters }}
  tier="section"
/>
```

## Example

```tsx
<EmptyState title="No runs yet" cause="Start one from the CLI." action={{ label: 'Open docs', href: '/docs' }} />
```
