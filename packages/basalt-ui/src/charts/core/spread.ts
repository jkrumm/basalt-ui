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

/** A dot's place once spread: along the axis it may move on, and across it. */
export type SpreadPlace = { along: number; across: number }

/** The farthest a dot steps across its axis, in steps of its own radius and the padding. */
const MAX_ACROSS_STEPS = 60

/** Like {@link nearestFree}, but `null` when `at` is held and neither end of its span is inside `[lo, hi]`. */
function freeSpot(at: number, spans: [number, number][], lo: number, hi: number): number | null {
  const held = spans.find(([from, to]) => at > from + EPSILON && at < to - EPSILON)
  if (held === undefined) return at
  const inside = (v: number): boolean => v >= lo - EPSILON && v <= hi + EPSILON
  const ends = [held[1], held[0]].filter(inside)
  if (ends.length === 0) return null
  return ends.reduce((best, v) => (Math.abs(v - at) < Math.abs(best - at) - EPSILON ? v : best))
}

/**
 * {@link spreadAlong}, with a way out for a column too dense to part along its own axis (a hundred
 * dots on one value in a plot a few hundred px tall): a dot that finds no free spot along the axis
 * steps across it, the least distance (the hypotenuse of its two moves) that leaves it a free spot,
 * so the column swells to a swarm instead of drawing one solid bar. A dot that finds a free spot
 * along its axis behaves exactly as in `spreadAlong`; `size.across` of 0 keeps every dot on its line.
 */
export function spreadPoints(
  points: readonly SpreadPoint[],
  size: { along: number; across: number },
  padding = 1,
): SpreadPlace[] {
  const out: SpreadPlace[] = []
  points.forEach((p, i) => {
    const lo = Math.min(p.r, p.along)
    const hi = Math.max(size.along - p.r, p.along)
    const trial = (across: number): number | null => {
      const blocked: [number, number][] = []
      for (let j = 0; j < i; j++) {
        const q = points[j] as SpreadPoint
        const there = out[j] as SpreadPlace
        const distance = p.r + q.r + padding
        const delta = Math.abs(across - there.across)
        if (delta >= distance) continue
        const half = Math.sqrt(distance * distance - delta * delta)
        blocked.push([there.along - half, there.along + half])
      }
      return freeSpot(p.along, join(blocked), lo, hi)
    }
    const own = trial(p.across)
    if (own !== null) {
      out.push({ along: own, across: p.across })
      return
    }
    // No room across (a plot that cannot move its dots sideways): the dot keeps its place.
    if (size.across <= 0) {
      out.push({ along: p.along, across: p.across })
      return
    }
    const step = p.r + padding
    const acrossLo = Math.min(p.r, p.across)
    const acrossHi = Math.max(size.across - p.r, p.across)
    let best: { place: SpreadPlace; cost: number } | undefined
    for (let k = 1; k <= MAX_ACROSS_STEPS; k++) {
      for (const sign of [1, -1]) {
        const across = p.across + sign * k * step
        if (across < acrossLo - EPSILON || across > acrossHi + EPSILON) continue
        const along = trial(across)
        if (along === null) continue
        const cost = Math.hypot(along - p.along, across - p.across)
        if (best === undefined || cost < best.cost - EPSILON)
          best = { place: { along, across }, cost }
      }
      // A farther ring costs at least its own distance: stop once the best spot found is nearer than that.
      if (best !== undefined && best.cost <= (k + 1) * step) break
    }
    out.push(best?.place ?? { along: p.along, across: p.across })
  })
  return out
}
