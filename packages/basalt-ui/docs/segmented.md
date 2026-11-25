---
name: Segmented
use when: 'a view or a range is one of two to five short options switched in place'
never when: 'the options are more than five (use Select), or they open different pages (use Tabs or InnerNav)'
subpath: basalt-ui/ui/segmented
peers: ['@base-ui/react']
slots: [segmented, segmented-item]
---

# Segmented

A row of options on Base UI's toggle group. Single select (the default) keeps exactly one option
on and draws it raised; the arrow keys move the selection through the options in DOM order.
`multiple` lets several be on. The raised face is CSS on the pressed option, so a server render
shows the selection with no script. Works with no provider.

## Props

### `Segmented`

```ts
Segmented(props: SegmentedProps): ReactElement
  // either options, options + multiple, children or children + multiple
  size?: "sm" | "md" | null
  fill?: boolean  // The track takes its box's width and every option an equal share of it (a phone's full-width switch)
  disabled?: boolean
  className?: string  // Layout only (`w-full`, `mt-2`)
  aria-label?: string
  aria-labelledby?: string
  options?: readonly SegmentedOption[]  // The options as data; use `children` with `SegmentedItem` when an option has its own layout
  children?: ReactNode
  multiple?: false | true
  value?: string | readonly string[]
  defaultValue?: string | readonly string[]
  onValueChange?: (value: string) => void | (value: string[]) => void  // Fires with the new value
```

### `SegmentedItem`

One option of a `Segmented`, for an option with its own layout (an icon and a count). It takes
the group's `size` and, in single select, becomes the selection when an arrow key reaches it.

```ts
SegmentedItem({ className, onFocus, ...props }: SegmentedItemProps): ReactElement
  value: string
  className?: string  // Layout only (`px-4`)
```

## `segmentedVariants`

Part `segmented`.

- `size`: `md`, `sm` (default `md`)
- `fill`: `true`, `false` (default `false`)

## `segmentedItemVariants`

Part `segmented-item`.

- `size`: `md`, `sm` (default `md`); not a prop of `SegmentedItem`, which resolves it itself

## Slots

- `segmented`
- `segmented-item`
