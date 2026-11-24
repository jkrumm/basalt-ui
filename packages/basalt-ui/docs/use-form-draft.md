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
(`keepDefaultValues`), so the form is dirty against the server while a draft is applied. A
successful submit deletes the key and re-bases the form on the submitted values, however the app
closes it: the draft is deleted even when the save's own `onSuccess` unmounts the form mid-submit
(nothing is left to re-base then). A failed submit, a cancel and a reload keep it; `clear()` is
for a discard, not for a save. A stored draft equal to the form's default values is deleted on
mount instead of restored, so `status` stays `'none'`.

## Signature

```ts
useFormDraft<V>(form: FormLike<V>, o: UseFormDraftOptions<V>): UseFormDraftResult
  state: { values: V; isSubmitting: boolean; canSubmit: boolean; errors: unknown[]; isDirty?: boolean; }  // `errors` are form-level
  options: { defaultValues?: V; }  // Stays the server value under `keepDefaultValues`
  store: { subscribe(cb: () => void): { unsubscribe(): void; }; }
  reset: (values: V, o?: { keepDefaultValues?: boolean; }) => void
```

`FormLike`, `UseFormDraftOptions`, `UseFormDraftResult` import from `basalt-ui/controls`: `import type { FormLike, UseFormDraftOptions, UseFormDraftResult } from 'basalt-ui/controls'`.

## Example

```tsx
const form = useForm({ defaultValues, validators: { onSubmitAsync: toSubmitErrors(save) } })
const draft = useFormDraft(form, { key: `run-edit:${id}`, version: 1, schema: Schema, owner: userId })
// a successful submit clears the draft and re-bases the form itself (its isSubmitted and
// isSubmitSuccessful reset with it); `draft.clear()` is for a discard
```
