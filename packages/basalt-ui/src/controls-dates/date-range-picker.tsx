/**
 * `DateRangePicker` — the `@mantine/dates` implementation of `RangeFilter`'s custom-window picker
 * (`docs/CONTROLS-SPEC.md` §3). Its OWN subpath, and the reason is packaging, not taste:
 * `@mantine/dates` is an optional peer, `basaltViteConfig` pre-bundles `@mantine/*`, and a consumer
 * without the peer (linewatch) would break on an absent import — so nothing under `src/controls/**`
 * may reference it, statically or lazily. `RangeFilter` takes the picker as a `customPicker` prop
 * instead, which is the whole seam.
 *
 * `DatePicker type="range"` deals in ISO `YYYY-MM-DD` strings in Mantine 9 (`DateStringValue`), which
 * is exactly what `field.range` stores — so there is no date parsing, formatting or timezone
 * handling in this adapter, and that is deliberate.
 *
 * No `size` prop: the calendar is a POPOVER BODY, not a control in a home, so it carries none of the
 * `ctl` tier's var set (`docs/CONTROLS-SPEC.md` §5 declares `-ctl` vars for Button/ActionIcon/Input/
 * SegmentedControl/Combobox — not for the calendar), and pinning one would be a size with no
 * declaration behind it.
 *
 * The consumer imports `@mantine/dates/styles.layer.css` alongside the other Mantine layer bundles
 * (before `basalt-ui/styles.css`); this module ships no CSS of its own.
 *
 * @example
 * import { DateRangePicker } from 'basalt-ui/controls-dates'
 * <RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
 */
import { DatePicker } from '@mantine/dates'
import type { ReactNode } from 'react'
import { assertRequiredProps } from '../common/validate'
import type { RangeCustomPickerProps } from '../controls/range-filter'

export function DateRangePicker(props: RangeCustomPickerProps): ReactNode {
  // F-ERR-1 — without this a missing `value` surfaces as `undefined is not an object
  // (evaluating 'value.from')`, caught by `BasaltErrorBoundary`.
  assertRequiredProps('DateRangePicker', props, ['value'], {
    value: "pass `{ from, to }` — usually injected by `RangeFilter`'s `customPicker`.",
  })
  const { value, onChange } = props
  return (
    <DatePicker
      type="range"
      allowSingleDateInRange
      value={[value.from ?? null, value.to ?? null]}
      onChange={([from, to]) => {
        // A range is only a value once BOTH ends are picked — the first click of a new range hands
        // back `[from, null]`, and committing that would write a half range onto the URL.
        if (from !== null && to !== null) onChange({ from, to })
      }}
    />
  )
}
