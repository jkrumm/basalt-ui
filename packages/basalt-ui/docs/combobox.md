---
name: Combobox
use when: 'search, async or multi-select, or 50 or more options'
never when: 'fewer than 10 known values (Select) or free text (Autocomplete)'
subpath: basalt-ui/ui/combobox
peers: ['@base-ui/react']
slots: [combobox, combobox-input, combobox-content, combobox-item, combobox-chips, combobox-chip, autocomplete, autocomplete-input, autocomplete-content, autocomplete-item]
---

# Combobox

A searchable select on Base UI. Which job, which part: fewer than 10 known values, `Select`;
search, async, multi or 50+ options, `Combobox`; free text with suggestions, `Autocomplete`.

## `comboboxVariants`

Part `combobox`.

No variant axes.

## `comboboxInputVariants`

Part `combobox-input`.

- `size`: `md`, `sm` (default `md`)

## `comboboxContentVariants`

Part `combobox-content`.

No variant axes.

## `comboboxItemVariants`

Part `combobox-item`.

No variant axes.

## `comboboxChipsVariants`

Part `combobox-chips`.

- `size`: `md`, `sm` (default `md`)

## `comboboxChipVariants`

Part `combobox-chip`.

No variant axes.

## `autocompleteVariants`

Part `autocomplete`.

No variant axes.

## `autocompleteInputVariants`

Part `autocomplete-input`.

- `size`: `md`, `sm` (default `md`)

## `autocompleteContentVariants`

Part `autocomplete-content`.

No variant axes.

## `autocompleteItemVariants`

Part `autocomplete-item`.

No variant axes.

## Slots

- `combobox`
- `combobox-input`
- `combobox-content`
- `combobox-item`
- `combobox-chips`
- `combobox-chip`
- `autocomplete`
- `autocomplete-input`
- `autocomplete-content`
- `autocomplete-item`
