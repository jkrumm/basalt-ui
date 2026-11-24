---
name: withForm
use when: 'a long form splits into components that each render some of its fields'
never when: 'the fields fit the one component that calls `useAppForm`'
subpath: basalt-ui/form
peers: ['@base-ui/react', '@tanstack/react-form']
slots: []
---

# withForm

A component that renders part of a form passed to it: a section of a long form, one step of a
`Stepper` form. `defaultValues` only types the form.

## Signature

```ts
withForm<TFormData, TOnMount extends FormValidateOrFn<TFormData> | undefined, TOnChange extends FormValidateOrFn<TFormData> | undefined, TOnChangeAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnBlur extends FormValidateOrFn<TFormData> | undefined, TOnBlurAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnSubmit extends FormValidateOrFn<TFormData> | undefined, TOnSubmitAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnDynamic extends FormValidateOrFn<TFormData> | undefined, TOnDynamicAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnServer extends FormAsyncValidateOrFn<TFormData> | undefined, TSubmitMeta, TRenderProps extends object = {}>({ render, props, }: WithFormProps<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta, { readonly FormField: (props: BoundFormFieldProps) => ReactElement; }, { readonly Form: ({ className, meta, children }: FormProps) => ReactElement; readonly Footer: <const A extends readonly FormAction[]>({ actions, sticky, floating, className, }: FooterProps<A>) => ReactElement; }, TRenderProps>): FunctionComponent<PropsWithChildren<NoInfer<UnwrapOrAny<TRenderProps>> & { form: AppFieldExtendedReactFormApi<UnwrapOrAny<TFormData>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnMount>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnChange>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnChangeAsync>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnBlur>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnBlurAsync>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnSubmit>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnSubmitAsync>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnDynamic>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnDynamicAsync>, UnwrapDefaultOrAny<FormValidateOrFn<TFormData> | undefined, TOnServer>, UnwrapOrAny<TSubmitMeta>, { readonly FormField: (props: BoundFormFieldProps) => ReactElement; }, { readonly Form: ({ className, meta, children }: FormProps) => ReactElement; readonly Footer: <const A extends readonly FormAction[]>({ actions, sticky, floating, className, }: FooterProps<A>) => ReactElement; }>; }>>
```

`BoundFormFieldProps`, `FooterProps`, `FormProps` import from `basalt-ui/form`: `import type { BoundFormFieldProps, FooterProps, FormProps } from 'basalt-ui/form'`.

## Example

```tsx
const Contact = withForm({ defaultValues, render: function Render({ form }) { return <form.AppField name="email">…</form.AppField> } })
```
