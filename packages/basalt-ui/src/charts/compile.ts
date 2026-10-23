/**
 * `compileCartesian` — basalt's chart spec in, a TanStack definition out (`docs/V2-SPEC.md` § 9.2).
 * Pure and React-free: the host memoizes it, the tests call it directly. It owns the scales and
 * domains, the theme bridge, zones / x-zones / reference lines, the crosshair, the shared cursor
 * binding, the tooltip content, and the container-class guide ladder.
 * TanStack owns margins (measured), layout, focus and keyboard, the tooltip surface and SSR.
 */
import { headerDay, readoutClock } from './chart-dates'
import { dateTickFormat, utcAxisDate } from './date-tick-format'
import { crosshair } from '@tanstack/charts/crosshair'
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { ruleX, ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from 'd3-scale'
import { portal } from '@tanstack/charts/tooltip/portal'
import type {
  ChartTooltipPortalExtension,
  ChartTooltipPortalPositionContext,
} from '@tanstack/charts/tooltip/portal'
import type {
  ChartBuildContext,
  ChartTooltipAnchorContext,
  ChartGradient,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartTooltipRow as EngineTooltipRow,
  ChartValue,
  ResponsiveChartDefinition,
  StoredChartSpec,
} from '@tanstack/charts/types/core'
import { compact } from '../format/number'
import { NON_FINITE, numberFormat } from '../format/shared'
import { VX } from '../tokens'
import type { ContainerClass } from '../tokens/size-classes'
import { cursorBinding, followerOptions, quietWhileFollowing } from './cursor'
import { cursorDots } from './marks'
import { bucketTicks, strideEvery } from './ticks'
import { MAIN_PANE, plotAccess, plotContext } from './plot-context'
import { claimedLabelBoxes } from './labels'
import { refLabelDy, refLabelPosition } from './ref-label'
import type { LabelBox, RefLabelPoint } from './ref-label'
import type { PlotSizes } from './plot-context'
import { resolveContainerClass } from '../tokens/size-classes'
import { resolveYDomain, xScaleFor, xZoneFractions, yScaleFor } from './scales'
import type { XScaleModel } from './scales'
import { AXIS_LINE, CHART_THEME, CROSSHAIR, DASH, GRID_LINE } from './theme'
import type {
  AxisConfig,
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
  ChartTooltipRow,
  ChartX,
  PlotRow,
  RefLine,
  ZoneEdge,
  ZoneSpec,
} from './types'

/**
 * The compiled definition. Annotated on purpose: TanStack's inferred definition type names internal
 * modules (`dist/scene`, `cursor-host-contract`) and fails declaration emit (TS2883 / TS4058).
 */
export type CartesianDefinition = ResponsiveChartDefinition<unknown, ChartValue, number, 'dom'>

/** Everything the rung compiles: the public props minus React chrome, plus the host's state. */
export type CartesianInput<T, X extends ChartX> = Pick<
  CartesianChartProps<T, X>,
  | 'data'
  | 'x'
  | 'series'
  | 'marks'
  | 'y'
  | 'y2'
  | 'xTicks'
  | 'xDomain'
  | 'formatX'
  | 'zones'
  | 'xZones'
  | 'refLines'
  | 'cursorGroup'
  | 'cursorResolution'
  | 'tooltip'
> & {
  /** Unique per mounted chart (React `useId`): owns what this chart publishes to the cursor. */
  chartId: string
  /** Series keys the legend has toggled off. */
  hidden?: ReadonlySet<string>
  /** The legend entry under the pointer. */
  highlighted?: string | null
  /** A band x scale (bar kinds), whatever `x` returns. */
  band?: boolean
  /** A coarse primary pointer: tap pins the cursor. */
  coarse?: boolean
  /** Tooltip series rows bottom-up (a stack reads top-down in the plot). */
  reverseRows?: boolean
  /** Bar kinds: how the left-axis `mark: 'bar'` series combine for the auto domain. */
  stack?: 'stacked' | 'normalized'
  /** The plot area the engine last laid out; `null` before the first layout (the frame stands in). */
  plot?: PlotSizes | null
  /** The tooltip opens below the chart (a strip of cells), above only when there is no room. */
  tooltipBelow?: boolean
  /** The vertical rule under the cursor. Default `true`; a bar kind has none (its hover is the bar). */
  crosshair?: boolean
  /** The engine's point marker on the focused datum. Default `true`; a bar kind has none (its hover is the bar). */
  focusRing?: boolean
  /** No axes, grid or margin: the plot is the whole box (a visual slot's bars, as `Sparkline`). */
  bare?: boolean
}

/** The one tick-label size, at every container width: the caption size, so a card never mixes sizes. */
const TICK_FONT = VX.text.micro

/** Tick counts per container class (§ 9.6). */
const LADDER = {
  micro: { xTicks: 2, yTicks: 0 },
  compact: { xTicks: 3, yTicks: 3 },
  regular: { xTicks: 5, yTicks: 5 },
  wide: { xTicks: 6, yTicks: 5 },
} as const satisfies Record<ContainerClass, { xTicks: number; yTicks: number }>

/**
 * A tick within this share of the x domain from its start counts as on the left edge: half a
 * day label is ~15 px, 4–5% of a compact plot. Round ticks rarely land on the domain start
 * exactly, so an equality test would miss the common case.
 */
const LEFT_EDGE_SHARE = 0.05

export function defaultNumberFormat(v: number): string {
  return compact(v, { digits: Math.abs(v) >= 1000 ? 1 : 2 })
}

/**
 * The UTC midnight of the day a day-keyed instant stands for. A key at LOCAL midnight is that local
 * calendar date (east of UTC it is `22:00` UTC of the day before); any other key is its UTC date, so
 * a key at 12:00 UTC or later never rolls to the next day.
 */
export function bucketDay(d: Date): Date {
  const local = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0
  return new Date(
    local
      ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
      : Math.floor(d.getTime() / DAY_MS) * DAY_MS,
  )
}

/**
 * The tooltip's date: weekday, day, month and year in the page's locale (`defineFormat` /
 * `BasaltProvider`), read in UTC like the time scale; a non-midnight instant adds `HH:MM`. With
 * `dayOnly` (a day-granular series) the instant is its bucket's DAY, never a clock time: see
 * {@link bucketDay}.
 */
export function utcHeaderDate(d: Date, dayOnly = false): string {
  if (!Number.isFinite(d.getTime())) return NON_FINITE
  const date = headerDay(dayOnly ? bucketDay(d) : d)
  if (dayOnly || d.getTime() % DAY_MS === 0) return date
  return `${date} ${readoutClock(d)}`
}

const DAY_MS = 86_400_000

/**
 * Default Date tick values: the time scale's own ticks, kept to whole UTC days once the data is
 * daily or coarser — d3 picks 12-hour steps for a short daily series, which label one day twice.
 */
export function dateTicks(domain: readonly [Date, Date], count: number, stepMs: number): Date[] {
  const ticks = scaleUtc().domain([domain[0], domain[1]]).ticks(count)
  if (stepMs < DAY_MS) return ticks
  const days = ticks.filter((t) => t.getTime() % DAY_MS === 0)
  return days.length >= 2 ? days : ticks.filter((_, i, all) => i === 0 || i === all.length - 1)
}

export function defaultFormatX(v: ChartValue): string {
  if (v instanceof Date) return utcAxisDate(v)
  if (typeof v === 'number') return defaultNumberFormat(v)
  return String(v)
}

const clampTo = (v: number, [lo, hi]: readonly [number, number]): number =>
  Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi))

