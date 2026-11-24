/**
 * The cell content each kind renders: plain functions of a present value, called by the spec's
 * `render` after the absent check. No color beyond the `status` dot and a `delta` with a real
 * polarity (concept section 5); alignment, numerals and wrapping are attributes the parts put on
 * the cell (`cellAttributes`), so a renderer draws content only.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../core/cn'
import type { CalendarDate, DateStyle, Format } from '../../core/format'
import { AppLink } from '../../core/link'
import { table } from '../../core/messages/table'
import { useMessages } from '../../core/messages/use-messages'
import type { Delta, IconComponent, NavTarget, Tone } from '../../core/ports'
import { TRUE_MINUS } from '../../format/shared'
import { Avatar, AvatarStack } from '../../ui/avatar'
import type { AvatarEntry } from '../../ui/avatar'
import { DeltaBadge } from '../../ui/badge'
import { Meter } from '../../ui/meter'
import { Status } from '../../ui/status'
import { dayOf } from './filters'
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
  value === null ||
  value === undefined ||
  (typeof value === 'number' && Number.isNaN(value)) ||
  (Array.isArray(value) && value.length === 0)

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

export function formatMoney(
  format: Format,
  value: number,
  currency: string,
  fractionDigits?: number,
): string {
  const digits = fractionDigits ?? currencyDigits(currency)
  return format
    .number(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replaceAll('-', TRUE_MINUS)
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

/** A time drawn in the mono face: the attribute the base styles read and the classes the cell draws. */
const monoProps = (mono: boolean): { 'data-monospace'?: ''; className?: string } =>
  mono ? { 'data-monospace': '', className: 'font-mono tabular-nums' } : {}

export function DateCell({
  value,
  format,
  style,
  mono = false,
}: {
  value: unknown
  format: Format
  style: DateStyle
  /** The date is a time: the mono face with tabular numerals. */
  mono?: boolean
}): ReactNode {
  const label = dateLabel(value, format, style)
  if (label === null) return <Absent />
  return (
    <time dateTime={label.iso} {...monoProps(mono)}>
      {label.text}
    </time>
  )
}

