---
name: Slider
use when: ''
never when: ''
subpath: basalt-ui/ui/slider
peers: ['@base-ui/react']
slots: [slider]
---

# Slider

A slider on Base UI with one thumb (`value` is a number) or two (`value` is `[low, high]`). The
value read out to assistive tech is formatted in the page locale (`useFormat`): `1,5` in `de-DE`.
`onValueChange` fires on every step while dragging, `onValueCommitted` once on release; use it
for a write that is expensive. Arrow keys step by `step`, Shift or Page keys by `largeStep`.

## `sliderVariants`

Part `slider`.

No variant axes.

## Slots

- `slider`
