/**
 * The hand-SVG core of `Sparkline` and `MiniBars` (S2 verdict HAND-SVG, `docs/v3/spikes/charts-s2.md`:
 * the engine floor is 40.7 KB gz over React, above the 36 KB line). Geometry only: pure functions
 * from values and a box to path strings and rects, no engine, no React, no DOM. The parts draw it.
 * A `null` is a gap, never a zero (invariant 3).
 */

export type SparkValue = number | null

export type SparkInput = {
  values: readonly SparkValue[]
  width: number
  height: number
  /** Vertical inset, px, so a stroke or the now dot at the extremes is not clipped. */
  padY?: number
  /** Extra inset above the plot, px: the room an off-scale caret takes over a capped point. */
  padTop?: number
  /** Reference values (a target, the mean, a band's two ends): they join the y domain and map through the same scale. */
  reference?: readonly number[]
}

export type SparkGeometry = {
  /** One `M…L…` subpath per run of finite values; a lone point is a zero-length subpath. */
  line: string
  /** The line's runs closed down to the box bottom. */
  area: string
  x: (index: number) => number
  y: (value: number) => number
  domain: readonly [number, number]
  /** The last finite point: the now dot. */
  last: { x: number; y: number } | null
}

const finite = (v: SparkValue): v is number => v !== null && Number.isFinite(v)
const n2 = (v: number): number => Math.round(v * 100) / 100
const at = (p: { x: number; y: number }): string => `${n2(p.x)},${n2(p.y)}`

function extent(values: readonly number[]): readonly [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return lo === Infinity ? null : [lo, hi]
}

/** Runs of consecutive finite values, as points. */
function runs(input: SparkInput, g: Pick<SparkGeometry, 'x' | 'y'>) {
  const out: { x: number; y: number }[][] = []
  let run: { x: number; y: number }[] = []
  input.values.forEach((v, i) => {
    if (finite(v)) {
      run.push({ x: g.x(i), y: g.y(v) })
    } else if (run.length) {
      out.push(run)
      run = []
    }
  })
  if (run.length) out.push(run)
  return out
}

export function sparkGeometry(input: SparkInput): SparkGeometry {
  const { values, width, height, padY = 0, padTop = 0, reference } = input
  const known = values.filter(finite)
  const domain = extent([...known, ...(reference ?? [])]) ?? [0, 1]
  const [lo, hi] = domain
  const n = values.length
  const top = padY + padTop
  const x = (i: number): number => (n <= 1 ? width / 2 : (i / (n - 1)) * width)
  const y = (v: number): number =>
    hi === lo ? (top + height - padY) / 2 : top + (1 - (v - lo) / (hi - lo)) * (height - top - padY)
  const parts = runs(input, { x, y })
  const line = parts
    .map(
      ([first, ...rest]) =>
        `M${at(first!)}${rest.length ? rest.map((p) => `L${at(p)}`).join('') : 'h0'}`,
    )
    .join('')
  const area = parts
    .map((run) => {
      const first = run[0]!
      const end = run.at(-1)!
      return `M${at(first)}${run
        .slice(1)
        .map((p) => `L${at(p)}`)
        .join('')}L${n2(end.x)},${n2(height)}L${n2(first.x)},${n2(height)}Z`
    })
    .join('')
  const lastIndex = values.findLastIndex(finite)
  const last = lastIndex < 0 ? null : { x: x(lastIndex), y: y(values[lastIndex] as number) }
  return { line, area, x, y, domain, last }
}

/**
 * Values held at `cap`: a value above it plots at the cap, and its index joins `over` (where the
 * off-scale caret goes). Without a finite cap the values come back as they are.
 */
export function capValues(
  values: readonly SparkValue[],
  cap: number | undefined,
): { values: readonly SparkValue[]; over: readonly number[] } {
  if (cap === undefined || !Number.isFinite(cap)) return { values, over: [] }
  const over: number[] = []
  const held = values.map((v, i) => {
    if (!finite(v) || v <= cap) return v
    over.push(i)
    return cap
  })
  return { values: held, over }
}

export type BarInput = {
  values: readonly SparkValue[]
  width: number
  height: number
  /** Space between two bars, px. */
  gap: number
  /** A bar's widest, px; a narrower set is centred in the box. */
  maxWidth?: number
}

export type BarRect = { x: number; y: number; width: number; height: number }

/** One rect per value from a zero baseline; `null` for an absent value (no zero-height bar). */
export function barGeometry(input: BarInput): (BarRect | null)[] {
  const { values, width, height, gap, maxWidth = Infinity } = input
  const n = values.length
  if (n === 0) return []
  const band = Math.min(maxWidth, Math.max(0, (width - gap * (n - 1)) / n))
  const offset = (width - (band * n + gap * (n - 1))) / 2
  const [lo, hi] = extent([0, ...values.filter(finite)]) ?? [0, 1]
  const scale = (v: number): number =>
    hi === lo ? height : height - ((v - lo) / (hi - lo)) * height
  const zero = scale(0)
  return values.map((v, i) => {
    if (!finite(v)) return null
    const top = Math.min(scale(v), zero)
    return { x: offset + i * (band + gap), y: top, width: band, height: Math.abs(scale(v) - zero) }
  })
}
