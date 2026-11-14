---
name: FormFooter
use when: 'a submit form needs Cancel and Save'
never when: 'the form saves as you type, or the page already has a bar action for it'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-footer, form-footer-actions, form-footer-error]
---

# FormFooter

The action row under a form's fields. The primary submits the form and is disabled on `!canSubmit`;
a server error returned by `toSubmitErrors` shows under the row.

## Signature

```ts
FormFooter<const A extends readonly FormAction[]>({ form, actions, className, }: { form: FormLike<unknown>; actions: A & ValidActions<A>; className?: string; }): ReactElement
  form: FormLike<unknown>
  actions: A & ValidActions<A>
  className?: string
```
