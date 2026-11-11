---
name: Dialog
use when: 'a modal decision or a short form interrupts the page; a destructive confirm is `AlertDialog` (modal decision: `Dialog`, edit beside the page: `Sheet`, name an icon: `Tooltip`, anywhere else: `Popover`)'
never when: 'the content is a long edit beside the page (use `Sheet`) or a hint on a trigger (use `Popover` or `Tooltip`)'
subpath: basalt-ui/ui/dialog
peers: ['@base-ui/react']
slots: [dialog-trigger, dialog-content, dialog-title, dialog-description, dialog-close, alert-dialog-trigger, alert-dialog-content]
---

# Dialog

A modal dialog on Base UI: focus is trapped, Escape and the corner close dismiss it, and it is
always portalled above the page. Open state stays with the caller (`open`/`onOpenChange`) or the
trigger. Works with no provider.

## `dialogContentVariants`

Part `dialog-content`.

- `size`: `sm`, `md`, `lg` (default `md`)

## `alertDialogContentVariants`

Part `alert-dialog-content`.

No variant axes.

## Slots

- `dialog-trigger`
- `dialog-content`
- `dialog-title`
- `dialog-description`
- `dialog-close`
- `alert-dialog-trigger`
- `alert-dialog-content`
