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

## `popoverContentVariants`

Part `popover-content`.

No variant axes.

## Slots

- `popover-trigger`
- `popover-content`
