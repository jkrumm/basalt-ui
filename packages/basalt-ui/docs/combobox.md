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

## Props

### `Combobox`

A searchable select on Base UI. Which job, which part: fewer than 10 known values, `Select`;
search, async, multi or 50+ options, `Combobox`; free text with suggestions, `Autocomplete`.

```ts
Combobox<Value = string, Multiple extends boolean | undefined = false>({ className, children, onCreate, ...props }: ComboboxProps<Value, Multiple>): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  children?: ReactNode
  onCreate?: (text: string) => Value  // Makes the combobox creatable
```

### `ComboboxInput`

The input box of a single-value `Combobox`. It must be named with `aria-label`.

```ts
ComboboxInput({ size, className, ...props }: ComboboxInputProps): ReactElement
  aria-label: string
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  size?: "md" | "sm" | null
```

### `ComboboxContent`

The popup, portalled and anchored to the field. It lists the items that match the input and
scrolls inside the room left on screen.

```ts
ComboboxContent({ className, empty, container, children, ...props }: ComboboxContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  empty?: ReactNode  // Rendered in place of the list while nothing matches
  container?: HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null  // Where the popup renders
  children?: ReactNode | ((item: never, index: number) => ReactNode)  // Items, or a function from an item to its `ComboboxItem`
```

### `ComboboxItem`

One option. The selected one carries a check.

```ts
ComboboxItem({ className, children, ...props }: ComboboxItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
```

### `ComboboxChips`

The input box of a `multiple` `Combobox`: the selected values as removable chips, then the input.
The remove buttons are named from the message key `combobox.remove`.

```ts
ComboboxChips({ size, className, itemToLabel, placeholder, "aria-label": label, ...props }: ComboboxChipsProps): ReactElement
  aria-label: string
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  size?: "md" | "sm" | null
  placeholder?: string
  itemToLabel?: (value: never) => string  // The text of a selected value, for the chip and its remove name
```

### `ComboboxChip`

One selected value of a `multiple` `Combobox`, with a remove button. `ComboboxChips` renders
these; use it directly only for a custom chips row.

```ts
ComboboxChip({ className, label, ...props }: ComboboxChipProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  label?: string  // The chip's text, also the name of its remove button
```

### `Autocomplete`

Free text with suggestions on Base UI: the input keeps what is typed, the popup suggests. It is
also the command-palette base. For a value that must come from the list use `Combobox`.

```ts
Autocomplete<Item = string>({ className, children, items, ...props }: AutocompleteProps<Item>): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  items?: readonly Item[]
  children?: ReactNode
```

### `AutocompleteInput`

The input box of an `Autocomplete`. It must be named with `aria-label`.

```ts
AutocompleteInput({ size, className, ...props }: AutocompleteInputProps): ReactElement
  aria-label: string
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  size?: "md" | "sm" | null
```

### `AutocompleteContent`

The suggestion popup, portalled and anchored to the field.

```ts
AutocompleteContent({ className, empty, container, children, ...props }: AutocompleteContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
  empty?: ReactNode
  container?: HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null
  children?: ReactNode | ((item: never, index: number) => ReactNode)
```

### `AutocompleteItem`

One suggestion.

```ts
AutocompleteItem({ className, ...props }: AutocompleteItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-64`, `flex-1`)
```

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
