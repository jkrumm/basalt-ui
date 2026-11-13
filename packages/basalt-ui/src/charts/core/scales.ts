/**
 * Scales basalt owns (`docs/V2-SPEC.md` § 9.1): every y domain, and the x scale by value type
 * (§ 9.4). TanStack receives CONFIGURED instances, never a factory: a factory infers its domain from
 * every scale-contributing mark (a 60–100 zone widened a 30–70 line's axis to 0–100) and cannot see
 * a legend-hidden series.
 */
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import type { LinearScale } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { scaleUtc } from '@tanstack/charts/scales/time'
import type { ChartPositionScaleOptions } from '@tanstack/charts/types/core'
import { scaleLog } from 'd3-scale'
import { logExtent, logFraction, logHalfStep } from '../axis-gaps'
import type { AxisConfig, ChartSeries, ChartX, XZoneSpec } from '../types'

const DEFAULT_AUTO_PAD = 1.1

/** Pad AWAY from zero: a positive floor moves down, a negative one further down; zero stays. */
export function padAutoLower(candidate: number, pad: number): number {
  if (candidate === 0) return 0
  return candidate > 0 ? candidate / pad : candidate * pad
}

/** The mirror of {@link padAutoLower}: a positive ceiling moves up, a negative one toward zero. */
export function padAutoUpper(candidate: number, pad: number): number {
  if (candidate === 0) return 0
  return candidate > 0 ? candidate * pad : candidate / pad
}

/**
 * Raises `upper` until the axis' top tick (for `count` ticks over `[lower, upper]`) reaches `max`:
 * a padded domain can end between ticks, so the line peaks above the last label. Each step adds
 * one tick interval, so the loop ends within a few turns.
 */
function coverTop(lower: number, upper: number, max: number, count: number): number {
  let top = upper
  for (let i = 0; i < 4; i++) {
    const ticks = scaleLinear().domain([lower, top]).ticks(count)
    const last = ticks.at(-1)
    const step = ticks.length > 1 ? (ticks[1] as number) - (ticks[0] as number) : 0
    if (last === undefined || step <= 0 || last >= max) return top
    top = last + step
  }
  return top
}

/**
 * One y axis' domain. `extraBounds` are the finite zone and reference-line values pinned to this
 * axis — a target past the data must stay inside the plot. Infinite bounds clamp to the domain by
 * definition and are ignored. The 1.x law, unchanged (`resolveAxisDomain`).
 */
export function resolveYDomain<T>(
  cfg: AxisConfig<T> | undefined,
  data: readonly T[],
  series: readonly ChartSeries<T>[],
  extraBounds: readonly number[] = [],
  /** The number of ticks the axis will draw (0: none, or its own tick values): when set, an AUTO
   * domain ends on a tick at or above the data's maximum. */
  tickCount = 0,
): readonly [number, number] {
  const domain = cfg?.domain ?? 'auto'
  if (Array.isArray(domain)) return domain as readonly [number, number]
  if (typeof domain === 'function') return domain(data, series)

  let min = Infinity
  let max = -Infinity
  const take = (v: number | null): void => {
    if (v === null || !Number.isFinite(v)) return
    if (v < min) min = v
    if (v > max) max = v
  }
  for (const d of data) for (const s of series) take(s.getValue(d))
  for (const v of extraBounds) take(v)

  const pad = cfg?.autoPad ?? DEFAULT_AUTO_PAD
  if (min === Infinity) return [0, cfg?.autoMaxFloor ?? 1]

  // Clamp the RAW bounds first, then pad once, away from zero: padding before the clamp lands a
  // floored top exactly on the floor, with a target line glued to the plot edge.
  const upper = padAutoUpper(Math.max(max, cfg?.autoMaxFloor ?? -Infinity), pad)
  const lower = padAutoLower(Math.min(min, cfg?.autoMinCeil ?? 0), pad)
  // A flat series would be a scale with no extent: every point on one pixel.
  if (lower === upper) return [Math.min(lower, 0), upper === 0 ? 1 : upper * pad]
  return [lower, tickCount > 0 && !cfg?.nice ? coverTop(lower, upper, max, tickCount) : upper]
}

/** A configured y scale instance for a resolved domain. Linear only: log rules are retired
 * (invariant 18) and the engine has no log scale, so a 2.x `scale: 'log'` draws linear. */
