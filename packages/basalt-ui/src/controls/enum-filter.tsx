/**
 * The shared body behind `SelectFilter` and `CompareFilter` — one closed-enum filter over
 * `field.enum` (`docs/CONTROLS-SPEC.md` §3). INTERNAL: the two exported wrappers differ only in
 * their default label and in how narrowly they type `field`, so there is one implementation and no
 * third public spelling of it.
 *
 * Both surfaces render the SAME `Radio.Group`, differing only in row height: a radio list states
 * "one of these" without a second interaction (a nested Select inside a popover would), and it is
 * the sheet form the spec prescribes — so it is the popover form too rather than inventing a second
 * idiom for the same choice.
 *
 * The pill label is the SELECTED option, falling back to the filter's name at its default value:
 * at rest the bar reads `Currency`, and once touched it reads `EUR` — the value is the information,
 * and the accent border already says "this one is filtering".
 */
import { Button, Radio, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import type { EnumField, FieldHandle } from '../state'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { sheetRowClassNames } from './filter-sheet'

export type EnumFilterProps<T extends string> = {
  readonly field: FieldHandle<EnumField<T>>
  readonly label: string
  readonly icon?: ReactNode
  /** Adds a `Clear` action that writes the field back to its fallback. */
  readonly clearable?: boolean
}

export function EnumFilter<T extends string>({
  field,
  label,
  icon,
  clearable,
}: EnumFilterProps<T>): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    setValue(field.fallback)
  })

  const options = field.options
  const selected = options.find((option) => option.value === value)
  const inSheet = surface === 'sheet'

  const body = (
    // Mantine's OWN `label` prop, not an `aria-label`: `Radio.Group` overwrites both `aria-label`
    // and `aria-labelledby` with its own `aria-labelledby` pointing at the `Input.Wrapper` label it
    // renders — which, with no `label` passed, points at an element that does not exist. So the only
    // way to name this group is to give it the label. It doubles as the heading in both surfaces:
    // the group needs the FILTER's name ('Currency'), which the pill cannot supply because the pill
    // reads the VALUE ('EUR') once set.
    <Radio.Group
      label={label}
      classNames={{ label: classes.groupLabel }}
      value={value}
      onChange={(next) => {
        // `next` is a DOM string; the radios are rendered from `field.options`, so it is always one
        // of the field's declared values — the cast restores what the codec already guarantees.
        setValue(next as T)
      }}
    >
      <Stack gap={inSheet ? 0 : 2}>
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            label={option.label}
            {...(inSheet && { classNames: sheetRowClassNames })}
          />
        ))}
      </Stack>
      {clearable === true && !isDefault && (
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
    </Radio.Group>
  )

  if (inSheet) return body

  return (
    <FilterPill
      label={isDefault ? label : (selected?.label ?? label)}
      active={!isDefault}
      {...(icon !== undefined && { icon })}
    >
      <div className={classes.optionList}>{body}</div>
    </FilterPill>
  )
}
