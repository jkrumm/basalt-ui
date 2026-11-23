---
name: SwatchPicker
use when: 'the user tags a record with one colour of the palette: a stage, a label, a calendar'
never when: 'any colour is allowed (a free colour picker is not part of basalt) or the choice is not a colour'
subpath: basalt-ui/ui/swatch-picker
peers: ['@base-ui/react']
slots: [swatch-picker]
---

# SwatchPicker

A small set of named colour tokens as swatches, picked by a ring and a check. The value is the
token's name (`brand`, `chart-3`), never a colour value, so a picked colour follows the theme in
both schemes. `display="menu"` folds the grid into a popover behind a trigger that shows the
picked colour, for a field with little room. Arrow keys move through the swatches; it joins a Base
UI `Field` when wrapped in one.

## Props

### `SwatchPicker`

A small set of named colour tokens as swatches, picked by a ring and a check. The value is the
token's name (`brand`, `chart-3`), never a colour value, so a picked colour follows the theme in
both schemes. `display="menu"` folds the grid into a popover behind a trigger that shows the
picked colour, for a field with little room. Arrow keys move through the swatches; it joins a Base
UI `Field` when wrapped in one.

```ts
SwatchPicker({ options, value, onValueChange, display, name, disabled, required, "aria-invalid": invalid, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, onBlur, className, }: SwatchPickerProps): ReactElement
  options: readonly SwatchOption[]
  value?: "neutral" | "good" | "warn" | "bad" | "info" | "brand" | "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "accent-blue" | "accent-violet" | "accent-rose" | "accent-orange" | "accent-green" | "accent-teal"
  onValueChange?: (value: SwatchToken) => void
  display?: "menu" | "inline"  // `inline` draws the grid in place; `menu` draws a trigger with the picked colour that opens it
  name?: string
  disabled?: boolean
  required?: boolean
  aria-invalid?: boolean
  aria-label?: string
  aria-labelledby?: string
  aria-describedby?: string
  onBlur?: () => void  // Fires once when focus leaves the picker (the menu: when it closes): the validate-on-blur hook
  className?: string  // Layout only (`w-fit`)
```

## `swatchPickerVariants`

Part `swatch-picker`.

No variant axes.

## Slots

- `swatch-picker`
