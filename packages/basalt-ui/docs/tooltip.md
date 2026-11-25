---
name: Tooltip
use when: 'an icon or a clipped value needs a one-line name on hover, focus or a long press'
never when: 'the content is interactive, longer than a line, or the only place a fact lives (use `Popover`)'
subpath: basalt-ui/ui/tooltip
peers: ['@base-ui/react']
slots: [tooltip]
---

# Tooltip

A short label on a trigger, on Base UI: it opens on hover after `delay` and on keyboard focus at
once, closes on Escape, blur or leave, and is always portalled above the page. The label is a
string and a visual aid only: it is not the trigger's accessible name, so an icon-only button
keeps its own `aria-label`. Works with no provider.

## Props

### `Tooltip`

```ts
Tooltip({ label, children, delay, closeDelay, side, align, sideOffset, className, open: controlled, onOpenChange, ...root }: TooltipProps): ReactElement
  label: string  // The text
  children: ReactElement<unknown, string | React.JSXElementConstructor<any>>  // The element the label names; it receives the hover and focus handlers
  delay?: number  // Milliseconds of hover before it opens
  closeDelay?: number  // Milliseconds before it closes once the pointer leaves
  className?: string  // Layout only (`max-w-sm`)
```

## `tooltipVariants`

Part `tooltip`.

No variant axes.

## Slots

- `tooltip`
