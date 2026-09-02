/**
 * `NumberFilter` — one number, one pill (`docs/CONTROLS-SPEC.md` §3), over a `field.number`. Takes
 * `field`, never `value`/`onChange`/`size` (C2/C5), like every other control on this subpath.
 *
 * **Two forms, and `options` is the whole switch.** With `options` the filter is a pill plus a radio
 * list — the same body `SelectFilter` renders, reached through `EnumFilter`'s `ChoiceHandle`, so a
 * numeric preset set (`1` / `2` / `7` nights) is one idiom with the enum filters rather than a
 * second spelling of the same choice. Without `options` it is a pill whose popover holds a `ctl`
 * `NumberInput` with its steppers, and the sheet form is that input in a full-width row.
 *
 * **A threshold is a NUMBER, not a string enum, and that is why this control exists.** Both
 * consumers that needed one wrote around its absence in opposite directions: linewatch kept a raw
 * `SegmentedControl` over `minDuration` (a `control-outside-home` warn, law C1), and argo widened
 * `nights` into a string enum — which puts `'3'` in the URL, makes every comparison a parse, and
 * closes a set that was never closed. `field.number` already carries the codec, the clamp and both
 * lanes; the only thing missing was the control.
 *
 * **The stepper applies on blur or Enter, never per keystroke.** A number is typed digit by digit,
 * so a live write navigates on `4`, `42`, `420` and lands three values in the loader for one
 * intended threshold — and the middle two are real values the store would clamp and persist.
 * `SearchFilter` debounces for the same reason; a number has an explicit commit point (leaving the
 * field, pressing Enter) and a phrase does not, so this one commits rather than waits.
 *
 * **`min`/`max`/`int`/`step` come off the HANDLE, never the call site.**
 * `field.number({ min, max, int, step })` declares them, the codec clamps to them on write, and the
 * handle republishes all four — so the `NumberInput` bounds its own stepper and `int` refuses
 * decimals outright. Three of them are not props here on purpose: they belong to the field, which is
 * the thing that validates the URL, and a second copy at the call site is a second answer to the
 * same question that stops matching the moment the field moves. The clamp is still the backstop for
 * a value that arrives from outside the input (a hand-typed URL, a stale deep link), and the draft
 * follows the field down when it fires (see {@link useCommittedNumber}).
 *
 * `step` survives as a prop only because a call site may legitimately want a COARSER grain than the
 * field's (a 0..600 seconds threshold stepping by 30), and it now DEFAULTS to `field.step` — the
 * resolved one, so `int: true` still implies 1 with the rule stated once, in `field.number`.
 *
 * @example
 * // A preset set — a pill plus a radio list, exactly like SelectFilter.
 * // nights: field.number({ fallback: 2, min: 1, max: 14, int: true })
 * <NumberFilter
 *   field={booking.field.nights}
 *   label="Nights"
 *   options={[
 *     { value: 1, label: '1 night' },
 *     { value: 2, label: '2 nights' },
 *     { value: 7, label: 'A week' },
 *   ]}
 * />
 *
 * @example
 * // An open threshold — a pill holding a stepper, applied on blur or Enter.
 * // minDuration: field.number({ fallback: 0, min: 0, max: 600 })
 * <NumberFilter field={lines.field.minDuration} label="Min duration" step={30} />
 */
import { NumberInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { FieldHandle, NumberField } from '../state'
import classes from './controls.module.css'
import { EnumFilter } from './enum-filter'
import type { ChoiceHandle } from './enum-filter'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { useControlName } from './filter-sheet'
import { PanelRow } from './panel-row'

/** One row of a numeric preset set. Narrower than `FilterOption` — a preset is never `disabled`:
 *  the set is declared at the call site, so a row that should not be offered is left out. */
export type NumberFilterOption = {
  readonly value: number
  readonly label: string
}

export type NumberFilterProps = BasaltProps & {
  readonly field: FieldHandle<NumberField>
  /** The popover/sheet heading and the accessible name — never the pill text, which reads the
   *  VALUE (see `EnumFilter`'s doc for why a pill may only print what is selected). */
  readonly label: string
  readonly icon?: ReactNode
  /** Present → the radio-list form. Absent → the stepper form. */
  readonly options?: readonly NumberFilterOption[]
  /**
   * The stepper's increment, overriding the field's own. Ignored in the `options` form, which has
   * no stepper.
   *
   * @default `field.step` — the field's declared grain, which is `1` for an `int: true` field that
   * declared none. Absent on both, the input keeps Mantine's own default of 1.
   */
  readonly step?: number
}

export function NumberFilter(props: NumberFilterProps): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces as `undefined is not an object
  // (evaluating 'field.use')`, caught by `BasaltErrorBoundary`.
  assertRequiredProps('NumberFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, label, icon, options, step, className, style } = props
  // Two BRANCHES, two components, and never a conditional hook: the radio form's state lives in
  // `EnumFilter` and the stepper's in `NumberStepper`, so which one mounts is decided once by a prop
  // that does not change across a mount's life.
  if (options !== undefined) {
    return (
      <NumberChoice
        field={field}
        label={label}
        options={options}
        {...(icon !== undefined && { icon })}
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      />
    )
  }
  // The prop wins over the field's declared grain; `field.step` is the default, so an `int` field
  // steps by 1 with nothing written here (see `NumberFilterProps.step`).
  const grain = step ?? field.step
  return (
    <NumberStepper
      field={field}
      label={label}
      {...(icon !== undefined && { icon })}
      {...(grain !== undefined && { step: grain })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}

/**
 * The `options` form. It renders no radio list of its own — it ADAPTS the number handle into
 * `EnumFilter`'s `ChoiceHandle<string>` and hands it over, so the popover's `Radio.Group`, the
 * sheet/panel `PanelChoice`, the registration and the pill readout are the ones already tested for
 * `SelectFilter`/`CompareFilter` rather than a numeric copy of all four.
 *
 * The adapter is a projection, not a store: the URL still holds a NUMBER (`nights=3`, not `'3'`),
 * because every write goes back through `setValue(Number(next))` into the same field codec.
 *
 * `field.use()` is called HERE, at a component's top level, and the adapter's own `use()` just
 * returns what it read. The other way round — a `use()` that calls the real hook when `EnumFilter`
 * invokes it — works at runtime (the call site is stable) but makes a plain object method a hook,
 * which is a thing neither `react/rules-of-hooks` nor a reader should have to reason about.
 */
function NumberChoice({
  field,
  label,
  icon,
  options,
  className,
  style,
}: BasaltProps & {
  readonly field: FieldHandle<NumberField>
  readonly label: string
  readonly icon?: ReactNode
  readonly options: readonly NumberFilterOption[]
}): ReactNode {
  const [value, setValue] = field.use()
  const rows = options.map((option) => ({ value: String(option.value), label: option.label }))
  const choice: ChoiceHandle<string> = {
    fallback: String(field.fallback),
    options: rows,
    use: () =>
      [
        String(value),
        (next: string) => {
          setValue(Number(next))
        },
      ] as const,
    isDefault: (v) => field.isDefault(Number(v)),
    clear: () => {
      field.clear()
    },
  }

  // `options` passed explicitly as well as through the handle: `EnumFilter` reads the PROP first
  // (the runtime-catalogue override), and passing the same rows both ways keeps the two agreeing
  // whichever branch of that lookup a future edit takes.
  return (
    <EnumFilter
      field={choice}
      label={label}
      numeric
      options={rows}
      {...(icon !== undefined && { icon })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}

/** The stepper form — a pill holding a `ctl` `NumberInput`, or a full-width sheet row. */
function NumberStepper({
  field,
  label,
  icon,
  step,
  className,
  style,
}: BasaltProps & {
  readonly field: FieldHandle<NumberField>
  readonly label: string
  readonly icon?: ReactNode
  readonly step?: number
}): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const inSheet = surface === 'sheet'
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    field.clear()
  })
  const inPanel = surface === 'panel'
  const { labelId, nameProps } = useControlName(label, inSheet || inPanel)
  const draft = useCommittedNumber(value, setValue, { min: field.min, max: field.max })

  const input = (
    <NumberInput
      {...nameProps}
      size="ctl"
      // The FIELD's bounds, straight off the handle — so the stepper stops at the limit and a typed
      // value cannot exceed it, instead of being silently corrected one commit later. The codec's
      // clamp stays the backstop for everything that does not come through this box.
      {...(field.min !== undefined && { min: field.min })}
      {...(field.max !== undefined && { max: field.max })}
      // `int: true` is refused by the codec, not rounded, so the input must refuse it too — a `.5`
      // typed into an integer field would otherwise decode to `null` and resurrect the fallback.
      {...(field.int && { allowDecimal: false })}
      // Already resolved by `NumberFilter` — the prop, else the field's own grain.
      {...(step !== undefined && { step })}
      value={draft.value}
      onChange={draft.set}
      onBlur={draft.commit}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        // A filter is not inside a form here, but a consumer's page may be — an Enter that submits
        // the page instead of committing the threshold is the one failure mode worth pre-empting.
        event.preventDefault()
        draft.commit()
      }}
    />
  )

  // The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a
  // Drawer") — the same `PanelRow` label-above-control row on both surfaces.
  if (inPanel || inSheet) {
    return (
      <PanelRow
        label={label}
        labelId={labelId}
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      >
        {input}
      </PanelRow>
    )
  }

  return (
    <FilterPill
      label={String(value)}
      numeric
      active={!isDefault}
      {...(icon !== undefined && { icon })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      <div className={classes.optionList}>{input}</div>
    </FilterPill>
  )
}

/**
 * A local draft that lands on the field only when the user is DONE with it (blur, Enter), and that
 * follows the field when it changes from outside the input — `Reset all`, a back navigation, a deep
 * link, and the codec's own clamp.
 *
 * The clamp is the interesting direction, and it is why `bounds` is a parameter rather than left to
 * the codec. `commit` clamps to the field's OWN limits before it compares, so the readout follows
 * the clamp even when the store does not move: a second out-of-range `9999` against `max: 600` over
 * a stored `600` writes nothing (the value is already `600`), which means `[value]` never changes and
 * the effect below never runs — and the input went on displaying `9999` over a URL holding `600`,
 * exactly the readout this hook exists to prevent. Only the FIRST out-of-range commit was ever
 * healed.
 *
 * `seen` (the number this hook last committed) plus the effect stay as the backstop for a change that
 * did not come through this box at all — `Reset all`, a deep link, a back navigation — and for a
 * codec clamp the bounds here cannot predict.
 */
function useCommittedNumber(
  value: number,
  setValue: (next: number) => void,
  bounds: { min?: number | undefined; max?: number | undefined },
): { value: number | string; set: (next: number | string) => void; commit: () => void } {
  const [draft, setDraft] = useState<number | string>(value)
  const seen = useRef(value)
  const commitRef = useRef(setValue)
  commitRef.current = setValue

  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setDraft(value)
  }, [value])

  return {
    value: draft,
    set: setDraft,
    commit: () => {
      const parsed = typeof draft === 'number' ? draft : Number.parseFloat(draft)
      // An empty or half-typed box ('', '-', '1e') is not a value — restore the field's, rather
      // than committing `NaN` for the codec to fall back on and calling that the user's intent.
      if (!Number.isFinite(parsed)) {
        setDraft(value)
        return
      }
      // Clamp to what the codec will actually store, then show THAT — a draft the store is about to
      // refuse is a lie whether or not the store's value moves. `int` needs no handling: the input
      // runs `allowDecimal: false` on an integer field, so a decimal never reaches here.
      let next = parsed
      if (bounds.min !== undefined && next < bounds.min) next = bounds.min
      if (bounds.max !== undefined && next > bounds.max) next = bounds.max
      setDraft(next)
      if (next === value) return
      seen.current = next
      commitRef.current(next)
    },
  }
}
