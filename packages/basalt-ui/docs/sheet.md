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
moves it with the width: one media query read picks the edge and the swipe-to-dismiss axis, and
it reads as narrow on the server and during hydration, so server and client markup never differ.
Open state stays with the caller or the trigger, or binds to a handle: `state` is a boolean field
(open while true) or a string field (open while non-empty, the record a URL names), and closing
calls its `clear()`, as `PageAside`'s `state` does. A string-bound sheet opens by writing the
field (a `SheetTrigger` cannot name a record), a boolean-bound one also by its trigger. Works with no provider.

## Props

### `Sheet`

A panel beside the page on Base UI Drawer: edit a record without leaving it. `placement="auto"`
moves it with the width: one media query read picks the edge and the swipe-to-dismiss axis, and
it reads as narrow on the server and during hydration, so server and client markup never differ.
Open state stays with the caller or the trigger, or binds to a handle: `state` is a boolean field
(open while true) or a string field (open while non-empty, the record a URL names), and closing
calls its `clear()`, as `PageAside`'s `state` does. A string-bound sheet opens by writing the
field (a `SheetTrigger` cannot name a record), a boolean-bound one also by its trigger. Works with no provider.

```ts
Sheet(props: SheetProps): ReactElement
  // either state or neither
  placement?: Placement  // The edge it opens from
  state?: SheetState  // Open while the handle is `true` (boolean) or non-empty (string); closing calls `clear()`
  open?: never
  defaultOpen?: never
  onOpenChange?: never
```

### `SheetTrigger`

The element that opens a `Sheet`. It carries no look of its own: pass `render={<Button />}`.

```ts
SheetTrigger({ className, ...props }: SheetTriggerProps): ReactElement
  className?: string  // Layout only (`w-120`, `mt-2`)
```

### `SheetContent`

The sheet panel with its backdrop. `title` is required and names the sheet; the corner close
button is named by the `sheet.close` message.

```ts
SheetContent({ title, className, children, ...props }: SheetContentProps): ReactElement
  className?: string  // Layout only (`w-120`, `mt-2`)
  title: ReactNode  // The accessible name and the visible heading
```

### `SheetTitle`

The sheet's heading. `SheetContent` renders it from its `title`.

```ts
SheetTitle({ className, ...props }: SheetTitleProps): ReactElement
  className?: string  // Layout only (`w-120`, `mt-2`)
```

### `SheetClose`

Closes the sheet. With no children it is the corner glyph, named by the `sheet.close` message;
with children it is a bare close trigger: pass `render={<Button />}` for a Cancel button.

```ts
SheetClose({ className, children, ...props }: SheetCloseProps): ReactElement
  className?: string  // Layout only (`w-120`, `mt-2`)
```

## `sheetContentVariants`

Part `sheet-content`.

- `placement`: `bottom`, `right`, `auto` (default `auto`); not a prop of `SheetContent`, which resolves it itself

## Slots

- `sheet-trigger`
- `sheet-content`
- `sheet-title`
- `sheet-close`
