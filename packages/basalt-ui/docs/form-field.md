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
  control?: ControlSource<T>  // A store `ControlHandle` (instant-apply preferences, a dot while it is not the default) or any handle with `use()`, such as a synced state's `field(key)`: the row applies at once
  label: NonNullable<ReactNode>  // The visible name of the control
  description?: ReactNode  // Help text under the control, wired to it through `aria-describedby`
  required?: boolean  // Marks the control required: a `*` glyph for the eye and `required` on the control
  disabled?: boolean  // Disables the control
  layout?: FormFieldLayout  // `stack` puts the label over the control; `row` is the settings row, label and description at the start and the control at the end, stacking when the field is narrow
  id?: string  // A stable id for the row, a target for a link (`#row-digest`): `SettingsLayout` scrolls to it and marks it once
  icon?: IconComponent  // An icon tile at the start of the row, `layout="row"` only
  className?: string  // Layout only (`w-full`, `max-w-sm`)
  children: ReactElement<unknown, string | JSXElementConstructor<any>>  // The bare control: an `Input`, a `Select`, a `Switch`, a `Checkbox`, a `NumberField`, a `Slider`
```

`FormFieldLayout`, `FormFieldProps` import from `basalt-ui/controls`: `import type { FormFieldLayout, FormFieldProps } from 'basalt-ui/controls'`.

`FieldLike`, `IconComponent` import from `basalt-ui`: `import type { FieldLike, IconComponent } from 'basalt-ui'`.

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
