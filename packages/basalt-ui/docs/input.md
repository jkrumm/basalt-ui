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
`start` and `end` put an icon or a unit inside the field; without them the DOM is the bare input.

## Props

### `Input`

```ts
Input({ size, className, start: Start, end, ...props }: InputProps): ReactElement
  size?: "sm" | "md" | null
  className?: string  // Layout only (`w-full`, `max-w-xs`, `flex-1`)
  start?: IconComponent  // A non-interactive leading icon, drawn inside the field
  end?: ReactNode  // A trailing unit (`ms`) or one small button, drawn inside the field
```

## `inputVariants`

Part `input`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `input`
