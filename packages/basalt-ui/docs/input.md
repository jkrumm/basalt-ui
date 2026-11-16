---
name: Input
use when: 'one line of free text, a number as text, a search or an email'
never when: 'several lines (use Textarea), a number with steppers (use NumberField), or a choice from known values (use Select or Combobox)'
subpath: basalt-ui/ui/input
peers: ['@base-ui/react']
slots: [input]
---

# Input

A text input on Base UI. Works with no provider and joins a Base UI `Field` when wrapped in one.

## Props

### `Input`

A text input on Base UI. Works with no provider and joins a Base UI `Field` when wrapped in one.

```ts
Input({ size, className, ...props }: InputProps): ReactElement
  size?: "md" | "sm" | null
  className?: string  // Layout only (`w-full`, `max-w-xs`, `flex-1`)
```

## `inputVariants`

Part `input`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `input`
