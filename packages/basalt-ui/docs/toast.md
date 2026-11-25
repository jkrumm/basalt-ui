---
name: Toast
use when: 'a result needs a short, passing note the user can ignore (toast vs inline vs inbox)'
never when: 'the message must be read to continue (use `Dialog`) or belongs next to a field (use inline `FieldError`)'
subpath: basalt-ui/ui/toast
peers: ['@base-ui/react']
slots: [toast-viewport, toast, toast-title, toast-description, toast-close]
---

# Toast

One toast: the surface with its `tone` dot. Pass the queue's toast object as `toast`.

## Props

### `ToastViewport`

The live region that holds the toasts, portalled to the page edge above every popup. Named by
the `toast.viewport` message. It reads a Base UI toast manager, so it renders inside a Base UI
`Toast.Provider`; the app-level `ToastHost` that owns the provider and feeds the queue lands with
`notify`.

```ts
ToastViewport({ className, ...props }: ToastViewportProps): ReactElement
  className?: string  // Layout only (`mt-2`)
```

### `Toast`

```ts
Toast({ tone, className, ...props }: ToastProps): ReactElement
  className?: string  // Layout only (`mt-2`)
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | null
```

### `ToastTitle`

The toast's headline; it renders the toast's own title when given no children.

```ts
ToastTitle({ className, ...props }: ToastTitleProps): ReactElement
  className?: string  // Layout only (`mt-2`)
```

### `ToastDescription`

The toast's detail line; it renders the toast's own description when given no children.

```ts
ToastDescription({ className, ...props }: ToastDescriptionProps): ReactElement
  className?: string  // Layout only (`mt-2`)
```

### `ToastClose`

Dismisses the toast. With no children it is the corner glyph, named by the `toast.dismiss`
message.

```ts
ToastClose({ className, children, ...props }: ToastCloseProps): ReactElement
  className?: string  // Layout only (`mt-2`)
```

## `toastViewportVariants`

Part `toast-viewport`.

No variant axes.

## `toastVariants`

Part `toast`.

- `tone`: `neutral`, `good`, `warn`, `bad`, `info` (default `neutral`)

## Slots

- `toast-viewport`
- `toast`
- `toast-title`
- `toast-description`
- `toast-close`
