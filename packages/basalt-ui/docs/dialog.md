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

## Props

### `Dialog`

```ts
Dialog(props: DialogProps): ReactElement
```

### `DialogTrigger`

The element that opens a `Dialog`. It carries no look of its own: pass `render={<Button />}`.

```ts
DialogTrigger({ className, ...props }: DialogTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `DialogContent`

The dialog panel with its backdrop, a light wash of the canvas so the page stays readable behind
it. `title` is required and names the dialog; `description` is optional. The corner close button
is part of the panel and named by the `dialog.close` message. A viewer adds `meta` (a muted line)
and `actions` (icon buttons) to the header. `size="split"` is the wizard panel: no header and no
padding, the title and description are read by assistive tech only, and the children (a
`WizardDialog`) draw their own top bar with a `DialogClose`.

```ts
DialogContent({ title, description, meta, actions, size, form, present, className, children, ...props }: DialogContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
  title: ReactNode  // The accessible name and the visible heading
  description?: ReactNode  // One sentence under the title; it also describes the dialog to assistive tech
  size?: "sm" | "md" | "lg" | "wide" | "split" | null
  meta?: ReactNode  // A muted line under the title, such as a file's size and date
  actions?: readonly DialogAction[]  // Icon actions between the title and the close, at most four
  form?: boolean  // The panel holds a form (or, at `size="split"`, the wizard): on a phone (compact width, coarse pointer) it opens as a full-height sheet from the bottom instead of centred
  present?: OverlayPresent  // Forces the presentation: `popup` centred, `sheet` full height from the bottom, `auto` by `form` and the viewport
```

### `DialogTitle`

The dialog's heading. `DialogContent` renders it from its `title`; use it directly only inside
a hand-built popup.

```ts
DialogTitle({ className, ...props }: DialogTitleProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `DialogDescription`

The dialog's lead-in sentence. `DialogContent` renders it from its `description`.

```ts
DialogDescription({ className, ...props }: DialogDescriptionProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `DialogClose`

Closes the dialog. With no children it is the corner glyph, named by the `dialog.close` message;
with children it is a bare close trigger: pass `render={<Button />}` for a Cancel button.

```ts
DialogClose({ className, children, ...props }: DialogCloseProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `AlertDialog`

A confirmation that needs an explicit answer: it has no corner close and an outside click does
not dismiss it. Use it for a destructive confirm; otherwise use `Dialog`.

```ts
AlertDialog(props: AlertDialogProps): ReactElement
```

### `AlertDialogTrigger`

The element that opens an `AlertDialog`. It carries no look of its own: pass `render`.

```ts
AlertDialogTrigger({ className, ...props }: AlertDialogTriggerProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
```

### `AlertDialogContent`

The alert panel: required `title`, optional `description`, and the answers as children (each a
`DialogClose`).

```ts
AlertDialogContent({ title, description, className, children, ...props }: AlertDialogContentProps): ReactElement
  className?: string  // Layout only (`w-full`, `mt-2`)
  title: ReactNode  // The accessible name and the visible heading
  description?: ReactNode  // One sentence under the title; it also describes the dialog to assistive tech
```

## `dialogContentVariants`

Part `dialog-content`.

- `size`: `sm`, `md`, `lg`, `wide`, `split` (default `md`)

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
