---
name: FormConfirmRow
use when: 'an action deletes or transfers something that cannot be restored (a workspace, an account)'
never when: 'the action can be undone, or an AlertDialog already confirms it'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [form-confirm-row]
---

# FormConfirmRow

A destructive row that asks for its name: an input labelled with the text to type, and a button
that stays disabled until the typed text matches `confirmText`. Danger tone by default. The input
is a plain field, so it has the label, the control height and the one focus ring of every row.

## Signature

```ts
FormConfirmRow({ label, description, icon, id, tone, confirmText, actionLabel, onConfirm, className, }: FormConfirmRowProps): ReactElement
  label: NonNullable<ReactNode>  // The row's name
  description?: ReactNode  // Help text under the label
  icon?: IconComponent  // An icon tile at the start of the row
  id?: string  // A stable id for the row, a target for a link (`#row-delete`): `SettingsLayout` scrolls to it and marks it once
  tone?: SettingsRowTone  // `danger` reads in the verdict color
  className?: string  // Layout only (`w-full`)
  confirmText: string  // The text the person types to arm the button: the workspace's name, `delete`
  actionLabel: string  // The button's text, naming the act: `Delete workspace`
  onConfirm: () => void | Promise<void>  // Runs once the typed text matches and the button is pressed; the field clears when it resolves
```

`FormConfirmRowProps`, `SettingsRowTone` import from `basalt-ui/controls`: `import type { FormConfirmRowProps, SettingsRowTone } from 'basalt-ui/controls'`.

`IconComponent` import from `basalt-ui`: `import type { IconComponent } from 'basalt-ui'`.

## Example

```tsx
<FormConfirmRow label="Delete workspace" description="Removes every project." confirmText="acme" actionLabel="Delete workspace" onConfirm={remove} />
```
