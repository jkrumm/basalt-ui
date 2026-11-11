/**
 * `ChartSeries.curve` → TanStack's `ChartCurve` contract. Written here rather than bridged through
 * `@tanstack/charts/d3/shape`: that bridge takes a `d3-shape` curve factory, and `d3-shape` is not
 * resolvable from basalt under an isolated linker (the engine depends on it, basalt would have to
 * add a third peer for five interpolations). The algorithms are d3's own: `monotone` is
 * `curveMonotoneX` (Steffen), the steps are `curveStep` / `curveStepAfter` / `curveStepBefore`.
 */
import type { ChartCurve } from '@tanstack/charts/types/core'

type Point = readonly [number, number]

export type CurveName = 'monotone' | 'linear' | 'step' | 'stepAfter' | 'stepBefore'

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000)
const at = (p: Point): string => `${fmt(p[0])},${fmt(p[1])}`

function linear(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${at(p)}`).join('')
}

/** `t` is where between two samples the value changes: 0 = before, 0.5 = midpoint, 1 = after. */
function step(points: readonly Point[], t: number): string {
  const first = points[0]
  if (!first) return ''
  let d = `M${at(first)}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1] as Point
    const [x1, y1] = points[i] as Point
    const xm = x0 * (1 - t) + x1 * t
    d += `L${fmt(xm)},${fmt(y0)}L${fmt(xm)},${fmt(y1)}`
    if (xm !== x1) d += `L${at([x1, y1])}`
  }
  return d
}

const sign = (n: number): number => (n < 0 ? -1 : 1)

/** d3's `slope3`: the tangent at an interior point, limited so the curve never overshoots. */
function interiorTangent(p0: Point, p1: Point, p2: Point): number {
  const h0 = p1[0] - p0[0]
  const h1 = p2[0] - p1[0]
  const s0 = (p1[1] - p0[1]) / (h0 || (h1 < 0 ? -0 : 0))
  const s1 = (p2[1] - p1[1]) / (h1 || (h0 < 0 ? -0 : 0))
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}

/** d3's `slope2`: an end tangent from the one next to it. */
function endTangent(a: Point, b: Point, t: number): number {
  const h = b[0] - a[0]
  return h ? ((3 * (b[1] - a[1])) / h - t) / 2 : t
}

function monotone(points: readonly Point[]): string {
  if (points.length < 3) return linear(points)
  const n = points.length
  const t: number[] = Array.from({ length: n }, () => 0)
  for (let i = 1; i < n - 1; i++)
    t[i] = interiorTangent(points[i - 1] as Point, points[i] as Point, points[i + 1] as Point)
  t[0] = endTangent(points[0] as Point, points[1] as Point, t[1] as number)
  t[n - 1] = endTangent(points[n - 2] as Point, points[n - 1] as Point, t[n - 2] as number)
  let d = `M${at(points[0] as Point)}`
  for (let i = 1; i < n; i++) {
    const [x0, y0] = points[i - 1] as Point
    const [x1, y1] = points[i] as Point
    const dx = (x1 - x0) / 3
    const c1: Point = [x0 + dx, y0 + dx * (t[i - 1] as number)]
    const c2: Point = [x1 - dx, y1 - dx * (t[i] as number)]
    d += `C${at(c1)},${at(c2)},${at([x1, y1])}`
  }
  return d
}

function pathFor(name: CurveName, points: readonly Point[], reversed: boolean): string {
  switch (name) {
    case 'linear':
      return linear(points)
    case 'monotone':
      return monotone(points)
    case 'step':
      return step(points, 0.5)
    // A reversed baseline walks right-to-left, so "after" becomes "before" (d3 flips `t` there).
    case 'stepAfter':
      return step(points, reversed ? 0 : 1)
    case 'stepBefore':
      return step(points, reversed ? 1 : 0)
    default:
      // Exhaustive at compile time; a JS caller's unknown name draws straight segments, never the
      // name itself as path data.
      void (name satisfies never)
      return linear(points)
  }
}

const CACHE = new Map<CurveName, ChartCurve>()

/** The engine curve for a series curve name. `linear` maps to the engine's own straight default. */
export function chartCurve(name: CurveName): ChartCurve {
  const hit = CACHE.get(name)
  if (hit) return hit
  const curve: ChartCurve = {
    line: (points) => pathFor(name, points, false),
    area: (top, bottom) => {
      if (top.length === 0) return ''
      const back = pathFor(name, bottom.toReversed(), true).replace(/^M/, 'L')
      return `${pathFor(name, top, false)}${back}Z`
    },
  }
  CACHE.set(name, curve)
  return curve
}
