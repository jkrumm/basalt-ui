---
name: optimistic
use when: 'a mutation should show its result in the cache before the server answers'
never when: 'the server response is the first honest state (use a plain mutation and invalidate)'
subpath: basalt-ui/data
peers: ['@tanstack/react-query']
slots: []
---

# optimistic

Optimistic cache writes for one mutation: cancel, snapshot, write; restore on error; invalidate
the targets when the last mutation with this key settles.

## Signature

```ts
optimistic<V, T = unknown>(options: OptimisticOptions<V, T>): OptimisticHandlers<V>
  key: readonly unknown[]  // Identifies this resource's mutations: `isMutating` counts only mutations carrying it
  scope?: string  // Serial-execution group
  targets: readonly OptimisticTarget<V, T>[]  // The cache entries written ahead of the server
```

## Example

```tsx
const rename = useMutation({
  mutationFn: (title: string) => unwrap(api.runs({ id }).patch({ title })),
  ...optimistic<string, Run>({
    key: ['run', id],
    targets: [{ queryKey: ['run', id], apply: (prev, title) => ({ ...prev, title }) }],
  }),
})
```
