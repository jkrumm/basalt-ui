/**
 * `compileCartesian` — basalt's chart spec in, a TanStack definition out (`docs/V2-SPEC.md` § 9.2).
 * Pure and React-free: the host memoizes it, the tests call it directly. It owns the scales and
 * domains, the theme bridge, zones / x-zones / reference lines, the crosshair, grouped source-only
 * focus, the shared cursor binding, the tooltip content, and the container-class guide ladder.
 * TanStack owns margins (measured), layout, focus and keyboard, the tooltip surface and SSR.
 */
import { crosshair } from '@tanstack/charts/crosshair'
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { ruleX, ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from 'd3-scale'
import { tooltip as tooltipHost } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import type {
  ChartBuildContext,
  ChartGradient,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartTooltipRow as EngineTooltipRow,
  ChartValue,
  ResponsiveChartDefinition,
  StoredChartSpec,
} from '@tanstack/charts/types/core'
import { SHORT_CHART_HEIGHT } from './box'
import { fmtCompact } from '../format/number'
import { VX } from '../tokens'
import type { ContainerClass } from '../tokens/size-classes'
import { cursorBinding, sourceOnlyFocus } from './cursor'
import { cursorDots } from './marks'
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
}

/** Font size and tick counts per container class (§ 9.6). */
const LADDER = {
  micro: { font: VX.text.nano, xTicks: 2, yTicks: 0 },
  compact: { font: VX.text.nano, xTicks: 3, yTicks: 3 },
  regular: { font: VX.text.micro, xTicks: 5, yTicks: 5 },
  wide: { font: VX.text.micro, xTicks: 6, yTicks: 5 },
} as const satisfies Record<ContainerClass, { font: number; xTicks: number; yTicks: number }>

/** Space between the plot's left edge and a compact y label drawn inside it. */
const INSIDE_LABEL_DX = 4
const INSIDE_LABEL_DY = -6

/**
 * Y labels go inside the plot only for the compact class under `SHORT_CHART_HEIGHT` (the box's own
 * short signal); otherwise they sit in a left gutter. `height` is the whole chart's, `0` before it
 * is measured, which keeps the gutter rather than flipping a first paint inside.
 */
const labelsInside = (cls: ContainerClass, height: number): boolean =>
  cls === 'compact' && height > 0 && height < SHORT_CHART_HEIGHT

