---
name: applyMove
use when: 'a board moves cards between states and the move must land on the server before the next read'
never when: 'the order is set by hand inside one list (use SortableList from basalt-ui/ui/sortable-list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# applyMove

`Move` applied to a board's cards: the card leaves `from` and lands at `index` in `to`. Pure,
so it is the `apply` of an `optimistic` target (`basalt-ui/data`), whose restore is the rollback.

## Signature

```ts
applyMove<C extends string, T extends { id: string; }>(items: Readonly<Record<C, readonly T[]>>, move: Move<C>): Record<C, T[]>
```

`Move` import from `basalt-ui/cards`: `import type { Move } from 'basalt-ui/cards'`.

## Example

```tsx
...optimistic<Move<Stage>, Cards>({ key: ['deals'], targets: [{ queryKey: ['deals'], apply: applyMove }] })
```
