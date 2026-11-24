---
name: ChainView
use when: 'records wait on other records (Issues, tasks, deploy steps) and the answer is what blocks what, beside the table of the same records'
never when: 'the records form a strict tree with nothing to compare across branches (use `DataTable` with `nested`), or the relation is a flow of quantities (a chart)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [chain-canvas, chain-controls, chain-edge, chain-graph, chain-list, chain-list-node, chain-node, chain-view]
---

# ChainView

A dependency chain: nodes that wait on other nodes, drawn left to right with each blocker left
of what waits on it. Every edge leaves its blocker at the middle of the right side and ends in an
arrowhead at the middle of the waiting node's left side; one from an open node is solid in the
warn hue and reads "blocks", one from a done node is dashed and reads "done", and a node waiting
on an open blocker is outlined in the warn tone. The graph opens fitted to its width (never below
half size) in a frame no taller than the page's visible scroll area: a drag on empty canvas, the
wheel and one finger pan it, Ctrl or Cmd with the wheel, a pinch, the zoom buttons and the
`+`, `-` and `0` keys zoom it. Pointing at a node (or focusing its row) lights its whole trace,
every node it waits on and every node waiting on it; Focus (or `F`) holds that trace and zooms
to it, Show all (or Escape) returns. Below 480 px of container it is a nested list instead, each
node under the first node it waits on with the rest named. It shares a `focus` with a
`DataTable` over the same records, so a node and its row are one item. The layout is the kit's
own (no dependency), and nodes never move.

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

`ChainFace`, `ChainViewProps` import from `basalt-ui/cards`: `import type { ChainFace, ChainViewProps } from 'basalt-ui/cards'`.

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
