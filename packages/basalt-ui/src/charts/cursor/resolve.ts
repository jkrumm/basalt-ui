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

export type DomainIndex<T> = {
  byKey: Map<string, T>
  /** Parsed positions, ascending. Empty when the domain isn't parseable. */
  values: number[]
  /** Points parallel to `values`. */
  points: T[]
  /** Median spacing — the tolerance within which a foreign key still resolves. */
  step: number
}

/** Build the lookup structure once per `data` identity. */
export function buildDomainIndex<T>(data: readonly T[], getKey: (d: T) => string): DomainIndex<T> {
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
  if (!parseable || parsed.length < 2) return { byKey, values: [], points: [], step: 0 }

  parsed.sort((a, b) => a.value - b.value)
  const values = parsed.map((p) => p.value)
  const points = parsed.map((p) => p.point)

  const diffs: number[] = []
  for (let i = 1; i < values.length; i++) {
    diffs.push((values[i] as number) - (values[i - 1] as number))
  }
  diffs.sort((a, b) => a - b)

  return { byKey, values, points, step: diffs[Math.floor(diffs.length / 2)] ?? 0 }
}

/**
 * The own point a broadcast `key` maps to: exact match first, else the nearest parsed position
 * within one domain step. Out of range → null, so charts over unrelated domains never paint a
 * cursor for each other — which is what makes "shared by default" safe.
 */
export function resolveCursorPoint<T>(index: DomainIndex<T>, key: string): T | null {
  const exact = index.byKey.get(key)
  if (exact !== undefined) return exact

  const target = parseKey(key)
  if (target === null || index.values.length === 0) return null

  const first = index.values[0] as number
  const last = index.values[index.values.length - 1] as number
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
