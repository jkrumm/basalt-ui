/**
 * Coincident dots spread apart (`Series.spread`). Each dot, in data order, keeps its own position
 * unless a dot placed before it overlaps; then it moves the least distance along one axis, either
 * way, to the nearest free spot inside the plot. Deterministic: the same points draw the same layout.
 * The engine's `dodgeX`/`dodgeY` pack from an anchor and drop the data on that axis; this starts from it.
 */

/** One dot in plot pixels. */
export type SpreadPoint = {
  /** Its position on the axis it may move along. */
  along: number
  /** Its position on the other axis, which never moves. */
  across: number
  r: number
}

const EPSILON = 1e-6

/** The spans `blocked` covers, sorted, with overlapping spans joined; spans that only touch stay apart. */
function join(blocked: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (const span of blocked.toSorted((a, b) => a[0] - b[0])) {
    const last = out.at(-1)
    if (last !== undefined && span[0] < last[1] - EPSILON) last[1] = Math.max(last[1], span[1])
    else out.push([span[0], span[1]])
  }
  return out
}

/**
 * The free spot nearest `at`: `at` itself when no span holds it, else the nearer end of the span
 * that does, inside `[lo, hi]`; the end after `at` wins a tie. With neither end inside, `at` stays.
 */
function nearestFree(at: number, spans: [number, number][], lo: number, hi: number): number {
  const held = spans.find(([from, to]) => at > from + EPSILON && at < to - EPSILON)
  if (held === undefined) return at
  const inside = (v: number): boolean => v >= lo - EPSILON && v <= hi + EPSILON
  const [before, after] = held
  const ends = [after, before].filter(inside)
  if (ends.length === 0) return at
  return ends.reduce((best, v) => (Math.abs(v - at) < Math.abs(best - at) - EPSILON ? v : best))
}

/**
 * Each point's position along its axis once spread: no two dots closer than their radii and
 * `padding`, each moved as little as it can, every one inside `[r, size - r]` (a dot that starts
 * outside keeps its start as the bound). A dot with no free spot inside the plot keeps its place.
 */
export function spreadAlong(points: readonly SpreadPoint[], size: number, padding = 1): number[] {
  const out: number[] = []
  points.forEach((p, i) => {
    const blocked: [number, number][] = []
    for (let j = 0; j < i; j++) {
      const q = points[j] as SpreadPoint
      const distance = p.r + q.r + padding
      const delta = Math.abs(p.across - q.across)
      if (delta >= distance) continue
      const half = Math.sqrt(distance * distance - delta * delta)
      const at = out[j] as number
      blocked.push([at - half, at + half])
    }
    const lo = Math.min(p.r, p.along)
    const hi = Math.max(size - p.r, p.along)
    out.push(nearestFree(p.along, join(blocked), lo, hi))
  })
  return out
}
