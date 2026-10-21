/**
 * `RangeFilter` — the time-window filter (`docs/CONTROLS-SPEC.md` §3). One pill over a
 * `field.range`, which owns THREE URL params (preset + `from` + `to`), so a consumer's existing deep
 * links and loaders keep their shape and `field.toWindow()` replaces every hand-rolled
 * `presetToParams`.
 *
 * In the POPOVER the presets render as a `SegmentedControl` — vertical past four options, where a
 * horizontal track would either overflow the popover or shrink each label below reading size.
 * Numeric preset labels (`7d` / `30d`) get `data-numeric`, which is the mono treatment
 * `theme/segmented-control.module.css` owns; that attribute is what retired the per-consumer
 * `theme-allow` + inline `fontFamily` hack (C7).
 *
 * In the PANEL and the SHEET (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a Drawer")
 * they render as one `Select` — label above, the presets plus a `Custom range…` ROW inside the same
 * list, which reveals the SAME injected picker underneath. A track cannot hold five date presets at
 * ~300px (or across a bottom drawer, where a vertical `SegmentedControl` read as a broken control
 * rather than a choice), and a second control beside the choice would cost the column — or an
 * unconditional calendar pushed below every OTHER filter in the sheet — a row it does not have.
 *
 * The custom picker is INJECTED, never imported: `basalt-ui/controls-dates` holds the
 * `@mantine/dates` implementation, and this module must resolve for a consumer who has no
 * `@mantine/dates` at all (`docs/CONTROLS-SPEC.md` §3 — `basaltViteConfig`'s `optimizeDeps.include`
 * for `@mantine/*` would break on an absent peer).
 *
 * @example
 * import { DateRangePicker } from 'basalt-ui/controls-dates'
 * // range: field.range({ presets: ['7d', '30d', '90d', 'ytd'], fallback: '30d', custom: true })
 * <RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
 *
 * @example
 * // range: field.range({ presets: ['7d', '30d'], fallback: '30d' }) — no `custom`, no picker
 * <RangeFilter field={analytics.field.range} />
 */
import { SegmentedControl, Select, Stack } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { assertRequiredProps } from '../common/validate'
import type { FieldHandle } from '../state'
import type { RangeField, RangeValue } from '../state/fields'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import type { FilterBase } from './filter-base'
import { FilterPill, filterReading } from './filter-pill'
import { CalendarGlyph } from './glyphs'
import { useControlName } from './control-name'
import { PanelRow } from './panel-row'
import type { UncontrolledProps } from './uncontrolled'

/** Past four presets the track goes vertical. */
const VERTICAL_FROM = 5
/** The panel `Select`'s last row — the same wording the sheet's disclosure uses, and the same
 *  `'custom'` preset value the field already declares, so no synthetic option value exists. */
const CUSTOM_ROW_LABEL = 'Custom range…'
/** `7d`, `30d`, `24h`, `90` — a label the mono numeric treatment is for. */
const NUMERIC_LABEL = /^\d/

/**
 * The contract a custom-range picker satisfies — `basalt-ui/controls-dates`' `DateRangePicker`, or a
 * consumer's own. Dates are ISO (`YYYY-MM-DD`), the same shape `field.range` stores and
 * `toWindow()` emits, so the picker never learns the store's encoding.
 */
export type RangeCustomPickerProps = {
  readonly value: { readonly from?: string | undefined; readonly to?: string | undefined }
  readonly onChange: (next: { from: string; to: string }) => void
}

/** Everything about the props that does not depend on the field's `custom` flag. */
type RangeFilterCommon<P extends string, C extends boolean> = UncontrolledProps &
  Omit<FilterBase, 'clearable' | 'label'> & {
    /** The filter's name: the sheet-form heading, and the pill's muted label once a range is chosen (`Window  7d`); at the default the pill reads the range alone. @default 'Range' */
    readonly label?: string
    /**
     * A range handle from either store factory. Generic over the field's `custom` flag so a
     * `field.range({ ... })` WITHOUT `custom` (whose handle is `RangeField<P, false>`, and whose
     * values therefore never include `'custom'`) binds with no cast — pinning `C` to its default
     * `boolean` here made the setter contravariantly incompatible and forced one at every call site.
     */
    readonly field: FieldHandle<RangeField<P, C>>
  }

/**
 * `customPicker` is REQUIRED exactly when the field is `custom: true` and FORBIDDEN otherwise, so
 * the unreachable-affordance state (a custom window nobody can pick) is a type error instead of a
 * dev warning. A widened handle (`C = boolean`) cannot say which, so it must supply the picker.
 */
export type RangeFilterProps<P extends string, C extends boolean = boolean> = RangeFilterCommon<
  P,
  C
> &
  ([C] extends [false]
    ? { readonly customPicker?: never }
    : { readonly customPicker: ComponentType<RangeCustomPickerProps> })