/**
 * A tooltip swatch is the engine's `background` shorthand, so a dashed one is a gradient: a 2px
 * dashed line across the swatch's middle, in the row color.
 */
export const dashedSwatch = (color: string): string =>
  `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 4px) center / 100% 2px no-repeat`

/** A basalt tooltip row as the engine's: the swatch shape folded into the row color. */
export function engineRow(
  row: ChartTooltipRow & { active?: boolean | undefined },
): EngineTooltipRow {
  const { label, value, color, swatch, active } = row
  return {
    label,
    value,
    ...(color !== undefined && { color: swatch === 'dashed' ? dashedSwatch(color) : color }),
    ...(active && { active }),
  }
}

/** A series row of a tooltip: the label with its note, the swatch following the series' dash. */
export function seriesRow(
  s: Pick<ChartSeries<never>, 'label' | 'note' | 'color' | 'dash'>,
  value: string,
  active: boolean,
): EngineTooltipRow {
  return engineRow({
    label: s.note === undefined ? s.label : `${s.label} · ${s.note}`,
    value,
    color: s.color,
    swatch: s.dash === 'dashed' ? 'dashed' : 'solid',
    active,
  })
}

/** Keys the compiler reserves for the legend entries it derives from `refLines`. */
const REF_KEY_PREFIX = '__ref-'
const ZONE_KEY_PREFIX = '__zone-'

/** The legend key of a reference line that names itself (`RefLine.legend`). */
const refLegendKey = (index: number): string => `${REF_KEY_PREFIX}${index}`

/**
 * A reference line is drawn translucent (`*-ref`, 20-30% alpha) so it recedes behind the data, but
 * a 16x8 swatch at that alpha vanishes on the dark surface. The legend takes the status solid,
 * which the color gate holds to 3:1 on the panel in both schemes, like a series swatch.
 */
const SWATCH_SOLID: ReadonlyMap<string, string> = new Map([
  [VX.goodRef, VX.goodSolid],
  [VX.badRef, VX.badSolid],
  [VX.warnRef, VX.warnSolid],
  // The tinted status fills are as translucent, and a consumer may pass either as a line color.
  [VX.good, VX.goodSolid],
  [VX.goodSoft, VX.goodSolid],
  [VX.bad, VX.badSolid],
  [VX.warn, VX.warnSolid],
])

/** Legend-only entries for the reference lines that name themselves, in line order. */
export function refLegendSeries<T>(refLines: readonly RefLine[] | undefined): ChartSeries<T>[] {
  return (refLines ?? []).flatMap((r, i) =>
    r.legend === undefined
      ? []
      : [
          {
            key: refLegendKey(i),
            label: r.legend.label,
            color: SWATCH_SOLID.get(r.color) ?? r.color,
            role: 'reference' as const,
            tooltip: false,
            getValue: () => null,
            ...(r.legend.mark !== undefined && { mark: r.legend.mark }),
            ...(r.dashed && { dash: 'dashed' as const }),
          },
        ],
  )
}

/** Legend-only entries for the zones that name themselves (`ZoneSpec.legend`), in zone order. */
export function zoneLegendSeries<T>(zones: readonly ZoneSpec[] | undefined): ChartSeries<T>[] {
  return (zones ?? []).flatMap((z, i) =>
    z.legend === undefined
      ? []
      : [
          {
            key: `${ZONE_KEY_PREFIX}${i}`,
            label: z.legend.label,
            color: z.legend.color ?? SWATCH_SOLID.get(z.fill) ?? z.fill,
            mark: z.legend.mark ?? 'bar',
            role: 'reference' as const,
            tooltip: false,
            getValue: () => null,
          },
        ],
  )
}

/** The visible series: not toggled off, and not a companion whose parent is. */
export function visibleSeries<T>(
  series: readonly ChartSeries<T>[],
  hidden: ReadonlySet<string>,
): ChartSeries<T>[] {
  return series.filter(
    (s) => !hidden.has(s.key) && !(s.parent !== undefined && hidden.has(s.parent)),
  )
}

type YAxis = { domain: readonly [number, number]; format: (v: number) => string }

/** The page locale's decimal separator (`.` or `,`). */
const decimalSeparator = (): string =>
  numberFormat(undefined, {})
    .formatToParts(1.1)
    .find((p) => p.type === 'decimal')?.value ?? '.'

/** A trailing zero fraction behind a digit (`2.0`, `2,00`), the separator being a decimal one. */
const zeroFraction = (separator: string): RegExp =>
  new RegExp(`(\\d)${separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}0+(?!\\d)`, 'g')

/**
 * The tick formatter. When every tick is a whole number (a whole step), a formatter that pads
 * decimals (`toFixed(1)`) prints integers: `2 s`, not `2.0 s`. Only the page locale's decimal
 * separator is read as one, so a thousands group (`1,000`, `1.000` in de) is never cut; a formatter
 * that writes `.` under a `,` locale keeps its padding. The tooltip keeps the full format. The
 * ticks are the engine's own (`count` goes through the same linear scale the engine builds).
 */
function wholeStepFormat<T>(
  axis: YAxis,
  cfg: AxisConfig<T> | undefined,
  ticks: { values: readonly number[] } | { count: number },
): (v: number) => string {
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const values =
    'values' in ticks
      ? ticks.values
      : cfg?.scale === 'log'
        ? []
        : scaleLinear().domain([lo, hi]).ticks(ticks.count)
  if (values.length === 0 || !values.every(Number.isInteger)) return axis.format
  const padded = zeroFraction(decimalSeparator())
  return (v) => axis.format(v).replace(padded, '$1')
}

/** A fixed domain's end this near the last round tick (as a share of the tick step) stays unlabelled. */
const END_TICK_MIN_GAP = 0.4

/** A label without its digits (any script), separators and spaces: the unit or symbol text it carries. */
const labelShape = (label: string): string => label.replace(/[\p{Nd}.,\s]/gu, '')

/**
 * The compact ladder's few ticks can stop short of a fixed domain's end (`[0, 25]` ticks `0 10 20`).
 * The end joins them only when it carries something the round ticks do not: a formatter that states
 * the unit on the end alone (`25 days`) would lose it otherwise. A uniform formatter (`77 kg` beside
 * `76 kg`) gains nothing from a tick off the step, so the end stays unlabelled and every label sits
 * on an even step.
 */
function withEndTick<T>(
  cfg: AxisConfig<T> | undefined,
  axis: YAxis,
  count: number,
): { values: readonly number[] } | null {
  if (!Array.isArray(cfg?.domain) || cfg.scale === 'log' || cfg.nice === true) return null
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const round = scaleLinear().domain([lo, hi]).ticks(count)
  const [first, next, last] = [round.at(0), round.at(1), round.at(-1)]
  if (first === undefined || next === undefined || last === undefined || last >= hi) return null
  if (hi - last < (next - first) * END_TICK_MIN_GAP) return null
  return labelShape(axis.format(hi)) === labelShape(axis.format(last))
    ? null
    : { values: [...round, hi] }
}

