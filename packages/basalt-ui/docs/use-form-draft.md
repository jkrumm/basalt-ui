---
name: useFormDraft
use when: 'a submit-and-leave form with a textarea or more than three fields can be lost to a reload'
never when: 'the form is an instant-apply preference (`persisted`) or a settings form with a Save action'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# useFormDraft

Keeps an unfinished form across a reload. The form's `defaultValues` stay the server value
(`keepDefaultValues`), so the form is dirty against the server while a draft is applied.

## Signature

```ts
useFormDraft<V>(form: FormLike<V>, o: UseFormDraftOptions<V>): UseFormDraftResult
  state: { values: V; isSubmitting: boolean; canSubmit: boolean; err…
  options: { defaultValues?: V; }
  store: { subscribe(cb: () => void): { unsubscribe(): void; }; }
  reset: (values: V, o?: { keepDefaultValues?: boolean; }) => void
```
