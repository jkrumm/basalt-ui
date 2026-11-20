---
name: withFieldGroup
use when: 'the same set of fields appears in two or more forms'
never when: 'the fields belong to one form only (`withForm`), or the group needs a validator of its own'
subpath: basalt-ui/form
peers: ['@base-ui/react', '@tanstack/react-form']
slots: []
---

# withFieldGroup

A group of fields reused by more than one form (an address, a time window); mounted with
`fields="address"` or a key map.

## Signature

```ts
withFieldGroup<TFieldGroupData, TSubmitMeta, TRenderProps extends object = {}>({ render, props, defaultValues, }: WithFieldGroupProps<TFieldGroupData, { readonly FormField: (props: BoundFormFieldProps) => ReactElement; }, { readonly Form: ({ className, meta, children }: FormProps) => ReactElement; readonly Footer: <const A extends readonly FormAction[]>({ actions, sticky, className, }: FooterProps<A>) => ReactElement; }, TSubmitMeta, TRenderProps>): <TFormData, TFields extends DeepKeysOfType<TFormData, TFieldGroupData | null | undefined> | FieldsMap<TFormData, TFieldGroupData>, TOnMount extends FormValidateOrFn<TFormData> | undefined, TOnChange extends FormValidateOrFn<TFormData> | undefined, TOnChangeAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnBlur extends FormValidateOrFn<TFormData> | undefined, TOnBlurAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnSubmit extends FormValidateOrFn<TFormData> | undefined, TOnSubmitAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnDynamic extends FormValidateOrFn<TFormData> | undefined, TOnDynamicAsync extends FormAsyncValidateOrFn<TFormData> | undefined, TOnServer extends FormAsyncValidateOrFn<TFormData> | undefined, TFormSubmitMeta>(params: PropsWithChildren<NoInfer<TRenderProps> & { form: AppFieldExtendedReactFormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, unknown extends TSubmitMeta ? TFormSubmitMeta : TSubmitMeta, { readonly FormField: (props: BoundFormFieldProps) => ReactElement; }, { readonly Form: ({ className, meta, children }: FormProps) => ReactElement; readonly Footer: <const A extends readonly FormAction[]>({ actions, sticky, className, }: FooterProps<A>) => ReactElement; }> | AppFieldExtendedReactFieldGroupApi<unknown, TFormData, string | FieldsMap<unknown, TFormData>, any, any, any, any, any, any, any, any, any, any, unknown extends TSubmitMeta ? TFormSubmitMeta : TSubmitMeta, { readonly FormField: (props: BoundFormFieldProps) => ReactElement; }, { readonly Form: ({ className, meta, children }: FormProps) => ReactElement; readonly Footer: <const A extends readonly FormAction[]>({ actions, sticky, className, }: FooterProps<A>) => ReactElement; }>; fields: TFields; }>) => ReturnType<FunctionComponent>
```

## Example

```tsx
const Address = withFieldGroup({
  defaultValues: { street: '', city: '' },
  render: function Render({ group }) {
    return <group.AppField name="city">…</group.AppField>
  },
})
```
