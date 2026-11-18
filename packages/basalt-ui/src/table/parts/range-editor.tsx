/**
 * The `range` editors (docs/v3/concepts/data-table.md section 3): a numeric column's min and max,
 * and a date column's quick ranges and day picker. Both write `[from, to]` into the column's one
 * `FilterModel`, an open end as `''`; a field writes on commit (Enter, blur, a step, a released
 * slider thumb), never per keystroke, so a server table asks once per edit.
 */
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useFormat } from '../../core/format'
import type { CalendarDate } from '../../core/format'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { useIntl } from '../../core/provider-props'
import { Button } from '../../ui/button'
import { NumberField } from '../../ui/number-field'
import { Slider } from '../../ui/slider'
import { dayOf, numberOf, rangeEnds } from '../core/filters'
import type { KindSpec } from '../core/kinds-spec'
import type { TableModel } from '../use-data-table'
import { filterValues, withFilter } from './toolbar-filters'
import type { FilterableSpec } from './toolbar-filters'

type Props<T> = { model: TableModel<T>; spec: KindSpec<T> & FilterableSpec }

/** A slider step a hundredth of the scale's order of magnitude: 10 over 0-5000, 0.01 over 0-1. */
function stepOf([low, high]: readonly [number, number]): number {
  return 10 ** (Math.floor(Math.log10(high - low)) - 2)
}

const snap = (value: number, step: number): number =>
  Number((Math.round(value / step) * step).toFixed(10))

/** The min and max of a numeric column, with a two-thumb slider over its declared `bounds`. */
export function NumberRangeEditor<T>({ model, spec }: Props<T>): ReactElement {
  const t = useMessages(table)
  const locale = useIntl().locale ?? 'en'
  const numbers = useFormat()
  const minId = useId()
  const maxId = useId()
  const { filters } = model.state.request
  const ends = rangeEnds(filterValues(filters, spec.id))
  const low = numberOf(ends[0])
  const high = numberOf(ends[1])
  // The fields show what the user types until it commits; a filter that changes under them
  // (a chip removed, a view applied) replaces it.
  const [shown, setShown] = useState<[number | null, number | null]>([low, high])
  const key = ends.join('..')
  const [seen, setSeen] = useState(key)
  if (seen !== key) {
    setSeen(key)
    setShown([low, high])
  }
  const write = (from: number | null, to: number | null): void => {
    const ordered = from !== null && to !== null && from > to ? [to, from] : [from, to]
    model.state.setRequest({
      filters: withFilter(
        filters,
        spec,
        ordered.map((v) => (v === null ? '' : String(v))),
      ),
    })
  }
  const format: Intl.NumberFormatOptions | undefined =
    spec.kind === 'money' && spec.unit !== undefined
      ? { style: 'currency', currency: spec.unit }
      : undefined
  const bounds = spec.bounds
  const step = bounds === undefined ? undefined : stepOf(bounds)
  const formatBound = (value: number): string => numbers.number(value, format)
  const field = (id: string, label: string, index: 0 | 1): ReactElement => (
    <>
      <span id={id} className="text-xs text-muted-foreground">
        {label}
      </span>
      <NumberField
        aria-labelledby={id}
        locale={locale}
        {...(format !== undefined && { format })}
        {...(bounds !== undefined && { min: bounds[0], max: bounds[1] })}
        {...(step !== undefined && { step })}
        placeholder={bounds === undefined ? label : formatBound(bounds[index])}
        value={shown[index]}
        onValueChange={(value) =>
          setShown((prev) => (index === 0 ? [value, prev[1]] : [prev[0], value]))
        }
        onValueCommitted={(value) => (index === 0 ? write(value, high) : write(low, value))}
      />
    </>
  )
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {bounds !== undefined && step !== undefined && (
        <Slider
          className="px-2"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          {...(format !== undefined && { format })}
          thumbLabels={[t('table.rangeMin'), t('table.rangeMax')]}
          value={[shown[0] ?? bounds[0], shown[1] ?? bounds[1]]}
          onValueChange={(value) => {
            const [a, b] = value as readonly number[]
            setShown([snap(a ?? bounds[0], step), snap(b ?? bounds[1], step)])
          }}
          onValueCommitted={(value) => {
            const [a = bounds[0], b = bounds[1]] = value as readonly number[]
            // A thumb at the end of the scale is an open end, so the filter keeps values past it.
            write(a <= bounds[0] ? null : snap(a, step), b >= bounds[1] ? null : snap(b, step))
          }}
        />
      )}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        {field(minId, t('table.rangeMin'), 0)}
        {field(maxId, t('table.rangeMax'), 1)}
      </div>
    </div>
  )
}

// ---- Days -----------------------------------------------------------------------------------

/** `YYYY-MM-DD` plus `n` days, on the calendar (no zone: a day is a day). */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** The last day of a day's month. */
function monthEnd(day: string): string {
  const [y, m] = day.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

type PresetKey =
  | 'table.presetToday'
  | 'table.presetWeek'
  | 'table.presetMonth30'
  | 'table.presetThisMonth'
  | 'table.presetThisYear'

/** The quick ranges, as fixed days from `today`: a saved view shows the same rows tomorrow. */
export function presetRanges(today: string): readonly [PresetKey, string, string][] {
  const month = `${today.slice(0, 7)}-01`
  const year = today.slice(0, 4)
  return [
    ['table.presetToday', today, today],
    ['table.presetWeek', addDays(today, -6), today],
    ['table.presetMonth30', addDays(today, -29), today],
    ['table.presetThisMonth', month, monthEnd(month)],
    ['table.presetThisYear', `${year}-01-01`, `${year}-12-31`],
  ]
}

/** A date column's range: quick ranges from today in the table's zone, and its day picker. */
export function DateRangeEditor<T>({ model, spec }: Props<T>): ReactElement {
  const t = useMessages(table)
  const { filters } = model.state.request
  const [from, to] = rangeEnds(filterValues(filters, spec.id))
  const domain = model.domainOf(spec.id)
  const today = dayOf(model.now, domain.kind === 'day' ? domain.zone : undefined) ?? ''
  const Picker = spec.picker
  const write = (a: string, b: string): void =>
    model.state.setRequest({ filters: withFilter(filters, spec, [a, b]) })
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
        <legend className="sr-only">{t('table.presets')}</legend>
        {presetRanges(today).map(([key, a, b]) => {
          const on = from === a && to === b
          return (
            <Button
              key={key}
              size="sm"
              variant={on ? 'secondary' : 'ghost'}
              aria-pressed={on}
              {...(!on && { className: 'text-muted-foreground' })}
              onClick={() => write(a, b)}
            >
              {t(key)}
            </Button>
          )
        })}
      </fieldset>
      {Picker !== undefined && (
        <Picker
          aria-label={t('table.dateRange', spec.header)}
          className="w-full"
          value={
            from === '' && to === ''
              ? null
              : {
                  from: from === '' ? null : (from as CalendarDate),
                  to: to === '' ? null : (to as CalendarDate),
                }
          }
          onChange={(range) => write(range.from, range.to)}
        />
      )}
    </div>
  )
}
