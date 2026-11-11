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
