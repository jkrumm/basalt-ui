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
import { BASALT } from '../tokens'
import { CV, DASH } from './core/theme'
import type { ChartMarks, ChartX, XRefAt, XRefLine } from './types'

// ---- axis titles -------------------------------------------------------------------------------

/** The title's text size: the tick font, so a card never mixes sizes. */
const TITLE_FONT = BASALT.text.micro

/** The x title as the engine's own axis label: centred under the ticks, its row reserved by the margin solver. */
export const xTitleLabel = (title: string) => ({
  text: title,
  fontSize: TITLE_FONT,
  fontWeight: 400,
  fill: CV.axis,
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
        // 4 px in: the keyboard focus ring is an inset 2 px outline along the chart's edge (`chart-box.module.css`),
        // and a title that starts at the edge reads as struck through by it; the ring's width and 2 px of air.
        dx: side === 'right' ? -4 : 4,
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

/** The y axis of a log chart is drawn by values above zero; a bar, an area and a stack stand on one. */
const LOG_Y_REFUSED = (what: string): string =>
  `[basalt] CartesianChart: y.scale 'log' has no zero baseline, so it does not take ${what}`

/**
 * A log y: a series that stands on zero (a bar, an area fade, a stack) cannot draw on it. A dev build
 * throws and names the series; a production build draws the chart linear. A left-axis value of zero
 * or below has no place on decades: a dev build throws with the series and the value, a production
 * build skips the point (the series reads `null` there). A left-axis rule at a non-positive value is dropped.
 */
export function withLogY<
  T,
  I extends {
    data: readonly T[]
    series: readonly {
      key: string
      mark?: string | undefined
      area?: unknown
      axis?: 'left' | 'right' | undefined
      getValue: (d: T) => number | null
    }[]
    y?: { scale?: 'linear' | 'log' | undefined } | undefined
    y2?: unknown
    stack?: 'stacked' | 'normalized' | undefined
    refLines?: readonly { value: number; axis?: 'left' | 'right' | undefined }[] | undefined
  },
>(input: I): I {
  if (input.y?.scale !== 'log') return input
  const dev = process.env.NODE_ENV !== 'production'
  const flat = { ...input, y: { ...input.y, scale: 'linear' as const } }
  const bar = input.series.find((s) => s.mark === 'bar')
  const area = input.series.find((s) => s.area !== undefined && s.area !== false)
  const refused = bar
    ? `the bar series "${bar.key}"`
    : area
      ? `the area of series "${area.key}"`
      : input.stack !== undefined
        ? 'a stack'
        : null
  if (refused !== null) {
    if (dev) throw new Error(LOG_Y_REFUSED(refused))
    return flat
  }
  // Only the left axis is log: a right-axis series or rule (with a `y2` to carry it) stays linear.
  const onRight = (axis: 'left' | 'right' | undefined): boolean =>
    input.y2 !== undefined && axis === 'right'
  const series = input.series.map((s) => {
    if (onRight(s.axis)) return s
    return {
      ...s,
      getValue: (d: T): number | null => {
        const v = s.getValue(d)
        if (v === null || !Number.isFinite(v) || v > 0) return v
        if (dev)
          throw new Error(
            `[basalt] CartesianChart: series "${s.key}" has the value ${v} on a log y, which needs values above zero`,
          )
        return null
      },
    }
  })
  if (dev) for (const s of series) if (!onRight(s.axis)) for (const d of input.data) s.getValue(d)
  const refLines = input.refLines?.filter((r) => onRight(r.axis) || !(r.value <= 0))
  return { ...input, series, ...(refLines !== undefined && { refLines }) }
}

/**
 * {@link withLogY} for the right axis (`y2.scale: 'log'`): a right-axis bar or area refuses it (a dev
 * build throws, a production build draws the right axis linear), a right-axis value of zero or below
 * throws in a dev build and is skipped in production, a right-axis rule at one is dropped.
 */
export function withLogY2<
  T,
  I extends {
    data: readonly T[]
    series: readonly {
      key: string
      mark?: string | undefined
      area?: unknown
      axis?: 'left' | 'right' | undefined
      getValue: (d: T) => number | null
    }[]
    y2?: { scale?: 'linear' | 'log' | undefined } | undefined
    refLines?: readonly { value: number; axis?: 'left' | 'right' | undefined }[] | undefined
  },
>(input: I): I {
  if (input.y2?.scale !== 'log') return input
  const dev = process.env.NODE_ENV !== 'production'
  const right = input.series.filter((s) => s.axis === 'right')
  const refused = right.find((s) => s.mark === 'bar' || (s.area !== undefined && s.area !== false))
  if (refused !== undefined) {
    if (dev) throw new Error(LOG_Y_REFUSED(`the right-axis series "${refused.key}"`))
    return { ...input, y2: { ...input.y2, scale: 'linear' as const } }
  }
  const series = input.series.map((s) => {
    if (s.axis !== 'right') return s
    return {
      ...s,
      getValue: (d: T): number | null => {
        const v = s.getValue(d)
        if (v === null || !Number.isFinite(v) || v > 0) return v
        if (dev)
          throw new Error(
            `[basalt] CartesianChart: series "${s.key}" has the value ${v} on a log y2, which needs values above zero`,
          )
        return null
      },
    }
  })
  if (dev) for (const s of series) if (s.axis === 'right') for (const d of input.data) s.getValue(d)
  const refLines = input.refLines?.filter((r) => r.axis !== 'right' || !(r.value <= 0))
  return { ...input, series, ...(refLines !== undefined && { refLines }) }
}

/**
 * The y ticks of a log axis over `[lo, hi]` (positive): 1, 2 and 5 times a power of ten, the densest of
 * those sets that fits `count`, else the decades thinned to an even stride. A domain too narrow for
 * any of them takes every digit, then the linear ticks.
 */
export function logYTicks(lo: number, hi: number, count: number): number[] {
  const first = Math.floor(Math.log10(lo))
  const last = Math.ceil(Math.log10(hi))
  const within = (mantissas: readonly number[]): number[] =>
    Array.from({ length: last - first + 1 }, (_, k) => mantissas.map((m) => m * 10 ** (first + k)))
      .flat()
      .filter((v) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9))
  const most = Math.max(2, count)
  const fives = within([1, 2, 5])
  if (fives.length >= 2 && fives.length <= most) return fives
  const decades = within([1])
  if (decades.length > most) {
    const stride = Math.ceil(decades.length / most)
    return decades.filter((_, i) => i % stride === 0)
  }
  if (decades.length >= 2) return decades
  if (fives.length >= 2) return fives.slice(0, most)
  const digits = within([1, 2, 3, 4, 5, 6, 7, 8, 9])
  return digits.length >= 2 ? digits : scaleLinear().domain([lo, hi]).ticks(most)
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
/** A rule caption's glyph advance as a share of the font size (proportional Latin, capitals included). */
const X_LABEL_GLYPH_EM = 0.68
/** A muted caption's estimated width in px: the rule and zone captions, no width table in the bundle. */
export const captionWidth = (label: string, fontSize: number): number =>
  label.length * fontSize * X_LABEL_GLYPH_EM
/** Air kept between two captions on one row, px. */
const X_LABEL_AIR = 4
/** A second row of captions hangs under the first before the caption looks lower. */
const X_LABEL_ROWS = 2
/** The most rows a caption tries down the plot before it settles over a mark. */
const X_LABEL_MAX_ROWS = 6

/** The centre of a caption row below the plot top, px (the engine centres text on its y). */
const xLabelDy = (row: number, fontSize: number): number => fontSize + row * (fontSize + 6)

/** A caption row's extent below the plot top, px: its centre and the drawn line box round it. */
function captionRows(row: number, fontSize: number): { top: number; bottom: number } {
  const half = (fontSize + 4) / 2 + 1
  return { top: xLabelDy(row, fontSize) - half, bottom: xLabelDy(row, fontSize) + half }
}

/** Where one rule caption sits: which side of its rule, on which row, and the px span it covers. */
export type XRefLabelSpot = {
  /** The line's index in `xRefLines`. */
  index: number
  toRight: boolean
  row: number
  /** The caption's span across the plot, px. */
  x0: number
  x1: number
}

/**
 * Where the captions of the vertical rules sit. Pure. Each caption takes the side of its rule with
 * more room, on the top row; one that would overprint another or leave the plot tries the other
 * side, then the second row, and drops when no spot is clear (the rule stays). Left to right, so the
 * earlier rule keeps the preferred spot.
 */
export function xRefLabelSpots<X extends ChartX>(opts: {
  lines: readonly XRefLine<X>[] | undefined
  fraction: (x: X, at?: XRefAt) => number | null
  plotWidth: number
  fontSize: number
  /** Whether a mark (a bar, a dot) fills the box (px across the plot, px below its top): a caption never sits on one. */
  blocked?: ((box: { x0: number; x1: number; top: number; bottom: number }) => boolean) | undefined
  /** The plot's height in px: a row never hangs below it. Absent, every row counts. */
  plotHeight?: number | undefined
}): XRefLabelSpot[] {
  const { fraction, plotWidth, fontSize, blocked, plotHeight } = opts
  const named = (opts.lines ?? []).flatMap((r, index) => {
    const f = r.label ? fraction(r.x, r.at) : null
    return r.label && f !== null && f >= 0 && f <= 1 ? [{ index, f, text: r.label }] : []
  })
  const taken: XRefLabelSpot[] = []
  for (const { index, f, text: label } of named.toSorted((a, b) => a.f - b.f)) {
    const width = captionWidth(label, fontSize) + X_REF_LABEL_DX
    const at = f * plotWidth
    const preferRight = f <= 0.5
    const spots: XRefLabelSpot[] = []
    for (let row = 0; row < X_LABEL_MAX_ROWS; row++) {
      // Past the second row a caption hangs lower only while the row stays inside the plot.
      if (
        row >= X_LABEL_ROWS &&
        (plotHeight === undefined || captionRows(row, fontSize).bottom > plotHeight)
      )
        break
      for (const toRight of [preferRight, !preferRight])
        spots.push({
          index,
          toRight,
          row,
          x0: toRight ? at + X_REF_LABEL_DX : at - width,
          x1: toRight ? at + width : at - X_REF_LABEL_DX,
        })
    }
    const placed = (c: XRefLabelSpot): boolean =>
      (plotWidth <= 0 || (c.x0 >= 0 && c.x1 <= plotWidth)) &&
      taken.every(
        (t) => t.row !== c.row || t.x1 + X_LABEL_AIR <= c.x0 || t.x0 >= c.x1 + X_LABEL_AIR,
      )
    const clear = (c: XRefLabelSpot): boolean =>
      placed(c) &&
      (blocked === undefined || !blocked({ x0: c.x0, x1: c.x1, ...captionRows(c.row, fontSize) }))
    // Before the plot is measured every caption keeps its natural spot. A rule that names the
    // answer is never dropped for the marks: with no spot clear of them it takes the first one
    // that stays inside the plot clear of the other captions, over a mark.
    const spot =
      plotWidth <= 0
        ? spots[0]
        : (spots.find(clear) ?? spots.slice(0, 2 * X_LABEL_ROWS).find(placed))
    if (spot !== undefined) taken.push(spot)
  }
  return taken
}

/** A box for a reference or zone caption to keep clear of: a share of the plot width, px below the plot top. */
export type XRefLabelBox = { fx0: number; fx1: number; top: number; bottom: number }

/** Half the width of a vertical rule's box, px: its half stroke and the air a caption keeps. */
const X_RULE_REACH = 2
/** The bottom of a vertical rule's box, px below the plot top: it runs the plot's full height whatever that is. */
const X_RULE_BOTTOM = 1e5

/**
 * The boxes of the vertical rules that carry a caption, for the other captions to keep clear of:
 * each caption's own box, and its rule, a thin box down the plot's full height at the side of the
 * caption it hangs from, so a reference or zone caption never sits across a rule or stacks beside it.
 */
export function xRefLabelBoxes(
  spots: readonly XRefLabelSpot[],
  opts: {
    plotWidth: number
    fontSize: number
  },
): XRefLabelBox[] {
  const { plotWidth, fontSize } = opts
  if (plotWidth <= 0) return []
  // The drawn line box (about 1.35 of the font size) and a pixel of air.
  return spots.flatMap((s) => {
    const rule = s.toRight ? s.x0 - X_REF_LABEL_DX : s.x1 + X_REF_LABEL_DX
    return [
      { fx0: s.x0 / plotWidth, fx1: s.x1 / plotWidth, ...captionRows(s.row, fontSize) },
      {
        fx0: (rule - X_RULE_REACH) / plotWidth,
        fx1: (rule + X_RULE_REACH) / plotWidth,
        top: 0,
        bottom: X_RULE_BOTTOM,
      },
    ]
  })
}

/**
 * Full-height rules at x values, over the marks, on the hidden `[0, 1]` scale `zx` (the chart's x
 * zones draw there too): a value off the scale or outside the plot draws nothing, a band key sits
 * at its band's centre. The caption hangs at the top, on the side of the rule with more room, and
 * keeps clear of the other captions ({@link xRefLabelSpots}; `plotWidth` 0 or absent skips that).
 */
export function xRefLineMarks<X extends ChartX>(opts: {
  lines: readonly XRefLine<X>[] | undefined
  fraction: (x: X, at?: XRefAt) => number | null
  /** The top of the left y domain: where a caption sits. */
  top: number
  /** The plot's width in px, for the collision pass. */
  plotWidth?: number | undefined
  /** See {@link xRefLabelSpots}. */
  blocked?: Parameters<typeof xRefLabelSpots>[0]['blocked']
  /** See {@link xRefLabelSpots}. */
  plotHeight?: number | undefined
}): ChartMarks {
  const fontSize = BASALT.text.micro
  const spots = xRefLabelSpots({
    lines: opts.lines,
    fraction: opts.fraction,
    plotWidth: opts.plotWidth ?? 0,
    fontSize,
    blocked: opts.blocked,
    plotHeight: opts.plotHeight,
  })
  const spotOf = new Map(spots.map((s) => [s.index, s]))
  return (opts.lines ?? []).flatMap((r, i) => {
    const f = opts.fraction(r.x, r.at)
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
    const spot = spotOf.get(i)
    if (!r.label || spot === undefined) return [rule]
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
          fill: CV.inkMuted,
          fontSize,
          anchor: spot.toRight ? 'start' : 'end',
          dx: spot.toRight ? X_REF_LABEL_DX : -X_REF_LABEL_DX,
          dy: xLabelDy(spot.row, fontSize),
        }),
      ),
    ]
  })
}

// ---- dot and ring swatches -----------------------------------------------------------------------

/** A tooltip swatch is the engine's `background` shorthand: a filled dot is a radial gradient. */
export const dotSwatch = (color: string): string =>
  `radial-gradient(circle, ${color} 0 3px, transparent 3.5px) center / 100% 100% no-repeat`

/** A hollow ring: a 1.5px band of the color between two radii. */
export const ringSwatch = (color: string): string =>
  `radial-gradient(circle, transparent 0 2px, ${color} 2.5px 4px, transparent 4.5px) center / 100% 100% no-repeat`
