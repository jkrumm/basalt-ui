---
name: Toast
use when: 'a result needs a short, passing note the user can ignore (toast vs inline vs inbox)'
never when: 'the message must be read to continue (use `Dialog`) or belongs next to a field (use inline `FieldError`)'
subpath: basalt-ui/ui/toast
peers: ['@base-ui/react']
slots: [toast-viewport, toast, toast-title, toast-description, toast-close]
---

# Toast

One toast: the surface with its `tone` edge. Pass the queue's toast object as `toast`.

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
