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
  // either field or control
  field?: FieldLike<T>  // A TanStack Form field, or any `FieldLike`: submit forms
  control?: ControlHandle<T>  // A store `ControlHandle`: instant-apply preferences
  label: NonNullable<ReactNode>  // The visible name of the control
  description?: ReactNode  // Help text under the control, wired to it through `aria-describedby`
  required?: boolean  // Marks the control required: a `*` glyph for the eye and `required` on the control
  disabled?: boolean  // Disables the control
  className?: string  // Layout only (`w-full`, `max-w-sm`)
  children: ReactElement<unknown, string | JSXElementConstructor<any>>  // The bare control: an `Input`, a `Select`, a `Switch`, a `Checkbox`, a `NumberField`, a `Slider`
```

## Example

```tsx
<form.Field name="title" children={(f) => (
  <FormField label="Title" description="Shown in the list." required field={f}>
    <Input />
  </FormField>
)} />
```

## Example

```tsx
<FormField label="Compact rows" control={prefs.compact}><Switch /></FormField>
```
