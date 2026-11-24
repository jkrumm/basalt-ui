---
name: Resizable
use when: 'two or more regions share one box and the reader should choose how much room each gets (a list and its detail, an editor and its output)'
never when: 'a panel only appears over the page without sharing it (a `Peek` or a `Sheet`), or its width is fixed (a plain flex row)'
subpath: basalt-ui/ui/resizable
peers: [react-resizable-panels]
slots: [resizable-panel-group, resizable-panel, resizable-handle]
---

# Resizable

Panels side by side (`orientation="horizontal"`, the default) or stacked (`"vertical"`) with a
draggable, keyboard-reachable divider between each pair, on `react-resizable-panels`. It fills its
parent (100% wide and high), so give the parent a height. Sizes are percentages of the group; a
bare number is px and a `"20rem"` string is its unit. Nothing is persisted: the app passes
`defaultLayout` and saves in `onLayoutChanged`, which is also what keeps a server render from
shifting (percent sizes are rendered as `flex-grow` ratios).

## Props

### `ResizablePanelGroup`

Panels side by side (`orientation="horizontal"`, the default) or stacked (`"vertical"`) with a
draggable, keyboard-reachable divider between each pair, on `react-resizable-panels`. It fills its
parent (100% wide and high), so give the parent a height. Sizes are percentages of the group; a
bare number is px and a `"20rem"` string is its unit. Nothing is persisted: the app passes
`defaultLayout` and saves in `onLayoutChanged`, which is also what keeps a server render from
shifting (percent sizes are rendered as `flex-grow` ratios).

```ts
ResizablePanelGroup(props: ResizablePanelGroupProps): ReactElement
  className?: string  // Layout only (`h-96`, `border`)
```

### `ResizablePanel`

One region of a `ResizablePanelGroup`. It clips its content instead of scrolling it, so the page
keeps one scrollport: put a `ScrollArea` inside when the content is longer than the panel (the
library's own default would draw a second scrollbar). `minSize`, `maxSize`, `defaultSize` and
`collapsible` take the library's units; give every panel an `id` when a layout is saved.

```ts
ResizablePanel({ style, ...rest }: ResizablePanelProps): ReactElement
  className?: string  // Layout only (`h-96`, `border`)
```

### `ResizableHandle`

The divider between two panels: a hairline that turns brand on hover, while it is dragged and on
keyboard focus. It is a `role="separator"` the reader can focus; ArrowLeft and ArrowRight (ArrowUp
and ArrowDown in a vertical group) move it 5% of the group, Home and End go to the panel's
minimum and maximum. The pointer target is larger than the line (10px, 20px on touch).

```ts
ResizableHandle({ className, grip, children, ...rest }: ResizableHandleProps): ReactElement
  className?: string  // Layout only (`h-96`, `border`)
  grip?: boolean  // Draws a small grip on the divider, for a split a reader may not know can be dragged
```

## Slots

- `resizable-panel-group`
- `resizable-panel`
- `resizable-handle`
