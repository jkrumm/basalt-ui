---
name: DataPanel
use when: 'a page needs the card frame around a table, a row list or a board, with a header, controls and a legend'
never when: 'the body is a chart (use a chart card) or a single figure (use a stat card or a stat cell)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [data-panel, data-panel-toolbar]
---

# DataPanel

The frame for a body that is not a chart: the same header and phase handling as the other cards,
around a table, a list or a board. The body is one box slot at a fixed height, declared by the
required `bodySize`, so a loading, empty or error panel is exactly as tall as a ready one and
the body is called only in `ready` and `stale`. The box clips with `overflow: clip`, never
`hidden`, so a table head that sticks to the page keeps sticking.

## Signature

```ts
DataPanel(props: DataPanelProps): ReactElement
  title: string
  subtitle?: string
  icon?: IconComponent
  info?: string
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  controls?: ControlsSlot<"widget">
  toolbar?: ControlsSlot<"widget">
  menu?: Menu
  legend?: readonly LegendEntry[]
  bodySize: { rows: number; } | { height: number; }  // Required: the loading card draws its final shape
  body: BoxSlot  // Tables, lists and boards
```

`Phase`, `QueryStateLike`, `Empty` import from the root: `import type { Phase, QueryStateLike, Empty } from 'basalt-ui'`.

## Example

```tsx
<DataPanel
  title="Open pull requests"
  subtitle="by age"
  phase={query}
  empty={rows.length ? null : { cause: 'Nothing open' }}
  bodySize={{ rows: 6 }}
  body={(box) => <PullTable rows={rows} height={box.height} />}
/>
```
