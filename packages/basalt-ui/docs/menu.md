---
name: Menu
use when: 'a trigger or a point on the page opens a list of actions, toggles or one-of-many choices'
never when: 'the list picks a form value (use `Select`) or holds arbitrary content (use `Popover`)'
subpath: basalt-ui/ui/menu
peers: ['@base-ui/react']
slots: [menu-trigger, menu-content, menu-item, menu-group, menu-checkbox-item, menu-radio-group, menu-radio-item, menu-sub, menu-separator]
---

# Menu

A list of actions on Base UI: Enter, Space or a click opens it, arrows and typeahead move,
Enter or a click runs an item, Escape closes it and gives focus back, and it is always portalled
above the page. Open state stays with the caller (`open`/`onOpenChange`) or the trigger. Works
with no provider.

## Props

### `Menu`

A list of actions on Base UI: Enter, Space or a click opens it, arrows and typeahead move,
Enter or a click runs an item, Escape closes it and gives focus back, and it is always portalled
above the page. Open state stays with the caller (`open`/`onOpenChange`) or the trigger. Works
with no provider.

```ts
Menu({ present, open, defaultOpen, onOpenChange, ...props }: MenuProps): ReactElement
  present?: OverlayPresent  // How the list opens: `auto` is an action sheet from the bottom on a phone (compact width, coarse pointer) and the anchored popup elsewhere; `popup` and `sheet` force one
```

### `MenuTrigger`

The element that opens a `Menu`. It carries no look of its own: pass `render={<Button />}`.

```ts
MenuTrigger({ className, ...props }: MenuTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `MenuContent`

The popup, portalled and positioned by Base UI. `anchor` takes an element or a virtual rect when
the menu has no trigger, and then focus lands on the first item. `finalFocus` names where focus
goes when it closes (a ref, an element, or `false` to leave it); the default is the trigger, or
the element that held focus before.

```ts
MenuContent({ anchor, side, align, sideOffset, alignOffset, container, className, children, ...props }: MenuContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
  container?: HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null  // Where the popup renders
```

### `MenuItem`

One action. `onClick` runs it and the menu closes; `closeOnClick={false}` keeps the menu open.

```ts
MenuItem({ className, ...props }: MenuItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `MenuGroup`

A labelled run of items.

```ts
MenuGroup({ className, label, children, ...props }: MenuGroupProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
  label: ReactNode  // The group heading; it names the group for assistive tech
```

### `MenuCheckboxItem`

A toggle: it carries a check while `checked`. It keeps the menu open by default so several can be
flipped in one visit; `closeOnClick` closes it.

```ts
MenuCheckboxItem({ className, children, closeOnClick, ...props }: MenuCheckboxItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `MenuRadioGroup`

The group of `MenuRadioItem`s that share one value (`value`/`onValueChange`).

```ts
MenuRadioGroup({ className, ...props }: MenuRadioGroupProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `MenuRadioItem`

One choice of a `MenuRadioGroup`; the chosen one carries a dot. It closes the menu on click by
default (`closeOnClick={false}` keeps it open).

```ts
MenuRadioItem({ className, children, ...props }: MenuRadioItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `MenuSub`

A nested menu: the row (`label`) opens a submenu of its `children` to the side on hover, click or
the arrow key. The submenu is portalled and stacks above its parent.

```ts
MenuSub({ label, children, sideOffset, alignOffset, className, ...props }: MenuSubProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
  label: string  // The row that opens the submenu
  children: ReactNode  // The submenu's items
```

### `MenuSeparator`

A hairline between groups of items.

```ts
MenuSeparator({ className, ...props }: MenuSeparatorProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

## `menuContentVariants`

Part `menu-content`.

No variant axes.

## `menuItemVariants`

Part `menu-item`.

No variant axes.

## Slots

- `menu-trigger`
- `menu-content`
- `menu-item`
- `menu-group`
- `menu-checkbox-item`
- `menu-radio-group`
- `menu-radio-item`
- `menu-sub`
- `menu-separator`
