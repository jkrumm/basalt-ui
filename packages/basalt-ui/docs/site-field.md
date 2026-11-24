---
name: SiteField
use when: 'a `SiteForm` needs one labelled text, email, number or multi-line field'
never when: 'the choice is a select, a date or a file (write the native element in the form, or use `basalt-ui/form` in an app)'
subpath: basalt-ui/static
peers: [react]
slots: [field]
---

# SiteField

A label, a native input or textarea and an optional hint. The hint sits above the control's
autofill popover and is read with the field.

## Signature

```ts
SiteField({ label, name, type, autoComplete, required, description, placeholder, inputMode, rows, className, }: SiteFieldProps): ReactElement
  label: string  // The visible label
  name: string  // The submitted name; also the id the label points at
  type?: "number" | "text" | "search" | "textarea" | "email" | "url" | "tel"  // Default `text`
  autoComplete: string  // The autofill token (`email`, `name`, `off`): every field names one
  required?: boolean
  description?: string  // A hint under the field, linked to it for a screen reader
  placeholder?: string
  inputMode?: "text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal"  // The on-screen keyboard (`numeric`, `email`) for a field whose `type` is not enough
  rows?: number  // Rows of a `textarea`
  className?: string
```

`SiteFieldProps` import from `basalt-ui/static`: `import type { SiteFieldProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteField label="Message" name="message" type="textarea" autoComplete="off" required />
```