export function yGuide<T>(opts: {
  cfg: AxisConfig<T> | undefined
  axis: YAxis
  cls: ContainerClass
  side: 'left' | 'right'
  grid: boolean
}): Omit<ChartPositionScaleOptions<number>, 'scale'> {
  const { cfg, axis, cls, side, grid } = opts
  const ladder = LADDER[cls]
  const ticks =
    typeof cfg?.ticks === 'object'
      ? { values: cfg.ticks }
      : ((cls === 'compact' && cfg?.ticks === undefined
          ? withEndTick(cfg, axis, ladder.yTicks)
          : null) ?? { count: typeof cfg?.ticks === 'number' ? cfg.ticks : ladder.yTicks })
  const gridLine = grid ? { grid: GRID_LINE } : {}
  if (cls === 'micro') return { ...gridLine, axis: false }
  const tickFormat = wholeStepFormat(axis, cfg, ticks)
  // Labels sit in a gutter OUTSIDE the plot, against its edge: a line never runs through one.
  return {
    ...gridLine,
    ...(side === 'right' && { side: 'right' as const }),
    axis: {
      line: false,
      ticks: { ...ticks, format: tickFormat, line: false },
      tickLabels: { fontSize: TICK_FONT, opacity: 1 },
    },
  }
}

/** The buckets of a band Date axis, or `null` for any other axis. */
function bucketDates<X extends ChartX>(model: XScaleModel<X>): readonly Date[] | null {
  if (!model.band || model.kind !== 'date') return null
  const dates = model.values.filter((v): v is X & Date => v instanceof Date)
  return dates.length === model.values.length ? dates : null
}

function xTickPolicy<X extends ChartX>(
  model: XScaleModel<X>,
  xTicks: number | readonly X[],
): { values: readonly ChartValue[] } | { count: number } {
  if (typeof xTicks === 'object') return { values: xTicks }
  const buckets = typeof xTicks === 'number' && Number.isFinite(xTicks) ? bucketDates(model) : null
  if (buckets !== null && typeof xTicks === 'number')
    return { values: bucketTicks(buckets, xTicks) }
  if (model.band || model.kind === 'string') return { values: model.values }
  if (model.kind === 'date' && model.extent)
    return {
      values: dateTicks([new Date(model.extent[0]), new Date(model.extent[1])], xTicks, model.step),
    }
  return { count: xTicks }
}

/**
 * Every n-th value, n the smallest stride that leaves at most the class's x tick count (the same
 * ladder a continuous x axis counts to). A band axis labels every value it is given and only drops
 * the ones that collide, so a short-label grid (18 hour columns) would otherwise draw all of them.
 */
export function strideTicks<V>(values: readonly V[], cls: ContainerClass): V[] {
  return strideEvery(values, LADDER[cls].xTicks)
}

/**
 * The one decision between a consumer's x format and the default: the consumer's wins; else dates
 * read span-aware from the given tick values; else the plain default (numbers, strings, and a lone
 * Date with no ticks to read a span from).
 */
export function xTickFormat(
  consumer: ((v: ChartValue) => string) | undefined,
  tickValues: readonly ChartValue[],
): (v: ChartValue) => string {
  if (consumer) return consumer
  if (tickValues.length === 0 || !tickValues.every((v): v is Date => v instanceof Date))
    return defaultFormatX
  const dateFormat = dateTickFormat(tickValues)
  return (v) => (v instanceof Date ? dateFormat(v) : defaultFormatX(v))
}

export function xGuide<X extends ChartX>(opts: {
  model: XScaleModel<X>
  xTicks: number | readonly X[] | undefined
  /** A consumer's formatter; absent, Date ticks get the span-aware {@link xTickFormat}. */
  format?: ((v: ChartValue) => string) | undefined
  cls: ContainerClass
}): Omit<ChartPositionScaleOptions<ChartValue>, 'scale'> {
  const { model, xTicks, cls } = opts
  const ladder = LADDER[cls]
  const ticks = xTickPolicy(model, xTicks ?? ladder.xTicks)
  // A Date axis always resolves to `values` (the time scale has an extent; a band axis lists its
  // buckets), so `{ count }` is only ever a number axis and never needs the date formatter.
  const format = xTickFormat(opts.format, 'values' in ticks ? ticks.values : [])
  // A continuous scale's domain start and span; a band scale pads its first slot, so none applies.
  const [leftEdgeX, spanX] =
    !model.band && model.extent
      ? [model.extent[0], model.extent[1] - model.extent[0]]
      : [Number.NaN, Number.NaN]
  return {
    axis: {
      line: AXIS_LINE,
      ticks: { ...ticks, format, line: false, size: 0 },
      tickLabels: {
        fontSize: TICK_FONT,
        opacity: 1,
        thin: true,
        // A label centred on a tick near the plot's left edge hangs left of it, under the gutter's
        // lowest y label: start-anchor it. `+value` is a Date's timestamp, or the number itself.
        anchor: ({ value }: { value: ChartValue }) => {
          const share = (+value - leftEdgeX) / spanX
          return share >= 0 && share <= LEFT_EDGE_SHARE ? ('start' as const) : undefined
        },
      },
    },
  }
}

/** Gradient resource id for a series' area fill; the host's `idPrefix` scopes it per chart. */
export const areaGradientId = (index: number): string => `basalt-area-${index}`

export function areaGradient(index: number, color: string): ChartGradient {
  return {
    id: areaGradientId(index),
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, color: `color-mix(in srgb, ${color} var(--vx-area-top), transparent)` },
      { offset: 1, color: `color-mix(in srgb, ${color} var(--vx-area-bottom), transparent)` },
    ],
  }
}

const areaTint = (color: string): string =>
  `color-mix(in srgb, ${color} var(--vx-area-top), transparent)`

/**
 * A series area filled by value zone: a vertical gradient whose stops sit at the zone boundaries.
 * The engine writes `<linearGradient>` in the default `objectBoundingBox` units, so offsets are
 * fractions of the AREA's own box, not of the plot: from the larger of the series' maximum and 0 down
 * to the smaller of its minimum and 0, the baseline the area closes to even when the y domain
 * excludes 0. A boundary at value `v` sits at `(ceiling - v) / (ceiling - floor)`. Hard edges:
 * neighbouring zones meet at one offset; overlapping zones never run backwards. `null` when no zone
 * reaches the area (the caller keeps the plain series-colour fade). Linear axes only.
 */
export function zoneAreaGradient(
  index: number,
  zones: readonly ZoneSpec[],
  values: readonly (number | null)[],
): ChartGradient | null {
  let floor = 0
  let ceiling = 0
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue
    if (v < floor) floor = v
    if (v > ceiling) ceiling = v
  }
  const span = ceiling - floor
  if (span <= 0) return null
  const offsetOf = (v: number): number => (ceiling - Math.min(ceiling, Math.max(floor, v))) / span
  const reaching = zones
    .filter((z) => !Number.isNaN(z.from) && !Number.isNaN(z.to) && z.to > floor && z.from < ceiling)
    .toSorted((p, q) => q.to - p.to)
  let previous = 0
  const stops = reaching.flatMap((z) =>
    [offsetOf(z.to), offsetOf(z.from)].map((raw) => {
      previous = Math.max(previous, raw)
      return { offset: previous, color: areaTint(z.fill) }
    }),
  )
  if (stops.length === 0) return null
  return { id: areaGradientId(index), x1: 0, y1: 0, x2: 0, y2: 1, stops }
}

