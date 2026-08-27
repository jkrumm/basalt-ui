/**
 * `ToggleFilter` — a boolean field as one pill (`docs/CONTROLS-SPEC.md` §3). The only filter whose
 * pill has no popover: there is nothing to choose, so the pill IS the control and a press flips it.
 * In the sheet it becomes a `Switch` row, where a 44px row with an explicit on/off affordance reads
 * better than a chip whose state is a border colour.
 *
 * @example
 * // errorsOnly: field.boolean(false)
 * <ToggleFilter field={filters.field.errorsOnly} label="Errors only" />
 */
import { Switch } from '@mantine/core'
import type { ReactNode } from 'react'
import type { BooleanField, FieldHandle } from '../state'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { sheetRowClassNames } from './filter-sheet'

export type ToggleFilterProps = {
  readonly field: FieldHandle<BooleanField>
  readonly label: string
  readonly icon?: ReactNode
}

export function ToggleFilter({ field, label, icon }: ToggleFilterProps): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  useFilterRegistration(!field.isDefault(value), () => {
    field.clear()
  })

  if (surface === 'sheet') {
    // The `Switch` IS the row — no wrapping div. `sheetRowClassNames` stretches its own `<label>`
    // across the full 44px, so the whole row is the touch target rather than the middle 20px of it
    // (C15). A wrapper div would put the height on a non-interactive box instead.
    return (
      <Switch
        classNames={sheetRowClassNames}
        checked={value}
        label={label}
        labelPosition="left"
        onChange={(event) => {
          setValue(event.currentTarget.checked)
        }}
      />
    )
  }

  return (
    <FilterPill
      label={label}
      active={value}
      pressed={value}
      hideGlyph
      {...(icon !== undefined && { icon })}
      onClick={() => {
        setValue(!value)
      }}
    />
  )
}
