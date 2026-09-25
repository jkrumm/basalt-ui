import type { ContainerClass } from '../../tokens/size-classes'

/** Aspect (frame W/H) above which the legend moves beside the ring. */
export const SIDE_LEGEND_ASPECT = 1.5
/** Aspect a side layout must fall below before it stacks again — the gap stops a legend whose own
 * placement changes the measured height from flipping the layout back and forth. */
export const STACK_LEGEND_ASPECT = 1.35
/** Most slices kept before the rest fold into "Other" (so 7 or more slices fold). */
export const DONUT_MAX_SLICES = 6
export const OTHER_KEY = '__other'
/** Side layout: the ring's diameter never exceeds this share of the frame width. */
export const SIDE_RING_MAX_WIDTH_SHARE = 0.55
/** Space kept between the ring's outer edge and the plot box. */
export const RING_PADDING = 4

export type DonutLayout = { side: boolean }

/** Side legend only on a wide-enough frame (`micro`/`compact` always stack under the ring).
 * `wasSide` applies hysteresis: an already-side layout stays side until W/H falls below
 * {@link STACK_LEGEND_ASPECT}. */
export function resolveDonutLayout(input: {
  frameW: number
  frameH: number
  containerClass: ContainerClass
  wasSide?: boolean
}): DonutLayout {
  const { frameW, frameH, containerClass, wasSide = false } = input
  const roomy = containerClass !== 'micro' && containerClass !== 'compact'
  if (!roomy || frameH <= 0) return { side: false }
  const aspect = frameW / frameH
  return { side: wasSide ? aspect >= STACK_LEGEND_ASPECT : aspect > SIDE_LEGEND_ASPECT }
}

/** Ring outer radius: never negative and never wider than the plot; the side layout also caps the
 * diameter at {@link SIDE_RING_MAX_WIDTH_SHARE} of the frame width. */
export function resolveDonutRadius(input: {
  plotW: number
  plotH: number
  frameW: number
  side: boolean
}): number {
  const { plotW, plotH, frameW, side } = input
  const diameter = side
    ? Math.min(plotW, plotH, SIDE_RING_MAX_WIDTH_SHARE * frameW)
    : Math.min(plotW, plotH)
  return Math.max(0, diameter / 2 - RING_PADDING)
}

/** Share of `total` as a whole percent; an empty total is 0%. */
export function sharePercent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

/** A slice value a ring can draw: non-finite or negative counts as 0. */
const safeValue = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0)

/** The key for the synthesized "Other" bucket — {@link OTHER_KEY}, prefixed until no input key uses it. */
export function resolveOtherKey(keys: readonly string[]): string {
  const taken = new Set(keys)
  let key = OTHER_KEY
  while (taken.has(key)) key = `_${key}`
  return key
}

/** Keeps the top {@link DONUT_MAX_SLICES} by value (in original order) and sums the rest into one
 * trailing "Other" entry. Non-finite and negative values count as 0. */
export function foldOther<T extends { key: string; value: number }>(
  slices: readonly T[],
): { kept: T[]; other: number | null } {
  const safe = slices.map((s) => ({ ...s, value: safeValue(s.value) }))
  if (safe.length <= DONUT_MAX_SLICES) return { kept: safe, other: null }
  const top = new Set(
    safe
      .toSorted((a, b) => b.value - a.value)
      .slice(0, DONUT_MAX_SLICES)
      .map((s) => s.key),
  )
  return {
    kept: safe.filter((s) => top.has(s.key)),
    other: safe.reduce((sum, s) => (top.has(s.key) ? sum : sum + s.value), 0),
  }
}