let warnedLogZones = false

/** Zone stops are placed linearly in value; a log axis would put them in the wrong place (V2-SPEC
 * § 9.9 precedent): dev throws, production logs once and keeps the series-colour fade. */
function guardLogZones(onLog: boolean): boolean {
  if (!onLog) return false
  const message = "area: 'zones' cannot use a log axis; use area: true"
  if (process.env.NODE_ENV !== 'production') throw new Error(message)
  // oxlint-disable-next-line no-console -- the production leg of a dev-only throw
  if (!warnedLogZones) console.error(message)
  warnedLogZones = true
  return true
}

/** The gradient resource for a series' `area` fill: zones, a colour ref, or the series colour. */
function seriesAreaGradient<T, X extends ChartX>(
  s: ChartSeries<T>,
  index: number,
  input: CartesianInput<T, X>,
  axes: Axes<T>,
): ChartGradient {
  const plain = areaGradient(
    index,
    typeof s.area === 'string' && s.area !== 'zones' ? s.area : s.color,
  )
  if (s.area !== 'zones') return plain
  const side = axes.onRight(s) ? 'right' : 'left'
  const axisConfig = side === 'right' ? input.y2 : input.y
  if (guardLogZones(axisConfig?.scale === 'log')) return plain
  const zones = (input.zones ?? []).filter((z) => axes.scaleId(z.axisSide) === axes.scaleId(side))
  return (
    zoneAreaGradient(
      index,
      zones,
      input.data.map((d) => s.getValue(d)),
    ) ?? plain
  )
}

const isBar = <T>(s: ChartSeries<T>): boolean => s.mark === 'bar'

/** The two synthetic totals standing in for a stack's bars in its AUTO domain only: the positive
 * sum and the negative sum per x; every other series counts as itself. */
const STACK_POSITIVE_KEY = '__stack+'
const STACK_NEGATIVE_KEY = '__stack-'

function stackedSeries<T>(series: readonly ChartSeries<T>[]): ChartSeries<T>[] {
  const bars = series.filter(isBar)
  if (bars.length === 0) return [...series]
  const sum = (d: T, sign: 1 | -1): number | null => {
    let total = 0
    let summed = false
    for (const s of bars) {
      const v = s.getValue(d)
      if (v === null || !Number.isFinite(v) || Math.sign(v) !== sign) continue
      total += v
      summed = true
    }
    return summed ? total : null
  }
  const base = bars[0] as ChartSeries<T>
  return [
    ...series.filter((s) => !isBar(s)),
    { ...base, key: STACK_POSITIVE_KEY, getValue: (d) => sum(d, 1) },
    { ...base, key: STACK_NEGATIVE_KEY, getValue: (d) => sum(d, -1) },
  ]
}

/** A normalized stack spans [0, 1], or [-1, 1] when a share is negative. */
function normalizedDomain<T>(
  data: readonly T[],
  series: readonly ChartSeries<T>[],
): readonly [number, number] {
  const negative = data.some((d) => series.some((s) => isBar(s) && (s.getValue(d) ?? 0) < 0))
  return negative ? [-1, 1] : [0, 1]
}

type Axes<T> = {
  left: YAxis
  right: YAxis | null
  onRight: (s: ChartSeries<T>) => boolean
  axisOf: (side: 'left' | 'right' | undefined) => YAxis
  scaleId: (side: 'left' | 'right' | undefined) => 'y' | 'y2'
}

/** Overlay bounds per axis; `'right'` without a `y2` lands on the left. */
function overlayBounds<T, X extends ChartX>(
  input: CartesianInput<T, X>,
): { left: number[]; right: number[] } {
  const bounds = { left: [] as number[], right: [] as number[] }
  const sideOf = (side: 'left' | 'right' | undefined): 'left' | 'right' =>
    side === 'right' && input.y2 !== undefined ? 'right' : 'left'
  for (const z of input.zones ?? []) bounds[sideOf(z.axisSide)].push(z.from, z.to)
  for (const l of input.refLines ?? []) bounds[sideOf(l.axis)].push(l.value)
  return bounds
}

/** A stack changes only the AUTO rule; a tuple is fixed and a domain function gets the real series. */
function leftDomain<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  series: readonly ChartSeries<T>[],
  bounds: readonly number[],
  tickCount: number,
): readonly [number, number] {
  const auto = input.y?.domain === undefined || input.y.domain === 'auto'
  if (auto && input.stack === 'normalized') return normalizedDomain(input.data, series)
  return resolveYDomain(
    input.y,
    input.data,
    auto && input.stack ? stackedSeries(series) : series,
    bounds,
    tickCount,
  )
}

/** Both y domains (basalt's, from the VISIBLE series plus this axis' overlay bounds) and scales. */
function resolveAxes<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  visible: readonly ChartSeries<T>[],
  cls: ContainerClass,
): Axes<T> {
  const hasY2 = input.y2 !== undefined
  // Ticks the axis draws at this class: a domain that ends on one never leaves the data above the top label.
  const tickCount = (cfg: AxisConfig<T> | undefined): number =>
    typeof cfg?.ticks === 'object' ? 0 : (cfg?.ticks ?? LADDER[cls].yTicks)
  const bounds = overlayBounds(input)
  const onRight = (s: ChartSeries<T>): boolean => hasY2 && s.axis === 'right'
  const left: YAxis = {
    domain: leftDomain(
      input,
      visible.filter((s) => !onRight(s)),
      bounds.left,
      tickCount(input.y),
    ),
    format: input.y?.format ?? defaultNumberFormat,
  }
  const right: YAxis | null = hasY2
    ? {
        domain: resolveYDomain(
          input.y2,
          input.data,
          visible.filter(onRight),
          bounds.right,
          tickCount(input.y2),
        ),
        format: input.y2?.format ?? defaultNumberFormat,
      }
    : null
  return {
    left,
    right,
    onRight,
    axisOf: (side) => (side === 'right' && right ? right : left),
    scaleId: (side) => (side === 'right' && hasY2 ? 'y2' : 'y'),
  }
}

/** The sides a `ZoneEdge` names, in a fixed order: the lower bound first. */
const edgeSides = <A extends string, B extends string>(
  edge: ZoneEdge<A | B> | undefined,
  lower: A,
  upper: B,
): { lower: boolean; upper: boolean } => ({
  lower: edge !== undefined && (edge.side === lower || edge.side === 'both'),
  upper: edge !== undefined && (edge.side === upper || edge.side === 'both'),
})

const edgePaint = (edge: ZoneEdge<string>) => ({
  stroke: edge.color,
  strokeOpacity: 1,
  strokeWidth: edge.width ?? 1,
  ...(edge.dashed && { strokeDasharray: DASH }),
})

/**
 * An edge rule at `position` when it lies strictly inside `(lo, hi)`: a bound at or past the plot
 * edge (infinite, outside the domain, exactly on it) has no rule, for y- and x-zones alike.
 */
const edgeRule = (
  position: number | null,
  [lo, hi]: readonly [number, number],
  make: (at: number) => ChartMarks[number],
): ChartMarks => (position !== null && position > lo && position < hi ? [make(position)] : [])

