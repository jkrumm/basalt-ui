---
name: Select
use when: 'a person picks one of fewer than 10 known values'
never when: 'the list is searchable, async, multi-select or 50 or more options (Combobox)'
subpath: basalt-ui/ui/select
peers: ['@base-ui/react']
slots: [select, select-trigger, select-value, select-content, select-item, select-group, native-select]
---

# Select

A single-choice select on Base UI. Which job, which part: fewer than 10 known values, `Select`;
row-level or an OS picker on phones, `NativeSelect`; search, async, multi or 50+ options,
`Combobox`; free text with suggestions, `Autocomplete`.

## `selectVariants`

Part `select`.

No variant axes.

## `selectTriggerVariants`

Part `select-trigger`.

- `size`: `md`, `sm` (default `md`)

## `selectContentVariants`

Part `select-content`.

No variant axes.

## `selectItemVariants`

Part `select-item`.

No variant axes.

## `nativeSelectVariants`

Part `native-select`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `select`
- `select-trigger`
- `select-value`
- `select-content`
- `select-item`
- `select-group`
- `native-select`
