---
name: QueryState
use when: 'a page or region renders the result of one query and must tell loading, failure, offline and empty apart'
never when: 'the container is a frame that already takes `phase` (`StatCard`, `ChartCard`) or the data is synchronous'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [query-state, query-state-banner, query-state-retry]
---

# QueryState

The one wrapper a page puts around an async result. It owns the branch precedence, which is the
point: loading, then error, then empty, then the data. A failed query never reads as "nothing
here", a failed refetch over saved data keeps the data and says it is old, and a fetch paused
for lack of a connection, with nothing to show, reads Offline instead of spinning forever.

## Signature

```ts
QueryState({ phase, empty, tier, skeleton, children, }: QueryStateProps): ReactElement
  phase: Phase | QueryStateLike  // A `Phase` or the app's query object, as every frame takes it
  empty?: Empty | null  // The measured-empty state; it applies once the query settled and shows `EmptyState`
  tier?: "page" | "section"  // `page` for a route body, `section` for a region in a card or panel; default 'page'
  skeleton?: ReactNode  // Replaces the default spinner while loading, e.g
  children?: ReactNode  // Rendered when there is data worth showing
```

`Empty`, `Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Empty, Phase, QueryStateLike } from 'basalt-ui/cards'`.

## Example

```tsx
<QueryState
  phase={runs}
  empty={runs.data?.length === 0 ? { cause: 'No runs match. Widen the dates.' } : null}
>
  <RunTable rows={runs.data ?? []} />
</QueryState>
```
