---
name: useAppForm
use when: 'a submit form: a create or edit dialog, a settings page with a Save'
never when: 'the control applies at once (a `FormField control={handle}` on a store), or it filters a view (a `FilterSet`)'
subpath: basalt-ui/form
peers: ['@base-ui/react', '@tanstack/react-form']
slots: []
---

# useAppForm

A TanStack form with basalt's parts: `f.FormField` on every `form.AppField`, `form.Form` and
`form.Footer` inside `form.AppForm`. Takes `useForm`'s options; `validationLogic` defaults to
blur, then change after the first submit, so a schema goes on `onDynamic`.

## Signature

```ts
useAppForm<TFormData, TOnMount extends FormValidateOrFn<TFormData> | undefined, TOnChange extends FormValidateOrFn<TFormData> | undefined, TOnChangeAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnBlur extends FormValidateOrFn<TFormData> | undefined, TOnBlurAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnSubmit extends FormValidateOrFn<TFormData> | undefined, TOnSubmitAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnDynamic extends FormValidateOrFn<TFormData> | undefined, TOnDynamicAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnServer extends FormAsyncValidateOrFn<TFormData> | undefined, TSubmitMeta>(props: FormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>): AppFieldExtendedReactFormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta, { readonly FormField: (props: BoundFormFieldProps) => ReactElement; }, { readonly Form: ({ className, meta, children }: FormProps) => ReactElement; readonly Footer: <const A extends readonly FormAction[]>({ actions, sticky, floating, className, }: FooterProps<A>) => ReactElement; }>
```

`BoundFormFieldProps`, `FooterProps`, `FormProps` import from `basalt-ui/form`: `import type { BoundFormFieldProps, FooterProps, FormProps } from 'basalt-ui/form'`.

## Example

```tsx
const form = useAppForm({ defaultValues, validators: { onSubmitAsync: toSubmitErrors(save) }, onSubmit })
<form.AppForm><form.Form>
  <form.AppField name="name" validators={{ onDynamic: NAME }}>
    {(f) => <f.FormField label="Name" required><Input /></f.FormField>}
  </form.AppField>
  <form.Footer actions={[{ label: 'Save', primary: true }]} />
</form.Form></form.AppForm>
```