/** Fixed paint under the kind's marks: zones, then x-zones, each with its edge rules. */
function underlayMarks<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  model: XScaleModel<X>,
  axes: Axes<T>,
): ChartMarks {
  const fractionRows = [{ f0: 0, f1: 1 }]
  const zones = (input.zones ?? []).flatMap((z, i) => {
    const domain = axes.axisOf(z.axisSide).domain
    const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
    const rule = (value: number, name: string) =>
      edgeRule(value, [lo, hi], (at) =>
        decorative(
          ruleY([at], {
            id: `zone-${i}-${name}`,
            yScale: axes.scaleId(z.axisSide),
            ...(z.edge && edgePaint(z.edge)),
          }),
        ),
      )
    const sides = edgeSides(z.edge, 'bottom', 'top')
    return [
      decorative(
        rect(fractionRows, {
          id: `zone-${i}`,
          x1: 'f0',
          x2: 'f1',
          y1: () => clampTo(z.from, domain),
          y2: () => clampTo(z.to, domain),
          xScale: 'zx',
          yScale: axes.scaleId(z.axisSide),
          fill: z.fill,
          inset: 0,
        }),
      ),
      ...(sides.lower ? rule(Math.min(z.from, z.to), 'bottom') : []),
      ...(sides.upper ? rule(Math.max(z.from, z.to), 'top') : []),
    ]
  })
  const xZones = (input.xZones ?? []).flatMap((z, i) => {
    const f = xZoneFractions(z, model)
    if (!f) return []
    const sides = edgeSides(z.edge, 'start', 'end')
    // The bound's own plot fraction (widened like the band), unclamped: `f` is clamped to the plot.
    const widen = z.align === 'edge' ? model.halfStep : 0
    const bound = (value: X | undefined, sign: 1 | -1): number | null => {
      const fraction = value === undefined ? null : model.fraction(value)
      return fraction === null ? null : fraction + sign * widen
    }
    const rule = (value: X | undefined, sign: 1 | -1, name: string) =>
      edgeRule(bound(value, sign), [0, 1], (at) =>
        decorative(
          ruleX([at], {
            id: `xzone-${i}-${name}`,
            x: (v: number) => v,
            xScale: 'zx',
            ...(z.edge && edgePaint(z.edge)),
          }),
        ),
      )
    return [
      decorative(
        rect([{ f0: f[0], f1: f[1] }], {
          id: `xzone-${i}`,
          x1: 'f0',
          x2: 'f1',
          y1: () => axes.left.domain[0],
          y2: () => axes.left.domain[1],
          xScale: 'zx',
          fill: z.fill,
          inset: 0,
        }),
      ),
      // An omitted bound is the plot edge: nothing to draw a rule on.
      ...(sides.lower ? rule(z.from, -1, 'start') : []),
      ...(sides.upper ? rule(z.to, 1, 'end') : []),
    ]
  })
  return [...zones, ...xZones]
}

/** A band's bar spans this share of its half step (`paddingInner` 0.2 leaves 0.8 of the step). */
const BAR_BODY = 0.8
const REF_LABEL_DX = 6

/** What a reference line's caption needs to choose its spot: the plot in px and the data on its axis. */
type RefLabelContext<T, X extends ChartX> = {
  plotWidth: number
  plotHeight: number
  /** One polyline per visible series on the line's axis. */
  lines: (side: 'left' | 'right' | undefined) => readonly (readonly RefLabelPoint[])[]
  /** The end labels placed on the left axis: a caption there keeps clear of them. */
  claimed: readonly LabelBox[]
  axes: Axes<T>
  model: XScaleModel<X>
}

/** The caption naming a reference line, at the spot {@link refLabelPosition} picks. */
const refLabelMark = <T, X extends ChartX>(
  r: RefLine,
  i: number,
  ctx: RefLabelContext<T, X>,
): ChartMarks[number] => {
  const { axes } = ctx
  const startFirst = r.axis === 'right' && axes.scaleId(r.axis) === 'y2'
  const position = refLabelPosition({
    pinned: r.labelPosition,
    startFirst,
    value: r.value,
    domain: axes.axisOf(r.axis).domain,
    plotWidth: ctx.plotWidth,
    plotHeight: ctx.plotHeight,
    label: r.label ?? '',
    fontSize: VX.text.micro,
    series: ctx.lines(r.axis),
    claimed: startFirst ? [] : ctx.claimed,
  })
  const atStart = position.startsWith('start')
  return decorative(
    text([{ f: atStart ? 0 : 1 }], {
      id: `ref-${i}-label`,
      x: (d: { f: number }) => d.f,
      y: () => r.value,
      xScale: 'zx',
      yScale: axes.scaleId(r.axis),
      text: () => r.label ?? '',
      fill: VX.ink2,
      fontSize: VX.text.micro,
      anchor: atStart ? 'start' : 'end',
      dx: atStart ? REF_LABEL_DX : -REF_LABEL_DX,
      dy: refLabelDy(position, VX.text.micro),
    }),
  )
}

/** Reference lines, over the marks. `label` reads the plot size, so only a chart with an unpinned caption pays for it. */
const refLineMarks = <T, X extends ChartX>(
  input: CartesianInput<T, X>,
  axes: Axes<T>,
  label: () => RefLabelContext<T, X>,
): ChartMarks =>
  (input.refLines ?? []).flatMap((r, i) =>
    // A line that names itself in the legend can be toggled off there.
    input.hidden?.has(refLegendKey(i))
      ? []
      : [
          ruleY([r.value], {
            id: `ref-${i}`,
            stroke: r.color,
            strokeOpacity: 1,
            strokeWidth: 1,
            yScale: axes.scaleId(r.axis),
            ...(r.dashed && { strokeDasharray: DASH }),
          }),
          ...(r.label ? [refLabelMark(r, i, label())] : []),
        ],
  )

function buildScales<T, X extends ChartX>(opts: {
  input: CartesianInput<T, X>
  model: XScaleModel<X>
  axes: Axes<T>
  formatX: (v: ChartValue) => string
  cls: ContainerClass
  zoneScale: boolean
}): StoredChartSpec['scales'] {
  const { input, model, axes, formatX, cls, zoneScale } = opts
  const { left, right } = axes
  if (input.bare === true) {
    return {
      x: { scale: model.scale, axis: false as const },
      y: { scale: yScaleFor(input.y, left.domain), axis: false as const },
      // A right-axis series still needs its scale, drawn or not.
      ...(right && {
        y2: {
          channel: 'y' as const,
          scale: yScaleFor(input.y2, right.domain),
          axis: false as const,
        },
      }),
      ...(zoneScale && {
        zx: { channel: 'x' as const, scale: scaleLinear().domain([0, 1]), axis: false as const },
      }),
    }
  }
  return {
    x: {
      scale: model.scale,
      ...xGuide({
        model,
        xTicks: input.xTicks,
        format: input.formatX ? formatX : undefined,
        cls,
      }),
    },
    y: {
      scale: yScaleFor(input.y, left.domain),
      ...yGuide({
        cfg: input.y,
        axis: left,
        cls,
        side: 'left',
        grid: input.y?.grid ?? true,
      }),
    },
    ...(right && {
      y2: {
        channel: 'y' as const,
        scale: yScaleFor(input.y2, right.domain),
        ...yGuide({
          cfg: input.y2,
          axis: right,
          cls,
          side: 'right',
          grid: input.y2?.grid ?? false,
        }),
      },
    }),
    ...(zoneScale && {
      zx: { channel: 'x' as const, scale: scaleLinear().domain([0, 1]), axis: false as const },
    }),
  }
}

