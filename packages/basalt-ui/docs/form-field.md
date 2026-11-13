---
name: FormField
use when: 'a form control needs a label, a description or an error'
never when: 'the control is a filter: `spec` and a `ControlHome` draw it'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# FormField

A labelled control with a description, an always-mounted error region, a required mark and, for a
`control`, a dot while it differs from its default. Pass `field` in a submit form and `control` for
an instant-apply preference; passing both, or no `label`, is a type error.

## Signature

```ts
FormField<T>(props: FormFieldProps<T>): ReactElement
  one of: field | control
  field: FieldLike<T>
  control: ControlHandle<T>
  label: NonNullable<ReactNode>
  description?: ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  children: ReactElement<unknown, string | JSXElementConstructor<any>>
```
