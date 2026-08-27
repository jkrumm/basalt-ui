/**
 * `basalt-ui/controls-dates` — the one export that needs `@mantine/dates`
 * (`docs/CONTROLS-SPEC.md` §3). Split off `./controls` on purpose: `./controls` resolves and renders
 * with no `@mantine/dates` installed, and this subpath is the only place that stops being true.
 * Proven from outside the package by `scripts/pack-test.sh`.
 */
export { DateRangePicker } from './date-range-picker'
export type { RangeCustomPickerProps } from '../controls/range-filter'
