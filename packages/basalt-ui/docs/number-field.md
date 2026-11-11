---
name: NumberField
use when: ''
never when: ''
subpath: basalt-ui/ui/number-field
peers: ['@base-ui/react']
slots: [number-field]
---

# NumberField

A number input on Base UI with decrement and increment buttons; arrow keys step it, Shift steps
by `largeStep`. The text is formatted and parsed in `locale` (`1.234,5` in `de-DE`). Works with
no provider and joins a Base UI `Field` when wrapped in one.

## `numberFieldVariants`

Part `number-field`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `number-field`
