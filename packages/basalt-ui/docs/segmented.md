---
name: Segmented
use when: ''
never when: ''
subpath: basalt-ui/ui/segmented
peers: ['@base-ui/react']
slots: [segmented, segmented-item]
---

# Segmented

A row of options on Base UI's toggle group. Single select (the default) keeps exactly one option
on and draws one indicator that slides to it; the arrow keys move the selection through the
options in DOM order. `multiple` lets several be on and draws no indicator. Works with no provider.

## `segmentedVariants`

Part `segmented`.

- `size`: `md`, `sm` (default `md`)

## `segmentedItemVariants`

Part `segmented-item`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `segmented`
- `segmented-item`
