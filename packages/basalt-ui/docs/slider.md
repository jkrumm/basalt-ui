---
name: Slider
use when: 'a number or a low-high range is picked on a bounded scale and approximate is fine'
never when: 'the exact value matters (use NumberField) or the choices are a few named options (use Segmented or RadioGroup)'
subpath: basalt-ui/ui/slider
peers: ['@base-ui/react']
slots: [slider]
---

# Slider

A slider on Base UI with one thumb (`value` is a number) or two (`value` is `[low, high]`). The
value read out to assistive tech is formatted in the page locale (`useFormat`): `1,5` in `de-DE`.
`onValueChange` fires on every step while dragging, `onValueCommitted` once on release; use it
for a write that is expensive. Arrow keys step by `step`, Shift or Page keys by `largeStep`.

## Props

### `Slider`

```ts
Slider<Value extends SliderValue = number>({ className, format: formatOptions, thumbLabels, showValue, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...props }: SliderProps<Value>): ReactElement
  className?: string  // Layout only (`max-w-xs`, `mt-2`)
  format?: Intl.NumberFormatOptions  // Intl options for the value read out to assistive tech (`{ style: 'percent' }`)
  aria-label?: string
  aria-labelledby?: string
  thumbLabels?: readonly string[]  // One name per thumb of a range (`['Minimum price', 'Maximum price']`)
  showValue?: boolean  // Prints the current value at the end of the track, formatted with `format`; a range reads `a – b`
```

## `sliderVariants`

Part `slider`.

No variant axes.

## Slots

- `slider`
