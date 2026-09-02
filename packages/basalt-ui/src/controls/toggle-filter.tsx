/**
 * `ToggleFilter` — a boolean field as one pill (`docs/CONTROLS-SPEC.md` §3). The only filter whose
 * pill has no popover: there is nothing to choose, so the pill IS the control and a press flips it.
 * In the sheet it becomes a `Switch` row, where a 44px row with an explicit on/off affordance reads
 * better than a chip whose state is a border colour.
 *
 * In the aside `panel` it is the ONE row whose control rides the label line (`docs/ASIDE-SPEC.md`
 * §3): a switch is atomic and needs no width, so the label-above law that every other panel row
 * follows would only cost it a second line.
 *
 * @example
 * // errorsOnly: field.boolean(false)
 * <ToggleFilter field={filters.field.errorsOnly} label="Errors only" />
 */
import { Switch } from '@mantine/core'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { BooleanField, FieldHandle } from '../state'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { sheetRowClassNames } from './filter-sheet'
import { PanelRow } from './panel-row'

export type ToggleFilterProps = BasaltProps & {
  readonly field: FieldHandle<BooleanField>
  readonly label: string
  readonly icon?: ReactNode
}

export function ToggleFilter(props: ToggleFilterProps): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces as `undefined is not an object
  // (evaluating 'field.use')`, caught by `BasaltErrorBoundary`.
  assertRequiredProps('ToggleFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, label, icon, className, style } = props
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  useFilterRegistration(!field.isDefault(value), () => {
    field.clear()
  })

  if (surface === 'panel') {
    return (
      <PanelRow
        label={label}
        end={
          <Switch
            aria-label={label}
            checked={value}
            onChange={(event) => {
              setValue(event.currentTarget.checked)
            }}
          />
        }
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      />
    )
  }

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
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
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
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}
