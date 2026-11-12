import type { Extent, Series } from '../contract'
import { rewriting } from './define'
import type { Seam, SeamProps } from './define'

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)

/**
 * The extent of the left axis' data: lines, dots and unstacked bars one by one, a bar stack by its
 * per-datum positive and negative totals (a stack spans from 0). Failed series draw nothing and a
 * right-axis series has its own scale. `null` when there is no finite value.
 */
export function leftExtent<D>({
  data,
  series,
}: Pick<SeamProps<D>, 'data' | 'series'>): Extent | null {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  const take = (v: number | null): void => {
    if (!finite(v)) return
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const stacks = new Map<string, Series<D>[]>()
  for (const s of series) {
    if (s.failed === true || s.axis === 'right') continue
    if (s.mark === 'bar' && s.stack !== undefined) {
      stacks.set(s.stack, [...(stacks.get(s.stack) ?? []), s])
      continue
    }
    for (const d of data) take(s.y(d))
  }
  for (const members of stacks.values()) {
    for (const d of data) {
      let up = 0
      let down = 0
      for (const m of members) {
        const v = m.y(d)
        if (!finite(v)) continue
        if (v >= 0) up += v
        else down += v
      }
      take(up)
      take(down)
    }
  }
  return lo > hi ? null : [lo, hi]
}

type Bounds = { floor?: number; ceil?: number; pad?: number }

/**
 * The `{ floor, ceil, pad }` form on a data extent. The domain always reaches `floor` down and `ceil`
 * up (each defaults to 0: a zero baseline), then `pad` adds that share of the span to both ends,
 * except an end that is exactly 0 the data does not cross.
 */
export function boundedDomain([lo, hi]: Extent, { floor, ceil, pad = 0 }: Bounds): Extent {
  const low = Math.min(lo, floor ?? 0)
  const high = Math.max(hi, ceil ?? 0)
  const margin = (high - low) * pad
  const down = low === 0 && lo >= 0 ? 0 : margin
  const up = high === 0 && hi <= 0 ? 0 : margin
  return [low - down, high + up]
}

const usable = (d: Extent): boolean => d.every(Number.isFinite) && d[0] < d[1]

const seam: Seam = (spec, props) => {
  const given = props.y?.domain
  // A tuple is applied by `toEngineSpec` already; nothing given leaves the engine's auto domain.
  if (given === undefined || Array.isArray(given)) return spec
  const extent = leftExtent(props)
  if (extent === null) return spec
  const domain = typeof given === 'function' ? given(extent) : boundedDomain(extent, given)
  // A reversed, flat or non-finite answer falls back to the auto domain rather than drawing nothing.
  return usable(domain) ? { ...spec, y: { ...spec.y, domain } } : spec
}

/**
 * `y.domain` as `{ floor, ceil, pad }` or `(extent) => extent`. Computed over the series as given:
 * a legend toggle does not re-run it (a tuple or the engine's auto domain does follow the legend).
 */
export const yDomain = rewriting({
  id: 'y.domain',
  consumer:
    'linewatch web/src/charts/latency-band-chart.tsx:328-337, `[0, domainMax(...)]` keeps the envelope in the domain; argo garmin-health/charts/acwr-chart.tsx:154, autoMaxFloor 1.6 / autoMinCeil 0.6',
  seam,
})
