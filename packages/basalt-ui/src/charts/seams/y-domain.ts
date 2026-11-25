import type { Extent, Series } from '../contract'
import { reportOnce } from '../../common/validate'
import { LOG_DOMAIN_WARNING } from '../core/scales'
import { rewriting } from './define'
import type { Seam, SeamProps } from './define'

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)

/**
 * The extent of the left axis' data as the plot draws it: lines, dots and grouped bars one by one,
 * the bars of a stacked layout (the default) as one stack by its per-datum positive and negative
 * totals (a stack spans from 0). The layout decides what stacks, as it does for drawing; a series'
 * `stack` key is not read. Failed series draw nothing and a right-axis series has its own scale.
 * `null` when there is no finite value.
 */
export function leftExtent<D>(
  props: Pick<SeamProps<D>, 'data' | 'series' | 'layout'>,
  /** A log y reads only the values above zero. */
  positive = false,
): Extent | null {
  return sideExtent(props, 'left', positive)
}

/** {@link leftExtent} for either axis: the right one reads the `axis: 'right'` series alone. */
export function sideExtent<D>(
  { data, series, layout = 'stacked' }: Pick<SeamProps<D>, 'data' | 'series' | 'layout'>,
  side: 'left' | 'right',
  positive = false,
): Extent | null {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  const take = (v: number | null): void => {
    if (!finite(v) || (positive && v <= 0)) return
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const members: Series<D>[] = []
  for (const s of series) {
    if (s.failed === true || (s.axis === 'right') !== (side === 'right')) continue
    if (s.mark === 'bar' && layout !== 'grouped') {
      members.push(s)
      continue
    }
    for (const d of data) take(s.y(d))
  }
  if (members.length > 0) {
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
export function boundedDomain(
  [lo, hi]: Extent,
  { floor, ceil, pad = 0 }: Bounds,
  log = false,
): Extent {
  if (log) {
    // Decades: the domain reaches `floor` down and `ceil` up (the data's own ends by default), then
    // `pad` is that share of the span in decades.
    const low = Math.min(lo, floor !== undefined && floor > 0 ? floor : lo)
    const high = Math.max(hi, ceil !== undefined && ceil > 0 ? ceil : hi)
    const margin = (Math.log10(high) - Math.log10(low)) * pad
    return [low / 10 ** margin, high * 10 ** margin]
  }
  const low = Math.min(lo, floor ?? 0)
  const high = Math.max(hi, ceil ?? 0)
  const margin = (high - low) * pad
  const down = low === 0 && lo >= 0 ? 0 : margin
  const up = high === 0 && hi <= 0 ? 0 : margin
  return [low - down, high + up]
}

const usable = (d: Extent, log = false): boolean =>
  d.every(Number.isFinite) && d[0] < d[1] && (!log || d[0] > 0)

/** The domain the object or function form of one axis' `domain` gives, or `null` to keep the auto one. */
function sideDomain<D>(props: SeamProps<D>, side: 'left' | 'right'): Extent | null {
  const cfg = side === 'left' ? props.y : props.y2
  const given = cfg?.domain
  // A tuple is applied by `toEngineSpec` already; nothing given leaves the engine's auto domain.
  if (given === undefined || Array.isArray(given)) return null
  const onSide = props.series.filter((s) => (s.axis === 'right') === (side === 'right'))
  // A bar or an area stands on zero: withLogY draws such a chart linear, so its domain is the linear one.
  const log =
    cfg?.scale === 'log' &&
    !onSide.some((s) => s.mark === 'bar' || (s.mark === 'line' && s.area !== undefined))
  const extent = sideExtent(props, side, log)
  if (extent === null) return null
  const domain = typeof given === 'function' ? given(extent) : boundedDomain(extent, given, log)
  // A reversed, flat or non-finite answer falls back to the auto domain rather than drawing nothing.
  if (usable(domain, log)) return domain
  if (log) reportOnce('CartesianChart', LOG_DOMAIN_WARNING)
  return null
}

const seam: Seam = (spec, props) => {
  const left = sideDomain(props, 'left')
  const right = spec.y2 === undefined ? null : sideDomain(props, 'right')
  if (left === null && right === null) return spec
  return {
    ...spec,
    ...(left !== null && { y: { ...spec.y, domain: left } }),
    ...(right !== null && { y2: { ...spec.y2, domain: right } }),
  }
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
