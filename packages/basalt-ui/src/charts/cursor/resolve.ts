/**
 * Domain-aware resolution of a BROADCAST cursor key against a chart's own points.
 *
 * The layer this replaced matched keys byte-for-byte, so two charts shared a cursor only if they emitted identical
 * strings. A chart that folded its domain to fit a narrow viewport stopped owning most of the keys
 * its siblings broadcast, and the shared crosshair then landed on roughly one hover in three with
 * no rule a reader could infer — patched per chart by a manual `resolveKey`. Resolving on the
 * PARSED domain instead makes that automatic (`docs/CHARTS-SPEC.md` §3).
 */

/**
 * A key as a comparable number: numeric-looking strings as numbers, everything else as a date.
 * Neither (a plain category like "Direct") → null, which degrades to exact-match only — correct,
 * since "nearest category" is meaningless.
 */
export function parseKey(key: string): number | null {
  if (/^[-+]?\d*\.?\d+$/.test(key)) {
    const n = Number(key)
    return Number.isFinite(n) ? n : null
  }
  const t = Date.parse(key)
  return Number.isNaN(t) ? null : t
}

/**
 * How a foreign key maps onto a chart's own points.
 *
 * `'nearest'` (default) treats every key as a POINT — the foreign key resolves to whichever own
 * point sits closest to it. Correct when a chart's x-domain is a set of instants.
 *
 * `'leading'` treats every key as the LEADING EDGE of a bucket covering `[key, nextKey)` — the
 * foreign key resolves to the LAST own key `<=` it. Use this when a chart's keys are bucket
 * starts (a weekly series keyed by the Monday of each week, a monthly series keyed by the 1st):
 * under `'nearest'`, a target landing in the back half of a bucket resolves to the FOLLOWING
 * bucket instead of the one it's actually inside, and the shared crosshair lands one column off
 * for every back-half hover.
 *
 * The two modes differ at the DOMAIN EDGES too, and deliberately: `'nearest'` tolerates one step
 * past each end (the target is an instant, so the closest point is still a defensible answer),
 * while `'leading'` bounds strictly to `[first, last + step)` — outside that range no bucket
 * CONTAINS the key, and answering with the nearest one would paint a crosshair on a bucket that
 * provably excludes it.
 */
export type CursorResolution = 'nearest' | 'leading'

export type DomainIndex<T> = {
  byKey: Map<string, T>
  /** Parsed positions, ascending. Empty when the domain isn't parseable. */
  values: number[]
  /** Points parallel to `values`. */
  points: T[]
  /** Median spacing — the tolerance within which a foreign key still resolves. */
  step: number
  /** The resolution strategy this index was built for. */
  resolution: CursorResolution
}

/** Build the lookup structure once per `data` identity. */
export function buildDomainIndex<T>(
  data: readonly T[],
  getKey: (d: T) => string,
  resolution: CursorResolution = 'nearest',
): DomainIndex<T> {
  const byKey = new Map<string, T>()
  const parsed: { value: number; point: T }[] = []
  let parseable = true

  for (const d of data) {
    byKey.set(getKey(d), d)
    if (!parseable) continue
    const value = parseKey(getKey(d))
    if (value === null) parseable = false
    else parsed.push({ value, point: d })
  }

  // Under two parseable points there is no step to reason about, so nearest-match would be
  // unbounded — fall back to exact match.
  if (!parseable || parsed.length < 2) {
    return { byKey, values: [], points: [], step: 0, resolution }
  }

  parsed.sort((a, b) => a.value - b.value)
  const values = parsed.map((p) => p.value)
  const points = parsed.map((p) => p.point)

  const diffs: number[] = []
  for (let i = 1; i < values.length; i++) {
    diffs.push((values[i] as number) - (values[i - 1] as number))
  }
  diffs.sort((a, b) => a - b)

  return { byKey, values, points, step: diffs[Math.floor(diffs.length / 2)] ?? 0, resolution }
}

/** `'leading'` resolution: the last own position `<= target`. The caller has already rejected
 * anything outside `[first, last + step)`, so a containing bucket is guaranteed to exist. */
function resolveLeading<T>(index: DomainIndex<T>, target: number): T {
  let lo = 0
  let hi = index.values.length - 1
  let result = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((index.values[mid] as number) <= target) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return index.points[result] as T
}

/**
 * The own point a broadcast `key` maps to: exact match first, else — per `index.resolution` — the
 * nearest parsed position or the last position at/before the target, both within one domain step.
 * Out of range → null, so charts over unrelated domains never paint a cursor for each other —
 * which is what makes "shared by default" safe. A categorical (unparseable) domain falls back to
 * exact-match-only in BOTH resolutions, since "nearest"/"leading" over a category is meaningless.
 */
export function resolveCursorPoint<T>(
  index: DomainIndex<T>,
  key: string,
  resolution: CursorResolution = index.resolution,
): T | null {
  const exact = index.byKey.get(key)
  if (exact !== undefined) return exact

  const target = parseKey(key)
  if (target === null || index.values.length === 0) return null

  const first = index.values[0] as number
  const last = index.values[index.values.length - 1] as number

  if (resolution === 'leading') {
    // Containment, NOT tolerance. A bucket keyed `k` covers `[k, nextKey)`, so a target before the
    // first key sits in no bucket at all, and `last + step` is the first instant past the final
    // one. Borrowing `'nearest'`'s symmetric ±step window here would snap a pre-domain target onto
    // the first bucket and a post-domain one onto the last — painting a crosshair on a bucket that
    // provably does not contain the hovered key, which is the exact lie this mode exists to remove.
    if (target < first || target >= last + index.step) return null
    return resolveLeading(index, target)
  }

  if (target < first - index.step || target > last + index.step) return null

  let lo = 0
  let hi = index.values.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((index.values[mid] as number) < target) lo = mid + 1
    else hi = mid
  }

  let best = lo
  let bestDist = Math.abs((index.values[lo] as number) - target)
  if (lo > 0) {
    const prevDist = Math.abs((index.values[lo - 1] as number) - target)
    // `<=`, not `<`: a key landing exactly between two own points belongs to the EARLIER one —
    // the folded bucket that swallowed it starts there, so ties resolve backwards, consistently.
    if (prevDist <= bestDist) {
      best = lo - 1
      bestDist = prevDist
    }
  }
  return bestDist <= index.step ? (index.points[best] as T) : null
}
