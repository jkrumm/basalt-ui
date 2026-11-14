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
moves it with CSS; the swipe-to-dismiss axis follows the same width from a media query that
reads as narrow on the server and during hydration, so server and client markup never differ.
Open state stays with the caller or the trigger, or binds to a handle: `state` is a boolean field
(open while true) or a string field (open while non-empty, the record a URL names), and closing
calls its `clear()`, as `PageAside`'s `state` does. A string-bound sheet opens by writing the
field (a `SheetTrigger` cannot name a record), a boolean-bound one also by its trigger. Works with no provider.

## `sheetContentVariants`

Part `sheet-content`.

- `placement`: `bottom`, `right`, `auto` (default `auto`)

## Slots

- `sheet-trigger`
- `sheet-content`
- `sheet-title`
- `sheet-close`