export function RangeFilter<P extends string, C extends boolean = boolean>(
  props: RangeFilterProps<P, C>,
): ReactNode
// The implementation signature is the widest arm, picker optional; the overload above is the only
// one a caller sees.
export function RangeFilter<P extends string>(
  props: Omit<RangeFilterProps<P, boolean>, 'customPicker'> & {
    readonly customPicker?: ComponentType<RangeCustomPickerProps> | undefined
  },
): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces as `undefined is not an object
  // (evaluating 'field.use')`, caught by `RootBoundary`.
  assertRequiredProps('RangeFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, icon, disabled, customPicker: Picker, label = 'Range', className, style } = props
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    field.clear()
  })

  const options = field.options
  const presets = options.filter((option) => option.value !== 'custom')
  const allowsCustom = options.length !== presets.length
  const numeric = presets.length > 0 && presets.every((option) => NUMERIC_LABEL.test(option.label))
  const inSheet = surface === 'sheet'
  const inPanel = surface === 'panel'
  // The track is a `radiogroup`; without this it announces unnamed, and the pill it hangs off reads
  // the VALUE (`30d`), not the filter.
  const { labelId, nameProps } = useControlName(label, inSheet || inPanel)
  // Expanded when the field ALREADY holds a custom window — a reader who deep-linked one must see
  // it without hunting for the row that holds it. Local, because it is an overlay's open flag and
  // not a filter value (the same line `FilterPill`'s `opened` state draws).
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom')
  // …and RE-SYNCED whenever the preset moves under it. Seeded once, the flag survived a write this
  // control did not make: a `Reset all` or a `field.clear()` from a `FilterSet` put the field back
  // on `30d` while the panel's Select still read `Custom range…` with the picker open beneath it.
  // Tracked against the LAST SEEN preset (`search-filter.tsx`'s `useDebouncedField` idiom) rather
  // than against `value.preset` alone, because the just-clicked `Custom range…` transient is
  // exactly the state where the flag is true and the preset has not moved yet.
  const seenPreset = useRef(value.preset)
  useEffect(() => {
    if (seenPreset.current === value.preset) return
    seenPreset.current = value.preset
    setCustomOpen(value.preset === 'custom')
  }, [value.preset])
  const picker =
    allowsCustom && Picker !== undefined ? (
      <Picker
        value={{ from: value.from, to: value.to }}
        onChange={({ from, to }) => {
          // The injected picker cannot be disabled through its props, so a disabled filter drops
          // what it reports instead.
          if (disabled === true) return
          setValue({ preset: 'custom', from, to } as RangeValue<P | 'custom'>)
        }}
      />
    ) : null

  // The sheet form is the panel form (`docs/CONTROLS-SPEC.md` §3: "sheet = panel rows inside a
  // Drawer") — one `Select` holding the presets plus a `Custom range…` row, which reveals the same
  // injected picker underneath. It used to be a `SheetOptionList` with the picker behind a separate
  // `SheetDisclosure` row; the `Select` already folds both into one control, so the disclosure had
  // no job left.
  if (inPanel || inSheet) {
    return (
      <PanelRow
        label={label}
        labelId={labelId}
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      >
        <Select
          {...nameProps}
          allowDeselect={false}
          {...(disabled === true && { disabled: true })}
          // `customOpen` is what the row reads while the picker is open but no window has been
          // picked yet — selecting `Custom range…` reveals the calendar, it does not write a
          // half-built `{ preset: 'custom' }` the codec would have to guess at.
          value={customOpen ? 'custom' : value.preset}
          data={[
            ...presets.map((option) => ({ value: option.value, label: option.label })),
            ...(picker !== null ? [{ value: 'custom', label: CUSTOM_ROW_LABEL }] : []),
          ]}
          onChange={(next) => {
            if (next === null) return
            if (next === 'custom') {
              setCustomOpen(true)
              return
            }
            setCustomOpen(false)
            // Rendered from `field.options`, so `next` is always a declared preset — the cast
            // restores what the codec already guarantees.
            setValue({ preset: next } as RangeValue<P | 'custom'>)
          }}
        />
        {customOpen && picker}
      </PanelRow>
    )
  }

  const body = (
    <Stack gap="xs">
      <SegmentedControl
        {...nameProps}
        size="ctl"
        {...(disabled === true && { disabled: true })}
        orientation={presets.length >= VERTICAL_FROM ? 'vertical' : 'horizontal'}
        value={value.preset}
        data={presets.map((option) => ({ value: option.value, label: option.label }))}
        {...(numeric && { 'data-numeric': true })}
        onChange={(next) => {
          // The segments are rendered from `field.options`, so `next` is always a declared preset —
          // the cast restores what the codec already guarantees.
          setValue({ preset: next } as RangeValue<P | 'custom'>)
        }}
      />
      {picker}
    </Stack>
  )

  return (
    <FilterPill
      {...filterReading({
        name: label,
        informative: !isDefault,
        value: rangeLabel(value, options),
        unsetText: rangeLabel(value, options),
      })}
      active={!isDefault}
      numeric={numeric && value.preset !== 'custom'}
      {...(disabled === true && { disabled: true })}
      icon={icon ?? <CalendarGlyph />}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      <div className={classes.optionList}>{body}</div>
    </FilterPill>
  )
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  // ISO date strings parse as UTC midnight; formatting them in the runtime's zone would render the
  // previous day west of Greenwich — and differently on server than on client (a hydration
  // mismatch), the same hazard `formatArticleDate` avoids.
  timeZone: 'UTC',
})

/** `Last 30 days`, or `Mar 1 – Mar 14` for a custom window. */
function rangeLabel(
  value: RangeValue<string>,
  options: readonly { value: string; label: string }[],
): string {
  if (value.preset === 'custom' && value.from !== undefined && value.to !== undefined) {
    return `${DAY_FORMAT.format(new Date(value.from))} – ${DAY_FORMAT.format(new Date(value.to))}`
  }
  return options.find((option) => option.value === value.preset)?.label ?? value.preset
}
