---
name: FormSection
use when: 'a settings or edit page groups more than a few fields under names a reader scans'
never when: 'the form is a short dialog (FormFields alone), or the group is a repeated line of an array (FormRow)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-section, form-section-action, form-section-body, form-section-box, form-section-footer, form-section-header, form-section-locked, form-section-title]
---

# FormSection

A titled group of settings rows: the heading row, then one bordered box of rows divided by
hairlines, with an optional footer band. Its fields default to the settings row: label and
description at the start, the control at the end, stacked when the section is narrow.

## Signature

```ts
FormSection({ title, description, badge, action, id, locked, layout, disabled, phase, footer, className, children, }: FormSectionProps): ReactElement
  title: NonNullable<ReactNode>  // The section's name: the heading row's title and the group's accessible name
  description?: ReactNode  // One line under the title saying what the group controls; wired as the group's description
  badge?: ReactNode  // A chip beside the title (a plan, `Beta`): a `Lozenge`
  action?: ReactNode  // A button at the end of the heading row (`New field`)
  id?: string  // A stable id for the section, a target for a link (`#deploys`)
  locked?: ReactNode  // Locks the section behind a plan or a permission: the box is dimmed and inert, every field in it is disabled, and this node says why (`Enterprise plan`) beside a padlock
  layout?: FormFieldLayout  // The layout of every `FormField` inside that names none
  disabled?: boolean  // Disables every field of the section
  phase?: Phase | QueryStateLike  // The query the section's values wait on
  footer?: ReactNode  // A band at the bottom of the box: a `FormFooter` when this section saves on its own (a form of one section), never a second save inside a larger form
  className?: string  // Layout only (`w-full`, `max-w-3xl`)
  children: ReactNode  // The section's `FormField`s, `FormRow`s and settings rows; each becomes one row of the box
```

`Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.

`FormFieldLayout`, `FormSectionProps` import from `basalt-ui/controls`: `import type { FormFieldLayout, FormSectionProps } from 'basalt-ui/controls'`.

## Example

```tsx
<FormSection title="Deploys" description="How a merge reaches production.">
  <form.AppField name="autoDeploy">{(f) => <f.FormField label="Deploy main on push"><Switch /></f.FormField>}</form.AppField>
  <form.AppField name="parallel">{(f) => <f.FormField label="Parallel deploys"><NumberField /></f.FormField>}</form.AppField>
</FormSection>
```

## Example

```tsx
<FormSection title="Audit log" badge={<Lozenge tone="accent">Enterprise</Lozenge>} locked="Part of the Enterprise plan." action={<Button>See plans</Button>}>…</FormSection>
```
