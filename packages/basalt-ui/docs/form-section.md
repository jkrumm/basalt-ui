---
name: FormSection
use when: 'a settings or edit page groups more than a few fields under names a reader scans'
never when: 'the form is a short dialog (FormFields alone), or the group is a repeated line of an array (FormRow)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-section, form-section-body, form-section-footer, form-section-header]
---

# FormSection

A titled group of fields on a surface, one row per field divided by a hairline, with an optional
footer band. Its fields default to the settings row: label and description at the start, the
control at the end, stacked when the section is narrow.

## Signature

```ts
FormSection({ title, description, layout, disabled, footer, className, children, }: FormSectionProps): ReactElement
  title: NonNullable<ReactNode>  // The section's name: the fieldset's legend, shown at the top of the surface
  description?: ReactNode  // One line under the title saying what the group controls; wired as the group's description
  layout?: FormFieldLayout  // The layout of every `FormField` inside that names none
  disabled?: boolean  // Disables every field of the section
  footer?: ReactNode  // A band at the bottom of the surface: a `FormFooter` when this section saves on its own (a form of one section), never a second save inside a larger form
  className?: string  // Layout only (`w-full`, `max-w-3xl`)
  children: ReactNode  // The section's `FormField`s and `FormRow`s; each becomes one row of the surface
```

## Example

```tsx
<FormSection title="Deploys" description="How a merge reaches production.">
  <FormField label="Deploy main on push" field={autoDeploy}><Switch /></FormField>
  <FormField label="Parallel deploys" field={parallel}><NumberField /></FormField>
</FormSection>
```
