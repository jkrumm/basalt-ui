---
name: Toolbar
use when: 'a row of related controls should be one tab stop with arrow-key movement (a viewer, an editor)'
never when: 'the controls are navigation (use InnerNav) or a single choice (use Segmented)'
subpath: basalt-ui/ui/toolbar
peers: ['@base-ui/react']
slots: [toolbar, toolbar-group, toolbar-button, toolbar-separator]
---

# Toolbar

A row of controls with roving focus: Tab enters the row once, the arrow keys move between its
controls (a button, a `Segmented`, a `Select` trigger through `ToolbarButton render`). Works
with no provider.

## Props

### `Toolbar`

```ts
Toolbar({ className, ...props }: ToolbarProps): ReactElement
  // either aria-label or aria-labelledby
  aria-label: string
  className?: string  // Layout only (`w-full`, `justify-between`)
  aria-labelledby: string
```

### `ToolbarGroup`

Controls that belong together, `role="group"` at the height of a `Button`. Name it with
`aria-label` when the group has meaning of its own.

```ts
ToolbarGroup({ className, ...props }: ToolbarGroupProps): ReactElement
  className?: string  // Layout only (`ml-auto`)
```

### `ToolbarButton`

A button that takes part in the toolbar's roving focus, looking like a `Button` (ghost by
default). With `render` it makes another control a roving item and leaves that control its own
look: `render={<SelectTrigger aria-label="Zoom" />}`.

```ts
ToolbarButton({ variant, size, shape, className, render, ...props }: ToolbarButtonProps): ReactElement
  // either aria-label + shape or neither
  size?: "sm" | "md" | null
  variant?: "primary" | "secondary" | "ghost" | "danger" | null
  className?: string  // Layout only (`ml-auto`)
  shape?: "default" | "icon"
  aria-label: string  [with shape="icon"]
```

### `ToolbarSeparator`

A hairline between groups. Its orientation follows the toolbar's, so it needs no prop.

```ts
ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps): ReactElement
  className?: string  // Layout only (`mx-2`)
```

## `toolbarVariants`

Part `toolbar`.

No variant axes.

## `toolbarGroupVariants`

Part `toolbar-group`.

No variant axes.

## `toolbarSeparatorVariants`

Part `toolbar-separator`.

No variant axes.

## Slots

- `toolbar`
- `toolbar-group`
- `toolbar-button`
- `toolbar-separator`
