/**
 * Scales basalt owns (`docs/V2-SPEC.md` § 9.1): every y domain, and the x scale by value type
 * (§ 9.4). TanStack receives CONFIGURED instances, never a factory: a factory infers its domain from
 * every scale-contributing mark (a 60–100 zone widened a 30–70 line's axis to 0–100) and cannot see
 * a legend-hidden series.
 */
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { scaleLog, scaleUtc } from 'd3-scale'
import type { ChartPositionScaleOptions } from '@tanstack/charts/types/core'
import type { AxisConfig, ChartSeries, ChartX, XZoneSpec } from './types'

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
 * One y axis' domain. `extraBounds` are the finite zone and reference-line values pinned to this
 * axis — a target past the data must stay inside the plot. Infinite bounds clamp to the domain by
 * definition and are ignored. The 1.x law, unchanged (`resolveAxisDomain`).
 */
export function resolveYDomain<T>(
  cfg: AxisConfig<T> | undefined,
  data: readonly T[],
  series: readonly ChartSeries<T>[],
  extraBounds: readonly number[] = [],
): readonly [number, number] {
  const domain = cfg?.domain ?? 'auto'
  if (Array.isArray(domain)) return domain as readonly [number, number]
  if (typeof domain === 'function') return domain(data, series)

  const isLog = cfg?.scale === 'log'
  let min = Infinity
  let max = -Infinity
  const take = (v: number | null): void => {
    if (v === null || !Number.isFinite(v)) return
    // A log axis has no zero and no negative half: such a value drops out of the domain.
    if (isLog && v <= 0) return
    if (v < min) min = v
    if (v > max) max = v
  }
  for (const d of data) for (const s of series) take(s.getValue(d))
  for (const v of extraBounds) take(v)

  const pad = cfg?.autoPad ?? DEFAULT_AUTO_PAD
  if (isLog) {
    if (min === Infinity) return [1, 10]
    if (min === max) return [min / pad, max * pad]
    return [min / pad, padAutoUpper(Math.max(max, cfg?.autoMaxFloor ?? -Infinity), pad)]
  }
  if (min === Infinity) return [0, cfg?.autoMaxFloor ?? 1]

  // Clamp the RAW bounds first, then pad once, away from zero: padding before the clamp lands a
  // floored top exactly on the floor, with a target line glued to the plot edge.
  const upper = padAutoUpper(Math.max(max, cfg?.autoMaxFloor ?? -Infinity), pad)
  const lower = padAutoLower(Math.min(min, cfg?.autoMinCeil ?? 0), pad)
  // A flat series would be a scale with no extent: every point on one pixel.
  if (lower === upper) return [Math.min(lower, 0), upper === 0 ? 1 : upper * pad]
  return [lower, upper]
}

/** A configured y scale instance for a resolved domain. */
export function yScaleFor<T>(
  cfg: AxisConfig<T> | undefined,
  domain: readonly [number, number],
): ReturnType<typeof scaleLinear> | ReturnType<typeof scaleLog<number, number>> {
  const extent: [number, number] = [domain[0], domain[1]]
  if (cfg?.scale === 'log') {
    const log = scaleLog().domain(extent)
    return cfg.nice ? log.nice() : log
  }
  const linear = scaleLinear().domain(extent)
  return cfg?.nice ? linear.nice() : linear
}

export type XKind = 'date' | 'number' | 'string'

/** The value type `x` returns, read off the first row (a chart's x is homogeneous by type). */
export function xKindOf(values: readonly ChartX[]): XKind {
  const first = values[0]
  if (first instanceof Date) return 'date'
  if (typeof first === 'number') return 'number'
  return 'string'
}

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
}

const DAY_MS = 86_400_000

export function xScaleFor<X extends ChartX>(raw: readonly X[], band: boolean): XScaleModel<X> {
  const values = distinctX(raw)
  const kind = xKindOf(values)
  const n = values.length

  if (band || kind === 'string') {
    const keys = values as X[]
    const index = new Map(keys.map((k, i) => [keyOf(k), i] as const))
    if (band) {
      const step = 1 / Math.max(1, n - BAND_PADDING_INNER + 2 * BAND_PADDING_OUTER)
      const scale = scaleBand<X>()
        .domain(keys)
        .paddingInner(BAND_PADDING_INNER)
        .paddingOuter(BAND_PADDING_OUTER)
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
          return step * (BAND_PADDING_OUTER + i + (1 - BAND_PADDING_INNER) / 2)
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

  const nums = values.map((v) => (v instanceof Date ? v.getTime() : (v as number)))
  // A loop, not Math.min(...nums): a spread of a long series overflows the call stack.
  let lo = Infinity
  let hi = -Infinity
  for (const v of nums) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1]
  if (lo === hi) {
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
      const v = x instanceof Date ? x.getTime() : (x as number)
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
