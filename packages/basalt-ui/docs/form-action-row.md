---
name: FormActionRow
use when: 'a settings row runs a command (export, revoke, reset) and holds no value'
never when: 'the row stores a value (FormField), or the action destroys data (FormConfirmRow)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-action-row]
---

# FormActionRow

A row whose control is an action, not a value: `Export data`, `Revoke key`, `Delete workspace`.
The label and description sit at the start, the button at the end, stacked below the regular tier.
A destructive action that cannot be undone asks for the name first: `FormConfirmRow`.

## Signature

```ts
FormActionRow({ label, description, icon, id, tone, action, className, }: FormActionRowProps): ReactElement
  label: NonNullable<ReactNode>  // The row's name
  description?: ReactNode  // Help text under the label
  icon?: IconComponent  // An icon tile at the start of the row
  id?: string  // A stable id for the row, a target for a link (`#row-delete`): `SettingsLayout` scrolls to it and marks it once
  tone?: SettingsRowTone  // `danger` reads in the verdict color
  className?: string  // Layout only (`w-full`)
  action: ReactNode  // The control at the end of the row: a `Button` (`variant="danger"` for a destructive one)
```

`FormActionRowProps`, `SettingsRowTone` import from `basalt-ui/controls`: `import type { FormActionRowProps, SettingsRowTone } from 'basalt-ui/controls'`.

`IconComponent` import from `basalt-ui`: `import type { IconComponent } from 'basalt-ui'`.

## Example

```tsx
<FormActionRow label="Export data" description="A CSV of every record." action={<Button onClick={run}>Export</Button>} />
```
