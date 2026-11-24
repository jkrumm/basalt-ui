---
name: FormGroupRow
use when: 'one setting fans out into several switches or fields (a notification category and its channels)'
never when: 'the revealed content is a page of its own (InnerNav), or the group is always visible (FormSection)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-group-row, form-group-row-panel, form-group-row-trigger]
---

# FormGroupRow

An expandable row: the closed row is a label, a description and a summary at the start and a
chevron at the end; opened, it reveals a list of rows (usually switches) under a hairline. The
revealed rows stay mounted while closed, so a bound value and the browser's find keep working.
This is a row, not a section: a page of many groups splits with `InnerNav`, never collapsible
sections.

## Signature

```ts
FormGroupRow({ label, description, icon, id, summary, defaultOpen, className, children, }: FormGroupRowProps): ReactElement
  className?: string  // Layout only (`w-full`)
  label: NonNullable<ReactNode>  // The row's name
  icon?: IconComponent  // An icon tile at the start of the row
  description?: ReactNode  // Help text under the label
  id?: string  // A stable id for the row, a target for a link (`#row-delete`): `SettingsLayout` scrolls to it and marks it once
  summary?: ReactNode  // A muted word or two at the end of the closed row (`3 of 5 on`)
  defaultOpen?: boolean  // Opens the row at first
  children: ReactNode  // The rows revealed: `FormField`s (switches), one per line, divided by hairlines
```

`FormGroupRowProps` import from `basalt-ui/controls`: `import type { FormGroupRowProps } from 'basalt-ui/controls'`.

## Example

```tsx
<FormGroupRow label="Deploys" description="Pipeline results." summary="2 of 3 on">
  <FormField label="Succeeded" control={a}><Switch /></FormField>
  <FormField label="Failed" control={b}><Switch /></FormField>
</FormGroupRow>
```
