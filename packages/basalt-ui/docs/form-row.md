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
  legend?: ReactNode
  disabled?: boolean
  className?: string
  children: ReactNode
```
