/**
 * The cell content each kind renders: plain functions of a present value, called by the spec's
 * `render` after the absent check. No colour beyond the `status` dot and a `delta` with a real
 * polarity (concept section 5); alignment, numerals and wrapping are attributes the parts put on
 * the cell (`cellAttributes`), so a renderer draws content only.
 */
import type { ReactNode } from 'react'
import type { CalendarDate, DateStyle, Format } from '../../core/format'
import type { Delta, IconComponent, LinkComponent, Tone } from '../../core/ports'
import { DeltaBadge } from '../../ui/badge'
import { Meter } from '../../ui/meter'
import { Status } from '../../ui/status'
import type { Align, KindSpec, Numerals } from './kinds-spec'

/** An absent value: a muted en dash. Absent is not zero (I15, consumer-linewatch). */
export const ABSENT = '–'

export function Absent(): ReactNode {
  return (
    <span data-slot="table-absent" className="text-muted-foreground">
      {ABSENT}
    </span>
  )
}

export const isAbsent = (value: unknown): value is null | undefined =>
  value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))

/** The attributes the parts spread on a `th`/`td` of this column. */
export type CellAttributes = {
  'data-kind': string
  'data-align': Align
  'data-numerals': Numerals
  'data-wrap': 'true' | 'false'
}

export function cellAttributes(
  spec: Pick<KindSpec<never>, 'kind' | 'align' | 'numerals' | 'wrap'>,
): CellAttributes {
  return {
    'data-kind': spec.kind,
    'data-align': spec.align,
    'data-numerals': spec.numerals,
    'data-wrap': spec.wrap ? 'true' : 'false',
  }
}

const minorDigits = new Map<string, number>()

/** The currency's own minor digits (`2` for EUR, `0` for JPY), cached per code. */
export function currencyDigits(currency: string): number {
  const cached = minorDigits.get(currency)
  if (cached !== undefined) return cached
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  minorDigits.set(currency, digits)
  return digits
}

export function formatMoney(format: Format, value: number, currency: string): string {
  const digits = currencyDigits(currency)
  return format.number(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatNumber(format: Format, value: number, digits: number | undefined): string {
  return digits === undefined
    ? format.number(value)
    : format.number(value, { maximumFractionDigits: digits })
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/** ISO string, `Date` or epoch ms to a `Date`; a zone-less `YYYY-MM-DD` stays a calendar date. */
export function toInstant(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export function DateCell({
  value,
  format,
  style,
}: {
  value: unknown
  format: Format
  style: DateStyle
}): ReactNode {
  if (typeof value === 'string' && CALENDAR_DATE.test(value)) {
    return <time dateTime={value}>{format.date(value as CalendarDate, style)}</time>
  }
  const instant = toInstant(value)
  if (instant === null) return <Absent />
  return <time dateTime={instant.toISOString()}>{format.date(instant, style)}</time>
}

export function RelativeTimeCell({
  value,
  format,
  now,
}: {
  value: unknown
  format: Format
  now: number
}): ReactNode {
  const instant = toInstant(value)
  if (instant === null) return <Absent />
  const full = format.dateTime(instant, 'long')
  return (
    <time dateTime={instant.toISOString()} title={full} aria-label={full}>
      {format.relative(instant, now)}
    </time>
  )
}

export function EntityCell({
  value,
  href,
  icon: Icon,
  sub,
  Link,
}: {
  value: string
  href: string | undefined
  icon: IconComponent | undefined
  sub: string | undefined
  Link: LinkComponent | undefined
}): ReactNode {
  const name =
    href === undefined ? (
      value
    ) : Link === undefined ? (
      <a href={href}>{value}</a>
    ) : (
      <Link href={href}>{value}</Link>
    )
  return (
    <span data-slot="table-entity">
      {Icon !== undefined && <Icon aria-hidden="true" size={16} />}
      <span data-slot="table-entity-name">{name}</span>
      {sub !== undefined && (
        <span data-slot="table-entity-sub" className="text-muted-foreground">
          {sub}
        </span>
      )}
    </span>
  )
}

export function StatusCell({ value, tone }: { value: string; tone: Tone }): ReactNode {
  return <Status tone={tone}>{value}</Status>
}

export function DeltaCell({
  value,
  polarity,
  format,
  unit,
}: {
  value: number
  polarity: Delta['polarity']
  format: Format
  unit: string | undefined
}): ReactNode {
  const shown = deltaText(format.number(value, { signDisplay: 'exceptZero' }), value)
  return <DeltaBadge value={unit === undefined ? shown : `${shown}${unit}`} polarity={polarity} />
}

/**
 * `DeltaBadge` reads the direction back off its text with `parseFloat`. A locale whose output
 * does not parse to the value's sign (`-0,5` in `de` reads as -0, Arabic-Indic digits as NaN)
 * would get the wrong direction and verdict, so the cell then shows the plain number instead.
 */
export function deltaText(formatted: string, value: number): string {
  const parsed = Number.parseFloat(formatted.replace('−', '-'))
  return Math.sign(parsed) === Math.sign(value) ? formatted : String(value)
}

export function MeterCell({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}): ReactNode {
  return <Meter label={label} value={value} max={max} />
}

export function BooleanCell({
  value,
  labels,
}: {
  value: boolean
  labels: readonly [string, string]
}): ReactNode {
  return (
    <span data-slot="table-boolean" data-value={value ? 'true' : 'false'}>
      <span aria-hidden="true">{value ? '✓' : '✕'}</span> {value ? labels[0] : labels[1]}
    </span>
  )
}
