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
import { ruleY } from '@tanstack/charts/rule'
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
import { fmtCompact } from '../format/number'
import { VX } from '../tokens'
import type { ContainerClass } from '../tokens/size-classes'
import { cursorBinding, sourceOnlyFocus } from './cursor'
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
  PlotContext,
  PlotRow,
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

function defaultFormatX(v: ChartValue): string {
  if (v instanceof Date) return utcAxisDate(v)
  if (typeof v === 'number') return defaultNumberFormat(v)
  return String(v)
}

const clampTo = (v: number, [lo, hi]: readonly [number, number]): number =>
  Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi))

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

function yGuide<T>(opts: {
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
      : { count: typeof cfg?.ticks === 'number' ? cfg.ticks : ladder.yTicks }
  const gridLine = grid ? { grid: GRID_LINE } : {}
  if (cls === 'micro') return { ...gridLine, axis: false }
  // Compact: labels sit INSIDE the plot, above their grid line, so the plot keeps the full width.
  const inside = cls === 'compact'
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

function xGuide<X extends ChartX>(opts: {
  model: XScaleModel<X>
  xTicks: number | readonly X[] | undefined
  format: (v: ChartValue) => string
  cls: ContainerClass
}): Omit<ChartPositionScaleOptions<ChartValue>, 'scale'> {
  const { model, xTicks, format, cls } = opts
  const ladder = LADDER[cls]
  const ticks = xTickPolicy(model, xTicks ?? ladder.xTicks)
  return {
    axis: {
      line: AXIS_LINE,
      ticks: { ...ticks, format, line: false, size: 0 },
      tickLabels: {
        fontSize: ladder.font,
        opacity: 1,
        thin: true,
        // A locked-zero left margin (compact) must not clip the first label.
        ...(cls === 'compact' && {
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

const isBar = <T>(s: ChartSeries<T>): boolean => s.mark === 'bar'

/** A stack's auto domain reads its per-x totals: the positive sum and the negative sum stand in for
 * the bar series; every other series counts as itself. */
/** The two synthetic totals standing in for a stack's bars in its AUTO domain only. */
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

export function compileCartesian<T, X extends ChartX>(
  input: CartesianInput<T, X>,
): CartesianDefinition {
  const hidden = input.hidden ?? new Set<string>()
  const highlighted = input.highlighted ?? null
  const visible = visibleSeries(input.series, hidden)
  const visibleKeys = new Set(visible.map((s) => s.key))
  const seriesBy = new Map(input.series.map((s) => [s.key, s]))
  const xs = input.data.map(input.x)
  const model = xScaleFor(xs, input.band === true)
  const hasY2 = input.y2 !== undefined

  // ── y domains: basalt's, from the VISIBLE series plus this axis' finite overlay bounds ────────
  const bounds = { left: [] as number[], right: [] as number[] }
  // A bound lands on the axis its mark is drawn on: `'right'` without a `y2` is the left axis.
  const sideOf = (side: 'left' | 'right' | undefined): 'left' | 'right' =>
    side === 'right' && hasY2 ? 'right' : 'left'
  for (const z of input.zones ?? []) bounds[sideOf(z.axisSide)].push(z.from, z.to)
  for (const l of input.refLines ?? []) bounds[sideOf(l.axis)].push(l.value)
  const onRight = (s: ChartSeries<T>): boolean => hasY2 && s.axis === 'right'
  const leftSeries = visible.filter((s) => !onRight(s))
  // A stack changes only the AUTO rule: a tuple is fixed, and a domain function gets the real
  // visible series (its own seam for summing a stack).
  const autoLeft = input.y?.domain === undefined || input.y.domain === 'auto'
  const left: YAxis = {
    domain:
      input.stack === 'normalized' && autoLeft
        ? normalizedDomain(input.data, leftSeries)
        : resolveYDomain(
            input.y,
            input.data,
            input.stack && autoLeft ? stackedSeries(leftSeries) : leftSeries,
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
  const yLeft = yScaleFor(input.y, left.domain)
  const yRight = right ? yScaleFor(input.y2, right.domain) : null
  const axisOf = (side: 'left' | 'right' | undefined): YAxis =>
    side === 'right' && right ? right : left
  const yScaleId = (side: 'left' | 'right' | undefined): 'y' | 'y2' =>
    side === 'right' && hasY2 ? 'y2' : 'y'

  const formatX = (v: ChartValue): string =>
    input.formatX ? input.formatX(v as X) : defaultFormatX(v)
  const header = (v: ChartValue, d: T): string => {
    if (input.tooltip && input.tooltip.formatHeader) return input.tooltip.formatHeader(v as X, d)
    if (v instanceof Date && !input.formatX) return utcHeaderDate(v)
    return formatX(v)
  }

  // ── fixed paint: zones and x-zones under the marks, reference lines over them ────────────────
  const fractionRows = [{ f0: 0, f1: 1 }]
  const zoneMarks = (input.zones ?? []).map((z, i) => {
    const domain = axisOf(z.axisSide).domain
    return decorative(
      rect(fractionRows, {
        id: `zone-${i}`,
        x1: 'f0',
        x2: 'f1',
        y1: () => clampTo(z.from, domain),
        y2: () => clampTo(z.to, domain),
        xScale: 'zx',
        yScale: yScaleId(z.axisSide),
        fill: z.fill,
        inset: 0,
      }),
    )
  })
  const xZoneMarks = (input.xZones ?? []).flatMap((z, i) => {
    const f = xZoneFractions(z, model)
    if (!f) return []
    return [
      decorative(
        rect([{ f0: f[0], f1: f[1] }], {
          id: `xzone-${i}`,
          x1: 'f0',
          x2: 'f1',
          y1: () => left.domain[0],
          y2: () => left.domain[1],
          xScale: 'zx',
          fill: z.fill,
          inset: 0,
        }),
      ),
    ]
  })
  const refMarks = (input.refLines ?? []).map((r, i) =>
    ruleY([r.value], {
      id: `ref-${i}`,
      stroke: r.color,
      strokeOpacity: 1,
      strokeWidth: 1,
      yScale: yScaleId(r.axis),
      ...(r.dashed && { strokeDasharray: DASH }),
    }),
  )

  const rowsFor = (key: string): PlotRow<T, X>[] => {
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

  const tooltip = input.tooltip === false ? undefined : input.tooltip
  // A point's datum is a `plot.rows()` row, or a consumer mark's own datum (taken as `T`).
  const sourceOf = (point: ChartPoint): { x: ChartValue; d: T } => {
    const datum = point.datum
    if (typeof datum === 'object' && datum !== null && 'datum' in datum && 'series' in datum) {
      const row = datum as PlotRow<T, X>
      if (seriesBy.has(row.series)) return { x: row.x, d: row.datum }
    }
    return { x: point.xValue, d: datum as T }
  }
  const rowSeries = (input.reverseRows ? visible.toReversed() : visible).filter(
    (s) => s.tooltip !== false,
  )
  const hiddenSeries = input.series.filter((s) => !visibleKeys.has(s.key))
  const zoneScale = zoneMarks.length > 0 || xZoneMarks.length > 0
  const gradients = input.series.flatMap((s, i) =>
    s.area ? [areaGradient(i, typeof s.area === 'string' ? s.area : s.color)] : [],
  )

  return {
    chart: ({ width, height }: ChartBuildContext): StoredChartSpec => {
      const cls = resolveContainerClass(width)
      const plot: PlotContext<T, X> = {
        rows: rowsFor,
        visible,
        highlighted,
        containerClass: cls,
        width,
        height,
        y2: hasY2 ? 'y2' : undefined,
        yDomain: left.domain,
        y2Domain: right?.domain,
      }
      const kindMarks: ChartMarks = input.marks(plot)
      const scales = {
        x: {
          scale: model.scale,
          ...xGuide({ model, xTicks: input.xTicks, format: formatX, cls }),
        },
        y: {
          scale: yLeft,
          ...yGuide({ cfg: input.y, axis: left, cls, side: 'left', grid: input.y?.grid ?? true }),
        },
        ...(right &&
          yRight && {
            y2: {
              channel: 'y' as const,
              scale: yRight,
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
      } satisfies StoredChartSpec['scales']
      const inside = cls === 'compact'
      return {
        marks: [
          ...zoneMarks,
          ...xZoneMarks,
          ...kindMarks,
          ...refMarks,
          crosshair({ x: CROSSHAIR, y: false }),
        ],
        scales,
        theme: CHART_THEME,
        ...(gradients.length > 0 && { gradients }),
        clip: true,
        ...(inside && { margin: { left: 0, ...(right && { right: 0 }) } }),
      }
    },
    // Followers paint the crosshair only, unless the chart opts into following tooltips.
    focus: tooltip?.onFollow ? 'group-x' : sourceOnlyFocus(input.cursorGroup, input.chartId),
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
        : {
            use: tooltipHost,
            portal,
            anchor: 'group-center',
            content: (points: readonly ChartPoint[]) => {
              const primary = points[0]
              if (!primary) return { rows: [] }
              const { x, d } = sourceOf(primary)
              const rows: EngineTooltipRow[] = []
              for (const s of rowSeries) {
                const v = s.getValue(d)
                if (v === null || !Number.isFinite(v)) continue
                const value = s.formatValue
                  ? s.formatValue(v, d)
                  : axisOf(onRight(s) ? 'right' : 'left').format(v)
                rows.push({
                  label: s.note === undefined ? s.label : `${s.label} · ${s.note}`,
                  value,
                  color: s.color,
                  ...(highlighted === s.key && { active: true }),
                })
              }
              const extra: readonly ChartTooltipRow[] =
                tooltip?.rows?.(d, { visible, hidden: hiddenSeries }) ?? []
              return { title: header(x, d), rows: [...rows, ...extra] }
            },
          },
  }
}
