/**
 * The cell content each kind renders: plain functions of a present value, called by the spec's
 * `render` after the absent check. No colour beyond the `status` dot and a `delta` with a real
 * polarity (concept section 5); alignment, numerals and wrapping are attributes the parts put on
 * the cell (`cellAttributes`), so a renderer draws content only.
 */
import type { ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { CalendarDate, DateStyle, Format } from '../../core/format'
import { AppLink } from '../../core/link'
import type { Delta, IconComponent, NavTarget, Tone } from '../../core/ports'
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

/**
 * A date value as its cell writes it: the `dateTime` attribute (the calendar day, or the instant's
 * ISO string) and the text; `null` when the value is no date. Read by the cell and by search.
 */
export function dateLabel(
  value: unknown,
  format: Format,
  style: DateStyle,
): { iso: string; text: string } | null {
  if (typeof value === 'string' && CALENDAR_DATE.test(value)) {
    return { iso: value, text: format.date(value as CalendarDate, style) }
  }
  const instant = toInstant(value)
  if (instant === null) return null
  return { iso: instant.toISOString(), text: format.date(instant, style) }
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
  const label = dateLabel(value, format, style)
  if (label === null) return <Absent />
  return <time dateTime={label.iso}>{label.text}</time>
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
  mono = false,
  subMono = false,
}: {
  value: string
  href: string | NavTarget | undefined
  icon: IconComponent | undefined
  sub: string | undefined
  /** The name is a time or an id: the mono face with tabular numerals. */
  mono?: boolean
  /** The sub line is a time or an id: the mono face with tabular numerals. */
  subMono?: boolean
}): ReactNode {
  const name = href === undefined ? value : <AppLink href={href}>{value}</AppLink>
  return (
    <span data-slot="table-entity" className="flex min-w-0 items-center gap-2">
      {Icon !== undefined && <Icon aria-hidden="true" size={16} />}
      <span
        data-slot="table-entity-name"
        data-monospace={mono ? '' : undefined}
        className={cn('max-w-full min-w-0 shrink-0 truncate', mono && 'font-mono tabular-nums')}
      >
        {name}
      </span>
      {sub !== undefined && (
        <span
          data-slot="table-entity-sub"
          data-monospace={subMono ? '' : undefined}
          className={cn(
            'min-w-0 flex-1 truncate text-muted-foreground',
            subMono && 'font-mono tabular-nums',
          )}
        >
          {sub}
        </span>
      )}
    </span>
  )
}

/**
 * A cell's leading icon (`icon` on `status`, `boolean`, `date` and `relativeTime`, like
 * `entity`'s): muted ink before the value, so it marks the value without competing with it.
 */
export function WithIcon({
  icon: Icon,
  children,
}: {
  icon: IconComponent | undefined
  children: ReactNode
}): ReactNode {
  if (Icon === undefined) return children
  return (
    <span
      data-slot="table-cell-icon"
      className="inline-flex max-w-full min-w-0 items-center gap-1.5"
    >
      <Icon aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
      {children}
    </span>
  )
}

/** The ink of a status icon per tone: the icon takes the dot's place and its colour. */
const TONE_INK: Readonly<Record<Tone, string>> = {
  neutral: 'text-muted-foreground',
  accent: 'text-brand',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
}

export function StatusCell({
  value,
  tone,
  icon: Icon,
}: {
  value: string
  tone: Tone
  icon?: IconComponent | undefined
}): ReactNode {
  if (Icon === undefined) return <Status tone={tone}>{value}</Status>
  return (
    <span
      data-slot="table-status"
      data-tone={tone}
      className="inline-flex max-w-full items-center gap-1.5 text-sm whitespace-nowrap text-foreground"
    >
      <Icon aria-hidden="true" size={14} className={cn('shrink-0', TONE_INK[tone])} />
      {value}
    </span>
  )
}

export function DeltaCell({
  value,
  polarity,
  format,
  unit,
  currency,
}: {
  value: number
  polarity: Delta['polarity']
  format: Format
  unit: string | undefined
  /** A money delta: the amount in the currency's own digits with its sign, `+€50.00`; wins over `unit`. */
  currency?: string | undefined
}): ReactNode {
  // No change is not a figure: the muted dash, as an absent value (a chip would say `0`).
  if (value === 0) return <Absent />
  return <DeltaBadge value={deltaLabel(format, value, unit, currency)} polarity={polarity} />
}

/** A change as its cell writes it: `+€50.00` in the currency's own digits, else the signed number and its unit. */
export function deltaLabel(
  format: Format,
  value: number,
  unit: string | undefined,
  currency: string | undefined,
): string {
  if (currency !== undefined) {
    const digits = currencyDigits(currency)
    const money = format.number(value, {
      style: 'currency',
      currency,
      signDisplay: 'exceptZero',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    return deltaText(money, value)
  }
  const shown = deltaText(format.number(value, { signDisplay: 'exceptZero' }), value)
  return unit === undefined ? shown : `${shown}${unit}`
}

/**
 * `DeltaBadge` reads the direction back off its text with `parseFloat`. A locale whose output
 * does not parse to the value's sign (`-0,5` in `de` reads as -0, Arabic-Indic digits as NaN)
 * would get the wrong direction and verdict, so the cell then shows the plain number instead.
 */
export function deltaText(formatted: string, value: number): string {
  const parsed = Number.parseFloat(formatted.replace('−', '-').replaceAll(/[^\d.,+-]/g, ''))
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
  // A table cell holds one text line: the bar and its value sit side by side on that line, not stacked.
  return (
    <Meter
      label={label}
      value={value}
      max={max}
      className="flex-row items-center gap-2 [&_[data-readout]]:contents [&_[data-readout]>span:empty]:hidden [&_[data-readout]>span:last-child]:shrink-0 [&_[data-readout]>span:last-child]:whitespace-nowrap"
    />
  )
}

export function BooleanCell({
  value,
  labels,
  icon: Icon,
}: {
  value: boolean
  labels: readonly [string, string]
  /** Takes the place of the check or cross glyph. */
  icon?: IconComponent | undefined
}): ReactNode {
  if (Icon !== undefined) {
    return (
      <span
        data-slot="table-boolean"
        data-value={value ? 'true' : 'false'}
        className="inline-flex items-center gap-1.5"
      >
        <Icon aria-hidden="true" size={16} className="shrink-0 text-muted-foreground" />
        {value ? labels[0] : labels[1]}
      </span>
    )
  }
  return (
    <span data-slot="table-boolean" data-value={value ? 'true' : 'false'}>
      <span aria-hidden="true">{value ? '✓' : '✕'}</span> {value ? labels[0] : labels[1]}
    </span>
  )
}