export function defaultNumberFormat(v: number): string {
  return fmtCompact(v, { digits: Math.abs(v) >= 1000 ? 1 : 2 })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** `DD.MM`, read in UTC like the time scale that placed it (a local read shifts a day west of UTC). */
export function utcAxisDate(d: Date): string {
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}`
}

/** `Mon Sep 1 2026`, in UTC; a non-midnight instant adds `HH:MM`. */
export function utcHeaderDate(d: Date): string {
  const date = `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`
  const ms = d.getTime() % DAY_MS
  return ms === 0 ? date : `${date} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
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

export function yGuide<T>(opts: {
  cfg: AxisConfig<T> | undefined
  axis: YAxis
  cls: ContainerClass
  side: 'left' | 'right'
  grid: boolean
  /** The whole chart's height: decides inside or gutter labels. */
  height: number
}): Omit<ChartPositionScaleOptions<number>, 'scale'> {
  const { cfg, axis, cls, side, grid, height } = opts
  const ladder = LADDER[cls]
  const ticks =
    typeof cfg?.ticks === 'object'
      ? { values: cfg.ticks }
      : { count: typeof cfg?.ticks === 'number' ? cfg.ticks : ladder.yTicks }
  const gridLine = grid ? { grid: GRID_LINE } : {}
  if (cls === 'micro') return { ...gridLine, axis: false }
  // Labels sit INSIDE the plot, above their grid line, so the plot keeps the full width.
  const inside = labelsInside(cls, height)
  return {
    ...gridLine,
    ...(side === 'right' && { side: 'right' as const }),
    axis: {
      line: false,
      ticks: { ...ticks, format: axis.format, line: false, ...(inside && { size: 0, padding: 0 }) },
      tickLabels: {
        fontSize: ladder.font,
        opacity: 1,
        ...(inside && {
          anchor: side === 'left' ? ('start' as const) : ('end' as const),
          dx: side === 'left' ? INSIDE_LABEL_DX : -INSIDE_LABEL_DX,
          dy: INSIDE_LABEL_DY,
        }),
      },
    },
  }
}

function xTickPolicy<X extends ChartX>(
  model: XScaleModel<X>,
  xTicks: number | readonly X[],
): { values: readonly ChartValue[] } | { count: number } {
  if (typeof xTicks === 'object') return { values: xTicks }
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
  const stride = Math.max(1, Math.ceil(values.length / LADDER[cls].xTicks))
  return values.filter((_, i) => i % stride === 0)
}

export function xGuide<X extends ChartX>(opts: {
  model: XScaleModel<X>
  xTicks: number | readonly X[] | undefined
  format: (v: ChartValue) => string
  cls: ContainerClass
  /** The whole chart's height: decides whether the left margin is locked to zero. */
  height: number
}): Omit<ChartPositionScaleOptions<ChartValue>, 'scale'> {
  const { model, xTicks, format, cls, height } = opts
  const ladder = LADDER[cls]
  const inside = labelsInside(cls, height)
  const ticks = xTickPolicy(model, xTicks ?? ladder.xTicks)
  return {
    axis: {
      line: AXIS_LINE,
      ticks: { ...ticks, format, line: false, size: 0 },
      tickLabels: {
        fontSize: ladder.font,
        opacity: 1,
        thin: true,
        // A locked-zero left margin (inside labels) must not clip the first label.
        ...(inside && {
          anchor: ({ index }: { index: number }) => (index === 0 ? ('start' as const) : undefined),
        }),
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
): readonly [number, number] {
  const auto = input.y?.domain === undefined || input.y.domain === 'auto'
  if (auto && input.stack === 'normalized') return normalizedDomain(input.data, series)
  return resolveYDomain(
    input.y,
    input.data,
    auto && input.stack ? stackedSeries(series) : series,
    bounds,
  )
}

/** Both y domains (basalt's, from the VISIBLE series plus this axis' overlay bounds) and scales. */
function resolveAxes<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  visible: readonly ChartSeries<T>[],
): Axes<T> {
  const hasY2 = input.y2 !== undefined
  const bounds = overlayBounds(input)
  const onRight = (s: ChartSeries<T>): boolean => hasY2 && s.axis === 'right'
  const left: YAxis = {
    domain: leftDomain(
      input,
      visible.filter((s) => !onRight(s)),
      bounds.left,
    ),
    format: input.y?.format ?? defaultNumberFormat,
  }
  const right: YAxis | null = hasY2
    ? {
        domain: resolveYDomain(input.y2, input.data, visible.filter(onRight), bounds.right),
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

/** Reference lines, over the marks. */
const refLineMarks = <T, X extends ChartX>(
  input: CartesianInput<T, X>,
  axes: Axes<T>,
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
        ],
  )

function buildScales<T, X extends ChartX>(opts: {
  input: CartesianInput<T, X>
  model: XScaleModel<X>
  axes: Axes<T>
  formatX: (v: ChartValue) => string
  cls: ContainerClass
  height: number
  zoneScale: boolean
}): StoredChartSpec['scales'] {
  const { input, model, axes, formatX, cls, height, zoneScale } = opts
  const { left, right } = axes
  return {
    x: {
      scale: model.scale,
      ...xGuide({ model, xTicks: input.xTicks, format: formatX, cls, height }),
    },
    y: {
      scale: yScaleFor(input.y, left.domain),
      ...yGuide({
        cfg: input.y,
        axis: left,
        cls,
        height,
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
          height,
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

/** The tooltip title: the consumer's header, a long UTC date for a Date x, else the axis format. */
function tooltipHeader<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  formatX: (v: ChartValue) => string,
  v: ChartValue,
  d: T,
): string {
  if (input.tooltip && input.tooltip.formatHeader) return input.tooltip.formatHeader(v as X, d)
  if (v instanceof Date && !input.formatX) return utcHeaderDate(v)
  return formatX(v)
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
    return [cursorDots(s, rows, axes.onRight(s) ? 'y2' : undefined)]
  })
}

function tooltipSpec<T, X extends ChartX>(opts: {
  input: CartesianInput<T, X>
  axes: Axes<T>
  visible: readonly ChartSeries<T>[]
  keys: ReadonlySet<string>
  visibleKeys: ReadonlySet<string>
  formatX: (v: ChartValue) => string
}): NonNullable<CartesianDefinition['tooltip']> {
  const { input, axes, visible, keys, visibleKeys, formatX } = opts
  const hidden = input.series.filter((s) => !visibleKeys.has(s.key))
  const rowSeries = (input.reverseRows ? visible.toReversed() : visible).filter(
    (s) => s.tooltip !== false,
  )
  return {
    use: tooltipHost,
    portal,
    anchor: 'group-center',
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
        rows.push(
          seriesRow(
            s,
            s.formatValue
              ? s.formatValue(v, d)
              : axes.axisOf(axes.onRight(s) ? 'right' : 'left').format(v),
            input.highlighted === s.key,
          ),
        )
      }
      const extra: readonly ChartTooltipRow[] =
        (input.tooltip || undefined)?.rows?.(d, { visible, hidden }) ?? []
      return {
        title: tooltipHeader(input, formatX, x, d),
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
  const model = xScaleFor(input.data.map(input.x), input.band === true)
  const axes = resolveAxes(input, visible)
  const under = underlayMarks(input, model, axes)
  const over = refLineMarks(input, axes)
  const dots = cursorDotMarks(input, visible, axes)
  const rows = rowsOf(input, visibleKeys)
  const formatX = (v: ChartValue): string =>
    input.formatX ? input.formatX(v as X) : defaultFormatX(v)
  const gradients = input.series.flatMap((s, i) =>
    s.area ? [seriesAreaGradient(s, i, input, axes)] : [],
  )

  return {
    chart: ({ width, height }: ChartBuildContext): StoredChartSpec => {
      const cls = resolveContainerClass(width)
      const kindMarks = input.marks({
        rows,
        visible,
        highlighted: input.highlighted ?? null,
        containerClass: cls,
        width,
        height,
        y2: axes.right ? 'y2' : undefined,
        yDomain: axes.left.domain,
        y2Domain: axes.right?.domain,
      })
      return {
        marks: [...under, ...kindMarks, ...dots, ...over, crosshair({ x: CROSSHAIR, y: false })],
        scales: buildScales({
          input,
          model,
          axes,
          formatX,
          cls,
          height,
          zoneScale: under.length > 0,
        }),
        theme: CHART_THEME,
        ...(gradients.length > 0 && { gradients }),
        clip: true,
        ...(labelsInside(cls, height) && { margin: { left: 0, ...(axes.right && { right: 0 }) } }),
      }
    },
    // Followers paint the crosshair only, unless the chart opts into following tooltips.
    focus:
      typeof input.tooltip === 'object' && input.tooltip.onFollow
        ? 'group-x'
        : sourceOnlyFocus(input.cursorGroup, input.chartId),
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: cursorBinding({
      group: input.cursorGroup,
      chartId: input.chartId,
      keys: model.values,
      mode: input.cursorResolution ?? 'nearest',
      pin: input.coarse === true,
    }),
    tooltip:
      input.tooltip === false
        ? false
        : tooltipSpec({ input, axes, visible, keys, visibleKeys, formatX }),
  }
}
