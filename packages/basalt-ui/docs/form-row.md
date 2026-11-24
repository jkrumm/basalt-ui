---
name: FormRow
use when: 'two or three related fields share a line, or a field array repeats a row'
never when: 'a single field stands alone: `FormField` already stacks its parts'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-row, form-row-fields]
---

# FormRow

A row of `FormField`s that lays itself out by its container: one column narrow, one equal column
per field from `@regular`. Repeat it for an array, keyed by a stable id in the value.

## Signature

```ts
FormRow({ legend, disabled, className, children }: FormRowProps): ReactElement
  legend?: ReactNode  // Names the row for assistive technology and shows above it: `Line 2` for a repeated row
  disabled?: boolean  // Disables every field of the row
  className?: string  // Layout only (`w-full`, `max-w-2xl`)
  children: ReactNode  // The row's `FormField`s
```

`FormRowProps` import from `basalt-ui/controls`: `import type { FormRowProps } from 'basalt-ui/controls'`.

## Example

```tsx
<FormRow legend="Line 1">
  <FormField label="Item" field={item}><Input /></FormField>
  <FormField label="Quantity" field={qty}><NumberField /></FormField>
</FormRow>
```
