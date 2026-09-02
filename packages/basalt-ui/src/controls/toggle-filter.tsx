/**
 * `ToggleFilter` — a boolean field as one pill (`docs/CONTROLS-SPEC.md` §3). The only filter whose
 * pill has no popover: there is nothing to choose, so the pill IS the control and a press flips it.
 * The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a
 * Drawer") — a `PanelRow` whose control rides the label line, the ONE row every panel/sheet surface
 * draws that way (`docs/ASIDE-SPEC.md` §3): a switch is atomic and needs no width, so the
 * label-above law every other row follows would only cost it a second line.
 *
 * @example
 * // errorsOnly: field.boolean(false)
 * <ToggleFilter field={filters.field.errorsOnly} label="Errors only" />
 */
import { Switch } from '@mantine/core'
import { useId } from 'react'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { BooleanField, FieldHandle } from '../state'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
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
  const id = useId()
  useFilterRegistration(!field.isDefault(value), () => {
    field.clear()
  })

  // The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a
  // Drawer") — the switch rides the label line on both surfaces, the one row whose control does.
  if (surface === 'panel' || surface === 'sheet') {
    return (
      <PanelRow
        label={label}
        htmlFor={id}
        end={
          <Switch
            id={id}
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
