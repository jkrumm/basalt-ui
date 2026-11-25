---
name: NumberField
use when: 'a number the user types or steps (a quantity, a price) with a min, a max and locale formatting'
never when: 'the value is a range on a scale (use Slider), or free text that happens to contain digits (use Input)'
subpath: basalt-ui/ui/number-field
peers: ['@base-ui/react']
slots: [number-field]
---

# NumberField

A number input on Base UI with decrement and increment buttons; arrow keys step it, Shift steps
by `largeStep`. The text is formatted and parsed in `locale` (`1.234,5` in `de-DE`). Works with
no provider and joins a Base UI `Field` when wrapped in one.

## Props

### `NumberField`

```ts
NumberField({ size, locale, className, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, placeholder, ...props }: NumberFieldProps): ReactElement
  format?: Intl.NumberFormatOptions  // Options to format the input value
  size?: "sm" | "md" | null
  locale?: string  // BCP 47 tag for the digits and separators, default `en`
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  placeholder?: string
  className?: string  // Layout only (`w-40`, `max-w-xs`)
```

## `numberFieldVariants`

Part `number-field`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `number-field`
