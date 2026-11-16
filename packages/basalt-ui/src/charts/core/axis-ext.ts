/**
 * The axis extensions of one chart, pure: the x tick picker for a band axis, the plot fraction of a
 * band's edge (an `at` rule), and the y domain bounds with the off-scale carets they draw.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import type { ChartMarks, ChartSeries, ChartX, XRefAt } from '../types'
import type { XScaleModel } from './scales'

const keyOf = (v: ChartX): number | string => (v instanceof Date ? v.getTime() : v)

/**
 * At most `count` of `values` at an even stride that always keeps the first and the last: the
 * indices are `round(i * (len - 1) / (count - 1))`. `count >= len` keeps all, `1` the first.
 */
export function strideKeepEnds<V>(values: readonly V[], count: number): V[] {
  const len = values.length
  if (len === 0 || !(count >= 1)) return []
  if (count >= len) return [...values]
  if (count < 2) return [values[0] as V]
  const picked = Array.from({ length: count }, (_, i) => Math.round((i * (len - 1)) / (count - 1)))
  return [...new Set(picked)].map((i) => values[i] as V)
}

/** The band keys a tick list names, in the list's order (a key the axis lacks is dropped; Dates by timestamp). */
export function matchBandKeys<X extends ChartX>(
  values: readonly X[],
  wanted: readonly ChartX[],
): X[] {
  const byKey = new Map(values.map((v) => [keyOf(v), v] as const))
  return wanted.flatMap((w) => {
    const hit = byKey.get(keyOf(w))
    return hit === undefined ? [] : [hit]
  })
}

/**
 * The plot fraction of x for a rule: the centre; on a band (or point) axis `start` and `end` sit half
 * a step to either side, so the rule falls mid-gap between two bars. Clamped to the plot. A continuous
 * axis ignores `at`.
 */
export function edgeFraction<X extends ChartX>(
  model: XScaleModel<X>,
  x: X,
  at: XRefAt | undefined,
): number | null {
  const centre = model.fraction(x)
  if (centre === null || at === undefined || at === 'centre') return centre
  if (!(model.band || model.kind === 'string')) return centre
  const shifted = centre + (at === 'start' ? -model.halfStep : model.halfStep)
  return Math.min(1, Math.max(0, shifted))
}

/** Which plot edge `v` lies past, or `null` inside the domain. */
export function offScaleSide(
  v: number,
  domain: readonly [number, number],
): 'top' | 'bottom' | null {
  if (!Number.isFinite(v)) return null
  if (v > domain[1]) return 'top'
  return v < domain[0] ? 'bottom' : null
}

/** `v` held on the plot edge it lies past. */
export const clampToDomain = (v: number, domain: readonly [number, number]): number =>
  Math.min(domain[1], Math.max(domain[0], v))

const CARET_SIZE = 8
const CARETS = { top: '▲', bottom: '▼' } as const

/**
 * One caret per datum past a bounded axis, in the series colour, at the datum's x on the plot's top
 * or bottom edge. Drawn on the hidden `[0, 1]` x scale `zx`, so any x scale places it.
 */
export function offScaleMarks<T, X extends ChartX>(opts: {
  series: readonly ChartSeries<T>[]
  data: readonly T[]
  x: (d: T) => X
  fraction: (x: X) => number | null
  /** The domain a datum is past (the page's cap), or `null` for an axis with none. */
  domainOf: (s: ChartSeries<T>) => readonly [number, number] | null
  /** The plotted domain, where the caret sits; the cap's own when absent. */
  edgeOf?: (s: ChartSeries<T>) => readonly [number, number]
  yScaleOf: (s: ChartSeries<T>) => 'y' | 'y2'
}): ChartMarks {
  return opts.series.flatMap((s) => {
    const domain = opts.domainOf(s)
    if (domain === null) return []
    const found = { top: [] as number[], bottom: [] as number[] }
    for (const d of opts.data) {
      const v = s.getValue(d)
      const side = v === null ? null : offScaleSide(v, domain)
      const f = side === null ? null : opts.fraction(opts.x(d))
      if (side !== null && f !== null) found[side].push(f)
    }
    return (['top', 'bottom'] as const).flatMap((side) =>
      found[side].length === 0
        ? []
        : [
            decorative(
              text(found[side], {
                id: `off-scale-${s.key}-${side}`,
                x: (f: number) => f,
                y: () => (opts.edgeOf?.(s) ?? domain)[side === 'top' ? 1 : 0],
                xScale: 'zx',
                yScale: opts.yScaleOf(s),
                text: () => CARETS[side],
                fill: s.color,
                fontSize: CARET_SIZE,
                anchor: 'middle',
                dy: side === 'top' ? CARET_SIZE : -1,
              }),
            ),
          ],
    )
  }) as unknown as ChartMarks
}
