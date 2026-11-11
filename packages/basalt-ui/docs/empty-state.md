---
name: EmptyState
use when: 'a settled query or a filter left a page or region with nothing to list'
never when: 'the data failed to load or is still loading (use `QueryState`, or a frame `phase`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [empty-state, empty-state-action, empty-state-icon, empty-state-why]
---

# EmptyState

The state of a region that has nothing to show: one line of why and at most one action. With
active filters it is the filtered variant, whose action is Clear filters; the line says what the
filters hid. It never says "No data": the line names the cause, so a failed load cannot pass for
an empty list (a failed query is `QueryState`'s error arm, not this).

## Signature

```ts
EmptyState(props: EmptyStateProps): ReactElement
  why: string
  icon?: IconComponent
  tier?: "section" | "page"
  action?: CardAction
  filtered: { reset: () => void; }
```