export function RelativeTimeCell({
  value,
  format,
  now,
  mono = false,
}: {
  value: unknown
  format: Format
  now: number
  /** The relative time is a time: the mono face with tabular numerals. */
  mono?: boolean
}): ReactNode {
  const instant = toInstant(value)
  if (instant === null) return <Absent />
  const full = format.dateTime(instant, 'long')
  return (
    <time dateTime={instant.toISOString()} title={full} aria-label={full} {...monoProps(mono)}>
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
  image,
  id,
}: {
  value: string
  href: string | NavTarget | undefined
  icon: IconComponent | undefined
  sub: string | undefined
  /** A logo or photo: a 16 px face before the name; `src` is absent for a row with none (initials show). */
  image?: { src: string | undefined; shape: 'person' | 'object' } | undefined
  /** A short reference (`INV-0042`) in muted mono beside the name. */
  id?: string | undefined
  /** The name is a time or an id: the mono face with tabular numerals. */
  mono?: boolean
  /** The sub line is a time or an id: the mono face with tabular numerals. */
  subMono?: boolean
}): ReactNode {
  const name = href === undefined ? value : <AppLink href={href}>{value}</AppLink>
  return (
    <span data-slot="table-entity" className="flex min-w-0 items-center gap-2">
      {image !== undefined ? (
        <Avatar
          name={value}
          {...(image.src !== undefined && { src: image.src })}
          shape={image.shape}
          size="xs"
          aria-hidden="true"
        />
      ) : (
        Icon !== undefined && <Icon aria-hidden="true" size={16} />
      )}
      <span
        data-slot="table-entity-name"
        data-monospace={mono ? '' : undefined}
        className={cn('max-w-full min-w-0 shrink-0 truncate', mono && 'font-mono tabular-nums')}
      >
        {name}
      </span>
      {id !== undefined && (
        <span
          data-slot="table-entity-id"
          className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
        >
          {id}
        </span>
      )}
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

/** The ink of a status icon per tone: the icon takes the dot's place and its color. */
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
 * would get the wrong direction and verdict, so the cell then shows the plain signed number instead.
 */
export function deltaText(formatted: string, value: number): string {
  const parsed = Number.parseFloat(formatted.replace('−', '-').replaceAll(/[^\d.,+-]/g, ''))
  if (Math.sign(parsed) === Math.sign(value)) return formatted
  // A rise keeps its plus: a figure with no sign draws no arrow.
  return value > 0 ? `+${value}` : String(value)
}

export function MeterCell({
  label,
  value,
  max,
  write,
  tone,
}: {
  label: string
  value: number
  max: number
  /** How the readout writes the value: a fraction column writes `455/472`. */
  write?: ((value: number) => string) | undefined
  /** The fill's tone; the meter's neutral when absent. */
  tone?: Tone | undefined
}): ReactNode {
  // A table cell holds one text line: the bar and its value sit side by side on that line, not stacked.
  // A written readout (a fraction) keeps one width down the column, so every track ends at one x.
  return (
    <Meter
      label={label}
      value={value}
      max={max}
      {...(write !== undefined && { format: write })}
      {...(tone !== undefined && { tone })}
      className={cn(
        'flex-row items-center gap-2 [&>div:first-child]:min-w-6 [&>div:first-child]:flex-1 [&_[data-readout]]:contents [&_[data-readout]>span:empty]:hidden [&_[data-readout]>span:last-child]:shrink-0 [&_[data-readout]>span:last-child]:whitespace-nowrap',
        write !== undefined && '[&_[data-readout]>span:last-child]:min-w-12',
      )}
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

// ---- person, tags, countdown, link ---------------------------------------------------------

/** One person: a 16 px round face, the name, and the role in muted ink after it. */
export function PersonCell({
  name,
  src,
  role,
  href,
}: {
  name: string
  src: string | undefined
  role: string | undefined
  href: string | NavTarget | undefined
}): ReactNode {
  const label = href === undefined ? name : <AppLink href={href}>{name}</AppLink>
  return (
    <span
      data-slot="table-person"
      className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle"
    >
      <Avatar name={name} {...(src !== undefined && { src })} size="xs" aria-hidden="true" />
      <span className="max-w-full min-w-0 shrink-0 truncate">{label}</span>
      {role !== undefined && (
        <span
          data-slot="table-person-role"
          className="min-w-0 flex-1 truncate text-muted-foreground"
        >
          {role}
        </span>
      )}
    </span>
  )
}

/** Several people: overlapping 16 px faces (one initial each, the size of a `person` face) with a `+N`; the names are the group's title. */
export function PeopleCell({
  label,
  people,
  max,
}: {
  label: string
  people: readonly AvatarEntry[]
  max: number
}): ReactNode {
  return (
    <span data-slot="table-people" title={people.map((p) => p.name).join(', ')}>
      <AvatarStack label={label} people={people} max={max} size="xs" />
    </span>
  )
}

/**
 * The chip's ink and ground per tone. Neutral and accent are a hairline with no ground, so a chip in
 * the active or selected row never sits on its own tint (a `Lozenge` there fails contrast); the
 * verdict tones are the tinted lozenge.
 */
const TAG_TONE: Readonly<Record<Tone, string>> = {
  neutral: 'border border-border text-muted-foreground',
  accent: 'border border-border text-brand',
  good: 'bg-good-tint text-good',
  warn: 'bg-warn-tint text-warn',
  bad: 'bg-bad-tint text-bad',
  info: 'bg-info-tint text-info',
}

function TagChip({
  tone,
  hidden,
  text,
  icon: Icon,
}: {
  tone: Tone
  hidden: boolean
  text: string
  icon?: IconComponent | undefined
}): ReactNode {
  return (
    <span
      data-slot="table-tag"
      aria-hidden={hidden ? 'true' : undefined}
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-chip px-1.5 text-xs font-medium whitespace-nowrap',
        Icon !== undefined && 'gap-1',
        TAG_TONE[tone],
        hidden && 'invisible',
      )}
    >
      {Icon !== undefined && <Icon aria-hidden="true" size={16} className="size-icon shrink-0" />}
      {text}
    </span>
  )
}

/** Width of the `+N` chip and its gap, kept free once the chips overflow. */
const MORE_CHIP_PX = 32

/**
 * Tag chips on one line. The chips that do not fit are dropped, never wrapped, and a `+N` chip
 * (its title lists the hidden ones) takes their place. Fit is measured after layout against the
 * cell's own width, so it follows a resize; the first paint shows every chip, clipped.
 */
export function TagsCell({
  tags,
  labels,
  tone,
  icon,
}: {
  tags: readonly string[]
  labels: Readonly<Record<string, string>> | undefined
  tone: ((tag: string) => Tone) | undefined
  icon: ((tag: string) => IconComponent | undefined) | undefined
}): ReactNode {
  const outer = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState(tags.length)
  const key = tags.join('\u0000')
  useLayoutEffect(() => {
    const box = outer.current
    const chips = row.current?.children
    if (box === null || chips === undefined || row.current === null) return
    const measure = (): void => {
      const width = box.clientWidth
      const start = row.current?.offsetLeft ?? 0
      const ends = Array.from(chips, (chip) => {
        const el = chip as HTMLElement
        return el.offsetLeft - start + el.offsetWidth
      })
      // No layout (hidden, detached): show everything rather than a bare `+N`.
      if (width === 0 || ends.every((end) => end === 0)) return setFit(tags.length)
      if ((ends.at(-1) ?? 0) <= width) return setFit(tags.length)
      setFit(ends.filter((end) => end <= width - MORE_CHIP_PX).length)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
    // the chip list is its identity: a new array of the same tags measures the same
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `tags`
  }, [key])
  const hidden = tags.slice(fit)
  return (
    <span
      ref={outer}
      data-slot="table-tags"
      className="inline-flex max-w-full min-w-0 items-center gap-1 overflow-hidden align-middle"
    >
      <span ref={row} className="flex min-w-0 items-center gap-1 overflow-hidden">
        {tags.map((tag, i) => (
          <TagChip
            key={tag}
            tone={tone?.(tag) ?? 'neutral'}
            hidden={i >= fit}
            text={labels?.[tag] ?? tag}
            icon={icon?.(tag)}
          />
        ))}
      </span>
      {hidden.length > 0 && (
        <span
          data-slot="table-tags-more"
          title={hidden.map((tag) => labels?.[tag] ?? tag).join(', ')}
          className="inline-flex shrink-0"
        >
          <TagChip tone="neutral" hidden={false} text={`+${hidden.length}`} />
        </span>
      )}
    </span>
  )
}

const DAY_MS = 86_400_000

/**
 * Whole calendar days from today to `value` in `zone` (`'host'` the runtime's, absent UTC): 0 today,
 * negative past. `null` when the value is no date.
 */
export function countdownDays(
  value: unknown,
  now: number,
  zone: string | undefined,
): number | null {
  const where = zone === 'host' ? undefined : (zone ?? 'UTC')
  const due = dayOf(value, where)
  const today = dayOf(now, where)
  if (due === null || today === null) return null
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
}

/** The thresholds a `countdown` column declares: days left at or below which the text turns. */
export type CountdownLimits = {
  /** Days at or below which the text is `bad`. Default -1: anything overdue. */
  bad: number
  /** Days at or below which the text is `warn`; absent, no warning band. */
  warn: number | undefined
  /** Distance in days beyond which the cell prints the date. */
  horizon: number
}

export function countdownTone(days: number, limits: CountdownLimits): Tone {
  if (days <= limits.bad) return 'bad'
  if (limits.warn !== undefined && days <= limits.warn) return 'warn'
  return 'neutral'
}

/** The ink of a countdown: plain until a threshold turns it, never a fill or a row tint. */
const COUNTDOWN_INK: Readonly<Record<Tone, string>> = {
  neutral: '',
  accent: 'text-brand',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
}

/** A date as its distance from today: `26 days late`, `Today`, `in 4 days`; the date past the horizon. */
export function CountdownCell({
  value,
  format,
  now,
  zone,
  limits,
}: {
  value: unknown
  format: Format
  now: number
  zone: string | undefined
  limits: CountdownLimits
}): ReactNode {
  const t = useMessages(table)
  const days = countdownDays(value, now, zone)
  const label = dateLabel(value, format, 'short')
  if (days === null || label === null) return <Absent />
  const text =
    Math.abs(days) > limits.horizon
      ? label.text
      : days === 0
        ? t('table.countdownToday')
        : days < 0
          ? t('table.countdownLate', -days)
          : t('table.countdownIn', days)
  const tone = countdownTone(days, limits)
  return (
    <time
      dateTime={label.iso}
      title={label.text}
      data-slot="table-countdown"
      data-tone={tone}
      className={cn('tabular-nums', COUNTDOWN_INK[tone])}
    >
      {text}
    </time>
  )
}

const WEB_URL = /^https?:\/\//i
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/

/**
 * Where a link's text points: an `http(s)`, `mailto` or `tel` URL as written, a bare address as
 * `mailto:`. Anything else (a `javascript:` URL included) has no destination and prints as text.
 */
export function linkTarget(text: string): { href: string; web: boolean } | null {
  const value = text.trim()
  if (SAFE_URL.test(value)) return { href: value, web: WEB_URL.test(value) }
  if (EMAIL.test(value)) return { href: `mailto:${value}`, web: false }
  return null
}

/** A link's text when the row names none: the URL without its scheme and trailing slash. */
export function linkLabel(text: string): string {
  return text
    .trim()
    .replace(/^(https?:\/\/|mailto:|tel:)/i, '')
    .replace(/\/$/, '')
}

/** A URL, an address or a record link as quiet text, with an optional leading icon. */
export function LinkCell({
  text,
  label: named,
  href,
  icon: Icon,
}: {
  /** The stored value: a URL, an address or the record's name. */
  text: string
  /** What is printed, when the row names it; else the value without its scheme. */
  label: string | undefined
  /** A record link or in-app path the row names; it wins over the value's own destination. */
  href: string | NavTarget | undefined
  icon: IconComponent | undefined
}): ReactNode {
  const own = href === undefined ? linkTarget(text) : null
  const className =
    '-my-1 min-w-0 truncate py-1 text-muted-foreground underline-offset-2 pointer-coarse:-my-3 pointer-coarse:py-3 hover:text-foreground hover:underline focus-visible:text-foreground'
  const label = named ?? (own === null ? text : linkLabel(text))
  let body: ReactNode = <span className="min-w-0 truncate text-muted-foreground">{label}</span>
  if (href !== undefined) {
    body = (
      <AppLink href={href} className={className}>
        {label}
      </AppLink>
    )
  } else if (own !== null) {
    body = (
      <a
        href={own.href}
        className={className}
        {...(own.web && { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {label}
      </a>
    )
  }
  return (
    <span
      data-slot="table-link"
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle"
    >
      {Icon !== undefined && (
        <Icon aria-hidden="true" size={14} className="shrink-0 text-muted-foreground" />
      )}
      {body}
    </span>
  )
}

/** A text column's `quiet` cell: muted ink on one truncated line, the preview of a record. */
export function QuietText({ text }: { text: string }): ReactNode {
  return (
    <span
      data-slot="table-quiet"
      title={text}
      className="inline-block max-w-full truncate align-bottom text-muted-foreground"
    >
      {text}
    </span>
  )
}

// ---- the reading look: a stacked meter, a figure with its trend and age, a lamp -------------

/**
 * A span in the one largest unit, for a figure in a column: `45 sec`, `30 min`, `1.4 hr`, `2.1 days`,
 * `12 days` (the locale's short unit names, a decimal below ten from an hour up). A value that rounds
 * into the next unit takes it: 59 min 50 s is `1 hr`.
 */
export function durationText(format: Format, ms: number): string {
  if (!Number.isFinite(ms)) return ABSENT
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.round(total / 60)
  const hours = total / 3_600
  const [unit, n] =
    total < 60
      ? (['second', total] as const)
      : minutes < 60
        ? (['minute', minutes] as const)
        : Math.round(hours * 10) / 10 < 24
          ? (['hour', hours] as const)
          : (['day', total / 86_400] as const)
  const decimal = (unit === 'hour' || unit === 'day') && n < 10 ? 1 : 0
  return format.number(n, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: decimal,
  })
}

/** The fill of a meter part, one class per tone, written out so the scanner sees each. */
const TONE_FILL: Readonly<Record<Tone, string>> = {
  neutral: 'bg-muted-foreground',
  accent: 'bg-brand-fill',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
}

/** The dot of a lamp, one class per tone: a quiet lamp is a ring, so it differs from a lit one by shape. */
const TONE_DOT: Readonly<Record<Tone, string>> = {
  ...TONE_FILL,
  neutral: 'border-[1.5px] border-muted-foreground',
}

const share = (part: number, whole: number): string =>
  `${Math.min(100, Math.max(0, (part / whole) * 100))}%`

/** One toned part of a stacked meter, as the cell draws it. */
export type MeterPart = { label: string; value: number; tone: Tone }

/**
 * Several toned parts on one track and their total beside it, all on the track's scale (`max`,
 * or the total when it is larger). The parts are named in order with their counts for assistive
 * tech and on hover; a part of zero draws nothing.
 */
export function StackedMeterCell({
  label,
  parts,
  total,
  max,
  format,
}: {
  label: string
  parts: readonly MeterPart[]
  total: number
  max: number
  format: Format
}): ReactNode {
  const drawn = parts.filter((part) => part.value > 0)
  const scale = Math.max(max, total, 1)
  const named = drawn.map((part) => `${part.label} ${format.number(part.value)}`).join(', ')
  const head = `${label}: ${format.number(total)}`
  const said = named === '' ? head : `${head}; ${named}`
  return (
    <span data-slot="table-meter-stack" title={said} className="flex min-w-0 items-center gap-2">
      <span
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the track of toned parts is one image to assistive tech, and an <img> holds no children
        role="img"
        aria-label={head}
        className="flex h-2 min-w-0 flex-1 gap-px overflow-hidden rounded-full bg-selected"
      >
        {drawn.map((part) => (
          <span
            key={part.label}
            data-part={part.label}
            data-tone={part.tone}
            style={{ '--part': share(part.value, scale) } as CSSProperties}
            className={cn('h-full w-(--part) shrink-0', TONE_FILL[part.tone])}
          />
        ))}
      </span>
      <span aria-hidden="true" className="min-w-6 shrink-0 text-end tabular-nums">
        {format.number(total)}
      </span>
      {/* the parts in words: heard after the total, and read on the phone card beside the track */}
      {named !== '' && (
        <span data-slot="table-meter-parts" className="sr-only">
          {named}
        </span>
      )}
    </span>
  )
}

/** A column's trend: the value before, the words that name when it was, and which way is better. */
export type TrendSpec = {
  before: number | null | undefined
  /** Which way is the good one: a duration is better `lower`, a count of shipped work `higher`. */
  better: 'lower' | 'higher'
  /** A change within this share of the value before is flat. */
  flat: number
  /** Words after the comparison that name the value before: `the 7 days before`. */
  against: string | undefined
  /** How the value before is written: the column's own format. */
  write: (value: number) => string
}

type Direction = 'up' | 'down' | 'flat'

/** The direction of a change against the value before, or `null` without one. */
export function trendOf(value: number, trend: TrendSpec): Direction | null {
  const before = trend.before
  if (before === null || before === undefined || !Number.isFinite(before)) return null
  const base = Math.max(Math.abs(before), Number.EPSILON)
  const change = (value - before) / base
  if (Math.abs(change) <= trend.flat) return 'flat'
  return change > 0 ? 'up' : 'down'
}

const TREND_PATH: Readonly<Record<Direction, string>> = {
  up: 'M4.5 11.5l7-7M6 4.5h5.5V10',
  down: 'M4.5 4.5l7 7M11.5 6v5.5H6',
  flat: 'M3 8h10M9.5 4.5L13 8l-3.5 3.5',
}

/** The arrow of a trend, in the tone its column's rule gives it; the slot stays when there is none. */
function TrendMark({
  direction,
  better,
}: {
  direction: Direction | null
  better: 'lower' | 'higher'
}): ReactNode {
  if (direction === null) return <span aria-hidden="true" className="size-3.5 shrink-0" />
  const good = better === 'lower' ? 'down' : 'up'
  const tone: Tone = direction === 'flat' ? 'neutral' : direction === good ? 'good' : 'bad'
  return (
    <svg
      data-slot="table-trend"
      data-direction={direction}
      data-tone={tone}
      viewBox="0 0 16 16"
      className={cn('size-3.5 shrink-0', TONE_INK[tone])}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TREND_PATH[direction]} />
    </svg>
  )
}

/** The second value of a cell: an instant, and the words that name it for assistive tech. */
export type AgeSpec = { at: unknown; label: string | undefined }

/**
 * A quiet age after a cell's first value (`3 hr`, `2.1 days`): a slot of its own width, so the
 * first values line up down the column whether a row has an age or not. Assistive tech hears the
 * relative time, after the column's label for it; a hover shows the date and time.
 */
function Age({
  age,
  format,
  now,
  align,
}: {
  age: AgeSpec
  format: Format
  now: number
  align: 'start' | 'end'
}): ReactNode {
  const instant = toInstant(age.at)
  const slot = cn(
    'w-15 shrink-0 font-mono text-xs text-muted-foreground tabular-nums',
    align === 'end' ? 'text-end' : 'text-start',
  )
  if (instant === null) return <span aria-hidden="true" className={slot} />
  const relative = format.relative(instant, now)
  return (
    <span data-slot="table-age" title={format.dateTime(instant)} className={slot}>
      <span aria-hidden="true">{durationText(format, now - instant.getTime())}</span>
      <span className="sr-only">
        , {age.label === undefined ? relative : `${age.label} ${relative}`}
      </span>
    </span>
  )
}

/**
 * A numeric cell of the reading look: the figure, then the trend arrow and the age in slots of
 * their own, so figures line up down the column. A fraction writes `11/12` and is heard as
 * `11 of 12`; a toned figure (a fraction under its threshold) takes the tone in its ink. The
 * comparison of a trend is said in words for assistive tech and on hover.
 */
export function FigureCell({
  text,
  fraction,
  tone,
  trend,
  age,
  format,
  now,
}: {
  /** The figure as written; an absent value passes the dash, so its slots keep the column's line. */
  text: ReactNode
  fraction?: { part: number; whole: number } | undefined
  tone?: Tone | undefined
  /** `value: null`: no figure to compare, the arrow's slot stays empty. */
  trend?: { value: number | null; spec: TrendSpec } | undefined
  age?: AgeSpec | undefined
  format: Format
  now: number
}): ReactNode {
  const t = useMessages(table)
  const said =
    fraction === undefined ? undefined : t('table.fraction', fraction.part, fraction.whole)
  const direction =
    trend === undefined || trend.value === null ? null : trendOf(trend.value, trend.spec)
  const before = trend?.spec.before
  const words =
    trend === undefined || direction === null || before === null || before === undefined
      ? undefined
      : [
          t(
            direction === 'up'
              ? 'table.trendUp'
              : direction === 'down'
                ? 'table.trendDown'
                : 'table.trendFlat',
            trend.spec.write(before),
          ),
          trend.spec.against,
        ]
          .filter((part) => part !== undefined)
          .join(' ')
  const toned = tone !== undefined && tone !== 'neutral'
  return (
    <span
      data-slot="table-figure"
      {...(toned && { 'data-tone': tone })}
      title={
        words === undefined ? said : `${said ?? (typeof text === 'string' ? text : '')}, ${words}`
      }
      className="inline-flex max-w-full items-center justify-end gap-1.5 whitespace-nowrap"
    >
      <span className={cn('min-w-0 truncate', toned && TONE_INK[tone])}>
        {said === undefined ? (
          text
        ) : (
          <>
            <span aria-hidden="true">{text}</span>
            <span className="sr-only">{said}</span>
          </>
        )}
      </span>
      {trend !== undefined && (
        <>
          <TrendMark direction={direction} better={trend.spec.better} />
          {words !== undefined && <span className="sr-only">, {words}</span>}
        </>
      )}
      {age !== undefined && <Age age={age} format={format} now={now} align="end" />}
    </span>
  )
}

/**
 * A status as a lamp: the toned dot alone, its word for assistive tech and on hover, and an
 * optional age after it in a slot of its own.
 */
export function LampCell({
  value,
  tone,
  age,
  format,
  now,
}: {
  value: string
  tone: Tone
  age?: AgeSpec | undefined
  format: Format
  now: number
}): ReactNode {
  return (
    <span
      data-slot="table-lamp"
      data-tone={tone}
      title={value}
      className="inline-flex max-w-full items-center gap-2 whitespace-nowrap"
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE_DOT[tone])} />
      <span data-slot="table-lamp-word" className="sr-only">
        {value}
      </span>
      {age !== undefined && <Age age={age} format={format} now={now} align="start" />}
    </span>
  )
}

/** A cell's first value and its age after it: the value takes the room, so the ages line up down the column. */
export function WithAge({
  children,
  age,
  format,
  now,
}: {
  children: ReactNode
  age: AgeSpec
  format: Format
  now: number
}): ReactNode {
  return (
    <span className="flex w-full min-w-0 items-center gap-2 whitespace-nowrap">
      <span className="flex min-w-0 flex-1">{children}</span>
      <Age age={age} format={format} now={now} align="start" />
    </span>
  )
}

/** A spark and its total beside it: the line takes the room, the figure keeps its own. */
export function SparkTotalCell({
  spark,
  total,
}: {
  spark: ReactNode
  total: ReactNode
}): ReactNode {
  return (
    <span data-slot="table-spark-total" className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1">{spark}</span>
      <span className="min-w-6 shrink-0 text-end tabular-nums">{total}</span>
    </span>
  )
}
