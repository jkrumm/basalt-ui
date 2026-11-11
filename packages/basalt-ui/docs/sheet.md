---
name: Sheet
use when: 'a record is edited or inspected beside the page and the page behind stays in view (modal decision: `Dialog`)'
never when: 'the question is a yes or no (use `Dialog`, or `AlertDialog` for a destructive confirm)'
subpath: basalt-ui/ui/sheet
peers: ['@base-ui/react']
slots: [sheet-trigger, sheet-content, sheet-title, sheet-close]
---

# Sheet

A panel beside the page on Base UI Drawer: edit a record without leaving it. `placement="auto"`
moves it with CSS; the swipe-to-dismiss axis is read once when it opens, so server and client
markup never differ. Open state stays with the caller or the trigger. Works with no provider.

## `sheetContentVariants`

Part `sheet-content`.

- `placement`: `bottom`, `right`, `auto` (default `auto`)

## Slots

- `sheet-trigger`
- `sheet-content`
- `sheet-title`
- `sheet-close`
