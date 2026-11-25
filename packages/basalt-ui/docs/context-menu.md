---
name: ContextMenu
use when: 'a row, card or item already has a '...' menu and a right click should open the same actions'
never when: 'the part has no menu of its own (the browser''s menu stays), or the list picks a form value (use `Select`)'
subpath: basalt-ui/ui/context-menu
peers: ['@base-ui/react']
slots: [context-menu-trigger, context-menu-content]
---

# ContextMenu

The same list of actions as a part's "..." button, opened where the pointer is. Right click,
a long press on touch, and Shift+F10 or the context-menu key on the focused part open it; a
modifier right click (Shift) and a right click inside a text field keep the browser's menu.
While it is open the trigger carries `data-popup-open`, which a part styles as selected. The
popup mounts on the first open, so a closed one costs a state hook and a few handlers.

## Props

### `ContextMenu`

The same list of actions as a part's "..." button, opened where the pointer is. Right click,
a long press on touch, and Shift+F10 or the context-menu key on the focused part open it; a
modifier right click (Shift) and a right click inside a text field keep the browser's menu.
While it is open the trigger carries `data-popup-open`, which a part styles as selected. The
popup mounts on the first open, so a closed one costs a state hook and a few handlers.

```ts
ContextMenu({ children, defaultOpen, disabled, onOpenChange, }: ContextMenuProps): ReactElement
  children?: ReactNode
  defaultOpen?: boolean  // Starts open at the top-left corner, for a docs frame or a test; a user opens it at a point
  disabled?: boolean  // Opt out: right click, long press and Shift+F10 fall through to the browser
  onOpenChange?: ((open: boolean) => void)  // Called when the menu opens or closes
```

### `ContextMenuTrigger`

The element a right click, a long press or Shift+F10 opens the menu from. It renders a `div`;
`render` swaps the element (a table row, a card) and keeps its own props and handlers.

```ts
ContextMenuTrigger({ render, className, ...props }: ContextMenuTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `ContextMenuContent`

The popup, opened at the point of the last right click or long press (or beside the focused part
for a keyboard open) and kept on screen by flipping. It mounts on the first open.

```ts
ContextMenuContent({ side, align, sideOffset, alignOffset, className, children, ...props }: ContextMenuContentProps): ReactElement | null
  className?: string  // Layout only (`w-full`, `mt-2`)
```

## Slots

- `context-menu-trigger`
- `context-menu-content`
