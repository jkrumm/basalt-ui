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
QueryState({ phase, empty, tier, loading, children, }: QueryStateProps): ReactElement
  phase: Phase | QueryResultLike
  empty?: Empty | null
  tier?: "section" | "page"
  loading?: ReactNode
  children?: ReactNode
```