/**
 * The tooltip title: the consumer's header, a long UTC date for a Date x, else the axis format. A
 * day-granular series keeps its long date under a consumer `formatX` too: that formatter shortens
 * the ticks (`2 Sep`), it does not rename the day.
 */
function tooltipHeader<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  formatX: (v: ChartValue) => string,
  dayOnly: boolean,
  v: ChartValue,
  d: T,
): string {
  if (input.tooltip && input.tooltip.formatHeader) return input.tooltip.formatHeader(v as X, d)
  if (v instanceof Date && (!input.formatX || dayOnly)) return utcHeaderDate(v, dayOnly)
  return formatX(v)
}

/**
 * A day-granular x: every step between its distinct instants is a whole day or more (23 h: a DST
 * day), or its one instant is a UTC midnight. The tooltip header of such a series is its date, never
 * a clock time (a bucket keyed by local midnight is `22:00` UTC in a UTC+2 zone).
 */
export function dayGranular(values: readonly ChartX[]): boolean {
  const times = values.flatMap((v) => (v instanceof Date ? [v.getTime()] : []))
  if (times.length === 0 || times.length !== values.length) return false
  const sorted = times.toSorted((a, b) => a - b)
  if (sorted.length === 1) return (sorted[0] as number) % DAY_MS === 0
  // 23 h, not 24: a local-midnight key is only 23 h after the previous one across a spring-forward DST.
  return sorted.every((t, i) => i === 0 || t - (sorted[i - 1] as number) >= DAY_MS - HOUR_MS)
}

const HOUR_MS = 3_600_000

/** The word without its case or a plural `s`: `Sessions` and `session` are one unit. */
const stem = (w: string): string => w.toLowerCase().replace(/s$/, '')

/** A row's label repeats the unit its value already carries (`Sessions` / `27 sessions`). */
function unitIsName(label: string, value: string): string | null {
  const words = value.trim().split(/\s+/)
  const unit = words.at(-1)
  if (words.length < 2 || unit === undefined || stem(unit) !== stem(label.trim())) return null
  return words.slice(0, -1).join(' ')
}

/** `plot.rows`: one row per datum for a visible series, `[]` for a hidden one, a throw for a typo. */
function rowsOf<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  visibleKeys: ReadonlySet<string>,
): (key: string) => PlotRow<T, X>[] {
  const seriesBy = new Map(input.series.map((s) => [s.key, s]))
  return (key) => {
    const s = seriesBy.get(key)
    if (!s)
      throw new Error(`[basalt] CartesianChart: marks asked for series "${key}", not in \`series\``)
    if (!visibleKeys.has(key)) return []
    return input.data.map((d) => {
      const v = s.getValue(d)
      return {
        x: input.x(d),
        y: v === null || !Number.isFinite(v) ? null : v,
        series: s.key,
        datum: d,
      }
    })
  }
}

/** The cursor dots of the visible series that opt in with `cursorValue`. */
function cursorDotMarks<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  visible: readonly ChartSeries<T>[],
  axes: Axes<T>,
): ChartMarks {
  return visible.flatMap((s) => {
    const { cursorValue } = s
    if (!cursorValue) return []
    const rows = input.data.flatMap((d): PlotRow<T, X>[] => {
      const y = cursorValue(d)
      return y === null || !Number.isFinite(y)
        ? []
        : [{ x: input.x(d), y, series: s.key, datum: d }]
    })
    return cursorDots(s, rows, axes.onRight(s) ? 'y2' : undefined)
  })
}

/**
 * `tooltipBelow` (a `BandStrip`, a short bar of cells under a hero value and beside its neighbours):
 * the tooltip opens below the strip, above only when there is no room, so it never covers the
 * cell's own value, with a gap clear of the cell edge.
 */
/** The hovered cell's centre x, on the strip's bottom edge: `bottom` opens just under the strip. */
const stripAnchor = (
  points: readonly ChartPoint[],
  { plot }: ChartTooltipAnchorContext,
): { x: number; y: number } => {
  const xs = points.map((p) => p.x)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: plot.y + plot.height }
}
const STRIP_TOOLTIP_PLACEMENT = ['bottom', 'top'] as const
const STRIP_TOOLTIP_OFFSET = 8
/**
 * A slotted `Bars` (`tooltipBelow` and `bare`): a micro-visual whose tooltip is the one-line chip
 * (`chart-box.module.css`, `data-basalt-slot`) in the line the cell reserves above the plot. It
 * anchors to the plot's top edge, clear of the focus ring, and opens upward, never below the plot and never over the
 * bars; the card clamp's vertical flip does not apply to it.
 */
const slotAnchor = (
  points: readonly ChartPoint[],
  { plot }: ChartTooltipAnchorContext,
): { x: number; y: number } => {
  const xs = points.map((p) => p.x)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: plot.y }
}
const SLOT_TOOLTIP_PLACEMENT = ['top'] as const
/** The plot's focus ring (`svg.ts-chart:focus-visible`, `chart-box.module.css`) is a 2px outline at a 0.125rem offset, and the chip keeps 1px of air above it. Mirrors that CSS ring at `--mantine-scale` 1; the chip's `block-size` in the same file is the reserve less this. A chart's ring is inset (W49) but a Sparkline's stays outer, and the chip is sized to the Sparkline's reserve. */
const SLOT_RING_CLEARANCE = 2 + 2 + 1

/** A tooltip's chrome (title row, padding) and each series row, px: the guess the bar anchor reserves. */
const TIP_CHROME = 30
const TIP_ROW = 18
/** Air between a clamped tooltip's top and the plot's top edge, px. */
const TIP_TOP_AIR = 4

/** A tall bar's tooltip steps aside by this much (a tooltip's half width plus a bar's), px. */
const TIP_SIDE_STEP = 96

/**
 * A bar's tooltip opens above the bar, and above a tall bar that is above the plot, over the card's
 * headline. For a bar too tall to fit it, the anchor drops to where the open-above tooltip's top meets
 * the plot's top edge (`rows` series rows tall) and steps to the side with more room, so the tooltip
 * sits beside the bar, in the plot, and not on the bar's top. A short bar is unaffected.
 */
const barAnchor =
  (rows: number) =>
  (
    points: readonly ChartPoint[],
    { plot }: ChartTooltipAnchorContext,
  ): { x: number; y: number } => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const centre = (Math.min(...xs) + Math.max(...xs)) / 2
    const x = Math.min(Math.max(centre, plot.x), plot.x + plot.width)
    const y = (Math.min(...ys) + Math.max(...ys)) / 2
    const floor = plot.y + TIP_TOP_AIR + TIP_CHROME + rows * TIP_ROW
    if (y >= floor) return { x, y }
    const toRight = x - plot.x < plot.width / 2
    const stepped = x + (toRight ? TIP_SIDE_STEP : -TIP_SIDE_STEP)
    return { x: Math.min(Math.max(stepped, plot.x), plot.x + plot.width), y: floor }
  }

/** The card a tooltip stays inside: a `ChartCard`, a strip cell, a `StatCard` (a Mantine Card). Never a Paper: the nearest small inner one would clamp. */
const TIP_CARD = '[data-basalt-chart-card], [data-strip-cell], .mantine-Card-root'
/** Air between a card-clamped tooltip and the card's edge, px. */
const TIP_CARD_AIR = 4
/** A card narrower than this keeps the engine's width and horizontal placement (a ~120px strip
 * cell would squeeze a tooltip to its 6rem label floor); the vertical rule applies to every card. */
