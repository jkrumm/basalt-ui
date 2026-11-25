---
name: PreviewCard
use when: 'a link to a record or a page should show a summary of it on hover, focus and tap, before it is followed'
never when: 'the content is a definition of a word (use `InfoHint`), a form or actions (use `Popover`) or a one-line label (use `Tooltip`)'
subpath: basalt-ui/ui/preview-card
peers: ['@base-ui/react']
slots: [preview-card-trigger, preview-card-content]
---

# PreviewCard

A rich card on a link, on Base UI: the card opens beside the link on mouse hover and on keyboard
focus, and on a first touch tap (the second tap follows the link); Escape, leaving, blur and an
outside press close it. It is always portalled above the page and works with no provider.

## Props

### `PreviewCard`

```ts
PreviewCard({ open: openProp, defaultOpen, onOpenChange, children, }: PreviewCardProps): ReactElement
  open?: boolean  // Controlled open state; pair it with `onOpenChange`
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
```

### `PreviewCardTrigger`

The link the card hangs off: an `<a>` that carries no look of its own, so give it the app's link
class. `delay` and `closeDelay` (ms) set the hover timing. A touch tap on it opens the card
instead of following the link; a tap while the card is open follows it, as does a click, Enter or
a press with a mouse, which also closes the card.

```ts
PreviewCardTrigger({ className, onPointerDown, onPointerCancel, onClick, ...props }: PreviewCardTriggerProps): ReactElement
  className?: string  // Layout only (`w-80`, `mt-2`)
```

### `PreviewCardContent`

The card, portalled and positioned by Base UI on the popup surface. It takes the summary: a few
lines of text and facts, no buttons or links, since a touch or keyboard user may never see it.

```ts
PreviewCardContent({ anchor, side, align, sideOffset, alignOffset, container, className, children, ...props }: PreviewCardContentProps): ReactElement
  className?: string  // Layout only (`w-80`, `mt-2`)
  container?: HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null  // Where the card renders
```

## Slots

- `preview-card-trigger`
- `preview-card-content`
