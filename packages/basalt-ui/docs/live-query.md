---
name: liveQuery
use when: 'a query is polled, pushed, cross-device or static and its cadence belongs in the factory, not the component'
never when: 'an observer would set its own `staleTime` or `refetchInterval`; the class owns both'
subpath: basalt-ui/data
peers: []
slots: []
---

# liveQuery

Gives a query its freshness class: `staleTime`, focus refetch, `meta.basalt.live` and a
function-form `refetchInterval` follow the class, so no component sets a cadence. `'static'` is
`staleTime: Infinity`, never the string `'static'` (that makes the query immune to invalidation).
A ticker runs `every` after the previous result, skips while hidden (unless `background`),
offline, mutating (`pauseWhileMutating`) or after a 401/403, and a function `every` returning
`false` means idle (staleness 30 s, not 0). Needs a client from `makeQueryClient`.

## Signature

```ts
liveQuery<T extends QueryOptionsLike>(options: T, freshness: Freshness): T
```