const TIP_CARD_ROOMY = 192

/**
 * The engine places a portalled tooltip against the viewport, so it opens past the card's edge, over
 * the neighbouring card or the section heading above. Its placements (a hover, and its own resize /
 * scroll repositions, which never pass through `position`) all write the element's inline `left` and
 * `top`, so each write is followed by a settle inside the card (`settleInCard`).
 */
/** What a card clamp does: `card` a chart tooltip (both axes, the card's width), `slot` a slotted
 * `Bars` chip (flush above its plot), `strip` a `BandStrip`'s (sideways only, as before Wave 39). */
type TipMode = 'card' | 'slot' | 'strip'

const cardPortal = (mode: TipMode): ChartTooltipPortalExtension => ({
  id: portal.id,
  create(context, options) {
    const inner = portal.create(context, options)
    const { element, container } = context
    if (mode === 'slot') element.dataset['basaltSlot'] = ''
    let last: ChartTooltipPortalPositionContext | undefined
    const watch = new MutationObserver(() => {
      if (last) settleInCard(element, container, last, mode)
    })
    watch.observe(element, { attributes: true, attributeFilter: ['style'] })
    return {
      ...inner,
      position(next) {
        last = next
        return inner.position(next)
      },
      destroy() {
        watch.disconnect()
        inner.destroy()
      },
    }
  },
})

/**
 * Keeps a tooltip inside its card on both axes. A card with room lets the tooltip grow up to its
 * width before a label wraps, and re-centres it on the anchor at that width. A tooltip that would
 * cross the card's top or bottom flips to the other side of its anchor when that side fits; neither
 * fitting, it slides in; taller than the card, it aligns to the card's top (the only overflow).
 * A `slot` tooltip (a slotted `Bars`, one line) keeps its place above the plot, centred on the
 * anchor, capped at the card's width and held inside the card sideways and at its top. A hidden or unmeasured tooltip is left alone, and an unchanged position
 * is not written back (a write re-runs this).
 */
export function settleInCard(
  tip: HTMLElement,
  within: Element,
  ctx: ChartTooltipPortalPositionContext,
  mode: TipMode = 'card',
): void {
  const slot = mode === 'slot'
  if (tip.hidden || tip.offsetHeight === 0) return
  const card = within.closest(TIP_CARD)?.getBoundingClientRect()
  const surface = ctx.surface.element.getBoundingClientRect()
  const { width: sceneW, height: sceneH } = ctx.scene
  let left = Number.parseFloat(tip.style.left)
  let top = Number.parseFloat(tip.style.top)
  if (!card || Number.isNaN(left) || Number.isNaN(top) || !surface.width || !sceneW || !sceneH)
    return
  const w0 = tip.offsetWidth
  const toClient = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: surface.left + (p.x / sceneW) * surface.width,
    y: surface.top + (p.y / sceneH) * surface.height,
  })
  if (mode === 'strip') {
    // A `BandStrip`: sideways only, as before; the engine's width and vertical placement stand.
    if (w0 + 2 * TIP_CARD_AIR <= card.width)
      left = Math.min(Math.max(left, card.left + TIP_CARD_AIR), card.right - w0 - TIP_CARD_AIR)
    if (Math.abs(left - Number.parseFloat(tip.style.left)) > 0.5) tip.style.left = `${left}px`
    return
  }
  const roomy = card.width >= TIP_CARD_ROOMY
  // A wider tooltip is centred again on its anchor at that width, and held inside the card.
  const grown = roomy || slot
  if (!grown) {
    // A card that shrank under a wider tooltip: the engine's own width and cap again.
    if (tip.dataset['basaltMax'] !== undefined) {
      tip.style.maxWidth = tip.dataset['basaltMax']
      tip.style.removeProperty('width')
      delete tip.dataset['basaltMax']
    }
  } else {
    tip.dataset['basaltMax'] ??= tip.style.maxWidth
    // Grows to its content, capped at the card's width; the engine's shrink-to-fit would narrow it
    // to the room right of its `left`.
    const cap = `${card.width - 2 * TIP_CARD_AIR}px`
    if (tip.style.maxWidth !== cap) tip.style.maxWidth = cap
    if (tip.style.width !== 'max-content') tip.style.width = 'max-content'
  }
  const [w, h] = [tip.offsetWidth, tip.offsetHeight]
  const anchor = toClient(ctx.anchor)
  const gap = Math.max(0, Number.isFinite(ctx.offset) ? (ctx.offset ?? 10) : 10)
  const maxTop = card.bottom - TIP_CARD_AIR - h
  // The card's header (title and facts) is off-limits while the plot area below it can hold the tooltip.
  const headerBottom = slot
    ? undefined
    : within
        .closest(TIP_CARD)
        ?.querySelector('[data-basalt-facts]')
        ?.parentElement?.getBoundingClientRect().bottom
  const belowHeader = headerBottom === undefined ? undefined : headerBottom + TIP_CARD_AIR
  const minTop =
    belowHeader !== undefined && belowHeader <= maxTop ? belowHeader : card.top + TIP_CARD_AIR
  const side = tip.dataset['placement']
  if (slot) {
    // Above the plot, in the reserved line, clear of the focus ring: no flip, never pushed down over the bars.
    top = Math.max(anchor.y - gap - SLOT_RING_CLEARANCE - h, card.top)
    left = anchor.x - w / 2
  } else if (side === 'top' || side === 'bottom') {
    const above = anchor.y - gap - h
    const below = anchor.y + gap
    const order = side === 'top' ? [above, below] : [below, above]
    const fits = order.findIndex((t) => t >= minTop && t <= maxTop)
    top = order[Math.max(fits, 0)] ?? top
    if (fits > 0) tip.dataset['placement'] = side === 'top' ? 'bottom' : 'top'
    if (roomy) left = anchor.x - w / 2
  }
  if (!slot) top = maxTop < minTop ? minTop : Math.min(Math.max(top, minTop), maxTop)
  if (grown || w + 2 * TIP_CARD_AIR <= card.width)
    left = Math.min(
      Math.max(left, card.left + TIP_CARD_AIR),
      Math.max(card.right - w - TIP_CARD_AIR, card.left + TIP_CARD_AIR),
    )
  if (Math.abs(left - Number.parseFloat(tip.style.left)) > 0.5) tip.style.left = `${left}px`
  if (Math.abs(top - Number.parseFloat(tip.style.top)) > 0.5) tip.style.top = `${top}px`
}

