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
 * In the PANEL (a `PageAside` body) they render as one `Select` — label above, the presets plus a
 * `Custom range…` ROW inside the same list, which reveals the SAME injected picker underneath. A
 * track cannot hold five date presets at ~300px, and a second control beside the choice would cost
 * the column a row it does not have.
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
import { SegmentedControl, Select, Stack } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { FieldHandle, RangeField, RangeValue } from '../state'
import classes from './controls.module.css'
import { useFilterRegistration, useFilterSurface } from './filter-context'
import { FilterPill } from './filter-pill'
import { CalendarGlyph } from './glyphs'
import { SheetDisclosure, SheetField, SheetOptionList, useControlName } from './filter-sheet'
import { PanelRow } from './panel-row'

/** Past four presets the track goes vertical. */
const VERTICAL_FROM = 5
/** The panel `Select`'s last row — the same wording the sheet's disclosure uses, and the same
 *  `'custom'` preset value the field already declares, so no synthetic option value exists. */
const CUSTOM_ROW_LABEL = 'Custom range…'
/** `7d`, `30d`, `24h`, `90` — a label the mono numeric treatment is for. */
const NUMERIC_LABEL = /^\d/

/** The house dev gate — `basaltViteConfig` defines `process.env.NODE_ENV`, so a production bundle
 *  constant-folds this to `false` and drops the warning. Read per call, never hoisted. */
function isDev(): boolean {
  return process.env['NODE_ENV'] !== 'production'
}

/** Once per label — a filter renders on every navigation, and the wiring is fixed at definition. */
const noPickerWarned = new Set<string>()

/**
 * Dev-only: the field declares `custom: true` and no picker was injected, so the custom window is
 * unreachable — the popover shows presets only and the sheet's `Custom range…` row never renders.
 * A warning rather than a type error: `custom: true` with presets only is a legal (and tested)
 * configuration, and the picker is INJECTED precisely because `@mantine/dates` may be absent, so
 * the type cannot tell "deliberately preset-only" from "forgot the import".
 */
function warnCustomWithoutPicker(label: string, unreachable: boolean): void {
  if (!unreachable || !isDev() || noPickerWarned.has(label)) return
  noPickerWarned.add(label)
  // oxlint-disable-next-line no-console -- a dev-time wiring warning has no other channel
  console.warn(
    `[basalt-ui] RangeFilter('${label}'): the field declares \`custom: true\` but no ` +
      '`customPicker` was injected, so the custom window cannot be reached. Pass ' +
      '`customPicker={DateRangePicker}` (`basalt-ui/controls-dates`), or drop `custom: true` from ' +
      'the field. (dev only)',
  )
}

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
type RangeFilterBase<P extends string, C extends boolean> = {
  /**
   * A range handle from either store factory. Generic over the field's `custom` flag so a
   * `field.range({ ... })` WITHOUT `custom` (whose handle is `RangeField<P, false>`, and whose
   * values therefore never include `'custom'`) binds with no cast — pinning `C` to its default
   * `boolean` here made the setter contravariantly incompatible and forced one at every call site.
   */
  readonly field: FieldHandle<RangeField<P, C>>
  /** Leading pill icon. Defaults to a calendar glyph — a range filter reads as a date control, so
   *  the glyph is part of the control's identity, not a per-call-site decision. */
  readonly icon?: ReactNode
  /** Sheet-form heading. The pill's own label is the VALUE, which is what a bar reads. @default 'Range' */
  readonly label?: string
}

export type RangeFilterProps<P extends string, C extends boolean = boolean> = RangeFilterBase<
  P,
  C
> & {
  /**
   * Rendered when the field declares `custom: true`. Omitted → presets only, which stays LEGAL
   * (a range that only ever shows presets is a real configuration) but warns once in dev when the
   * field allows a custom window: the affordance is then unreachable, and nothing else says so.
   */
  readonly customPicker?: ComponentType<RangeCustomPickerProps>
}

export function RangeFilter<P extends string, C extends boolean = boolean>(
  props: RangeFilterProps<P, C>,
): ReactNode {
  const {
    field,
    icon,
    customPicker,
    label = 'Range',
    // One cast, at the one boundary a generic `C` cannot be read through: `C` only ever describes
    // the FIELD's custom flag, and the body handles both.
  } = props as unknown as RangeFilterBase<P, boolean> & {
    readonly customPicker?: ComponentType<RangeCustomPickerProps>
  }
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
  const Picker = customPicker
  warnCustomWithoutPicker(label, allowsCustom && Picker === undefined)
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
  const showPicker = allowsCustom && Picker !== undefined

  if (inPanel) {
    return (
      <PanelRow label={label} labelId={labelId}>
        <Select
          {...nameProps}
          allowDeselect={false}
          // `customOpen` is what the row reads while the picker is open but no window has been
          // picked yet — selecting `Custom range…` reveals the calendar, it does not write a
          // half-built `{ preset: 'custom' }` the codec would have to guess at.
          value={customOpen ? 'custom' : value.preset}
          data={[
            ...presets.map((option) => ({ value: option.value, label: option.label })),
            ...(showPicker ? [{ value: 'custom', label: CUSTOM_ROW_LABEL }] : []),
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
        {showPicker && customOpen && (
          <Picker
            value={{ from: value.from, to: value.to }}
            onChange={({ from, to }) => {
              setValue({ preset: 'custom', from, to } as RangeValue<P | 'custom'>)
            }}
          />
        )}
      </PanelRow>
    )
  }

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
