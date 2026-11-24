---
name: FlowCanvas
use when: 'a workflow or a pipeline is a few stages of configured steps with connectors between them (a builder), edited in place, with a workflow-level panel'
never when: 'the records wait on each other in a graph the layout should place (use `ChainView`), or the nodes are free to move (a whiteboard, out of scope)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [flow-canvas, flow-column, flow-edge, flow-edges, flow-ground, flow-stage]
---

# FlowCanvas

A builder canvas: columns of group cards on a dot ground, connectors between their rows, and a
floating toolbar. The app places content (columns of groups of rows, never free nodes); the
canvas owns the grid, the zoom, the edges and the marks. Pan is the frame's own scroll: the wheel,
a drag on empty ground with the pointer tool (`V`), a drag anywhere with the hand tool (`H`);
Ctrl or Cmd with the wheel, a pinch, the zoom menu (50, 100 and 125 per cent and fit) and the
`+`, `-` and `0` keys (with or without Ctrl or Cmd, while focus is in the canvas) zoom it. A
group header folds its rows and the fold is remembered per flow; every header and row is a tab
stop in source order. Edges are elbows with rounded turns and an arrowhead, re-measured on a
resize, a fold and a zoom; one into a target with an issue takes the issue's tone. An issue marks
its group header (a chip with the count), its row (a triangle) and its edge, and `FlowChecklist`
lists it. Below 480 px of container the groups stack in source order, with no edges and no zoom.
A drawing smaller than the frame sits in its middle. Put it in a `fill` page; a `PageAside` beside
it docks and the canvas refits to the narrower frame. The column, group, row, edge and issue shapes
are not exported: type data off `FlowCanvasProps['columns'][number]`, and take `flow` from `useFlow`.

## Signature

```ts
FlowCanvas({ label, flow, columns, edges, issues, zoom, }: FlowCanvasProps): ReactElement
  label: string  // The accessible name of the canvas region
  flow: FlowHandle  // From `useFlow`: the tool, the folds and the checklist's reveal
  columns: readonly FlowColumn[]  // The stage, left to right; each column's groups top to bottom
  edges?: readonly FlowEdge[]  // Connectors between anchors (group or row ids); an unknown anchor draws nothing
  issues?: readonly FlowIssue[]
  zoom?: { min: number; max: number; }  // The zoom range; default 0.5 to 1.25
```

`FlowCanvasProps` import from `basalt-ui/cards`: `import type { FlowCanvasProps } from 'basalt-ui/cards'`.

## Example

```tsx
const flow = useFlow({ id: 'reorder' })
<FlowCanvas
  label="Reorder workflow"
  flow={flow}
  columns={[{ id: 'when', groups: [{ id: 'trigger', title: 'When', rows: [{ id: 'low', title: 'Stock below reorder point' }] }] }]}
  edges={[{ from: 'trigger', to: 'approval' }]}
  issues={issues}
/>
```
