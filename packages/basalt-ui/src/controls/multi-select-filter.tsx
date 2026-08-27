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
 *
 * @example
 * // A runtime catalogue over the same closed field — live labels, same values.
 * <MultiSelectFilter
 *   field={analytics.field.channels}
 *   label="All channels"
 *   options={CHANNELS.map((c) => ({ value: c, label: `${c} · ${counts[c]}` }))}
 * />
 */
import { Button, Checkbox, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import type { FieldHandle, MultiField } from '../state'
import type { FilterOption } from './select-filter'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { SheetField, SheetOptionList, useControlName } from './filter-sheet'

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
  /**
   * Overrides `field.options` at render — a runtime catalogue whose labels carry live data
   * (`web · 1.2k`). The VALUES still belong to the field: a multi field is a closed set, so this
   * relabels and reorders rows, it does not open new ones. Unlike `SelectFilter` there is no
   * string-field shape to make it required.
   */
  readonly options?: readonly FilterOption[]
}

export function MultiSelectFilter<T extends string>({
  field,
  label,
  icon,
  noun,
  options: optionsProp,
}: MultiSelectFilterProps<T>): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    field.clear()
  })

  // The prop wins whole, never merged — same rule as `EnumFilter`: a catalogue that dropped a row
  // must be able to drop it, and `All channels` is counted against the rows actually shown.
  const options: readonly FilterOption[] = optionsProp ?? field.options
  const inSheet = surface === 'sheet'
  const carriesInformation = value.length > 0 && value.length < options.length
  const { labelId } = useControlName(label, inSheet)

  // The SHEET form is a `SheetOptionList` in `multi` mode — 44px rows, a trailing check on each
  // selected one, hairlines between rows only. Same reasoning as `EnumFilter`: the popover keeps
  // Mantine's `Checkbox.Group`, the sheet reads as a list of options rather than a stack of boxes.
  if (inSheet) {
    return (
      <SheetField label={label} labelId={labelId}>
        <SheetOptionList
          mode="multi"
          labelId={labelId}
          selected={value}
          options={options}
          onToggle={(next) => {
            // The rows are rendered from `options`, whose values belong to the field either way (the
            // prop relabels a closed set, it cannot open it) — the cast restores what the codec
            // already guarantees.
            const has = value.includes(next as T)
            setValue(has ? value.filter((v) => v !== next) : [...value, next as T])
          }}
        />
      </SheetField>
    )
  }

  const body = (
    // Mantine's own `label`, for the same reason `enum-filter.tsx` uses it — `Checkbox.Group`
    // overwrites any `aria-label`/`aria-labelledby` with its own. Named from `label`, never from the
    // pill text, which reads `3 channels` and describes the selection rather than the filter.
    <Checkbox.Group
      label={label}
      classNames={{ label: classes.groupLabel }}
      value={[...value]}
      onChange={(next) => {
        // The boxes are rendered from `options`, whose values belong to the field either way (the
        // prop relabels a closed set, it cannot open it) — the cast restores what the codec
        // already guarantees.
        setValue(next as readonly T[])
      }}
    >
      <Stack gap={2}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            value={option.value}
            label={option.label}
            {...(option.disabled === true && { disabled: true })}
          />
        ))}
      </Stack>
      {!isDefault && (
        <Button
          variant="subtle"
          size="ctl"
          onClick={() => {
            field.clear()
          }}
        >
          Clear
        </Button>
      )}
    </Checkbox.Group>
  )

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
