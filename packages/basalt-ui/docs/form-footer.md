---
name: FormFooter
use when: 'a submit form needs Cancel and Save'
never when: 'the form saves as you type, or the page already has a bar action for it'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-footer, form-footer-actions, form-footer-error, form-footer-status]
---

# FormFooter

The action row under a form's fields. The primary submits the form; it stays enabled while the
form is invalid or unchanged and is disabled only while it submits. A server error returned by
`toSubmitErrors` shows under the row.

## Signature

```ts
FormFooter<const A extends readonly FormAction[]>({ form, actions, sticky, floating, className, }: { form: FormLike<unknown>; actions: A & ValidActions<A>; sticky?: boolean; floating?: boolean; className?: string; }): ReactElement
  form: FormLike<unknown>
  actions: A & ValidActions<A>
  sticky?: boolean  // Keeps the row at the bottom of the scrollport while the form scrolls, on a band of its own, and reads `Unsaved changes` while the form is dirty: the save of a long settings page
  floating?: boolean  // The unsaved bar: a raised bar that floats at the bottom of the scrollport and is there only while the form is dirty or saving (Discard, Save)
  className?: string  // Layout only (`mt-4`, `w-full`)
```

`FormAction`, `FormLike` import from `basalt-ui/controls`: `import type { FormAction, FormLike } from 'basalt-ui/controls'`.

## Example

```tsx
<FormFooter form={form} actions={[{ label: 'Cancel', onClick: close }, { label: 'Save', primary: true }]} />
<FormFooter sticky form={form} actions={[{ label: 'Discard', onClick: reset }, { label: 'Save settings', primary: true }]} />
```
