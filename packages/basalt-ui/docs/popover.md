---
name: Popover
use when: 'a panel of any content hangs off one trigger and is not a decision (a filter pill, a rich hover card, a small form)'
never when: 'the content is a list of actions (use `Menu`) or a one-line hint on an icon (use `Tooltip`)'
subpath: basalt-ui/ui/popover
peers: ['@base-ui/react']
slots: [popover-trigger, popover-content]
---

# Popover

A floating panel anchored to its trigger on Base UI: click or Enter opens it, Escape and an
outside click close it, focus moves in and returns, and it is always portalled above the page.
Open state stays with the caller (`open`/`onOpenChange`) or the trigger. Works with no provider.

## Props

### `Popover`

```ts
Popover({ present, open, defaultOpen, onOpenChange, ...props }: PopoverProps): ReactElement
  present?: OverlayPresent  // How the panel opens: `auto` keeps it anchored, and on a phone (compact width, coarse pointer) lifts it into a bottom sheet only when it would not fit the viewport; `popup` and `sheet` force one
```

### `PopoverTrigger`

The element that opens a `Popover`. It carries no look of its own: pass `render={<Button />}`.
`openOnHover` (with `delay` and `closeDelay`) opens the panel on hover as well as on press.

```ts
PopoverTrigger({ className, ...props }: PopoverTriggerProps): ReactElement
  className?: string  // Layout only (`w-96`, `mt-2`)
```

### `PopoverContent`

The panel, portalled and positioned by Base UI. It must be named: pass `aria-label` or
`aria-labelledby`, or a missing name fails to type-check. `finalFocus` and `initialFocus` name
where focus goes when it closes and opens.

```ts
PopoverContent({ anchor, side, align, sideOffset, alignOffset, container, className, children, ...props }: PopoverContentProps): ReactElement
  // either aria-label or aria-labelledby
  aria-label: string
  className?: string  // Layout only (`w-96`, `mt-2`)
  container?: HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null  // Where the panel renders
  aria-labelledby: string
```

## `popoverContentVariants`

Part `popover-content`.

No variant axes.

## Slots

- `popover-trigger`
- `popover-content`
