/**
 * `MultiSelectFilter` — an any-of set over one closed enum (`docs/CONTROLS-SPEC.md` §3).
 *
 * The pill reads the filter's name while the selection carries no information — empty (no
 * constraint) or every option (the same thing said the long way) — and switches to a count once it
 * does: `All channels` → `3 channels`. `noun` is the plural read in that count and defaults to the
 * label lowercased, so `label="Channels"` needs no second prop.
 *
 * @example
 * <MultiSelectFilter field={analytics.field.channels} label="All channels" noun="channels" />
 */
import { Button, Checkbox, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import type { FieldHandle, MultiField } from '../state'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { sheetRowClassNames } from './filter-sheet'

export type MultiSelectFilterProps<T extends string> = {
  readonly field: FieldHandle<MultiField<T>>
  readonly label: string
  readonly icon?: ReactNode
  /**
   * The plural noun in the `3 channels` count.
   *
   * @default the label, lowercased
   */
  readonly noun?: string
}

export function MultiSelectFilter<T extends string>({
  field,
  label,
  icon,
  noun,
}: MultiSelectFilterProps<T>): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    setValue(field.fallback)
  })

  const options = field.options
  const inSheet = surface === 'sheet'
  const carriesInformation = value.length > 0 && value.length < options.length

  const body = (
    // Mantine's own `label`, for the same reason `enum-filter.tsx` uses it — `Checkbox.Group`
    // overwrites any `aria-label`/`aria-labelledby` with its own. Named from `label`, never from the
    // pill text, which reads `3 channels` and describes the selection rather than the filter.
    <Checkbox.Group
      label={label}
      classNames={{ label: classes.groupLabel }}
      value={[...value]}
      onChange={(next) => {
        // The boxes are rendered from `field.options`, so every entry is one of the field's
        // declared values — the cast restores what the codec already guarantees.
        setValue(next as readonly T[])
      }}
    >
      <Stack gap={inSheet ? 0 : 2}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            value={option.value}
            label={option.label}
            {...(inSheet && { classNames: sheetRowClassNames })}
          />
        ))}
      </Stack>
      {!isDefault && (
        <Button
          variant="subtle"
          size="ctl"
          onClick={() => {
            setValue(field.fallback)
          }}
        >
          Clear
        </Button>
      )}
    </Checkbox.Group>
  )

  if (inSheet) return body

  return (
    <FilterPill
      label={carriesInformation ? `${value.length} ${noun ?? label.toLowerCase()}` : label}
      active={!isDefault}
      {...(icon !== undefined && { icon })}
    >
      <div className={classes.optionList}>{body}</div>
    </FilterPill>
  )
}
