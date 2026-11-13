/**
 * Axis titles, a log x axis, vertical reference rules and the dot / ring swatch: the pieces both
 * cartesian compilers (`compile.ts`, `core/compile.ts`) share. Pure and React-free; each compiler
 * wires them in at the same four points (input, x scale, guides, over-marks).
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { ruleX } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { text } from '@tanstack/charts/text'
import { reportOnce } from '../common/validate'
import { VX } from '../tokens'
import { DASH } from './theme'
import type { ChartMarks, ChartX, XRefLine } from './types'

// ---- axis titles -------------------------------------------------------------------------------

/** The title's text size: the tick font, so a card never mixes sizes. */
const TITLE_FONT = VX.text.micro

/** The x title as the engine's own axis label: centred under the ticks, its row reserved by the margin solver. */
export const xTitleLabel = (title: string) => ({
  text: title,
  fontSize: TITLE_FONT,
  fontWeight: 400,
  fill: VX.axis,
  opacity: 1,
})

/**
 * The engine's axis label is rotated beside the ticks and widens the gutter, so a y title is a
 * tick label of its own hidden scale instead: one label at the plot's top edge, lifted a line
 * above it. The margin solver measures guide labels, so the top margin grows to hold it.
 */
export function yTitleScale(
  title: string,
  side: 'left' | 'right',
): { channel: 'y'; scale: ReturnType<typeof scaleLinear>; side?: 'right'; axis: object } {
  return {
    channel: 'y',
    scale: scaleLinear().domain([0, 1]),
    ...(side === 'right' && { side: 'right' as const }),
    axis: {
      line: false,
      ticks: { values: [1], format: () => title, line: false, size: 0 },
      tickLabels: {
        fontSize: TITLE_FONT,
        fontWeight: 400,
        opacity: 1,
        // The caption starts at the plot's edge and runs inward: it never widens the tick gutter.
        anchor: side === 'right' ? ('end' as const) : ('start' as const),
        dy: -Math.round(TITLE_FONT * 1.4),
      },
    },
  }
}

// ---- log x -------------------------------------------------------------------------------------

const warnOnce = (message: string): void => reportOnce('CartesianChart', message)

/** The log axis' domain: an explicit positive one, else the positive data's extent (a flat one widened). */
export function logExtent(
  nums: readonly number[],
  explicit: readonly [number, number] | null,
): [number, number] {
  if (explicit !== null && explicit[0] > 0) return [explicit[0], explicit[1]]
  if (explicit !== null)
    warnOnce('[basalt] CartesianChart: a log xDomain must be positive; using the data extent')
  let lo = Infinity
  let hi = -Infinity
  for (const v of nums) {
    if (!(v > 0)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (lo === Infinity) return [1, 10]
  return lo === hi ? [lo / 2, hi * 2] : [lo, hi]
}

/** Half the median gap between neighbouring values on the log axis, as a plot fraction. */
export function logHalfStep(nums: readonly number[], lo: number, hi: number): number {
  const logs = nums
    .filter((v) => v > 0)
    .map(Math.log)
    .toSorted((a, b) => a - b)
  const gaps = logs.slice(1).map((v, i) => v - (logs[i] as number))
  const median = gaps.length ? (gaps.toSorted((a, b) => a - b)[gaps.length >> 1] as number) : 0
  return median / (Math.log(hi) - Math.log(lo)) / 2
}

/**
 * A log x needs a numeric, continuous axis: any other x (Date, string, a band) ignores `xScale` with
 * a dev warning. Rows whose x is not positive have no place on it, so they are dropped here, once,
 * before anything reads the data (domains, rows, cursor keys), with a dev warning.
 */
export function withLogX<
  T,
  I extends {
    data: readonly T[]
    x: (d: T) => ChartX
    xScale?: 'linear' | 'log' | undefined
  },
>(input: I, band: boolean): I {
  if (input.xScale !== 'log') return input
  const xs = input.data.map(input.x)
  if (band || !xs.every((v) => typeof v === 'number')) {
    warnOnce("[basalt] CartesianChart: xScale 'log' needs a numeric x; the axis draws linear")
    return { ...input, xScale: 'linear' }
  }
  const data = input.data.filter((_, i) => (xs[i] as number) > 0)
  if (data.length === input.data.length) return input
  warnOnce("[basalt] CartesianChart: xScale 'log' does not draw rows with x <= 0")
  return { ...input, data }
}

/** The log-scale fraction `(log v - log lo) / (log hi - log lo)`, or `null` for a non-positive `v`. */
export const logFraction =
  (lo: number, hi: number) =>
  (v: number): number | null =>
    v > 0 && Number.isFinite(v)
      ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))
      : null

