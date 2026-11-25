---
name: Button
use when: 'an action the user takes: save, delete, open'
never when: 'the target is another page (use a link, or `render` a link through Button), or the control is a choice (use Switch, Segmented or Select)'
subpath: basalt-ui/ui/button
peers: ['@base-ui/react']
slots: [button, pressable]
---

# Button

A button on Base UI. Works with no provider; polymorphism only through `render`.

## Props

### `Button`

```ts
Button({ variant, size, shape, loading, disabled, focusableWhenDisabled, className, children, ...props }: ButtonProps): ReactElement
  // either aria-label + shape or neither
  className?: string  // Layout only (`w-full`, `flex-1`, `mt-2`)
  size?: "sm" | "md" | null
  variant?: "primary" | "secondary" | "ghost" | "danger" | null
  loading?: boolean  // Disables interaction, sets `aria-busy` and draws a spinner over the label; the label keeps its place (transparent, still the accessible name), so the button never changes width
  shape?: "default" | "icon"
  aria-label: string  [with shape="icon"]
```

### `Pressable`

A whole row, chip or disclosure that is one button. Styled by the caller; it owns focus, the
pointer-tier hit floor and `size` layout, and nothing else.

```ts
Pressable({ size, className, ...props }: PressableProps): ReactElement
  className?: string  // Layout only (`w-full`, `flex-1`, `mt-2`)
  size?: "none" | "row" | "chip" | null
```

## `buttonVariants`

Part `button`.

- `variant`: `primary`, `secondary`, `ghost`, `danger` (default `secondary`)
- `size`: `md`, `sm` (default `md`)
- `shape`: `default`, `icon` (default `default`)

## `pressableVariants`

Part `pressable`.

- `size`: `none`, `row`, `chip` (default `none`)

## Slots

- `button`
- `pressable`