export function yScaleFor<T>(
  cfg: AxisConfig<T> | undefined,
  domain: readonly [number, number],
): LinearScale {
  if (cfg?.scale === 'log' && process.env.NODE_ENV !== 'production' && !warnedLog) {
    warnedLog = true
    console.warn("[basalt] y scale 'log' is retired; the axis draws linear")
  }
  const linear = scaleLinear().domain([domain[0], domain[1]])
  return cfg?.nice ? linear.nice() : linear
}

let warnedLog = false

/**
 * `domain` split into equal buckets, one per `range` value, clamped at both ends: Heatmap's fill
 * steps, the one d3 scale the engine does not ship. A flat domain or a NaN maps to the first.
 */
export function quantize<R>(
  domain: readonly [number, number],
  range: readonly [R, ...R[]],
): (value: number) => R {
  const [lo, hi] = domain
  const last = range.length - 1
  const span = hi - lo
  return (value) => {
    if (!(span > 0) || Number.isNaN(value)) return range[0]
    // ±Infinity clamps to the ends like any value past the domain.
    const i = Math.floor(((value - lo) / span) * range.length)
    return range[Math.min(Math.max(i, 0), last)] as R
  }
}

export type XKind = 'date' | 'number' | 'string'

/** The value type `x` returns, read off the first row (a chart's x is homogeneous by type). */
export function xKindOf(values: readonly ChartX[]): XKind {
  const first = values[0]
  if (first instanceof Date) return 'date'
  if (typeof first === 'number') return 'number'
  return 'string'
}

/** A continuous x value as a number: a `Date` by timestamp. */
const toNumber = (v: ChartX): number => (v instanceof Date ? v.getTime() : (v as number))

const keyOf = (v: ChartX): number | string => (v instanceof Date ? v.getTime() : v)

