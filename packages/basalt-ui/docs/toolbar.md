---
name: Toolbar
use when: ''
never when: ''
subpath: basalt-ui/ui/toolbar
peers: ['@base-ui/react']
slots: [toolbar, toolbar-group, toolbar-button, toolbar-separator]
---

# Toolbar

A row of controls with roving focus: Tab enters the row once, the arrow keys move between its
controls (a button, a `Segmented`, a `Select` trigger through `ToolbarButton render`). Works
with no provider.

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
