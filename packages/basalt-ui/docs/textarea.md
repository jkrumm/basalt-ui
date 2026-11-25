---
name: Textarea
use when: 'free text of several lines (a note, a message)'
never when: 'one line (use Input) or markdown the user reads back (use Markdown for the display)'
subpath: basalt-ui/ui/textarea
peers: ['@base-ui/react']
slots: [textarea]
---

# Textarea

A multi-line text field on Base UI's `Input`, rendered as a `<textarea>`. It grows with its
content from `rows` lines (default 3) to 10, then scrolls; where `field-sizing` is unsupported it
stays the fixed `rows` box. Works with no provider and joins a Base UI `Field` when wrapped in one.

## Props

### `Textarea`

```ts
Textarea({ size, className, rows, style, onFocus, ...props }: TextareaProps): ReactElement
  value?: string
  defaultValue?: string
  onValueChange?: ((value: string, eventDetails: BaseInput.ChangeEventDetails) => void)  // Fires with the next text; use it to control the field
  className?: string  // Layout only (`max-w-md`, `resize-none`, a taller ceiling `max-h-96`)
  size?: "sm" | "md" | null
```

## `textareaVariants`

Part `textarea`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `textarea`
