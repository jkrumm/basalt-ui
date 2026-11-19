---
name: ChainView
use when: 'records wait on other records (Issues, tasks, deploy steps) and the answer is what blocks what, beside the table of the same records'
never when: 'the records form a strict tree with nothing to compare across branches (use `DataTable` with `nested`), or the relation is a flow of quantities (a chart)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [chain-edge, chain-graph, chain-list, chain-list-node, chain-node, chain-view]
---

# ChainView

A dependency chain: nodes that wait on other nodes, drawn left to right with each blocker left
of what waits on it. An edge from an open node is solid in the warn hue and reads "blocks", one
from a done node is dashed and reads "done", and a node waiting on an open blocker carries the
warn outline. The graph scrolls sideways inside the scroll primitive; below 480 px of container it
is a nested list instead, each node under the first node it waits on with the rest named. It
shares a `focus` with a `DataTable` over the same records, so a node and its row are one item.
The layout is the kit's own (no dependency): it never pans or zooms, and nodes do not move.

## Signature

```ts
ChainView<T>({ label, nodes, getId, waitsOn, face, onActivate, focus, }: ChainViewProps<T>): ReactElement
  label: string  // The accessible name of the chain (the region and the list)
  nodes: readonly T[]  // Every node, in reading order: it breaks ties in the layout and orders the narrow list
  getId: (node: T) => string
  waitsOn: (node: T) => readonly string[]  // The ids of the nodes this one waits on (its blockers)
  face: (node: T) => ChainFace
  onActivate?: ((node: T) => void)  // A click or Enter on a node
  focus?: ListFocus<T>  // A focus shared with a table or a chart over the same records (`useChartFocus(rows, …)`): a node maps to its item by `getId`, so the order of `focus.items` is free
```

## Example

```tsx
<ChainView
  label="Plan"
  nodes={issues}
  getId={(i) => i.id}
  waitsOn={(i) => i.waitsOn}
  face={(i) => ({ title: i.title, sub: i.key, status: verdictOf(i), done: i.state === 'done' })}
  focus={focus}
/>
```
