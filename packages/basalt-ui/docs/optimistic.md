---
name: optimistic
use when: 'a mutation should show its result in the cache before the server answers'
never when: 'the server response is the first honest state (use a plain mutation and invalidate)'
subpath: basalt-ui/data
peers: []
slots: []
---

# optimistic

Optimistic cache writes for one mutation: cancel, snapshot, write; restore on error; invalidate
the targets when the last mutation with this key settles.

## Signature

```ts
optimistic<V>(options: OptimisticOptions<V>): OptimisticHandlers<V>
  key: readonly unknown[]
  scope?: string
  targets: readonly OptimisticTarget<V>[]
```
