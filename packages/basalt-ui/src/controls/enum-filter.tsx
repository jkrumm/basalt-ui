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
 * **The pill label is ALWAYS the selected option's label, including at the field's default value.**
 * It used to fall back to the FILTER's name while `isDefault(value)` held, and that is the bug this
 * comment exists to keep fixed: a bar reading `Compare` over a field holding `'previous'` states
 * something false — the popover said `Previous period` was selected and the pill said the filter had
 * not been touched. A pill is a readout, so the value is the only thing it may print. `label` is the
 * popover/sheet heading and the accessible name, nothing else; the ACTIVE state (touched vs at its
 * default) is carried by the accent border, which is a second channel and does not need the text.
 *
 * `?? label` survives as a last resort for a value that is in the field but not in the rendered
 * `options` — a runtime catalogue that has dropped a row while the URL still points at it. That is a
 * data gap, not a default, and printing the filter's name is the least-wrong thing to do with it.
 *
 * `field` is typed as `ChoiceHandle` rather than a `FieldHandle<EnumField>`, and `options` may
 * override the field's own rows — the two halves of `SelectFilter`'s runtime-catalogue shape (see
 * its doc). Both public wrappers still type `field` exactly, so a wrong field kind is still a type
 * error at the call site; the widening lives here, where nothing consumer-facing points at it.
 */
import { Button, Radio, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import type { FieldOption } from '../state'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { SheetField, SheetOptionList, useControlName } from './filter-sheet'
import type { FilterOption } from './select-filter'

/**
 * The slice of a `FieldHandle` this body actually binds to, generic over the VALUE rather than over
 * the field kind. `FieldHandle<EnumField<T>>` satisfies it at `T` and `FieldHandle<StringField>` at
 * `string`, which is what lets `SelectFilter` take either without this file knowing about kinds —
 * and it stays a structural subset, so it can never widen into a second, hand-constructible handle.
 */
export type ChoiceHandle<T extends string> = {
  readonly fallback: T
  readonly options: readonly FieldOption[]
  use(): readonly [T, (next: T) => void]
  isDefault(v: T): boolean
  /** Removes the value on whichever lane the field is on — what both reset paths call, never a write
   * of the fallback back over it. See `useFilterRegistration`'s doc for why. */
  clear(): void
}

export type EnumFilterProps<T extends string> = {
  readonly field: ChoiceHandle<T>
  readonly label: string
  readonly icon?: ReactNode
  /** Adds a `Clear` action that clears the field — the same `field.clear()` `Reset all` calls. */
  readonly clearable?: boolean
  /**
   * Overrides `field.options` at render — a runtime catalogue whose labels carry live data, or the
   * only row source a `StringField` has. `| undefined` explicitly: an internal component is spread
   * into, and `exactOptionalPropertyTypes` rejects a possibly-undefined member on a bare optional.
   */
  readonly options?: readonly FilterOption[] | undefined
  /**
   * Mono pill label — forwarded to `FilterPill.numeric`. Set by `NumberFilter`, whose values ARE
   * numbers (`1` / `2` / `7`), and by nothing else: the same law `[data-numeric]` applies to a
   * numeric SegmentedControl label. A word-valued filter never sets it.
   */
  readonly numeric?: boolean | undefined
}

export function EnumFilter<T extends string>({
  field,
  label,
  icon,
  clearable,
  numeric,
  options: optionsProp,
}: EnumFilterProps<T>): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    field.clear()
  })

  // The prop wins whole, never merged: a catalogue that has dropped a value must be able to drop
  // its row, which a merge with `field.options` would silently put back.
  const options: readonly FilterOption[] = optionsProp ?? field.options
  const selected = options.find((option) => option.value === value)
  const inSheet = surface === 'sheet'
  const { labelId } = useControlName(label, inSheet)

  // The SHEET form is a `SheetOptionList` (44px rows, trailing check, hairline between rows), not
  // the popover's `Radio.Group` — see `SheetOptionList`'s doc for why the leading radio dot had to
  // go. Both still write through the same setter, so there is one behaviour and two surfaces.
  if (inSheet) {
    return (
      <SheetField label={label} labelId={labelId}>
        <SheetOptionList
          mode="single"
          labelId={labelId}
          selected={[value]}
          options={options}
          onToggle={(next) => {
            // Rendered from `options` — the field's declared values, or the runtime catalogue
            // standing in for them; the cast restores what the codec already guarantees.
            setValue(next as T)
          }}
        />
      </SheetField>
    )
  }

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
        // `next` is a DOM string, and the radios are rendered from `options` — the field's own
        // declared values, or the runtime catalogue standing in for them. Over a closed enum the
        // cast restores what the codec already guarantees; over a `StringField` there is nothing to
        // guarantee and nothing to widen, since every string is a legal value there.
        setValue(next as T)
      }}
    >
      <Stack gap={2}>
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            label={option.label}
            {...(option.disabled === true && { disabled: true })}
          />
        ))}
      </Stack>
      {clearable === true && !isDefault && (
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
    </Radio.Group>
  )

  return (
    <FilterPill
      label={selected?.label ?? label}
      active={!isDefault}
      {...(numeric === true && { numeric: true })}
      {...(icon !== undefined && { icon })}
    >
      <div className={classes.optionList}>{body}</div>
    </FilterPill>
  )
}
