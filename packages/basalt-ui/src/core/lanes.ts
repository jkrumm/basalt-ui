/**
 * Lane packing for spans on one axis, shared by `IntervalTrack` (`basalt-ui/charts`) and
 * `Schedule` (`basalt-ui/cards`): spans that overlap take a lane each, so no two ever cover each
 * other. Pure, no imports.
 */

/**
 * A lane index per item: in start order, each takes the first lane whose last span ended at or
 * before its start. Returns the lane per item (by input position) and the lane count (at least 1).
 */
export function assignLanes(items: readonly { start: number; end: number }[]): {
  lanes: number[]
  count: number
} {
  const order = items
    .map((_, i) => i)
    .toSorted((a, b) => {
      const p = items[a] as { start: number; end: number }
      const q = items[b] as { start: number; end: number }
      return p.start - q.start || p.end - q.end || a - b
    })
  const ends: number[] = []
  // Whether the last item in each lane is a point.
  const pointLast: boolean[] = []
  const lanes: number[] = Array.from({ length: items.length }, () => 0)
  for (const i of order) {
    const item = items[i] as { start: number; end: number }
    const point = item.start === item.end
    // A point (start === end) shares a lane with a span that ends where it sits, but never with
    // another point at the same instant: coincident points each take a lane, so the second shows.
    let lane = ends.findIndex(
      (end, l) => end < item.start || (end === item.start && !(point && pointLast[l])),
    )
    if (lane === -1) {
      lane = ends.length
      ends.push(item.end)
      pointLast.push(point)
    } else {
      ends[lane] = item.end
      pointLast[lane] = point
    }
    lanes[i] = lane
  }
  return { lanes, count: Math.max(1, ends.length) }
}

/** Where one span sits: its lane, and the lane count of the overlap cluster it belongs to. */
export type PackedLane = { lane: number; lanes: number }

/**
 * Lanes per overlap cluster: spans that overlap one another, directly or through a chain, form a
 * cluster and share its width as `lanes` columns; a span that overlaps nothing takes the whole
 * width (`lanes` 1). A time grid places each span at `lane / lanes` across, `1 / lanes` wide, so
 * overlapping events stand side by side and a lone event keeps its full column. Spans that only
 * touch (one ends where the next starts) are no overlap. By input position.
 */
export function packLanes(items: readonly { start: number; end: number }[]): PackedLane[] {
  const order = items
    .map((_, i) => i)
    .toSorted((a, b) => {
      const p = items[a] as { start: number; end: number }
      const q = items[b] as { start: number; end: number }
      return p.start - q.start || q.end - p.end || a - b
    })
  const out: PackedLane[] = Array.from({ length: items.length }, () => ({ lane: 0, lanes: 1 }))
  let cluster: number[] = []
  let reach = Number.NEGATIVE_INFINITY
  const close = (): void => {
    const { lanes, count } = assignLanes(
      cluster.map((i) => items[i] as { start: number; end: number }),
    )
    cluster.forEach((i, k) => {
      out[i] = { lane: lanes[k] ?? 0, lanes: count }
    })
    cluster = []
  }
  for (const i of order) {
    const item = items[i] as { start: number; end: number }
    if (cluster.length > 0 && item.start >= reach) close()
    cluster.push(i)
    reach = cluster.length === 1 ? item.end : Math.max(reach, item.end)
  }
  if (cluster.length > 0) close()
  return out
}