function tooltipSpec<T, X extends ChartX>(opts: {
  input: CartesianInput<T, X>
  axes: Axes<T>
  visible: readonly ChartSeries<T>[]
  keys: ReadonlySet<string>
  visibleKeys: ReadonlySet<string>
  formatX: (v: ChartValue) => string
  /** The x is day-granular: the header is a date, not a clock time. */
  dayOnly: boolean
}): NonNullable<CartesianDefinition['tooltip']> {
  const { input, axes, visible, keys, visibleKeys, formatX, dayOnly } = opts
  const hidden = input.series.filter((s) => !visibleKeys.has(s.key))
  const slot = input.tooltipBelow === true && input.bare === true
  const rowSeries = (input.reverseRows ? visible.toReversed() : visible).filter(
    (s) => s.tooltip !== false,
  )
  return {
    use: quietWhileFollowing,
    ...followerOptions(input.tooltip, input.cursorGroup, input.chartId),
    portal: cardPortal(slot ? 'slot' : input.tooltipBelow === true ? 'strip' : 'card'),
    anchor: input.tooltipBelow
      ? slot
        ? slotAnchor
        : stripAnchor
      : visible.some((s) => s.mark === 'bar')
        ? barAnchor(rowSeries.length)
        : 'group-center',
    ...(input.tooltipBelow &&
      (slot
        ? { placement: SLOT_TOOLTIP_PLACEMENT, offset: 0 }
        : { placement: STRIP_TOOLTIP_PLACEMENT, offset: STRIP_TOOLTIP_OFFSET })),
    content: (points: readonly ChartPoint[]) => {
      const primary = points[0]
      if (!primary) return { rows: [] }
      // A point's datum is a `plot.rows()` row, or a consumer mark's own datum (taken as `T`).
      const datum = primary.datum
      const row =
        typeof datum === 'object' && datum !== null && 'datum' in datum && 'series' in datum
          ? (datum as PlotRow<T, X>)
          : undefined
      const [x, d] = row && keys.has(row.series) ? [row.x, row.datum] : [primary.xValue, datum as T]
      const rows: EngineTooltipRow[] = []
      for (const s of rowSeries) {
        const v = s.getValue(d)
        if (v === null || !Number.isFinite(v)) continue
        const text = s.formatValue
          ? s.formatValue(v, d)
          : axes.axisOf(axes.onRight(s) ? 'right' : 'left').format(v)
        // A lone series whose value already ends in its own name (`27 sessions`) prints the name once.
        const bare = input.series.length === 1 ? unitIsName(s.label, text) : null
        rows.push(seriesRow(s, bare ?? text, input.highlighted === s.key))
      }
      const extra: readonly ChartTooltipRow[] =
        (input.tooltip || undefined)?.rows?.(d, { visible, hidden }) ?? []
      return {
        title: tooltipHeader(input, formatX, dayOnly, x, d),
        rows: [...rows, ...extra.map(engineRow)],
      }
    },
  }
}

/** A consumer key in the legend's reserved `__ref-` namespace would collide with a reference line. */
function guardReservedKeys<T>(series: readonly ChartSeries<T>[]): void {
  if (process.env.NODE_ENV === 'production') return
  const clash = series.find((s) => s.key.startsWith(REF_KEY_PREFIX))
  if (clash)
    throw new Error(
      `[basalt] CartesianChart: the series key "${clash.key}" is reserved (\`${REF_KEY_PREFIX}\` prefix names reference-line legend entries)`,
    )
}

export function compileCartesian<T, X extends ChartX>(
  input: CartesianInput<T, X>,
): CartesianDefinition {
  guardReservedKeys(input.series)
  const visible = visibleSeries(input.series, input.hidden ?? new Set<string>())
  const visibleKeys = new Set(visible.map((s) => s.key))
  const keys = new Set(input.series.map((s) => s.key))
  const model = xScaleFor(input.data.map(input.x), input.band === true, input.xDomain)
  // The y domain depends on the tick count, so on the class; everything else about the axes
  // (formats, sides) does not, and `shared` stands for it.
  const byClass = new Map<ContainerClass, Axes<T>>()
  const axesAt = (cls: ContainerClass): Axes<T> => {
    const found = byClass.get(cls)
    if (found) return found
    const made = resolveAxes(input, visible, cls)
    byClass.set(cls, made)
    return made
  }
  const shared = axesAt('regular')
  const dots = cursorDotMarks(input, visible, shared)
  const rows = rowsOf(input, visibleKeys)
  const formatX = (v: ChartValue): string =>
    input.formatX ? input.formatX(v as X) : defaultFormatX(v)
  const gradients = input.series.flatMap((s, i) =>
    s.area ? [seriesAreaGradient(s, i, input, shared)] : [],
  )
  const dayOnly = dayGranular(model.values)
  const names = (input.refLines ?? []).some((r) => r.label !== undefined && r.label !== '')
  // What an unpinned reference caption avoids: each visible series as (x share, y) points. A bar is
  // a filled column from zero, so it walks round its body instead of through its top centre.
  const barHalf = model.halfStep * BAR_BODY
  const linesOn = (side: 'left' | 'right' | undefined): RefLabelPoint[][] =>
    visible
      .filter((s) => shared.onRight(s) === (side === 'right' && shared.right !== null))
      .map((s) =>
        rows(s.key).flatMap((r) => {
          const fx = model.fraction(r.x)
          if (fx === null || r.y === null) return []
          if (!(model.band && s.mark === 'bar')) return [{ fx, y: r.y }]
          return [
            { fx: fx - barHalf, y: 0 },
            { fx: fx - barHalf, y: r.y },
            { fx: fx + barHalf, y: r.y },
            { fx: fx + barHalf, y: 0 },
          ]
        }),
      )

  const definition: CartesianDefinition = {
    chart: ({ width, height }: ChartBuildContext): StoredChartSpec => {
      const cls = resolveContainerClass(width)
      const axes = axesAt(cls)
      const access = plotAccess(definition, input.plot, MAIN_PANE)
      const plot = plotContext(
        {
          rows,
          visible,
          highlighted: input.highlighted ?? null,
          containerClass: cls,
          width,
          height,
          data: input.data,
          xFraction: model.fraction,
          y2: axes.right ? 'y2' : undefined,
          yDomain: axes.left.domain,
          y2Domain: axes.right?.domain,
        },
        access,
      )
      const kindMarks = input.marks(plot)
      const under = underlayMarks(input, model, axes)
      const over = refLineMarks(input, axes, () => {
        // Reading the plot size recompiles once on the measured area; the frame stands in before it.
        access.read()
        const size = access.size()
        return {
          plotWidth: size?.width ?? width,
          plotHeight: size?.height ?? height,
          lines: linesOn,
          claimed: claimedLabelBoxes(plot),
          axes,
          model,
        }
      })
      return {
        marks: [
          ...under,
          ...kindMarks,
          ...dots,
          ...over,
          ...(input.crosshair === false ? [] : [crosshair({ x: CROSSHAIR, y: false })]),
        ],
        scales: buildScales({
          input,
          model,
          axes,
          formatX,
          cls,
          zoneScale: under.length > 0 || names,
        }),
        theme: CHART_THEME,
        ...(input.bare === true && { guides: false as const, margin: 0 }),
        ...(gradients.length > 0 && { gradients }),
        clip: true,
      }
    },
    // Followers resolve the leader's group, so they draw its dots; `quietWhileFollowing` mutes the
    // tooltip unless the chart opts into following tooltips.
    focus: 'group-x',
    ...(input.focusRing === false && { focusRing: false as const }),
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: cursorBinding({
      group: input.cursorGroup,
      chartId: input.chartId,
      keys: model.values,
      extent: model.extent,
      mode: input.cursorResolution ?? 'nearest',
      pin: input.coarse === true,
    }),
    tooltip:
      input.tooltip === false
        ? false
        : tooltipSpec({ input, axes: shared, visible, keys, visibleKeys, formatX, dayOnly }),
  }
  return definition
}
