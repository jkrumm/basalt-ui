/**
 * Tick selection that needs no engine: the stride every band axis shares, and the round,
 * bucket-snapped ticks of a bucketed Date axis.
 */
import { scaleUtc } from 'd3-scale'

/** Every n-th value, n the smallest stride that leaves at most `count` of them. */
export function strideEvery<V>(values: readonly V[], count: number): V[] {
  const stride = Math.max(1, Math.ceil(values.length / Math.max(1, count)))
  return values.filter((_, i) => i % stride === 0)
}

/** The median gap between sorted, DISTINCT numbers: two or more of them leave a positive one. */
function medianGap(sorted: readonly number[]): number {
  const gaps = sorted.slice(1).map((t, i) => t - (sorted[i] as number))
  return gaps.toSorted((a, b) => a - b)[gaps.length >> 1] as number
}

/** The index of the value nearest `target` in an ascending, non-empty array (binary search). */
function nearestIndex(sorted: readonly number[], target: number): number {
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((sorted[mid] as number) < target) lo = mid + 1
    else hi = mid
  }
  const before = lo - 1
  return before >= 0 && target - (sorted[before] as number) <= (sorted[lo] as number) - target
    ? before
    : lo
}

/**
 * Ticks of a bucketed Date axis: the time scale's own round instants, each snapped to the bucket
 * it falls in. Labelling every bucket and letting the engine thin the collisions leaves an uneven,
 * near-touching subset ("18:13 18:17 18:21"); round instants are evenly spaced whenever the
 * buckets are. A bucket is used once, and a round instant with no bucket within a step of it is
 * dropped. Fewer than two picks falls back to a plain stride over the distinct,
 * sorted buckets. `count` must be finite (`xTickPolicy` guards it). O(ticks · log buckets) after the sort.
 */
export function bucketTicks(values: readonly Date[], count: number): Date[] {
  const times = [...new Set(values.map((v) => v.getTime()).filter(Number.isFinite))].toSorted(
    (a, b) => a - b,
  )
  const asDates = (ts: readonly number[]): Date[] => ts.map((t) => new Date(t))
  const first = times[0]
  const last = times.at(-1)
  if (first === undefined || last === undefined || first === last) return asDates(times)
  const step = medianGap(times)
  const want = Math.max(1, Math.floor(count))
  const picked = new Set<number>()
  for (const tick of scaleUtc()
    .domain([new Date(first), new Date(last)])
    .ticks(want)) {
    const t = tick.getTime()
    const near = times[nearestIndex(times, t)]
    if (near !== undefined && Math.abs(near - t) < step) picked.add(near)
  }
  return asDates(picked.size >= 2 ? [...picked] : strideEvery(times, want))
}
