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

## Props

### `Select`

A single-choice select on Base UI. Which job, which part: fewer than 10 known values, `Select`;
row-level or an OS picker on phones, `NativeSelect`; search, async, multi or 50+ options,
`Combobox`; free text with suggestions, `Autocomplete`.

```ts
Select<Value = string>(props: SelectProps<Value>): ReactElement
  // either aria-label + options, aria-labelledby + options or children
  className?: string  // Layout only (`w-full`, `w-40`, `flex-1`)
  size?: "sm" | "md" | null
  present?: OverlayPresent  // How the list opens: `auto` is a bottom sheet on a phone (compact width, coarse pointer) and the anchored popup elsewhere; `popup` and `sheet` force one
  aria-label: string
  options?: ListSource<Value>  [with aria-label | aria-labelledby]  // Options and groups (`{ label, options }`)
  placeholder?: string  [with aria-label | aria-labelledby]  // Shown in the trigger while no value is selected
  searchable?: boolean  [with aria-label | aria-labelledby]  // A search field at the top of the open list, ranked with `rank`
  rank?: RankFn<ListOption<Value>>  [with aria-label | aria-labelledby]  // Orders and filters the options for the search text
  empty?: ReactNode  [with aria-label | aria-labelledby]  // Shown when the search matches nothing
  virtual?: ListVirtual  [with aria-label | aria-labelledby]  // The windowing port of a searchable list: pass `VirtualList` from `basalt-ui/ui/virtual-list` and past 100 rows only the rows in view mount
  items?: Record<string, ReactNode> | readonly { label: React.ReactNode; value: any; }[] | readonly Group<any>[]  [with children]  // Label lookup for `SelectValue`, so the closed trigger shows a label before the popup has mounted
  children?: ReactNode
  aria-labelledby: string
```

### `SelectTrigger`

The closed control of a parts-form `Select`. It must be named: pass `aria-label` or
`aria-labelledby`, or a missing name fails to type-check.

```ts
SelectTrigger({ size, className, children, ...props }: SelectTriggerProps): ReactElement
  // either aria-label or aria-labelledby
  aria-label: string
  className?: string  // Layout only (`w-full`, `w-40`, `flex-1`)
  size?: "sm" | "md" | null
  children?: ReactNode
  aria-labelledby: string
```

### `SelectValue`

The selected value inside the trigger; it shows the item's label, or `placeholder` while empty.

```ts
SelectValue({ className, ...props }: SelectValueProps): ReactElement
  className?: string  // Layout only
```

### `SelectContent`

The popup, portalled and positioned by Base UI. It scrolls inside the room left on screen.

```ts
SelectContent({ className, container, children, ...props }: SelectContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-40`, `flex-1`)
  container?: HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null  // Where the popup renders
```

### `SelectItem`

One option. The selected one carries a check.

```ts
SelectItem({ size, className, children, ...props }: SelectItemProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-40`, `flex-1`)
  size?: "sm" | "md" | null
```

### `SelectGroup`

A labelled run of items.

```ts
SelectGroup({ className, label, children, ...props }: SelectGroupProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-40`, `flex-1`)
  label: ReactNode  // The group heading; it names the group for assistive tech
```

### `NativeSelect`

The platform `<select>` with the design's box and chevron: appearance stripped, height from
`size`, focus ring, the field's text size on every pointer. Use it for a row-level choice or where the OS
picker is the better phone UI. Name it with a wrapping `<label>` or `aria-label`.

```ts
NativeSelect({ size, className, options, onValueChange, onChange, children, ...props }: NativeSelectProps): ReactElement
  className?: string  // Layout only (`w-full`, `w-40`, `flex-1`)
  size?: "sm" | "md" | null
  options?: readonly SelectOption<string>[]  // The choices; omit it to write `<option>` children
  onValueChange?: (value: string) => void  // Fires with the picked value, so a form field's value writer takes it
```

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

- `size`: `sm`, `md` (default `md`)

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
