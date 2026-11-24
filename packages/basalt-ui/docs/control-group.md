---
name: ControlGroup
use when: 'controls that together make one request: a field and the select that scopes it, a search and its submit'
never when: 'the controls are filters of a list (use FilterSet), or one field with a unit or a button of its own (use Input start and end, or InputGroup)'
subpath: basalt-ui/ui/control-group
peers: []
slots: [button-group, control-group, input-group, input-addon]
---

# ControlGroup

Several different controls on one line as one unit, 2 px apart: a select, an input and a button.
The group sets `size` for every child (and `variant` for its buttons); a child that passes its own
keeps it. Inside the group a field sizes to its content, and with `fill` every child grows.

## Props

### `ButtonGroup`

Buttons shown as one: fused edges, the outer corners rounded, in a `<fieldset>`. The group sets
`size` and `variant` for its buttons; a button that passes its own keeps it. Tab still visits each
button in order; for one tab stop with arrow keys, use `Toolbar`.

```ts
ButtonGroup({ size, variant, orientation, fill, className, children, ...props }: ButtonGroupProps): ReactElement
  aria-label?: string
  aria-labelledby?: string
  size?: "sm" | "md"  // Sets every child's `size`; a child's own `size` wins
  orientation?: "horizontal" | "vertical"  // `vertical` stacks the children
  fill?: boolean  // The group takes its box's width and every child grows; `className="grow-0"` keeps one at its own width
  className?: string  // Layout only (`ml-auto`, `max-w-md`)
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"  // Sets every button's `variant`; a button's own `variant` wins
```

### `ControlGroup`

Several different controls on one line as one unit, 2 px apart: a select, an input and a button.
The group sets `size` for every child (and `variant` for its buttons); a child that passes its own
keeps it. Inside the group a field sizes to its content, and with `fill` every child grows.

```ts
ControlGroup({ size, variant, orientation, fill, className, children, ...props }: ControlGroupProps): ReactElement
  aria-label?: string
  aria-labelledby?: string
  size?: "sm" | "md"  // Sets every child's `size`; a child's own `size` wins
  orientation?: "horizontal" | "vertical"  // `vertical` stacks the children
  fill?: boolean  // The group takes its box's width and every child grows; `className="grow-0"` keeps one at its own width
  className?: string  // Layout only (`ml-auto`, `max-w-md`)
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"  // Sets the `variant` of the buttons in the group; a button's own `variant` wins
```

### `InputGroup`

One field fused with addons on its edge: an `InputAddon` with text (`https://`, `EUR`), a
`NativeSelect` or a `Button`. The field grows, the addons keep their width; the group sets `size`
for all of them. Name the field so it includes the addon's meaning (`aria-label="Price in EUR"`):
the addon text is not part of the field's label.

```ts
InputGroup({ size, className, children, ...props }: InputGroupProps): ReactElement
  aria-label?: string
  aria-labelledby?: string
  className?: string  // Layout only (`ml-auto`, `max-w-md`)
  children: ReactNode
  size?: "sm" | "md"  // Sets every child's `size`; a child's own `size` wins
```

### `InputAddon`

A text cell on an `InputGroup` field's edge: a prefix or a unit the user does not type.

```ts
InputAddon({ size, className, ...props }: InputAddonProps): ReactElement
  size?: "sm" | "md" | null
  className?: string  // Layout only (`min-w-16`)
```

## `buttonGroupVariants`

Part `button-group`.

- `orientation`: `horizontal`, `vertical` (default `horizontal`)
- `fill`: `true`, `false` (default `false`)

## `controlGroupVariants`

Part `control-group`.

- `orientation`: `horizontal`, `vertical` (default `horizontal`)
- `fill`: `true`, `false` (default `false`)

## `inputGroupVariants`

Part `input-group`.

No variant axes.

## `inputAddonVariants`

Part `input-addon`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `button-group`
- `control-group`
- `input-group`
- `input-addon`
