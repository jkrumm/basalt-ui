---
name: Checkbox
use when: 'a yes or no the user sets, or several independent choices in a `CheckboxGroup`'
never when: 'a setting that applies at once (use Switch), or exactly one of several (use RadioGroup)'
subpath: basalt-ui/ui/checkbox
peers: ['@base-ui/react']
slots: [checkbox-group, checkbox]
---

# Checkbox

One checkbox, alone or inside a `CheckboxGroup`. Space toggles it; `indeterminate` shows a dash.
Its root is a `<span role="checkbox">`, so find it by role `checkbox`, never `button`. The check is
drawn by the part; children are not accepted.

## Props

### `CheckboxGroup`

A group of checkboxes on Base UI: the value is the list of checked options' `value`s. Works with
no provider and joins a Base UI `Field` when wrapped in one. Name each checkbox with a wrapping
`<label>`, or give `options` and each row is labelled and described for you. `variant="card"` or
`"tile"` draws the options as selectable cards.

```ts
CheckboxGroup({ className, variant, options, children, ...props }: CheckboxGroupProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
  options?: readonly ChoiceOption[]  // The choices, each a row with its label and description
  variant?: ChoiceVariant  // `list` (default) is plain rows; `card` and `tile` draw each option as a `ChoiceCard`
```

### `Checkbox`

```ts
Checkbox({ className, ...props }: CheckboxProps): ReactElement
  className?: string  // Layout only (`w-full`, `max-w-sm`, `mt-2`)
```

## `checkboxGroupVariants`

Part `checkbox-group`.

- `variant`: `list`, `card`, `tile` (default `list`)

## `checkboxVariants`

Part `checkbox`.

No variant axes.

## Slots

- `checkbox-group`
- `checkbox`
