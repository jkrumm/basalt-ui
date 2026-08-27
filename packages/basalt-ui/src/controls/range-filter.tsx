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
 * In the SHEET they render as a `SheetOptionList`, and the custom picker sits behind a
 * `Custom range…` disclosure row. A vertical `SegmentedControl` stretched across a bottom drawer
 * read as a broken control rather than a choice (see `SheetOptionList`'s doc), and an unconditional
 * calendar pushed every OTHER filter in the sheet below the fold — the sheet holds all of them, and
 * `RangeFilter` is one.
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
 */
import { SegmentedControl, Stack } from '@mantine/core'
import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { FieldHandle, RangeField, RangeValue } from '../state'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { CalendarGlyph } from './glyphs'
import { SheetDisclosure, SheetField, SheetOptionList, useControlName } from './filter-sheet'

/** Past four presets the track goes vertical. */
const VERTICAL_FROM = 5
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

export type RangeFilterProps<P extends string> = {
  readonly field: FieldHandle<RangeField<P>>
  /** Leading pill icon. Defaults to a calendar glyph — a range filter reads as a date control, so
   *  the glyph is part of the control's identity, not a per-call-site decision. */
  readonly icon?: ReactNode
  /** Rendered when the field declares `custom: true`. Omitted → presets only. */
  readonly customPicker?: ComponentType<RangeCustomPickerProps>
  /** Sheet-form heading. The pill's own label is the VALUE, which is what a bar reads. @default 'Range' */
  readonly label?: string
}

export function RangeFilter<P extends string>({
  field,
  icon,
  customPicker,
  label = 'Range',
}: RangeFilterProps<P>): ReactNode {
  const [value, setValue] = field.use()
  const surface = useFilterSurface()
  const isDefault = field.isDefault(value)
  useFilterRegistration(!isDefault, () => {
    setValue(field.fallback)
  })

  const options = field.options
  const presets = options.filter((option) => option.value !== 'custom')
  const allowsCustom = options.length !== presets.length
  const numeric = presets.length > 0 && presets.every((option) => NUMERIC_LABEL.test(option.label))
  const inSheet = surface === 'sheet'
  const Picker = customPicker
  // The track is a `radiogroup`; without this it announces unnamed, and the pill it hangs off reads
  // the VALUE (`30d`), not the filter.
  const { labelId, nameProps } = useControlName(label, inSheet)
  // Expanded when the field ALREADY holds a custom window — a reader who deep-linked one must see
  // it without hunting for the row that holds it. Local, because it is an overlay's open flag and
  // not a filter value (the same line `FilterPill`'s `opened` state draws).
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom')
  const showPicker = allowsCustom && Picker !== undefined

  if (inSheet) {
    return (
      <SheetField label={label} labelId={labelId}>
        <SheetOptionList
          mode="single"
          labelId={labelId}
          selected={[value.preset]}
          options={presets.map((option) => ({ value: option.value, label: option.label }))}
          onToggle={(next) => {
            setCustomOpen(false)
            // Rendered from `field.options`, so `next` is always a declared preset — the cast
            // restores what the codec already guarantees.
            setValue({ preset: next } as RangeValue<P | 'custom'>)
          }}
        />
        {showPicker && (
          <SheetDisclosure
            label="Custom range…"
            expanded={customOpen}
            onToggle={() => {
              setCustomOpen((open) => !open)
            }}
          >
            <Picker
              value={{ from: value.from, to: value.to }}
              onChange={({ from, to }) => {
                setValue({ preset: 'custom', from, to } as RangeValue<P | 'custom'>)
              }}
            />
          </SheetDisclosure>
        )}
      </SheetField>
    )
  }

  const body = (
    <Stack gap="xs">
      <SegmentedControl
        {...nameProps}
        size="ctl"
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
      {showPicker && (
        <Picker
          value={{ from: value.from, to: value.to }}
          onChange={({ from, to }) => {
            setValue({ preset: 'custom', from, to } as RangeValue<P | 'custom'>)
          }}
        />
      )}
    </Stack>
  )

  return (
    <FilterPill
      label={rangeLabel(value, options)}
      active={!isDefault}
      numeric={numeric && value.preset !== 'custom'}
      icon={icon ?? <CalendarGlyph />}
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
