/**
 * `EventList`'s pure half: day grouping and the large-feed assertion. The caller's order is kept: a
 * group is a run of adjacent items on one day, never a re-sort. What a "day" is belongs to the
 * caller (the provider's time zone), passed in as `dayOf`.
 */

export const toInstant = (at: Date | number): Date => (at instanceof Date ? at : new Date(at))

export const isInstant = (at: Date): boolean => Number.isFinite(at.getTime())

export type EventGroup<T extends { readonly at: Date | number }> = {
  /** The run's first real instant, or an invalid date for a list with none. */
  readonly day: Date
  /** The day key plus the run's occurrence, so a same-day prepend keeps every group's identity. */
  readonly id: string
  readonly items: readonly T[]
}

/**
 * Runs of adjacent items on one day, in the order given. An item whose `at` is invalid has no day
 * of its own: it joins the run before it, or (leading) the first real run that follows. A list with
 * no real instant at all is one group on an invalid day, which renders without a header.
 */
export function groupByDay<T extends { readonly at: Date | number }>(
  items: readonly T[],
  dayOf: (at: Date) => string,
): EventGroup<T>[] {
  const runs: { day: Date; key: string; items: T[] }[] = []
  const leading: T[] = []
  for (const item of items) {
    const at = toInstant(item.at)
    const last = runs[runs.length - 1]
    if (!isInstant(at)) {
      if (last === undefined) leading.push(item)
      else last.items.push(item)
      continue
    }
    const key = dayOf(at)
    if (last !== undefined && last.key === key) last.items.push(item)
    else
      runs.push({
        day: at,
        key,
        items: runs.length === 0 ? [...leading, item] : [item],
      })
  }
  if (runs.length === 0) {
    return leading.length === 0
      ? []
      : [{ day: new Date(Number.NaN), id: 'invalid#0', items: leading }]
  }
  const seen = new Map<string, number>()
  return runs.map((run) => {
    const n = seen.get(run.key) ?? 0
    seen.set(run.key, n + 1)
    return { day: run.day, id: `${run.key}#${n}`, items: run.items }
  })
}

/** Which calendar bucket a moment falls in, relative to a "now". */
export type PeriodKind = 'today' | 'yesterday' | 'week' | 'month' | 'monthOf' | 'year'

export type Period = {
  readonly kind: PeriodKind
  /** Equal for two moments in one bucket: `today`, `week`, `2026-08` (a month), `2025` (a year). */
  readonly key: string
  readonly year: number
  /** 1 to 12. */
  readonly month: number
}

export type PeriodOptions = {
  /** IANA zone the calendar is read in. Default `UTC`, as `createFormat` does; `'host'` is the runtime's. */
  timeZone?: string | undefined
  /** The first day of the week, 0 for Sunday. Default 1, Monday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Name today and yesterday as their own buckets. Default `true`; `false` folds both into `week`. */
  days?: boolean
}

const zones = new Map<string, Intl.DateTimeFormat>()

/** The calendar day of `at` in `timeZone` as a day count (and its year and month): arithmetic on it is DST-proof. */
function calendarDay(
  at: Date,
  timeZone: string | undefined,
): { day: number; year: number; month: number } {
  const zone = timeZone === 'host' ? '' : (timeZone ?? 'UTC')
  let format = zones.get(zone)
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en-u-nu-latn', {
      ...(zone !== '' && { timeZone: zone }),
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    zones.set(zone, format)
  }
  const part = (type: string): number =>
    Number(format.formatToParts(at).find((p) => p.type === type)?.value)
  const year = part('year')
  const month = part('month')
  return { day: Math.floor(Date.UTC(year, month - 1, part('day')) / 86_400_000), year, month }
}

/**
 * The bucket a moment belongs to, read on the calendar of `now`: today and yesterday (unless
 * `days: false`), then the rest of this week, the earlier days of this month, each earlier month of
 * this year by name, and every earlier year by its number. A moment after the week ends keeps its
 * own month or year. One pure function, so a day-grouped list elsewhere (a mailbox) reads the same
 * boundaries; `now` is the caller's, never the clock's, so a server and a client agree.
 *
 * @useWhen a list of moments is headed by calendar period (a mailbox's day groups, an activity feed's This week and Earlier this month)
 * @neverWhen the grouping is by an exact day key only (group on `f.date(at, 'short')`), or the moments are not in a time zone you can name
 *
 * @example
 * periodOf(new Date('2026-08-03'), new Date('2026-11-23')).key // '2026-08'
 */
export function periodOf(at: Date, now: Date, options: PeriodOptions = {}): Period {
  const { timeZone, weekStartsOn = 1, days = true } = options
  const then = calendarDay(at, timeZone)
  const today = calendarDay(now, timeZone)
  const make = (kind: PeriodKind, key: string): Period => ({
    kind,
    key,
    year: then.year,
    month: then.month,
  })
  if (days && then.day === today.day) return make('today', 'today')
  if (days && then.day === today.day - 1) return make('yesterday', 'yesterday')
  // 1970-01-01 was a Thursday (4).
  const weekday = (((today.day + 4) % 7) + 7) % 7
  const weekStart = today.day - ((weekday - weekStartsOn + 7) % 7)
  if (then.day >= weekStart && then.day < weekStart + 7) return make('week', 'week')
  if (then.year === today.year && then.month === today.month && then.day < weekStart) {
    return make('month', 'month')
  }
  if (then.year === today.year) {
    return make('monthOf', `${then.year}-${String(then.month).padStart(2, '0')}`)
  }
  return make('year', String(then.year))
}

/** A body past this many characters, or over more than one line, folds to one line with an expander. */
export const FOLD_BODY = 90

export const isLongBody = (body: string): boolean => body.length > FOLD_BODY || body.includes('\n')

/** Above this the feed is the wrong shape: filter, page on the server, or use a table. */
export const LARGE_FEED = 200

let warned = false

/** Dev only: says once per page load that a feed holds more than `LARGE_FEED` rows. */
export function warnLargeFeed(count: number): void {
  if (process.env.NODE_ENV === 'production' || warned || count <= LARGE_FEED) return
  warned = true
  console.warn(
    `EventList holds ${count} rows (over ${LARGE_FEED}). It pages with "Show more" and never windows: filter the feed or page it on the server.`,
  )
}

/** Test seam: forget that the warning ran. */
export function resetLargeFeedWarning(): void {
  warned = false
}