/** Mantissa sets tried in order: decades, then 2 and 5 between them, then every digit. */
const MANTISSAS = [[1], [1, 2, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9]] as const

/** Decade ticks of `[lo, hi]` (positive), with 2 and 5 between them when decades alone leave fewer than 3. */
export function logTicks(lo: number, hi: number): number[] {
  const first = Math.floor(Math.log10(lo))
  const last = Math.ceil(Math.log10(hi))
  const within = (mantissas: readonly number[]): number[] =>
    Array.from({ length: last - first + 1 }, (_, k) => mantissas.map((m) => m * 10 ** (first + k)))
      .flat()
      .filter((v) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9))
  for (const mantissas of MANTISSAS) {
    const ticks = within(mantissas)
    if (ticks.length >= 3) return ticks
  }
  return within(MANTISSAS[2])
}

// ---- vertical reference rules -------------------------------------------------------------------

const X_REF_LABEL_DX = 6

/**
 * Full-height rules at x values, over the marks, on the hidden `[0, 1]` scale `zx` (the chart's x
 * zones draw there too): a value off the scale or outside the plot draws nothing, a band key sits
 * at its band's centre. The caption hangs at the top, on the side of the rule with more room.
 */
export function xRefLineMarks<X extends ChartX>(opts: {
  lines: readonly XRefLine<X>[] | undefined
  fraction: (x: X) => number | null
  /** The top of the left y domain: where a caption sits. */
  top: number
}): ChartMarks {
  return (opts.lines ?? []).flatMap((r, i) => {
    const f = opts.fraction(r.x)
    if (f === null || !(f >= 0 && f <= 1)) return []
    const rule = ruleX([f], {
      id: `xref-${i}`,
      x: (v: number) => v,
      xScale: 'zx',
      stroke: r.color,
      strokeOpacity: 1,
      strokeWidth: 1,
      ...(r.dashed && { strokeDasharray: DASH }),
    })
    if (!r.label) return [rule]
    const toRight = f <= 0.5
    return [
      rule,
      decorative(
        text([{ f }], {
          id: `xref-${i}-label`,
          x: (d: { f: number }) => d.f,
          y: () => opts.top,
          xScale: 'zx',
          yScale: 'y',
          text: () => r.label ?? '',
          fill: VX.ink2,
          fontSize: VX.text.micro,
          anchor: toRight ? 'start' : 'end',
          dx: toRight ? X_REF_LABEL_DX : -X_REF_LABEL_DX,
          dy: VX.text.micro,
        }),
      ),
    ]
  })
}

// ---- dot and ring swatches -----------------------------------------------------------------------

/** A tooltip swatch is the engine's `background` shorthand: a filled dot is a radial gradient. */
export const dotSwatch = (color: string): string =>
  `radial-gradient(circle, ${color} 0 3px, transparent 3.5px) center / 100% 100% no-repeat`

/** A hollow ring: a 1.5px band of the colour between two radii. */
export const ringSwatch = (color: string): string =>
  `radial-gradient(circle, transparent 0 2px, ${color} 2.5px 4px, transparent 4.5px) center / 100% 100% no-repeat`
