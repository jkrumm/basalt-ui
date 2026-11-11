---
name: Checkbox
use when: ''
never when: ''
subpath: basalt-ui/ui/checkbox
peers: ['@base-ui/react']
slots: [checkbox-group, checkbox]
---

# Checkbox

One checkbox, alone or inside a `CheckboxGroup`. Space toggles it; `indeterminate` shows a dash.
Its root is a `<span role="checkbox">`, so find it by role `checkbox`, never `button`. The check is
drawn by the part; children are not accepted.

## `checkboxGroupVariants`

Part `checkbox-group`.

No variant axes.

## `checkboxVariants`

Part `checkbox`.

No variant axes.

## Slots

- `checkbox-group`
- `checkbox`