/** Distinct x values in data order (dates by timestamp). */
export function distinctX<X extends ChartX>(values: readonly X[]): X[] {
  const seen = new Set<number | string>()
  const out: X[] = []
  for (const v of values) {
    const k = keyOf(v)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

/** Point-scale padding for a categorical line: half a step at each edge. */
const POINT_PADDING = 0.5
/** Band padding for bars: the gap between two bars, and the inset at the plot's ends. */
const BAND_PADDING_INNER = 0.2
const BAND_PADDING_OUTER = 0.1

/**
 * The x scale and the normalized position of any x value inside the plot (0 = left edge, 1 = right
 * edge). Zones and x-zones are drawn on a hidden `[0, 1]` scale from those fractions, so a band
 * spans the plot exactly whatever the x scale is.
 */
export type XScaleModel<X extends ChartX> = {
  kind: XKind
  band: boolean
  /** Goes straight into `scales.x.scale`. */
  scale: ChartPositionScaleOptions['scale']
  values: readonly X[]
  /** Center of `x` as a plot fraction; `null` for a value the scale does not contain. */
  fraction: (x: X) => number | null
  /** Half a sample step, as a plot fraction (the `'edge'` widening). */
  halfStep: number
  /** Continuous scales: the domain as numbers (ms for dates), and the median sample step. */
  extent?: readonly [number, number]
  step: number
  /** A log x: `extent` is the positive domain and `fraction` is on the log scale. */
  log?: true
}

const DAY_MS = 86_400_000

/** The explicit x domain as `[min, max]` numbers, or `null` (unset, reversed, flat or not finite:
 * the data's own extent stands, with a dev warning for a domain that was set but unusable). */
function explicitDomain(xDomain: readonly [ChartX, ChartX] | undefined): [number, number] | null {
  if (xDomain === undefined) {
    return null
  }
  const [min, max] = [toNumber(xDomain[0]), toNumber(xDomain[1])]
  if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
    return [min, max]
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[basalt] CartesianChart: `xDomain` needs finite min < max; using the data extent')
  }
  return null
}

export function xScaleFor<X extends ChartX>(
  raw: readonly X[],
  /** `'flush'`: a band scale with no outer padding, so the first and last band meet the plot's
   * edges (`MirroredBars`); `true` pads half a gap-and-a-bit at each end, as `Bars` does. */
  band: boolean | 'flush',
  /** Continuous scales only: the explicit `[min, max]` that replaces the data's own extent. */
  xDomain?: readonly [X, X],
  /** A numeric continuous x on a log scale (`withLogX` has dropped the rows with x <= 0). */
  log = false,
): XScaleModel<X> {
  const values = distinctX(raw)
  // The kind comes from the data; an empty series has none to read, so the domain stands in.
  const kind = xKindOf(values.length > 0 || xDomain === undefined ? values : [xDomain[0]])
  const n = values.length

  if (band || kind === 'string') {
    const keys = values as X[]
    const index = new Map(keys.map((k, i) => [keyOf(k), i] as const))
    if (band) {
      const outer = band === 'flush' ? 0 : BAND_PADDING_OUTER
      // Total width in steps; no data has none, so a step of 1 (a lone flush band spans 0.8 of one).
      const steps = n - BAND_PADDING_INNER + 2 * outer
      const step = 1 / (steps > 0 ? steps : 1)
      const scale = scaleBand<X>().domain(keys).paddingInner(BAND_PADDING_INNER).paddingOuter(outer)
      return {
        kind,
        band: true,
        scale,
        values: keys,
        halfStep: step / 2,
        step: 1,
        fraction: (x) => {
          const i = index.get(keyOf(x))
          if (i === undefined) return null
          return step * (outer + i + (1 - BAND_PADDING_INNER) / 2)
        },
      }
    }
    const step = 1 / Math.max(1, n - 1 + 2 * POINT_PADDING)
    return {
      kind,
      band: false,
      scale: scalePoint<X>().domain(keys).padding(POINT_PADDING),
      values: keys,
      halfStep: step / 2,
      step: 1,
      fraction: (x) => {
        const i = index.get(keyOf(x))
        return i === undefined ? null : step * (POINT_PADDING + i)
      },
    }
  }

  const nums = values.map(toNumber)
  if (log && kind === 'number') {
    const [lo, hi] = logExtent(nums, explicitDomain(xDomain))
    const at = logFraction(lo, hi)
    return {
      kind,
      band: false,
      scale: scaleLog().domain([lo, hi]),
      values,
      halfStep: logHalfStep(nums, lo, hi),
      extent: [lo, hi],
      step: 0,
      log: true,
      fraction: (x) => at(toNumber(x)),
    }
  }
  // A loop, not Math.min(...nums): a spread of a long series overflows the call stack.
  let lo = Infinity
  let hi = -Infinity
  for (const v of nums) {
    // NaN poisons the extent, as Math.min/max did: the guard below falls back to [0, 1].
    if (Number.isNaN(v)) {
      lo = hi = NaN
      break
    }
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1]
  const explicit = explicitDomain(xDomain)
  if (explicit !== null) {
    ;[lo, hi] = explicit
  } else if (lo === hi) {
    // One sample: give the axis a day (or a unit) of width so the point sits in the middle.
    const half = kind === 'date' ? DAY_MS / 2 : 0.5
    lo -= half
    hi += half
  }
  const span = hi - lo
  const sorted = nums.toSorted((a, b) => a - b)
  const gaps = sorted.slice(1).map((v, i) => v - (sorted[i] as number))
  const medianGap = gaps.length ? (gaps.toSorted((a, b) => a - b)[gaps.length >> 1] as number) : 0
  const scale =
    kind === 'date'
      ? scaleUtc().domain([new Date(lo), new Date(hi)])
      : scaleLinear().domain([lo, hi])
  return {
    kind,
    band: false,
    scale,
    values,
    halfStep: medianGap / span / 2,
    extent: [lo, hi],
    step: medianGap,
    fraction: (x) => {
      const v = toNumber(x)
      return typeof v === 'number' && Number.isFinite(v) ? (v - lo) / span : null
    },
  }
}

/** An x-zone's [left, right] as plot fractions, clamped to the plot; `null` when it is empty. */
export function xZoneFractions<X extends ChartX>(
  zone: XZoneSpec<X>,
  model: XScaleModel<X>,
): readonly [number, number] | null {
  const widen = zone.align === 'edge' ? model.halfStep : 0
  const from = zone.from === undefined ? 0 : (model.fraction(zone.from) ?? 0) - widen
  const to = zone.to === undefined ? 1 : (model.fraction(zone.to) ?? 1) + widen
  const left = Math.max(0, Math.min(from, to))
  const right = Math.min(1, Math.max(from, to))
  return right > left ? [left, right] : null
}
