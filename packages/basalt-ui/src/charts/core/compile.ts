/**
 * `compileCartesian` — basalt's chart spec in, a TanStack definition out (`docs/V2-SPEC.md` § 9.2).
 * Pure and React-free: the host memoizes it, the tests call it directly. It owns the scales and
 * domains, the theme bridge, zones / x-zones / reference lines, the crosshair, the shared cursor
 * binding, the tooltip content, and the container-class guide ladder.
 * TanStack owns margins (measured), layout, focus and keyboard, the tooltip surface and SSR.
 */
import { headerDay, readoutClock } from '../chart-dates'
import { dateTickFormat, utcAxisDate } from '../date-tick-format'
import { crosshair } from '@tanstack/charts/crosshair'
import { decorative } from '@tanstack/charts/mark/decorative'
import { dot } from '@tanstack/charts/dot'
import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { ruleX, ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleUtc } from '@tanstack/charts/scales/time'
import { cardPortal } from './portal'
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
import { compact } from '../../format/number'
import { NON_FINITE, numberFormat } from '../../format/shared'
import { BASALT } from '../../tokens'
import type { ContainerClass } from '../../tokens/size-classes'
import { cursorBinding, followerOptions, followsChart, quietWhileFollowing } from './cursor'
import { cursorDots } from '../marks'
import { changeOf, markRich, rampColor, rampShare } from './rich-tooltip'
import type { RichRow, RowDetail } from './rich-tooltip'
import { bucketTicks, strideEvery } from './ticks'
import {
  clampToDomain,
  edgeFraction,
  matchBandKeys,
  offScaleMarks,
  stackCapMarks,
  CARET_SIZE,
  offScaleSide,
  xRoomForDots,
  strideKeepEnds,
} from './axis-ext'
import { barValueLabels } from './bar-values'
import { MAIN_PANE, plotAccess, plotContext } from './plot-context'
import { spreadPoints } from './spread'
import type { SpreadPlace } from './spread'
import { claimedLabelBoxes, endLabelGutter } from '../labels'
import type { LinesNaming } from '../labels'
import { estimateWidth, lineHeight } from '../label-place'
import type { LabelBox as PxBox } from '../chart-labels'
import {
  captionPx,
  markDot,
  pathBoxes,
  pxBox,
  ruleBoxes,
  valueBox,
  withHostObstacles,
  xRuleBoxes,
} from '../label-obstacles'
import type { PlotPx } from '../label-obstacles'
import { boxesMeet, dotBox, placeRefLabel, refLabelDy } from '../ref-label'
import type { DotMark, LabelBox, RefLabelPoint } from '../ref-label'
import type { PlotAccess, PlotSizes } from './plot-context'
import { resolveContainerClass } from '../../tokens/size-classes'
import {
  resolveYDomain,
  xScaleFor,
  xZoneBound,
  xZoneFractions,
  xZoneWiden,
  yScaleFor,
  warpFor,
} from './scales'
import type { XScaleModel } from './scales'
import {
  captionWidth,
  dotSwatch,
  logTicks,
  ringSwatch,
  withLogX,
  withLogY,
  withLogY2,
  logYTicks,
  xRefLabelBoxes,
  xRefLabelSpots,
  xRefLineMarks,
  xTitleLabel,
  yTitleScale,
} from '../axis-gaps'
import type { XRefLabelBox } from '../axis-gaps'
import { chipCoversTick, chipRepeatsTick, xTickOpacity, yTickOpacity } from './readout-clear'
import type { Corner, XTickLabel } from './readout-clear'
import {
  AREA_BOTTOM,
  AREA_TOP,
  AXIS_LINE,
  CHART_THEME,
  CROSSHAIR,
  CV,
  DASH,
  GRID_LINE,
  LINE_STROKE_WIDTH,
} from './theme'
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
} from '../types'

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
  | 'formatXTick'
  | 'zones'
  | 'xZones'
  | 'refLines'
  | 'xRefLines'
  | 'events'
  | 'xTitle'
  | 'xScale'
  | 'cursorGroup'
  | 'cursorResolution'
  | 'tooltip'
> & {
  /** Unique per mounted chart (React `useId`): owns what this chart publishes to the cursor. */
  chartId: string
  /** The locale of every default chart text: ticks, tooltip header, y numbers (the provider's). */
  locale?: string
  /** The largest radius a dot series draws, px by series key: the plot keeps room for it at its edge. */
  dotRadius?: ReadonlyMap<string, number>
  /** The axis a dot series moves its coincident dots along (`Series.spread`), by series key. */
  dotSpread?: ReadonlyMap<string, 'x' | 'y'>
  /** Series keys the legend has toggled off. */
  hidden?: ReadonlySet<string>
  /** The legend entry under the pointer. */
  highlighted?: string | null
  /** The datum the chart's `focus` holds (`plot.focused`). */
  focused?: T | null
  /** `false`: the engine takes no tab stop or keys (a `focus` wrapper owns them). */
  keyboard?: boolean
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
  /** `y.gutter` (the seam): a fixed left margin in px, so stacked panes share one plot x. */
  yGutter?: number
  /**
   * The narrow class draws the y tick labels inside the plot, above their grid line, and reserves no axis column
   * (the plot is the frame). Set by a chart that owns its y axis; a pane of stacked charts (they share one gutter),
   * a fixed `y.gutter` and a right axis keep the labels in the gutter.
   */
  yInside?: boolean
  /** `auto` names the lines with end labels on the narrow class too: the chart's lines passed `phoneNamesFit`. */
  endLabelsNarrow?: boolean
  /** Engine controls on the definition (`RangeNavigator`'s brush). */
  controls?: CartesianDefinition['controls']
  /** `false`: no y axis, no grid (an overview strip). */
  yAxis?: false
  /** How the lines are named (`Lines`' `naming`, resolved): with end labels the point scale keeps them a gutter right of the last points. */
  endLabels?: LinesNaming
}

/** An inside y label's inset from the plot's left edge, px: clear of the keyboard ring, as the y title is. */
const INSIDE_DX = 4
/** An inside label's lift above its grid line, px (negative is up). */
const INSIDE_ABOVE = -4
/** A label this close to the plot's top edge, px, sits under its line instead, so the plot's edge never clips it. */
const INSIDE_TOP_PX = 14
/** An inside label drawn under its line, px. */
const INSIDE_BELOW = 11

/** Where an inside label stands from its grid line at `position`, px: the top one under its line, the rest above theirs. */
const insideShift = (position: number): number =>
  position < INSIDE_TOP_PX ? INSIDE_BELOW : INSIDE_ABOVE

/** The one tick-label size, at every container width: the caption size, so a card never mixes sizes. */
const TICK_FONT = BASALT.text.micro

/** Tick counts per container class (§ 9.6). */
const LADDER = {
  micro: { xTicks: 2, yTicks: 0 },
  narrow: { xTicks: 3, yTicks: 3 },
  regular: { xTicks: 5, yTicks: 5 },
  wide: { xTicks: 6, yTicks: 5 },
} as const satisfies Record<ContainerClass, { xTicks: number; yTicks: number }>

/**
 * A tick within this share of the x domain from its start counts as on the left edge: half a
 * day label is ~15 px, 4–5% of a compact plot. Round ticks rarely land on the domain start
 * exactly, so an equality test would miss the common case.
 */
const LEFT_EDGE_SHARE = 0.05

/** Air the engine keeps between two x tick labels, px: at 4 a date pair reads as one string (`27 Sep 4 Oct`). */
const TICK_MIN_GAP = 8
/** The width a y axis takes from the chart's width: what the x tick anchors count against, px. */
const Y_GUTTER = 44

/** Whether the y tick labels sit inside the plot: the narrow class of a chart that owns a lone left axis. */
const yInsideOf = (
  input: {
    yInside?: boolean | undefined
    yGutter?: number | undefined
    bare?: boolean | undefined
  },
  cls: ContainerClass,
  hasRight: boolean,
): boolean =>
  input.yInside === true &&
  cls === 'narrow' &&
  !hasRight &&
  input.bare !== true &&
  input.yGutter === undefined

/** The width the y axis takes from a frame of this class: none while its labels sit inside the plot. */
const yRoomPx = (inside: boolean): number => (inside ? 0 : Y_GUTTER)

export function defaultNumberFormat(v: number, locale?: string): string {
  return compact(v, { digits: Math.abs(v) >= 1000 ? 1 : 2, locale })
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
 * The tooltip's date: weekday, day, month and year in the chart's `locale` (the provider's; else the
 * one `setFormatDefaults` set, else the runtime's), read in UTC like the time scale; a non-midnight instant adds `HH:MM`. With
 * `dayOnly` (a day-granular series) the instant is its bucket's DAY, never a clock time: see
 * {@link bucketDay}.
 */
export function utcHeaderDate(d: Date, dayOnly = false, locale?: string): string {
  if (!Number.isFinite(d.getTime())) return NON_FINITE
  const date = headerDay(dayOnly ? bucketDay(d) : d, locale)
  if (dayOnly || d.getTime() % DAY_MS === 0) return date
  return `${date} ${readoutClock(d, locale)}`
}

const DAY_MS = 86_400_000

/** The fewest Date ticks an axis spanning at least this many whole days keeps. */
const MIN_DATE_TICKS = 3

/**
 * Default Date tick values: the time scale's own ticks, kept to whole UTC days once the data is
 * daily or coarser — d3 picks 12-hour steps for a short daily series, which label one day twice. A
 * span of several days never keeps fewer than {@link MIN_DATE_TICKS}: d3 steps by weeks when asked
 * for 3 over twelve days and leaves one tick, so the count is raised until three land.
 */
export function dateTicks(domain: readonly [Date, Date], count: number, stepMs: number): Date[] {
  const scale = scaleUtc().domain([domain[0], domain[1]])
  const ticksFor = (n: number): Date[] => {
    const ticks = scale.ticks(n)
    if (stepMs < DAY_MS) return ticks
    const days = ticks.filter((t) => t.getTime() % DAY_MS === 0)
    return days.length >= 2 ? days : ticks.filter((_, i, all) => i === 0 || i === all.length - 1)
  }
  const span = Math.abs(domain[1].getTime() - domain[0].getTime())
  const floor = Math.min(MIN_DATE_TICKS, Math.floor(span / DAY_MS))
  let ticks = ticksFor(count)
  // One more tick asked for at a time, so the fewest that reach the floor; 12 bounds the loop.
  for (let n = count + 1; ticks.length < floor && n <= count + 12; n++) ticks = ticksFor(n)
  return ticks
}

export function defaultFormatX(v: ChartValue, locale?: string): string {
  if (v instanceof Date) return utcAxisDate(v, locale)
  if (typeof v === 'number') return defaultNumberFormat(v, locale)
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
  s: Pick<ChartSeries<never>, 'label' | 'note' | 'color' | 'dash' | 'mark'>,
  value: string,
  active: boolean,
): EngineTooltipRow {
  return engineRow({
    label: s.note === undefined ? s.label : `${s.label} · ${s.note}`,
    value,
    color:
      s.mark === 'dot' ? dotSwatch(s.color) : s.mark === 'ring' ? ringSwatch(s.color) : s.color,
    swatch: s.dash === 'dashed' ? 'dashed' : 'solid',
    active,
  })
}

/** Keys the compiler reserves for the legend entries it derives from `refLines`. */
const REF_KEY_PREFIX = '__ref-'
const ZONE_KEY_PREFIX = '__zone-'

/** The legend key of a reference line that names itself (`RefLine.legend`). */
const refLegendKey = (index: number): string => `${REF_KEY_PREFIX}${index}`

/** Legend-only entries for the reference lines that name themselves, in line order. */
export function refLegendSeries<T>(refLines: readonly RefLine[] | undefined): ChartSeries<T>[] {
  return (refLines ?? []).flatMap((r, i) =>
    r.legend === undefined
      ? []
      : [
          {
            key: refLegendKey(i),
            label: r.legend.label,
            color: r.color,
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
            color: z.legend.color ?? z.fill,
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

type YAxis = {
  domain: readonly [number, number]
  format: (v: number) => string
  /** Every value on this axis is a whole number and a bar draws it (a count): ticks land on integers. */
  whole?: boolean
  /** The axis is logarithmic: label placement works in decades (`warpFor`). */
  log?: boolean
  /** The domain is fixed or bounded: a datum past it is drawn on the edge, with a caret. */
  bounded?: boolean
  /**
   * Every value is zero and the page set no domain: the engine still needs a span to draw a flat
   * line on, but the axis labels the zero baseline alone and invents no scale (never a lone `1`).
   */
  flat?: boolean
}

/** Whether every finite value of `series` (and every bound) is zero, with at least one present. */
function allZero<T>(
  data: readonly T[],
  series: readonly ChartSeries<T>[],
  bounds: readonly number[],
): boolean {
  let seen = false
  const zero = (v: number | null): boolean => {
    if (v === null || !Number.isFinite(v)) return true
    seen = true
    return v === 0
  }
  if (!bounds.every(zero)) return false
  for (const d of data) for (const s of series) if (!zero(s.getValue(d))) return false
  return seen
}

/** The page locale's decimal separator (`.` or `,`). */
const decimalSeparator = (locale?: string): string =>
  numberFormat(locale, {})
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
  locale?: string,
): (v: number) => string {
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const values =
    'values' in ticks ? ticks.values : scaleLinear().domain([lo, hi]).ticks(ticks.count)
  if (values.length === 0 || !values.every(Number.isInteger)) return axis.format
  const padded = zeroFraction(decimalSeparator(locale))
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
  if (!Array.isArray(cfg?.domain) || cfg.nice === true || cfg.scale === 'log') return null
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const round = scaleLinear().domain([lo, hi]).ticks(count)
  const [first, next, last] = [round.at(0), round.at(1), round.at(-1)]
  if (first === undefined || next === undefined || last === undefined || last >= hi) return null
  if (hi - last < (next - first) * END_TICK_MIN_GAP) return null
  return labelShape(axis.format(hi)) === labelShape(axis.format(last))
    ? null
    : { values: [...round, hi] }
}

/**
 * A count axis never labels a fraction: `0, 0.5, 1` over a day's two events becomes `0, 1, 2`. The
 * count's own ticks keep the integers; fewer than two leave the plan as it was. A tick list the caller
 * wrote, a log axis and a plan that is all integers already stay as they are.
 */
function wholeTicks<T>(
  axis: YAxis,
  cfg: AxisConfig<T> | undefined,
  planned: { values: readonly number[] } | { count: number },
): { values: readonly number[] } | { count: number } {
  if ('values' in planned || cfg?.scale === 'log') return planned
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const all = scaleLinear().domain([lo, hi]).ticks(planned.count)
  if (all.every(Number.isInteger)) return planned
  const whole = all.filter(Number.isInteger)
  return whole.length >= 2 ? { values: whole } : planned
}

/**
 * A zone or band drawn on a y axis puts a tick on each of its edges, so the rules land on labels: the
 * round ticks that sit within half a step of an edge give way to it. An edge on or past the domain's
 * end, a non-finite one, and (on a count axis) a fraction stay off. A tick list the caller wrote is
 * never changed (the caller checks `cfg.ticks`).
 */
function withEdgeTicks(
  axis: YAxis,
  planned: { values: readonly number[] } | { count: number },
  edges: readonly number[],
): { values: readonly number[] } | { count: number } {
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const inside = [...new Set(edges)].filter(
    (e) => Number.isFinite(e) && e > lo && e < hi && (axis.whole !== true || Number.isInteger(e)),
  )
  if (inside.length === 0) return planned
  const base =
    'values' in planned ? planned.values : scaleLinear().domain([lo, hi]).ticks(planned.count)
  const step = base.length > 1 ? Math.abs((base[1] as number) - (base[0] as number)) : hi - lo
  const kept = base.filter((t) => inside.every((e) => Math.abs(t - e) >= step / 2))
  return { values: [...kept, ...inside].toSorted((a, b) => a - b) }
}

export function yGuide<T>(opts: {
  cfg: AxisConfig<T> | undefined
  axis: YAxis
  cls: ContainerClass
  side: 'left' | 'right'
  grid: boolean
  /** The locale the default tick numbers read; absent, the format defaults'. */
  locale?: string | undefined
  /** The edges of the zones drawn on this axis: a tick sits on each when the domain allows. */
  edges?: readonly number[] | undefined
  /** The hover pins its y value beside this axis: the tick on the readout's row is blanked while it shows. */
  readout?: boolean | undefined
  /** The plot's lower-left corner: the lowest tick is blanked while the x chip hangs over it. */
  corner?: Corner | undefined
  /** The labels sit inside the plot, above their grid line, and reserve no gutter (see `CartesianInput.yInside`). */
  inside?: boolean | undefined
}): Omit<ChartPositionScaleOptions<number>, 'scale'> {
  const { cfg, axis, cls, side, grid, locale, edges = [], readout = false, corner, inside } = opts
  const ladder = LADDER[cls]
  const planned =
    typeof cfg?.ticks === 'object'
      ? { values: cfg.ticks }
      : ((cls === 'narrow' && cfg?.ticks === undefined
          ? withEndTick(cfg, axis, ladder.yTicks)
          : null) ?? { count: typeof cfg?.ticks === 'number' ? cfg.ticks : ladder.yTicks })
  const [domLo, domHi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  const ticks =
    cfg?.scale === 'log' && cfg.ticks === undefined
      ? {
          values: logYTicks(
            domLo,
            domHi,
            typeof planned === 'object' && 'count' in planned ? planned.count : ladder.yTicks,
          ),
        }
      : axis.flat === true
        ? { values: [0] }
        : axis.whole === true
          ? wholeTicks(axis, cfg, planned)
          : cfg?.ticks === undefined && cfg?.scale !== 'log'
            ? withEdgeTicks(axis, planned, edges)
            : planned
  const gridLine = grid ? { grid: GRID_LINE } : {}
  if (cls === 'micro') return { ...gridLine, axis: false }
  const tickFormat = wholeStepFormat(axis, cfg, ticks, locale)
  // Labels sit in a gutter OUTSIDE the plot, against its edge: a line never runs through one. A narrow chart
  // takes no gutter: each label stands inside the plot on its grid line (the top one under its line, where the
  // plot ends), the way the y title does, so the plot takes the whole frame.
  return {
    ...gridLine,
    ...(side === 'right' && { side: 'right' as const }),
    axis: {
      line: false,
      ticks: {
        ...ticks,
        format: tickFormat,
        line: false,
        ...(inside === true && { size: 0, padding: 0 }),
      },
      tickLabels: {
        fontSize: TICK_FONT,
        opacity:
          readout || corner !== undefined
            ? yTickOpacity({
                fontSize: TICK_FONT,
                chip: readout,
                corner,
                shift: inside === true ? insideShift : undefined,
              })
            : 1,
        ...(inside === true && {
          anchor: 'start' as const,
          dx: INSIDE_DX,
          dy: ({ position }: { position: number }) => insideShift(position),
        }),
      },
    },
  }
}

/**
 * The values the y axis of `side` labels, as `yGuide` plans them: a written list, else the ticks of the
 * planned count on the axis' domain, with the zone edges `yGuide` adds. Empty on the micro class.
 */
export function yTickValues<T>(opts: {
  cfg: AxisConfig<T> | undefined
  axis: YAxis
  cls: ContainerClass
  /** The edges of the zones drawn on this axis: `yGuide` puts a tick on each. */
  edges?: readonly number[] | undefined
}): number[] {
  if (opts.cls === 'micro') return []
  const guide = yGuide({ ...opts, side: 'left', grid: false })
  const axisSpec = guide.axis
  if (axisSpec === undefined || axisSpec === false) return []
  const ticks = axisSpec.ticks as { values?: readonly number[]; count?: number } | undefined
  if (ticks === undefined) return []
  if (ticks.values !== undefined) return [...ticks.values]
  const [lo, hi] = [Math.min(...opts.axis.domain), Math.max(...opts.axis.domain)]
  return scaleLinear()
    .domain([lo, hi])
    .ticks(ticks.count ?? LADDER[opts.cls].yTicks)
}

/**
 * How far a band axis label wider than its slot hangs past the plot's right edge, px: the engine would
 * shrink the plot to make room for it. Such a label is right-aligned to the plot edge instead
 * (anchor `end`, shifted by the distance from its band centre to the edge). `undefined` when it fits or
 * the width is not known.
 */
function bandEdgeShift<X extends ChartX>(
  model: XScaleModel<X>,
  value: ChartValue,
  text: string,
  width: number | undefined,
  yRoom: number,
): number | undefined {
  if (width === undefined || !Number.isFinite(width)) return undefined
  const plotWidth = Math.max(0, width - yRoom)
  const centre = model.fraction(value as X)
  if (centre === null || plotWidth <= 0) return undefined
  const toEdge = (1 - centre) * plotWidth
  return captionWidth(text, TICK_FONT) / 2 > toEdge ? toEdge : undefined
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
  /** The caller wrote `ticks`: a band axis honours the number (first and last kept), not its own ladder. */
  explicit = false,
): { values: readonly ChartValue[] } | { count: number } {
  if (typeof xTicks === 'object')
    return {
      values: model.band || model.kind === 'string' ? matchBandKeys(model.values, xTicks) : xTicks,
    }
  const buckets = typeof xTicks === 'number' && Number.isFinite(xTicks) ? bucketDates(model) : null
  if (buckets !== null && typeof xTicks === 'number')
    return { values: explicit ? strideKeepEnds(buckets, xTicks) : bucketTicks(buckets, xTicks) }
  if (model.log && model.extent) return { values: logTicks(model.extent[0], model.extent[1]) }
  if (model.band || model.kind === 'string')
    return { values: explicit ? strideKeepEnds(model.values, xTicks) : model.values }
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
  locale?: string,
): (v: ChartValue) => string {
  if (consumer) return consumer
  const plain = (v: ChartValue): string => defaultFormatX(v, locale)
  if (tickValues.length === 0 || !tickValues.every((v): v is Date => v instanceof Date))
    return plain
  const dateFormat = dateTickFormat(tickValues, locale)
  return (v) => (v instanceof Date ? dateFormat(v) : plain(v))
}

/** What the x axis' tick labels are built from: the scale, the caller's ticks and format, the class and the chart's width. */
type XTickSetupOpts<X extends ChartX> = {
  model: XScaleModel<X>
  xTicks: number | readonly X[] | undefined
  /** A consumer's formatter; absent, Date ticks get the span-aware {@link xTickFormat}. */
  format?: ((v: ChartValue) => string) | undefined
  cls: ContainerClass
  /** The locale the default tick text reads; absent, the format defaults'. */
  locale?: string | undefined
  /** The chart's width in px: a band axis anchors a label wider than its slot to the plot edge. */
  width?: number | undefined
  /** What the y axis takes of the width, px: {@link Y_GUTTER}, or 0 while its labels sit inside the plot (then no gutter takes a label hung past the left edge either). */
  yRoom?: number | undefined
}

function xTickSetup<X extends ChartX>(opts: XTickSetupOpts<X>) {
  const { model, xTicks, cls } = opts
  const ladder = LADDER[cls]
  const ticks = xTickPolicy(model, xTicks ?? ladder.xTicks, xTicks !== undefined)
  // A Date axis always resolves to `values` (the time scale has an extent; a band axis lists its
  // buckets), so `{ count }` is only ever a number axis and never needs the date formatter.
  const format = xTickFormat(opts.format, 'values' in ticks ? ticks.values : [], opts.locale)
  // A continuous scale's domain start and span; a band scale pads its first slot, so none applies.
  const [leftEdgeX, spanX] =
    !model.band && model.extent
      ? [model.extent[0], model.extent[1] - model.extent[0]]
      : [Number.NaN, Number.NaN]
  // A label centred on a tick near the plot's left edge hangs left of it, under the gutter's
  // lowest y label: start-anchor it. `+value` is a Date's timestamp, or the number itself.
  // On a band axis a label that hangs over the plot's right edge would make the engine shrink the
  // plot: it is right-aligned to the edge instead (see `dx`).
  const yRoom = opts.yRoom ?? Y_GUTTER
  // With no y gutter (the labels sit inside the plot) and no margin, a label centred nearer an edge than half its
  // width would hang out of the frame: it starts (left edge) or ends (right edge) at its tick instead.
  const edgeAnchor = (value: ChartValue): 'start' | 'end' | undefined => {
    if (yRoom > 0 || opts.width === undefined || !Number.isFinite(opts.width)) return undefined
    const centre = model.fraction(value as X)
    if (centre === null) return undefined
    const half = captionWidth(format(value), TICK_FONT) / 2
    if (centre * opts.width < half) return 'start'
    return (1 - centre) * opts.width < half ? 'end' : undefined
  }
  const anchor = ({ value }: { value: ChartValue }) => {
    const edge = edgeAnchor(value)
    if (edge !== undefined) return edge
    if (model.band) {
      return bandEdgeShift(model, value, format(value), opts.width, yRoom) === undefined
        ? undefined
        : ('end' as const)
    }
    const share = model.log
      ? (model.fraction(value as X) ?? Number.NaN)
      : (+value - leftEdgeX) / spanX
    return share >= 0 && share <= LEFT_EDGE_SHARE ? ('start' as const) : undefined
  }
  const dx = ({ value }: { value: ChartValue }) =>
    model.band && edgeAnchor(value) === undefined
      ? bandEdgeShift(model, value, format(value), opts.width, yRoom)
      : undefined
  return { ticks, format, anchor, dx }
}

/**
 * The x tick labels the axis prints, as the readout's coverage check reads them: each tick's value, text,
 * anchor and shift. A number axis with a tick count has the ticks d3 picks for it (the engine may thin them).
 */
export function xTickLabelList<X extends ChartX>(opts: XTickSetupOpts<X>): readonly XTickLabel[] {
  return tickLabelsOf(opts.model, xTickSetup(opts))
}

function tickLabelsOf<X extends ChartX>(
  model: XScaleModel<X>,
  { ticks, format, anchor, dx }: ReturnType<typeof xTickSetup>,
): readonly XTickLabel[] {
  const { extent } = model
  const values: readonly ChartValue[] =
    'values' in ticks
      ? ticks.values
      : extent === undefined
        ? []
        : scaleLinear().domain([extent[0], extent[1]]).ticks(ticks.count)
  return values.map((value) => ({
    value,
    text: format(value),
    anchor: anchor({ value }),
    dx: dx({ value }),
  }))
}

export function xGuide<X extends ChartX>(
  opts: XTickSetupOpts<X> & {
    /** The axis name, drawn centred under the ticks by the engine's own axis label. */
    title?: string | undefined
    /** What the hover's x readout prints; given, the tick under the readout is blanked while it shows. */
    readout?: ((v: ChartValue) => string) | undefined
    /** The plot's lower-left corner; given with `readout`, the first tick is blanked while the y chip sits over it. */
    corner?: Corner | undefined
  },
): Omit<ChartPositionScaleOptions<ChartValue>, 'scale'> {
  const setup = xTickSetup(opts)
  const { ticks, format, anchor, dx } = setup
  return {
    axis: {
      line: AXIS_LINE,
      ticks: { ...ticks, format, line: false, size: 0 },
      ...(opts.title && { label: xTitleLabel(opts.title) }),
      tickLabels: {
        fontSize: TICK_FONT,
        opacity: opts.readout
          ? xTickOpacity({
              tick: {
                text: format,
                anchor: (value) => anchor({ value }),
                dx: (value) => dx({ value }),
              },
              readoutText: opts.readout,
              fontSize: TICK_FONT,
              width: opts.width,
              corner: opts.corner,
              ticks: tickLabelsOf(opts.model, setup),
            })
          : 1,
        thin: { minGap: TICK_MIN_GAP },
        anchor,
        dx,
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
      { offset: 0, color: `color-mix(in srgb, ${color} ${AREA_TOP}, transparent)` },
      { offset: 1, color: `color-mix(in srgb, ${color} ${AREA_BOTTOM}, transparent)` },
    ],
  }
}

const areaTint = (color: string): string => `color-mix(in srgb, ${color} ${AREA_TOP}, transparent)`

/**
 * A series area filled by value zone: a vertical gradient whose stops sit at the zone boundaries.
 * The engine writes `<linearGradient>` in the default `objectBoundingBox` units, so offsets are
 * fractions of the AREA's own box, not of the plot: from the larger of the series' maximum and 0 down
 * to the smaller of its minimum and 0, the baseline the area closes to even when the y domain
 * excludes 0. A boundary at value `v` sits at `(ceiling - v) / (ceiling - floor)`. Hard edges:
 * neighbouring zones meet at one offset; overlapping zones never run backwards. `null` when no zone
 * reaches the area (the caller keeps the plain series-color fade). Linear axes only.
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

/** The gradient resource for a series' `area` fill: zones, a color ref, or the series color. */
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

/** The ring a dot draws round its radius, px: the room a dot needs is its radius and this. */
const DOT_RING = 1

/**
 * `axis` with its domain grown so every dot (`dots`: its value and radius) sits whole inside the
 * plot, which clips its marks at the edge: a dot centred on the floor draws half. Grown only on a
 * side a dot reaches, by the radius in px of the grown plot (`plotHeight`). A domain with a bar on it
 * keeps its floor: the bars stand on it.
 */
function roomForDots(
  axis: YAxis,
  dots: readonly { y: number; r: number; caret?: boolean }[],
  plotHeight: number,
): YAxis {
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  if (dots.length === 0 || plotHeight <= 0 || hi === lo) return axis
  const r = Math.max(...dots.map((d) => d.r)) + DOT_RING
  const [low, high] = [Math.min(...dots.map((d) => d.y)), Math.max(...dots.map((d) => d.y))]
  // A dot capped at an end also keeps the off-scale caret clear of itself, on the plot's side of the edge.
  const caret = (end: number): number =>
    dots.some((d) => d.caret === true && d.y === end) ? CARET_SIZE : 0
  let [from, to] = [lo, hi]
  // The room is a share of the grown span, so it is found by settling: a few passes converge.
  for (let i = 0; i < 4; i++) {
    const per = (to - from) / plotHeight
    from = Math.min(lo, low - (r + caret(lo)) * per)
    to = Math.max(hi, high + (r + caret(hi)) * per)
  }
  if (from === lo && to === hi) return axis
  return { ...axis, domain: axis.domain[0] <= axis.domain[1] ? [from, to] : [to, from] }
}

/**
 * `axis` with its floor lowered so the value label of its most negative bar fits under the bar's end:
 * a negative bar's label stands outside it, below, as a positive one stands above, so the plot keeps
 * the label's line and its air (`VALUE_HEAD_PX`) under the longest bar. The room is a share of the grown
 * span, found by settling. A floor already further down is kept.
 */
function roomForValues(axis: YAxis, floor: number | null, plotHeight: number): YAxis {
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  if (floor === null || floor >= 0 || plotHeight <= 0 || hi === lo) return axis
  let from = lo
  for (let i = 0; i < 4; i++)
    from = Math.min(lo, floor - (VALUE_ROOM_PX * (hi - from)) / plotHeight)
  if (from === lo) return axis
  return { ...axis, domain: axis.domain[0] <= axis.domain[1] ? [from, hi] : [hi, from] }
}

/** Only a dot within a tenth of the span of an end can touch the plot's edge: the rest never read the size. */
const nearEnd = (axis: YAxis, dots: readonly { y: number }[]): boolean => {
  const [lo, hi] = [Math.min(...axis.domain), Math.max(...axis.domain)]
  return dots.some((d) => d.y - lo < (hi - lo) * 0.1 || hi - d.y < (hi - lo) * 0.1)
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

/** Whether the left axis shows counts: a bar draws it, no stack shares it out, every value is whole. */
function wholeCounts<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  series: readonly ChartSeries<T>[],
): boolean {
  if (input.stack === 'normalized' || !series.some(isBar)) return false
  return series.every((s) =>
    input.data.every((d) => {
      const v = s.getValue(d)
      return v === null || !Number.isFinite(v) || Number.isInteger(v)
    }),
  )
}

/**
 * An explicit domain (a tuple, or the one the `y.domain` seam wrote): the data may lie past it. An
 * auto domain always holds its data. A stack of two or more bar series is not bounded per series
 * (a part's value is not the height it reaches): `clampStacks` and `stackCapMarks` cap its total
 * instead. A normalized one never clamps (it shares out the raw values); a lone bar series in the
 * default `stacked` layout is no stack and clamps here.
 */
const isBounded = <T, X extends ChartX>(
  input: CartesianInput<T, X>,
  cfg: AxisConfig<T> | undefined,
): boolean => {
  const stacks =
    input.stack === 'normalized' ||
    (input.stack === 'stacked' && input.series.filter(isBar).length > 1)
  return !stacks && cfg?.domain !== undefined && cfg.domain !== 'auto'
}

/** An auto-domain axis whose every value is zero: it labels the baseline and invents no scale. */
const flatAxis = <T, X extends ChartX>(
  input: CartesianInput<T, X>,
  cfg: AxisConfig<T> | undefined,
  series: readonly ChartSeries<T>[],
  bounds: readonly number[],
): boolean =>
  cfg?.scale !== 'log' &&
  (cfg?.domain === undefined || cfg.domain === 'auto') &&
  input.stack !== 'normalized' &&
  allZero(input.data, series, bounds)

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
    format: input.y?.format ?? ((v) => defaultNumberFormat(v, input.locale)),
    bounded: isBounded(input, input.y),
    ...(input.y?.scale === 'log' && { log: true }),
    ...(flatAxis(
      input,
      input.y,
      visible.filter((s) => !onRight(s)),
      bounds.left,
    ) && { flat: true }),
    whole: wholeCounts(
      input,
      visible.filter((s) => !onRight(s)),
    ),
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
        format: input.y2?.format ?? ((v) => defaultNumberFormat(v, input.locale)),
        bounded: isBounded(input, input.y2),
        ...(input.y2?.scale === 'log' && { log: true }),
        ...(flatAxis(input, input.y2, visible.filter(onRight), bounds.right) && { flat: true }),
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
    const widen = xZoneWiden(z, model)
    const bound = (value: X | undefined, sign: 1 | -1): number | null => {
      const fraction =
        value === undefined ? null : xZoneBound(value, sign === 1 ? 'to' : 'from', model)
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
          y1: () => (z.y ? clampTo(z.y.from, axes.left.domain) : axes.left.domain[0]),
          y2: () => (z.y ? clampTo(z.y.to, axes.left.domain) : axes.left.domain[1]),
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
/** The hairline that ties a caption stepped off its rule back to it: its width at the plot's edge and its reach into the caption's box, px. */
const REF_LABEL_LEADER_INSET = 1
const REF_LABEL_LEADER_PAD = 4
/** The most rows a zone caption tries down the inside of its zone. */
const MAX_ZONE_ROWS = 24
/** The most rows a zone caption tries down the side of its zone, after and before it. */
const MAX_ZONE_SIDE_ROWS = 6
/** A plot narrower than this (a phone's) keeps a zone caption inside its zone, over its own columns, or drops it: beside the zone it reads as the next thing's, px. */
const ZONE_SIDE_MIN_PLOT_PX = 400
/** A caption this wide or less (a run's '5 h') still stands beside its zone on a phone's plot, px. */
const ZONE_SHORT_CAPTION_PX = 40
/** Whether a zone's caption of this width may stand beside the zone on a plot of this width: a phone's plot keeps a longer caption inside its zone or drops it (a plot not yet measured keeps its first spot). */
export const zoneSideSpotsFit = (plotWidth: number, captionPx: number): boolean =>
  plotWidth <= 0 || plotWidth >= ZONE_SIDE_MIN_PLOT_PX || captionPx <= ZONE_SHORT_CAPTION_PX
/** How many rows above its top edge and under its bottom edge a zone bounded in y tries for its caption. */
const MAX_ZONE_EDGE_ROWS = 3
/** The room a bar's value label takes above its end (below a negative bar's), px: its line and the air under it. */
const VALUE_HEAD_PX = lineHeight(BASALT.text.micro) + 3
/** The room kept under the longest negative bar for its value label, px: the label's line, its gap to the bar and the air the placer keeps round it. */
const VALUE_ROOM_PX = VALUE_HEAD_PX + 6
/** The px an x axis takes off the frame, until the plot is measured: a first pass reads the plot's height as the frame's less this. */
const X_AXIS_PX = 40
/** The share of a bar slot kept between two grouped bars (`group({ padding })` in `bars-marks`). */
const GROUP_PADDING = 0.1

/** What a reference line's caption needs to choose its spot: the plot in px and the data on its axis. */
type RefLabelContext<T, X extends ChartX> = {
  plotWidth: number
  plotHeight: number
  /** One polyline per visible series on the line's axis. */
  lines: (side: 'left' | 'right' | undefined) => readonly (readonly RefLabelPoint[])[]
  /** Whether a bar or a dot on the left axis fills a box of a rule caption (px across, px below the plot top). */
  xBlocked: NonNullable<Parameters<typeof xRefLabelSpots>[0]['blocked']>
  /** The bar bodies and dots on the line's axis: a caption keeps off them. */
  marks: (side: 'left' | 'right' | undefined) => { bars: LabelBox[]; dots: DotMark[] }
  /** Whether a line path crosses a caption box (px across, px below the plot top). */
  lineHits: (box: { x0: number; x1: number; top: number; bottom: number }) => boolean
  /** The end labels placed on the left axis: a caption there keeps clear of them. */
  claimed: readonly LabelBox[]
  /** The vertical rules' captions, px below the plot top: a reference caption keeps clear of them. */
  xCaptions: readonly XRefLabelBox[]
  /** The captions already placed, by axis: the next one keeps clear of them. */
  placed: Record<'left' | 'right', LabelBox[]>
  axes: Axes<T>
  model: XScaleModel<X>
}

/** A caption box taken from the plot top in px, as a span of values on an axis with `domain`. */
function xCaptionOn(
  box: XRefLabelBox,
  domain: readonly [number, number],
  plotHeight: number,
): LabelBox {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const perPx = plotHeight > 0 ? (hi - lo) / plotHeight : 0
  return { fx0: box.fx0, fx1: box.fx1, y0: hi - box.bottom * perPx, y1: hi - box.top * perPx }
}

/** Half the height of another rule's claim, px: its half stroke and a pixel of air. */
const RULE_CLAIM_PX = 2

/** Other reference rules as boxes across the plot's width, for a caption to keep off. */
function ruleClaims(
  values: readonly number[],
  domain: readonly [number, number],
  plotHeight: number,
): LabelBox[] {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const perPx = plotHeight > 0 ? (hi - lo) / plotHeight : 0
  return values.map((v) => ({
    fx0: 0,
    fx1: 1,
    y0: v - RULE_CLAIM_PX * perPx,
    y1: v + RULE_CLAIM_PX * perPx,
  }))
}

/** The caption naming a reference line, at the spot {@link placeRefLabel} picks; none when no spot is clear of the other captions. */
const refLabelMark = <T, X extends ChartX>(
  r: RefLine,
  i: number,
  ctx: RefLabelContext<T, X>,
  /** The values of the other rules on this line's axis: a caption never crosses one. */
  others: readonly number[] = [],
): ChartMarks => {
  const { axes } = ctx
  const startFirst = r.axis === 'right' && axes.scaleId(r.axis) === 'y2'
  const side = startFirst ? 'right' : 'left'
  const axis = axes.axisOf(r.axis)
  const warp = warpFor(axis.log)
  const domain = warp.domain(axis.domain)
  const placed = placeRefLabel({
    pinned: r.labelPosition,
    startFirst,
    value: warp.to(r.value),
    domain,
    plotWidth: ctx.plotWidth,
    plotHeight: ctx.plotHeight,
    label: r.label ?? '',
    fontSize: BASALT.text.micro,
    series: ctx.lines(r.axis),
    ...ctx.marks(r.axis),
    claimed: [
      ...(startFirst ? [] : ctx.claimed),
      ...ctx.xCaptions.map((b) => xCaptionOn(b, domain, ctx.plotHeight)),
      ...ctx.placed[side],
      ...ruleClaims(others.map(warp.to), domain, ctx.plotHeight),
    ],
  })
  if (placed === null) return []
  ctx.placed[side].push(placed.box)
  const { position, shift, slide } = placed
  const atStart = position.startsWith('start')
  const above = position.endsWith('above')
  const dy = refLabelDy(position, BASALT.text.micro) + (above ? -shift : shift)
  const label = decorative(
    text([{ f: atStart ? slide : 1 - slide }], {
      id: `ref-${i}-label`,
      x: (d: { f: number }) => d.f,
      y: () => r.value,
      xScale: 'zx',
      yScale: axes.scaleId(r.axis),
      text: () => r.label ?? '',
      fill: CV.inkMuted,
      fontSize: BASALT.text.micro,
      anchor: atStart ? 'start' : 'end',
      dx: atStart ? REF_LABEL_DX : -REF_LABEL_DX,
      dy,
    }),
  )
  if (shift === 0) return [label]
  // A caption stepped off its rule is tied back to it by a hairline at the plot's edge.
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const perPx = ctx.plotHeight > 0 ? (hi - lo) / ctx.plotHeight : 0
  const reach = (shift + REF_LABEL_LEADER_PAD) * perPx
  const edge = (atStart ? 1 : -1) * (REF_LABEL_LEADER_INSET / Math.max(ctx.plotWidth, 1))
  const f = atStart ? 0 : 1
  return [
    decorative(
      rect(
        [
          {
            f0: f,
            f1: f + edge,
            y0: r.value,
            y1: warp.from(warp.to(r.value) + (above ? reach : -reach)),
          },
        ],
        {
          id: `ref-${i}-leader`,
          x1: 'f0',
          x2: 'f1',
          y1: 'y0',
          y2: 'y1',
          xScale: 'zx',
          yScale: axes.scaleId(r.axis),
          fill: CV.inkMuted,
          inset: 0,
        },
      ),
    ),
    label,
  ]
}

/**
 * The captions of the x zones that carry a `label`, over the marks, muted like a reference
 * caption: inside the zone at its top-start corner; after the zone, then before it, when the
 * caption is wider than the zone, and never over another zone; slid along the zone in 10 px steps (the first
 * inside rows, then the edge rows) when the corner, the edges and the sides are all taken; dropped when no spot stays in the
 * plot clear of the reference captions, the zone captions placed before it, the end labels, the
 * page's own labels, every line and rule, every bar and dot and the room a bar's value label takes. Reads the plot size,
 * so only a chart with a zone caption pays the measured re-render.
 */
const xZoneLabelMarks = <T, X extends ChartX>(
  input: CartesianInput<T, X>,
  ctx: RefLabelContext<T, X>,
): ChartMarks => {
  const { plotWidth, plotHeight, axes, model } = ctx
  const fontSize = BASALT.text.micro
  const warp = warpFor(axes.left.log)
  const domain = warp.domain(axes.left.domain)
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const perPx = plotHeight > 0 && hi > lo ? (hi - lo) / plotHeight : 0
  const inDomain = (v: number): number => warp.to(clampTo(v, axes.left.domain))
  const avoid = (): LabelBox[] => [
    ...ctx.xCaptions.map((b) => xCaptionOn(b, domain, plotHeight)),
    ...ctx.placed.left,
    ...ctx.claimed,
  ]
  return (input.xZones ?? []).flatMap((z, i) => {
    const f = z.label ? xZoneFractions(z, model) : null
    if (!z.label || f === null) return []
    const top = z.y ? inDomain(Math.max(z.y.from, z.y.to)) : hi
    const bottom = z.y ? inDomain(Math.min(z.y.from, z.y.to)) : lo
    const width = estimateWidth(z.label, fontSize)
    const [x0, x1] = [f[0] * plotWidth, f[1] * plotWidth]
    // A line box from the zone's top: its first row sits in the corner, each next one a row lower.
    const rowTop = fontSize / 2 - 2
    const rowBottom = fontSize * 1.5 + 2
    const stepPx = rowBottom - rowTop + 2
    const zoneHeightPx = perPx > 0 ? (top - bottom) / perPx : 0
    const rows =
      perPx > 0
        ? Math.min(MAX_ZONE_ROWS, Math.max(1, Math.floor((zoneHeightPx - rowTop) / stepPx)))
        : 1
    const inside = Array.from({ length: rows }, (_, row) => ({
      at: f[0],
      side: 1 as const,
      left: x0 + REF_LABEL_DX,
      inside: true,
      row,
    }))
    // A zone bounded in y has room above its top edge and under its bottom one, over its own columns.
    const edge = z.y
      ? [
          // The first row clears the zone's own edge rule by a pixel or two, the next ones step away.
          ...Array.from({ length: MAX_ZONE_EDGE_ROWS }, (_, k) => -(rowBottom + 2.5) / stepPx - k),
          ...Array.from(
            { length: MAX_ZONE_EDGE_ROWS },
            (_, k) => (zoneHeightPx + 3 - rowTop) / stepPx + k,
          ),
        ].map((row) => ({
          at: f[0],
          side: 1 as const,
          left: x0 + REF_LABEL_DX,
          inside: false,
          row,
        }))
      : []
    // The same rows, slid along the zone's own span: a zone that bars or lines fill from its corner to
    // its far end still has a gap somewhere along it, so its caption moves there (10 px a try, the first
    // three inside rows and the edge rows) rather than drop. A caption that fits its corner or sits
    // beside its zone never moves.
    const slid = [...inside.slice(0, 3), ...edge].flatMap((row) =>
      Array.from({ length: Math.floor((x1 - x0 - width) / 10) }, (_, k) => ({
        ...row,
        at: f[0] + ((k + 1) * 10) / plotWidth,
        left: row.left + (k + 1) * 10,
      })),
    )
    // Inside the zone, top to bottom, then above and under it, then after it and before it on the top
    // row, then lower down beside it: a zone that lines cross keeps its caption beside it rather
    // than lose it. Then the same rows along the zone.
    const spots = [
      ...inside,
      ...edge,
      ...(!zoneSideSpotsFit(plotWidth, width)
        ? []
        : Array.from({ length: MAX_ZONE_SIDE_ROWS }, (_, row) => [
            { at: f[1], side: 1 as const, left: x1 + REF_LABEL_DX, inside: false, row },
            { at: f[0], side: -1 as const, left: x0 - REF_LABEL_DX - width, inside: false, row },
          ]).flat()),
      ...slid,
    ]
    type Spot = (typeof spots)[number]
    const offset = (spot: Spot): number => spot.row * stepPx
    // Every other zone as a box (its x span, its y span or the plot's): a caption beside its zone never lies over one.
    const neighbours = (input.xZones ?? []).flatMap((o, j): LabelBox[] => {
      const g = j === i ? null : xZoneFractions(o, model)
      if (g === null) return []
      const [from, to] = o.y ? [warp.to(o.y.from), warp.to(o.y.to)] : [lo, hi]
      return [{ fx0: g[0], fx1: g[1], y0: Math.min(from, to), y1: Math.max(from, to) }]
    })
    // The caption's line box from the zone's top, in values, for the collision pass.
    const boxOf = (spot: Spot): LabelBox => ({
      fx0: spot.left / plotWidth,
      fx1: (spot.left + width) / plotWidth,
      y0: top - (rowBottom + offset(spot)) * perPx,
      y1: top - (rowTop + offset(spot)) * perPx,
    })
    // The same box in px below the plot top, for the marks: no bar, dot or line path under it.
    const pxOf = (spot: Spot): { x0: number; x1: number; top: number; bottom: number } => {
      const edge = perPx > 0 ? (hi - top) / perPx : 0
      return {
        x0: spot.left,
        x1: spot.left + width,
        top: edge + rowTop + offset(spot),
        bottom: edge + rowBottom + offset(spot),
      }
    }
    // A caption sits where no line, rule, bar, dot or bar value passes through its box, or it is dropped: a
    // struck-through or overprinted caption reads worse than none, and the zone's fill still shows what it spans.
    const fits = (s: Spot): boolean =>
      s.left >= 0 &&
      s.left + width <= (s.inside ? x1 - REF_LABEL_DX : plotWidth) &&
      (s.inside || !neighbours.some((o) => boxesMeet(boxOf(s), o))) &&
      (s.inside || (pxOf(s).top >= 0 && pxOf(s).bottom <= plotHeight)) &&
      !avoid().some((b) => boxesMeet(boxOf(s), b)) &&
      !ctx.xBlocked(pxOf(s)) &&
      !ctx.lineHits(pxOf(s))
    // Before the plot is measured the caption keeps its first spot.
    const spot = plotWidth <= 0 ? spots[0] : spots.find(fits)
    if (spot === undefined) return []
    if (plotWidth > 0) ctx.placed.left.push(boxOf(spot))
    return [
      decorative(
        text([{ f: spot.at }], {
          id: `xzone-${i}-label`,
          x: (d: { f: number }) => d.f,
          y: () => warp.from(top),
          xScale: 'zx',
          yScale: 'y',
          text: () => z.label ?? '',
          fill: CV.inkMuted,
          fontSize,
          anchor: spot.side === 1 ? 'start' : 'end',
          dx: spot.side * REF_LABEL_DX,
          dy: fontSize + offset(spot),
        }),
      ),
    ]
  })
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
          ...(r.label
            ? refLabelMark(
                r,
                i,
                label(),
                (input.refLines ?? []).flatMap((o, j) =>
                  j === i ||
                  input.hidden?.has(refLegendKey(j)) ||
                  axes.scaleId(o.axis) !== axes.scaleId(r.axis)
                    ? []
                    : [o.value],
                ),
              )
            : []),
        ],
  )

/** The edges of the zones drawn against one axis: a tick sits on each. */
function zoneEdgesOn<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  axes: Axes<T>,
  side: 'left' | 'right',
): number[] {
  return (input.zones ?? [])
    .filter((z) => axes.scaleId(z.axisSide) === axes.scaleId(side))
    .flatMap((z) => [z.from, z.to])
}

function buildScales<T, X extends ChartX>(opts: {
  input: CartesianInput<T, X>
  model: XScaleModel<X>
  axes: Axes<T>
  formatX: (v: ChartValue) => string
  cls: ContainerClass
  zoneScale: boolean
  /** The chart's width in px. */
  width?: number
}): StoredChartSpec['scales'] {
  const { input, model, axes, formatX, cls, zoneScale, width } = opts
  const edgesOn = (side: 'left' | 'right'): number[] => zoneEdgesOn(input, axes, side)
  const { left, right } = axes
  const leftWarp = warpFor(left.log)
  const [warpLo, warpHi] = leftWarp.domain(left.domain)
  const yFloor = Math.min(warpLo, warpHi)
  const ySpan = Math.max(warpLo, warpHi) - yFloor
  // The x chip hangs left of the plot only where it is drawn: on a chart that labels its x axis and does not
  // follow another chart's cursor. The y chip pins only without a right axis.
  const corner: Corner = {
    x: (value) => model.fraction(value as X),
    xChip: () => labelsX(input) && !followsChart(input.cursorGroup, input.chartId),
    y: (value) =>
      typeof value === 'number' && ySpan > 0 ? (leftWarp.to(value) - yFloor) / ySpan : null,
  }
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
        format: tickFormatOf(input, formatX),
        title: cls === 'micro' ? undefined : input.xTitle,
        cls,
        locale: input.locale,
        width,
        yRoom: yRoomPx(yInsideOf(input, cls, right !== null)),
        readout: cls === 'micro' ? undefined : formatX,
        corner: right === null ? corner : undefined,
      }),
    },
    y: {
      scale: yScaleFor(input.y, left.domain),
      ...(input.yAxis === false
        ? { axis: false as const }
        : yGuide({
            cfg: input.y,
            axis: left,
            cls,
            side: 'left',
            grid: input.y?.grid ?? true,
            locale: input.locale,
            edges: edgesOn('left'),
            // The hover pins the y value only without a right axis (see `crosshairGuide`).
            readout: right === null,
            corner,
            inside: yInsideOf(input, cls, right !== null),
          })),
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
          locale: input.locale,
          edges: edgesOn('right'),
        }),
      },
    }),
    ...(zoneScale && {
      zx: { channel: 'x' as const, scale: scaleLinear().domain([0, 1]), axis: false as const },
    }),
    // A y title is a caption above the tick column; the micro class draws no axes, so no titles.
    ...(cls !== 'micro' && input.y?.title && { ytitle: yTitleScale(input.y.title, 'left') }),
    ...(cls !== 'micro' &&
      right &&
      input.y2?.title && { y2title: yTitleScale(input.y2.title, 'right') }),
  }
}

/** The x tick text: the consumer's tick format, else its readout format, else the default (`undefined`). */
function tickFormatOf<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  formatX: (v: ChartValue) => string,
): ((v: ChartValue) => string) | undefined {
  const tick = input.formatXTick
  if (tick !== undefined) return (v) => tick(v as X)
  return input.formatX ? formatX : undefined
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
  if (v instanceof Date && (!input.formatX || dayOnly))
    return utcHeaderDate(v, dayOnly, input.locale)
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
  axes: Axes<T>,
): (key: string) => PlotRow<T, X>[] {
  const seriesBy = new Map(input.series.map((s) => [s.key, s]))
  return (key) => {
    const s = seriesBy.get(key)
    if (!s)
      throw new Error(`[basalt] CartesianChart: marks asked for series "${key}", not in \`series\``)
    if (!visibleKeys.has(key)) return []
    // A datum past a bounded domain is drawn on the plot's edge; the tooltip reads `getValue`.
    const axis = axes.axisOf(axes.onRight(s) ? 'right' : 'left')
    return input.data.map((d) => {
      const v = s.getValue(d)
      return {
        x: input.x(d),
        y:
          v === null || !Number.isFinite(v)
            ? null
            : axis.bounded
              ? clampToDomain(v, axis.domain)
              : v,
        series: s.key,
        datum: d,
      }
    })
  }
}

/**
 * `rows` with each `spread` dot series' rows moved apart where they would overlap
 * (`spreadPoints`, in plot pixels). Only the drawn position moves: `datum` still reads the true value
 * for the tooltip and the readout. An x spread needs a linear x (a number or a time); on a band, point
 * or log x the dots stay where they are. A y spread of a column too dense to part along y also steps
 * its dots sideways on a linear x, so the column swells to a swarm instead of drawing one solid bar.
 */
function spreadRowsOf<T, X extends ChartX>(
  rows: (key: string) => PlotRow<T, X>[],
  input: CartesianInput<T, X>,
  at: {
    visible: readonly ChartSeries<T>[]
    model: XScaleModel<X>
    axes: Axes<T>
    plotWidth: number
    plotHeight: number
  },
): (key: string) => PlotRow<T, X>[] {
  const spread = input.dotSpread
  if (spread === undefined || spread.size === 0) return rows
  const { model, axes, plotWidth, plotHeight } = at
  if (plotWidth <= 0 || plotHeight <= 0) return rows
  const memo = new Map<string, PlotRow<T, X>[]>()
  return (key) => {
    const drawn = rows(key)
    const axis = spread.get(key)
    const s = at.visible.find((v) => v.key === key)
    if (axis === undefined || s === undefined || drawn.length === 0) return drawn
    const known = memo.get(key)
    if (known !== undefined) return known
    const extent = model.extent
    const xLinear = extent !== undefined && model.log !== true && !model.band
    if (axis === 'x' && !xLinear) return drawn
    const yAxis = axes.axisOf(axes.onRight(s) ? 'right' : 'left')
    const warp = warpFor(yAxis.log)
    const domain = warp.domain(yAxis.domain)
    const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
    if (hi === lo) return drawn
    const yPx = (y: number): number => ((hi - warp.to(y)) / (hi - lo)) * plotHeight
    const r = input.dotRadius?.get(key) ?? BASALT.dotR
    const live: { row: PlotRow<T, X>; px: number; py: number }[] = []
    for (const row of drawn) {
      const f = model.fraction(row.x)
      if (row.y === null || f === null) continue
      live.push({ row, px: f * plotWidth, py: yPx(row.y) })
    }
    const placed = spreadPoints(
      live.map((p) =>
        axis === 'x' ? { along: p.px, across: p.py, r } : { along: p.py, across: p.px, r },
      ),
      axis === 'x'
        ? { along: plotWidth, across: plotHeight }
        : { along: plotHeight, across: xLinear ? plotWidth : 0 },
    )
    const moved = new Map(live.map((p, i) => [p.row, { to: placed[i] as SpreadPlace, p }]))
    const toX = (px: number): X => {
      const [from, to] = extent ?? [0, 1]
      const v = from + (px / plotWidth) * (to - from)
      return (model.kind === 'date' ? new Date(v) : v) as unknown as X
    }
    const toY = (py: number): number => warp.from(hi - (py / plotHeight) * (hi - lo))
    const out = drawn.map((row) => {
      const at = moved.get(row)
      if (at === undefined) return row
      const { to, p } = at
      if (axis === 'x')
        return {
          ...row,
          x: toX(to.along),
          ...(to.across !== p.py && { y: toY(to.across) }),
        }
      return {
        ...row,
        y: toY(to.along),
        ...(to.across !== p.px && { x: toX(to.across) }),
      }
    })
    memo.set(key, out)
    return out
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
    // The dot sits where its mark does: on the edge for a datum past a bounded domain.
    const axis = axes.axisOf(axes.onRight(s) ? 'right' : 'left')
    const rows = input.data.flatMap((d): PlotRow<T, X>[] => {
      const v = cursorValue(d)
      if (v === null || !Number.isFinite(v)) return []
      const y = axis.bounded ? clampToDomain(v, axis.domain) : v
      return [{ x: input.x(d), y, series: s.key, datum: d }]
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

/**
 * A point's tooltip opens off the mark, never on it: anchored at the topmost mark of the group (a
 * dot's centre, a column's top for {@link pointerAnchor} without a pointer), over it, then below it.
 */
const markAnchor = (points: readonly ChartPoint[]): { x: number; y: number } => {
  const xs = points.map((p) => p.x)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...points.map((p) => p.y)) }
}
const MARK_TOOLTIP_OFFSET = 12
/**
 * A line's, an area's or a column's tooltip sits at the group's x and the pointer's height, so a sweep
 * along the plot keeps it on one side however the data climbs and falls (owner review 2: anchored at
 * the data, a line's flipped above and below each next point). A column's opens beside it, right of
 * it, left once the right side would leave the plot: over the column first put it above a short bar
 * and beside a tall one. A focus with no pointer (keys, a linked list, a shared cursor) anchors at the
 * group's topmost mark.
 */
const pointerAnchor = (
  points: readonly ChartPoint[],
  { pointer }: ChartTooltipAnchorContext,
): { x: number; y: number } => {
  const at = markAnchor(points)
  return { x: at.x, y: pointer?.y ?? at.y }
}
const BAR_TOOLTIP_PLACEMENT = ['right', 'left'] as const
const DOT_TOOLTIP_PLACEMENT = ['top', 'bottom'] as const

/**
 * A series row's detail at a datum: its change over the period (`tooltip.change`), its `compare`
 * reading and its `status`. `undefined` when it has none. The change base is the series' first
 * finite value in `data` (`'start'`), or its last finite value before the datum (`'previous'`).
 */
function rowDetail<T, X extends ChartX>(
  input: CartesianInput<T, X>,
  axes: Axes<T>,
): (s: ChartSeries<T>, v: number, d: T) => RowDetail | undefined {
  const mode = (input.tooltip || undefined)?.change
  const index = new Map(input.data.map((d, i) => [d, i]))
  const starts = new Map<string, number | undefined>()
  const finiteOf = (s: ChartSeries<T>, d: T | undefined): number | undefined => {
    const v = d === undefined ? null : s.getValue(d)
    return v !== null && Number.isFinite(v) ? v : undefined
  }
  const baseOf = (s: ChartSeries<T>, d: T): number | undefined => {
    if (mode === 'start') {
      if (!starts.has(s.key))
        starts.set(
          s.key,
          finiteOf(
            s,
            input.data.find((e) => finiteOf(s, e) !== undefined),
          ),
        )
      return starts.get(s.key)
    }
    for (let i = (index.get(d) ?? 0) - 1; i >= 0; i -= 1) {
      const v = finiteOf(s, input.data[i])
      if (v !== undefined) return v
    }
    return undefined
  }
  return (s, v, d) => {
    const base = mode === undefined ? undefined : baseOf(s, d)
    const change = base === undefined ? undefined : changeOf(v, base)
    const compared = s.compare?.getValue(d) ?? null
    const format = (n: number): string =>
      s.formatValue
        ? s.formatValue(n, d)
        : axes.axisOf(axes.onRight(s) ? 'right' : 'left').format(n)
    const reference =
      s.compare === undefined || compared === null || !Number.isFinite(compared)
        ? undefined
        : `${s.compare.label} ${format(compared)}`
    const status = s.status?.(v, d)
    if (change === undefined && reference === undefined && status === undefined) return undefined
    return {
      ...(change !== undefined && { change }),
      ...(reference !== undefined && { reference }),
      ...(status !== undefined && { status }),
    }
  }
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
  // Columns and points have a body to keep off; a line is crossed by its own tooltip's anchor line.
  const onMarks = visible.length > 0 && visible.every((s) => isBar(s) || s.mark === 'dot')
  const rowSeries = (input.reverseRows ? visible.toReversed() : visible).filter(
    (s) => s.tooltip !== false,
  )
  const detailOf = rowDetail(input, axes)
  const events = eventsByDatum(input)
  return {
    use: quietWhileFollowing,
    ...followerOptions(input.tooltip, input.cursorGroup, input.chartId),
    portal: cardPortal(slot ? 'slot' : input.tooltipBelow === true ? 'strip' : 'card'),
    anchor: input.tooltipBelow
      ? slot
        ? slotAnchor
        : stripAnchor
      : onMarks && !visible.some(isBar)
        ? markAnchor
        : pointerAnchor,
    ...(input.tooltipBelow &&
      (slot
        ? { placement: SLOT_TOOLTIP_PLACEMENT, offset: 0 }
        : { placement: STRIP_TOOLTIP_PLACEMENT, offset: STRIP_TOOLTIP_OFFSET })),
    ...(!input.tooltipBelow &&
      onMarks && {
        placement: visible.some(isBar) ? BAR_TOOLTIP_PLACEMENT : DOT_TOOLTIP_PLACEMENT,
        offset: MARK_TOOLTIP_OFFSET,
      }),
    content: (points: readonly ChartPoint[]) => {
      const first = points[0]
      if (!first) return { rows: [] }
      // A point's datum is a `plot.rows()` row, or a consumer mark's own datum (taken as `T`).
      const rowOf = (point: ChartPoint): PlotRow<T, X> | undefined => {
        const datum = point.datum
        return typeof datum === 'object' && datum !== null && 'datum' in datum && 'series' in datum
          ? (datum as PlotRow<T, X>)
          : undefined
      }
      // A held focus names the tooltip: the cursor carries only an x, so at a gap or where several
      // data share one x the engine's nearest point is another datum than the one the hero reads.
      const held = input.focused ?? null
      const heldPoint =
        held === null ? undefined : points.find((point) => rowOf(point)?.datum === held)
      const primary = heldPoint ?? first
      const row = rowOf(primary)
      const [x, d] =
        held !== null && heldPoint === undefined
          ? [input.x(held), held]
          : row && keys.has(row.series)
            ? // The datum's own x: a `spread` dot draws off it, and the header names the true value.
              [input.x(row.datum), row.datum]
            : [primary.xValue, primary.datum as T]
      const rows: EngineTooltipRow[] = []
      for (const s of rowSeries) {
        const v = s.getValue(d)
        if (v === null || !Number.isFinite(v)) continue
        const text = s.formatValue
          ? s.formatValue(v, d)
          : axes.axisOf(axes.onRight(s) ? 'right' : 'left').format(v)
        // A lone series whose value already ends in its own name (`27 sessions`) prints the name once.
        const bare = input.series.length === 1 ? unitIsName(s.label, text) : null
        // A highlighted datum's swatch wears the accent, as its bar does; a `colorBy` line's, the point's ramp step.
        const swatch = s.highlight?.(d)
          ? { ...s, color: CV.brand }
          : s.colorBy
            ? { ...s, color: rampColorAt(s, d) }
            : s
        const row: RichRow = seriesRow(swatch, bare ?? text, input.highlighted === s.key)
        const detail = detailOf(s, v, d)
        rows.push(detail === undefined ? row : { ...row, detail })
        const by = s.colorBy
        const reading = by?.value(d) ?? null
        if (by !== undefined && reading !== null && Number.isFinite(reading))
          rows.push({
            label: by.label,
            value: (by.format ?? ((n: number) => defaultNumberFormat(n, input.locale)))(reading),
            color: rampColorAt(s, d),
          })
      }
      const extra: readonly ChartTooltipRow[] =
        (input.tooltip || undefined)?.rows?.(d, { visible, hidden }) ?? []
      const marked = (events.get(d) ?? []).map((e): RichRow => ({
        label: e.label,
        value: e.note ?? formatX(e.at),
        color: CV.axis,
      }))
      return {
        title: tooltipHeader(input, formatX, dayOnly, x, d),
        rows: [
          ...rows,
          ...extra.map((r): RichRow => {
            const row = engineRow(r)
            return r.status === undefined ? row : { ...row, detail: { status: r.status } }
          }),
          ...marked,
        ],
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

/**
 * The value labels a hover pins to the axes: the tick size in the ink, on a wide halo of the surface the
 * plot sits on (`--bc-guide-halo`, the inset inside a card), so it covers the tick label under it.
 */
const GUIDE_LABEL = {
  fontSize: TICK_FONT,
  fontWeight: 500,
  fill: CV.ink,
  stroke: 'var(--bc-guide-halo, var(--basalt-card))',
  strokeWidth: 6,
  offset: 5,
} as const

/** Whether the chart labels its x axis: the panel that does carries the hover's x chip. */
const labelsX = (input: { xTicks?: unknown }): boolean =>
  !(Array.isArray(input.xTicks) && input.xTicks.length === 0)

/**
 * The hover's guide: the x rule (a bar kind has none, its hover is the bar) and the y rule through the
 * focused point, each with its value pinned on its axis, so a hover reads x and y where the ticks do.
 * Unpinned (a micro plot without axes, a bare slot) the line keeps its x rule alone. The y label is the
 * left axis' and only drawn without a right axis, where one y value cannot name both scales. An x axis
 * with no tick labels (`x.ticks: []`, the upper panels of charts stacked on one x) pins no x value: the
 * chip would sit on the plot's baseline over the marks, once per panel; the panel that labels the axis
 * carries it. A chart that follows another's shared cursor pins none either (its chip text is empty),
 * so the one the pointer is on carries the value; a leader with no x chip leaves it to the labelled follower.
 */
export function crosshairGuide<T, X extends ChartX>(opts: {
  input: CartesianInput<T, X>
  pinned: boolean
  formatX: (v: ChartValue) => string
  formatY: ((v: number) => string) | null
  /** What the chip text `text` of `v` does to the x tick labels: it only repeats one, or it would cover one. */
  clashOf?: ((v: ChartValue, text: string) => 'repeats' | 'covers' | null) | undefined
}): { x: object | false; y: object | false } | null {
  const { input, pinned, formatX, formatY, clashOf } = opts
  const xLabelled = labelsX(input)
  const rule = input.crosshair !== false
  if (!pinned) return rule ? { x: CROSSHAIR, y: false } : null
  const x = {
    ...(rule ? CROSSHAIR : { strokeOpacity: 0 }),
    // A chart that follows another's cursor draws the rule alone: the chip is the hovered chart's, not one per panel.
    label: xLabelled
      ? {
          ...GUIDE_LABEL,
          format: (v: ChartValue) => {
            if (followsChart(input.cursorGroup, input.chartId)) return ''
            const text = formatX(v)
            const clash = clashOf?.(v, text)
            // The engine blanks a tick under the chip only for the chart that holds the focus; any other chart
            // drawing a chip (a follower, a chart the keys moved) drops it where it would cover a tick, or
            // sit over the tick that already prints the reading.
            if (clash === undefined || clash === null) return text
            // The engine blanks a tick under the chip only while this chart holds the focus. A chart that tracks
            // its focus (a `focus` owns its keys: `keyboard` is `false`) and holds none (the pointer is between
            // its data, or the focused datum is another pane's) has no callback to blank the tick: no chip there.
            const tracks = input.keyboard === false
            const { focused } = input
            const holds =
              focused !== undefined &&
              focused !== null &&
              input.data.includes(focused) &&
              visibleSeries(input.series, input.hidden ?? new Set<string>()).some((s) => {
                const v = s.getValue(focused)
                return v !== null && Number.isFinite(v)
              })
            return tracks && !holds ? '' : text
          },
        }
      : false,
  }
  // A bar that prints its value labels needs no read-across: the guide at the focused value would run through
  // the labels of the bars beside it (it struck a neighbour's '4 · 3.4%'), so its chip stands alone.
  const valued = input.series.some(
    (s) => s.mark === 'bar' && s.values !== undefined && s.values !== false,
  )
  const y =
    formatY === null
      ? false
      : {
          ...(valued ? { strokeOpacity: 0 } : CROSSHAIR),
          label: { ...GUIDE_LABEL, format: (v: ChartValue) => formatY(Number(v)) },
        }
  return { x, y }
}

export function compileCartesian<T, X extends ChartX>(
  given: CartesianInput<T, X>,
): CartesianDefinition {
  const input = withLogY2<T, CartesianInput<T, X>>(
    withLogY<T, CartesianInput<T, X>>(
      withLogX<T, CartesianInput<T, X>>(given, given.band === true),
    ),
  )
  guardReservedKeys(input.series)
  const visible = visibleSeries(input.series, input.hidden ?? new Set<string>())
  const visibleKeys = new Set(visible.map((s) => s.key))
  const keys = new Set(input.series.map((s) => s.key))
  const baseModel = xScaleFor(
    input.data.map(input.x),
    input.band === true,
    input.xDomain,
    input.xScale === 'log',
  )
  // The x scale of the build in hand: `baseModel`, or one grown so an edge dot draws whole (`dotRoomX`).
  let model = baseModel
  // Whether this chart draws an x chip while it leads: set at each layout (a micro plot draws none).
  let xChipDrawn = input.bare !== true && labelsX(input)
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
  const rows = rowsOf(input, visibleKeys, shared)
  const formatX = (v: ChartValue): string =>
    input.formatX ? input.formatX(v as X) : defaultFormatX(v, input.locale)
  const gradients = [
    ...input.series.flatMap((s, i) => (s.area ? [seriesAreaGradient(s, i, input, shared)] : [])),
    ...input.series.flatMap((s, i) => {
      const ramp = s.colorBy && rampGradient(s, i, input, baseModel)
      return ramp ? [ramp] : []
    }),
  ]
  const dayOnly = dayGranular(model.values)
  const names = (input.refLines ?? []).some((r) => r.label !== undefined && r.label !== '')
  // What an unpinned reference caption avoids: each visible series as (x share, y) points. A bar is
  // a filled column from zero, so it walks round its body instead of through its top centre.
  const barHalf = model.halfStep * BAR_BODY
  const warpOn = (side: 'left' | 'right' | undefined) =>
    warpFor(shared.axisOf(side === 'right' ? 'right' : 'left').log)
  const linesOn = (side: 'left' | 'right' | undefined): RefLabelPoint[][] =>
    visible
      .filter((s) => shared.onRight(s) === (side === 'right' && shared.right !== null))
      .map((s) =>
        rows(s.key).flatMap((r) => {
          const fx = model.fraction(r.x)
          if (fx === null || r.y === null) return []
          if (!(model.band && s.mark === 'bar')) return [{ fx, y: warpOn(side).to(r.y) }]
          return [
            { fx: fx - barHalf, y: 0 },
            { fx: fx - barHalf, y: r.y },
            { fx: fx + barHalf, y: r.y },
            { fx: fx + barHalf, y: 0 },
          ]
        }),
      )

  // The dots of one axis side: their value and radius. A side with a bar keeps its floor, so none.
  const dotsOn = (side: 'left' | 'right'): { y: number; r: number; caret: boolean }[] => {
    const onSide = visible.filter((s) => shared.onRight(s) === (side === 'right'))
    if (onSide.some(isBar)) return []
    const axis = shared.axisOf(side)
    return onSide
      .filter((s) => s.mark === 'dot')
      .flatMap((s) =>
        rows(s.key).flatMap((row) => {
          if (row.y === null) return []
          const v = s.getValue(row.datum)
          const caret = axis.bounded === true && v !== null && offScaleSide(v, axis.domain) !== null
          return [{ y: row.y, r: input.dotRadius?.get(s.key) ?? BASALT.dotR, caret }]
        }),
      )
  }
  // The room the value label of the largest bar on one axis takes above its end: the label that names the
  // answer. A caption keeps off it as it keeps off the bar, so no caption takes the spot that value needs
  // (the other values give way to a caption, as before).
  const valueHeads = (
    side: 'left' | 'right' | undefined,
    domain: readonly [number, number],
    plotHeight: number,
  ): LabelBox[] => {
    const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
    if (plotHeight <= 0 || hi === lo || input.stack === 'normalized') return []
    const onSide = visible.filter(
      (s) => shared.onRight(s) === (side === 'right' && shared.right !== null),
    )
    if (!onSide.some((s) => isBar(s) && s.values !== undefined && s.values !== false)) return []
    const head = (VALUE_HEAD_PX * (hi - lo)) / plotHeight
    const largest = marksOn(side).bars.reduce<LabelBox | undefined>(
      (best, b) => (best === undefined || b.y1 > best.y1 ? b : best),
      undefined,
    )
    return largest === undefined || largest.y1 <= 0
      ? []
      : [{ fx0: largest.fx0, fx1: largest.fx1, y0: largest.y1, y1: largest.y1 + head }]
  }
  // The end labels' gutter: room right of the last points of a point-scale line chart when the labels
  // would otherwise sit over the lines (`endLabelGutter`). Read on the measured plot, so a first frame
  // takes the frame less the y gutter.
  const endRoomPx = (access: PlotAccess, frameWidth: number, cls: ContainerClass): number => {
    const naming = input.endLabels
    if (naming === undefined || input.band === true || input.y2 !== undefined) return 0
    if (baseModel.kind !== 'string' || baseModel.band) return 0
    const lines = visible.filter((s) => s.mark === 'line' && s.role !== 'reference')
    if (lines.length === 0 || lines.length !== visible.length) return 0
    access.read()
    return endLabelGutter({
      naming,
      phoneNames: input.endLabelsNarrow,
      containerClass: cls,
      plotWidth:
        access.size()?.width ??
        Math.max(frameWidth - yRoomPx(yInsideOf(input, cls, axesAt(cls).right !== null)), 0),
      labels: lines.flatMap((s) => {
        const last = input.data.findLast((d) => s.getValue(d) !== null)
        const fraction = last === undefined ? null : baseModel.fraction(input.x(last))
        return fraction === null ? [] : [{ label: s.label, fraction }]
      }),
    })
  }
  // A point chart's x domain grown so the dot at either end sits whole inside the clipped plot.
  const dotRoomX = (access: PlotAccess, frameWidth: number): XScaleModel<X> => {
    const { extent } = baseModel
    if (extent === undefined || baseModel.log === true || visible.length === 0) return baseModel
    // Dots among lines keep their room too; a bar on the plot has a band (or a floor) of its own.
    const pointed = visible.filter((s) => s.mark === 'dot')
    if (pointed.length === 0 || visible.some(isBar)) return baseModel
    access.read()
    const drawn = input.data.filter((d) => pointed.some((s) => s.getValue(d) !== null))
    const r = Math.max(...pointed.map((s) => input.dotRadius?.get(s.key) ?? BASALT.dotR)) + DOT_RING
    const grown = xRoomForDots(
      extent,
      drawn.map((d) => Number(input.x(d))),
      r,
      access.size()?.width ?? frameWidth,
    )
    if (grown === null) return baseModel
    const domain = baseModel.kind === 'date' ? grown.map((t) => new Date(t)) : grown
    return xScaleFor(input.data.map(input.x), false, domain as unknown as readonly [X, X])
  }
  const dotRoomAxes = (base: Axes<T>, access: PlotAccess, frameHeight: number): Axes<T> => {
    // The room is linear value space: a log axis (either side) keeps its decades as they are.
    const leftLinear = base.left.log !== true
    const rightLinear = base.right !== null && base.right.log !== true
    const onLeft = leftLinear ? dotsOn('left') : []
    const onRight = rightLinear ? dotsOn('right') : []
    const leftNear = leftLinear && nearEnd(base.left, onLeft)
    const rightNear = rightLinear && base.right !== null && nearEnd(base.right, onRight)
    if (!leftNear && !rightNear) return base
    access.read()
    const plotHeight = access.size()?.height ?? frameHeight
    const left = leftLinear ? roomForDots(base.left, onLeft, plotHeight) : base.left
    const right =
      base.right && (rightLinear ? roomForDots(base.right, onRight, plotHeight) : base.right)
    if (left === base.left && right === base.right) return base
    return { ...base, left, right, axisOf: (side) => (side === 'right' && right ? right : left) }
  }

  // The bar bodies and dots a caption must not sit on, on one axis. A stack's body runs to the sum
  // of its positive parts (and down to its negative ones); a grouped bar is taken at the band's full
  // width at its own height, which over-covers by a slot and never under-covers.
  const marksOn = (
    side: 'left' | 'right' | undefined,
    /** The rows a dot is drawn at: a spread series' dots are where the spread put them. */
    dotRows: (key: string) => PlotRow<T, X>[] = rows,
  ): { bars: LabelBox[]; dots: DotMark[] } => {
    const onSide = visible.filter(
      (s) => shared.onRight(s) === (side === 'right' && shared.right !== null),
    )
    const bodies = new Map<number, { fx: number; up: number; down: number }>()
    const dotMarks: DotMark[] = []
    for (const s of onSide) {
      for (const r of s.mark === 'dot' ? dotRows(s.key) : rows(s.key)) {
        const fx = model.fraction(r.x)
        if (fx === null || r.y === null) continue
        if (s.mark === 'dot')
          dotMarks.push({
            fx,
            y: warpOn(side).to(r.y),
            r: input.dotRadius?.get(s.key) ?? BASALT.dotR,
          })
        if (!(model.band && s.mark === 'bar')) continue
        const at = bodies.get(fx) ?? { fx, up: 0, down: 0 }
        const stacked = input.stack !== undefined
        at.up = stacked ? at.up + Math.max(r.y, 0) : Math.max(at.up, r.y)
        at.down = stacked ? at.down + Math.min(r.y, 0) : Math.min(at.down, r.y)
        bodies.set(fx, at)
      }
    }
    const normalized = input.stack === 'normalized'
    return {
      dots: dotMarks,
      bars: [...bodies.values()].map((b) => ({
        fx0: b.fx - barHalf,
        fx1: b.fx + barHalf,
        y0: normalized ? 0 : b.down,
        y1: normalized ? 1 : b.up,
      })),
    }
  }

  // The axes with room under the most negative bar of a series that prints its values. A domain the page
  // fixed as a tuple is the page's; a log axis has no bars.
  const valueRoomAxes = (base: Axes<T>, access: PlotAccess, frameHeight: number): Axes<T> => {
    if (input.y?.scale === 'log' || input.stack === 'normalized') return base
    const floorOn = (side: 'left' | 'right'): number | null => {
      const fixed = side === 'left' ? input.y?.domain : input.y2?.domain
      if (Array.isArray(fixed)) return null
      const onSide = visible.filter(
        (s) => shared.onRight(s) === (side === 'right' && shared.right !== null),
      )
      if (!onSide.some((s) => isBar(s) && s.values !== undefined && s.values !== false)) return null
      const low = Math.min(0, ...marksOn(side).bars.map((b) => b.y0))
      return low < 0 ? low : null
    }
    const [onLeft, onRight] = [floorOn('left'), base.right === null ? null : floorOn('right')]
    if (onLeft === null && onRight === null) return base
    access.read()
    const plotHeight = access.size()?.height ?? Math.max(frameHeight - X_AXIS_PX, 1)
    const left = roomForValues(base.left, onLeft, plotHeight)
    const right = base.right && roomForValues(base.right, onRight, plotHeight)
    if (left === base.left && right === base.right) return base
    return { ...base, left, right, axisOf: (side) => (side === 'right' && right ? right : left) }
  }

  const definition: CartesianDefinition = {
    chart: ({ width, height }: ChartBuildContext): StoredChartSpec => {
      const cls = resolveContainerClass(width)
      // On a phone, two or more dated events keep their rules, dots and tooltip rows but drop their
      // captions: the captions of a few years' events pile up over a 300 px plot.
      const xRefLines =
        cls === 'narrow' && (input.events?.length ?? 0) > 1
          ? input.xRefLines?.map((l) =>
              input.events?.some((e) => e.label === l.label && timeOf(e.at) === timeOf(l.x))
                ? { ...l, label: undefined }
                : l,
            )
          : input.xRefLines
      const access = plotAccess(definition, input.plot, MAIN_PANE)
      // `capped` holds the page's domain; `axes` may grow it so an edge dot draws whole. A datum
      // past the cap is clamped to the cap, so the growth keeps it whole too.
      model = dotRoomX(access, width)
      const gutter = model === baseModel ? endRoomPx(access, width, cls) : 0
      if (gutter > 0)
        model = xScaleFor(input.data.map(input.x), false, input.xDomain, input.xScale === 'log', {
          px: gutter,
          plotWidth:
            access.size()?.width ??
            Math.max(width - yRoomPx(yInsideOf(input, cls, axesAt(cls).right !== null)), 0),
        })
      const capped = axesAt(cls)
      const axes = valueRoomAxes(dotRoomAxes(capped, access, height), access, height) // A spread reads the plot's size: dots move apart in pixels, so it recompiles once measured.
      const spreads = visible.some((s) => input.dotSpread?.has(s.key) === true)
      if (spreads) access.read()
      const plot = plotContext(
        {
          rows: spreads
            ? spreadRowsOf(rowsOf(input, visibleKeys, capped), input, {
                visible,
                model,
                axes,
                plotWidth: access.size()?.width ?? width,
                plotHeight: access.size()?.height ?? height,
              })
            : rowsOf(input, visibleKeys, capped),
          visible,
          highlighted: input.highlighted ?? null,
          focused: input.focused ?? null,
          containerClass: cls,
          width,
          height,
          data: input.data,
          xFraction: model.fraction,
          y2: axes.right ? 'y2' : undefined,
          yDomain: axes.left.domain,
          y2Domain: axes.right?.domain,
          ...(axes.left.log === true && { yLog: true }),
          ...(axes.right?.log === true && { y2Log: true }),
          ...(input.locale !== undefined && { locale: input.locale }),
          ...(gutter > 0 && { endRoom: true }),
          ...(input.endLabelsNarrow === true && { phoneNames: true }),
        },
        access,
      )
      const under = underlayMarks(input, model, axes)
      // Reading the plot size recompiles once on the measured area; the frame stands in before it.
      // Only a chart with a caption pays for it, and the one context serves every caption: the
      // vertical rules' captions are placed first, and a reference caption keeps clear of them and of
      // the captions placed before it.
      // Whether a bar or a dot on the left axis fills a rule caption's box: it moves or drops.
      const xBlocked =
        (plotWidth: number, plotHeight: number): RefLabelContext<T, X>['xBlocked'] =>
        (box) => {
          const warped = warpFor(axes.left.log).domain(axes.left.domain)
          const [lo, hi] = [Math.min(...warped), Math.max(...warped)]
          if (plotWidth <= 0 || plotHeight <= 0 || hi === lo) return false
          const perPx = (hi - lo) / plotHeight
          const at = {
            fx0: box.x0 / plotWidth,
            fx1: box.x1 / plotWidth,
            y0: hi - box.bottom * perPx,
            y1: hi - box.top * perPx,
          }
          const { bars, dots } = marksOn('left', spreadDrawn(plotWidth, plotHeight))
          return (
            bars.some((b) => boxesMeet(at, b)) ||
            valueHeads('left', axes.left.domain, plotHeight).some((b) => boxesMeet(at, b)) ||
            dots.some((d) => boxesMeet(at, dotBox(d, plotWidth, perPx)))
          )
        }
      // The rows the dots are drawn at in a plot of this size: a spread series' dots are moved apart.
      const spreadDrawn = (plotWidth: number, plotHeight: number) =>
        spreadRowsOf(rows, input, { visible, model, axes, plotWidth, plotHeight })
      let captions: RefLabelContext<T, X> | undefined
      let lineMemo: PxBox[] | undefined
      // The labels a page's own marks landed: the captions placed after them keep clear of these.
      const pageLabels: PxBox[] = []
      const captionContext = (): RefLabelContext<T, X> => {
        if (captions !== undefined) return captions
        access.read()
        const size = access.size()
        const plotWidth = size?.width ?? width
        // A reference rule is a line a caption keeps off too, level with the series lines.
        const lineHits: RefLabelContext<T, X>['lineHits'] = (box) => {
          const frame = { width: plotWidth, height: size?.height ?? height }
          lineMemo ??= [...lineBoxes(frame), ...refRuleBoxes(frame)]
          return lineMemo.some(
            (b) =>
              b.left < box.x1 &&
              b.left + b.width > box.x0 &&
              b.top < box.bottom &&
              b.top + b.height > box.top,
          )
        }
        const marksBlock = xBlocked(plotWidth, size?.height ?? height)
        const xSpots = xRefLabelSpots({
          lines: xRefLines,
          fraction: (x, at) => edgeFraction(model, x, at),
          plotWidth,
          fontSize: BASALT.text.micro,
          // A line path or a horizontal rule through a rule's caption strikes it as a bar or a dot does.
          blocked: (box) => marksBlock(box) || lineHits(box),
          plotHeight: size?.height ?? height,
        })
        captions = {
          plotWidth,
          plotHeight: size?.height ?? height,
          lines: linesOn,
          marks: (side) => {
            const found = marksOn(side, spreadDrawn(plotWidth, size?.height ?? height))
            const heads = valueHeads(
              side,
              axes.axisOf(side === 'right' ? 'right' : 'left').domain,
              size?.height ?? height,
            )
            return heads.length === 0 ? found : { ...found, bars: [...found.bars, ...heads] }
          },
          xBlocked: marksBlock,
          lineHits,
          get claimed() {
            return [...claimedLabelBoxes(plot), ...pageClaims()]
          },
          xCaptions: xRefLabelBoxes(xSpots, { plotWidth, fontSize: BASALT.text.micro }),
          placed: { left: [], right: [] },
          axes,
          model,
        }
        return captions
      }
      const pageClaims = (): LabelBox[] => {
        const frame = { width: captions?.plotWidth ?? 0, height: captions?.plotHeight ?? 0 }
        const domain = warpFor(axes.left.log).domain(axes.left.domain)
        return pageLabels.map((b) => valueBox(b, domain, frame))
      }
      const hasXCaption = (xRefLines ?? []).some((l) => l.label)
      // The captions are placed once, in one order: the vertical rules', then the reference
      // lines', then the zones'. A page's own labels read the result (`hostBoxes`) while its marks
      // build, which is after the end labels have claimed their room and before the rest of this pass.
      let placedCaptions:
        | { xPlotWidth: number; over: ChartMarks; zoneCaptions: ChartMarks }
        | undefined
      const captionMarks = () => {
        if (placedCaptions !== undefined) return placedCaptions
        const xPlotWidth = hasXCaption ? captionContext().plotWidth : 0
        const over = refLineMarks(input, axes, captionContext)
        const zoneCaptions = (input.xZones ?? []).some((z) => z.label)
          ? xZoneLabelMarks(input, captionContext())
          : []
        placedCaptions = { xPlotWidth, over, zoneCaptions }
        return placedCaptions
      }
      /** The line paths on both axes, as boxes in plot px. */
      const lineBoxes = (frame: PlotPx): PxBox[] =>
        visible.flatMap((s) => {
          if (s.mark !== 'line') return []
          const axis = axes.axisOf(axes.onRight(s) ? 'right' : 'left')
          const warp = warpFor(axis.log)
          const [lo, hi] = warp.domain(axis.domain)
          const span = Math.max(lo, hi) - Math.min(lo, hi) || 1
          const runs: { x: number; y: number }[][] = [[]]
          for (const r of rows(s.key)) {
            const fx = model.fraction(r.x)
            if (r.y === null || fx === null || !Number.isFinite(r.y)) {
              if (s.gaps !== 'connect' && runs.at(-1)?.length !== 0) runs.push([])
              continue
            }
            runs.at(-1)?.push({
              x: fx * frame.width,
              y: ((Math.max(lo, hi) - warp.to(r.y)) / span) * frame.height,
            })
          }
          return pathBoxes(runs, s.strokeWidth ?? LINE_STROKE_WIDTH)
        })
      /** The dots of a spread series at their drawn (spread) positions, as boxes in plot px: a page's label keeps off the dots it sees. */
      const spreadDotBoxes = (frame: PlotPx): PxBox[] => {
        const spread = spreadRowsOf(rows, input, {
          visible,
          model,
          axes,
          plotWidth: frame.width,
          plotHeight: frame.height,
        })
        return visible.flatMap((s) => {
          if (s.mark !== 'dot' || input.dotSpread?.has(s.key) !== true) return []
          const r = input.dotRadius?.get(s.key) ?? BASALT.dotR
          const axis = axes.axisOf(axes.onRight(s) ? 'right' : 'left')
          const warp = warpFor(axis.log)
          const [lo, hi] = warp.domain(axis.domain)
          const span = Math.max(lo, hi) - Math.min(lo, hi) || 1
          return spread(s.key).flatMap((row) => {
            const fx = model.fraction(row.x)
            if (row.y === null || fx === null || !Number.isFinite(row.y)) return []
            const cx = fx * frame.width
            const cy = ((Math.max(lo, hi) - warp.to(row.y)) / span) * frame.height
            return [markDot({ left: cx - r, top: cy - r, width: 2 * r, height: 2 * r })]
          })
        })
      }
      /** The bodies of the bars of a band axis, as boxes in plot px: a group splits its band, a stack is one body. */
      const barBoxes = (frame: PlotPx): PxBox[] => {
        if (!model.band) return []
        const bars = visible.filter(isBar)
        const out: PxBox[] = []
        for (const side of axes.right === null
          ? (['left'] as const)
          : (['left', 'right'] as const)) {
          const domain = axes.axisOf(side).domain
          const onSide = bars.filter(
            (s) => axes.onRight(s) === (side === 'right' && axes.right !== null),
          )
          const bodies = new Map<number, { fx: number; up: number; down: number }>()
          for (const s of onSide) {
            for (const r of rows(s.key)) {
              const fx = model.fraction(r.x)
              if (fx === null || r.y === null || !Number.isFinite(r.y)) continue
              if (input.stack === undefined) {
                // Grouped: the body splits into one slot per bar series, 0.1 of a slot between them.
                const step = (2 * barHalf) / (bars.length - GROUP_PADDING)
                const at = fx - barHalf + bars.indexOf(s) * step
                out.push(
                  pxBox(
                    {
                      fx0: at,
                      fx1: at + step * (1 - GROUP_PADDING),
                      y0: Math.min(r.y, 0),
                      y1: Math.max(r.y, 0),
                    },
                    domain,
                    frame,
                  ),
                )
                continue
              }
              const body = bodies.get(fx) ?? { fx, up: 0, down: 0 }
              body.up += Math.max(r.y, 0)
              body.down += Math.min(r.y, 0)
              bodies.set(fx, body)
            }
          }
          for (const b of bodies.values()) {
            const normalized = input.stack === 'normalized'
            out.push(
              pxBox(
                {
                  fx0: b.fx - barHalf,
                  fx1: b.fx + barHalf,
                  y0: normalized ? 0 : b.down,
                  y1: normalized ? 1 : b.up,
                },
                domain,
                frame,
              ),
            )
          }
        }
        return out.filter((b) => b.width > 0 && b.height > 0)
      }
      /** The drawn horizontal reference rules, as boxes in plot px. */
      const refRuleBoxes = (frame: PlotPx): PxBox[] =>
        ruleBoxes(
          (input.refLines ?? []).flatMap((r, i) =>
            input.hidden?.has(refLegendKey(i))
              ? []
              : [
                  {
                    value: warpFor(axes.axisOf(r.axis).log).to(r.value),
                    domain: warpFor(axes.axisOf(r.axis).log).domain(axes.axisOf(r.axis).domain),
                  },
                ],
          ),
          frame,
        )
      /** Everything a label keeps clear of but the bar bodies, in plot px. */
      const hostBoxesBesidesBars = (): PxBox[] => {
        const ctx = captionContext()
        const frame = { width: ctx.plotWidth, height: ctx.plotHeight }
        captionMarks()
        const rightAxis = axes.right ?? axes.left
        return [
          ...ctx.placed.left.map((b) =>
            pxBox(b, warpFor(axes.left.log).domain(axes.left.domain), frame),
          ),
          ...ctx.placed.right.map((b) =>
            pxBox(b, warpFor(rightAxis.log).domain(rightAxis.domain), frame),
          ),
          ...hostBoxesBeforeCaptions(),
        ]
      }
      /**
       * What a label keeps clear of before the reference and zone captions are placed: the vertical
       * rules' captions, the end labels, the lines and the rules. A page's own labels are placed
       * against these alone, and the captions that come after give way to them.
       */
      const hostBoxesBeforeCaptions = (): PxBox[] => {
        const ctx = captionContext()
        const frame = { width: ctx.plotWidth, height: ctx.plotHeight }
        return [
          ...ctx.xCaptions.map((b) => captionPx(b, frame)),
          ...ctx.claimed.map((b) =>
            pxBox(b, warpFor(axes.left.log).domain(axes.left.domain), frame),
          ),
          ...lineBoxes(frame),
          ...spreadDotBoxes(frame),
          ...refRuleBoxes(frame),
          ...xRuleBoxes(
            (input.xRefLines ?? []).flatMap((l) => edgeFraction(model, l.x, l.at) ?? []),
            frame,
          ),
        ]
      }
      const hostBoxes = (): PxBox[] => {
        const ctx = captionContext()
        return [
          ...hostBoxesBesidesBars(),
          ...barBoxes({ width: ctx.plotWidth, height: ctx.plotHeight }),
        ]
      }
      // The value labels of the bars that ask for them, placed before the page's own marks so those
      // keep clear of the labels too. Reading the plot size recompiles once on the measured area.
      const valueLabels = (() => {
        const bars = visible.filter(isBar)
        const none = {
          marks: [] as ChartMarks,
          boxes: [] as PxBox[],
          written: new Set<string>(),
          backed: false,
        }
        if (!model.band || !bars.some((s) => s.values !== undefined && s.values !== false))
          return none
        const ctx = captionContext()
        const onRight = (s: ChartSeries<T>): 'left' | 'right' =>
          axes.onRight(s) && axes.right !== null ? 'right' : 'left'
        return barValueLabels<T, X>({
          series: bars,
          data: input.data,
          x: input.x,
          fraction: model.fraction,
          barHalf,
          stack: input.stack,
          sideOf: onRight,
          domainOf: (side) => axes.axisOf(side).domain,
          scaleOf: (side) => axes.scaleId(side),
          formatOf: (side) => axes.axisOf(side).format,
          frame: { width: ctx.plotWidth, height: ctx.plotHeight },
          focused: input.focused ?? null,
          ticks: (['left', 'right'] as const).flatMap((side) =>
            side === 'right' && axes.right === null
              ? []
              : yTickValues({
                  cfg: side === 'right' ? input.y2 : input.y,
                  axis: axes.axisOf(side),
                  cls: resolveContainerClass(width),
                  edges: zoneEdgesOn(input, axes, side),
                }).map((value) => ({ side, value })),
          ),
          obstacles: hostBoxes(),
          clear: hostBoxesBesidesBars(),
        })
      })()
      // A named bar's value label is never dropped for what the host drew, so it may land over a caption
      // placed before it: the captions are then placed again around the value labels (n68 at 390).
      if (valueLabels.boxes.length > 0) {
        const ctx = captionContext()
        captionMarks()
        const frame = { width: ctx.plotWidth, height: ctx.plotHeight }
        const labels = valueLabels.boxes.map((b) => valueBox(b, axes.left.domain, frame))
        if (ctx.placed.left.some((caption) => labels.some((l) => boxesMeet(caption, l)))) {
          pageLabels.push(...valueLabels.boxes)
          captions = lineMemo = placedCaptions = undefined
          captionMarks()
        }
      }
      // The page's own labels come before the captions unless a value label already placed them: a
      // caption is the first thing to give way to a data label.
      const captionsFirst = placedCaptions !== undefined
      const kindMarks = withHostObstacles(
        captionsFirst
          ? () => [...hostBoxes(), ...valueLabels.boxes]
          : () => [
              ...hostBoxesBeforeCaptions(),
              ...barBoxes({
                width: captionContext().plotWidth,
                height: captionContext().plotHeight,
              }),
            ],
        () => input.marks(plot),
        captionsFirst ? undefined : pageLabels,
      )
      const { xPlotWidth, over, zoneCaptions } = captionMarks()
      // A stack's bars are capped together: its total past the edge is one caret, not one per segment.
      const stacked = input.stack === 'stacked'
      const stackedBars = stacked ? visible.filter((s) => isBar(s) && !axes.onRight(s)) : []
      // `isBounded` leaves a stack out (a stack's domain grows to its totals), so a page's own
      // domain is the cap here: a total past it is what the plot's edge clips.
      const stackCapped = input.y?.domain !== undefined && input.y.domain !== 'auto'
      const capLabels = {
        frame: () => {
          const ctx = captionContext()
          return { width: ctx.plotWidth, height: ctx.plotHeight }
        },
        obstacles: () => [...hostBoxes(), ...valueLabels.boxes],
        clear: () => [...hostBoxesBesidesBars(), ...valueLabels.boxes],
      }
      const stackCaps =
        stackedBars.length === 0 || !stackCapped
          ? []
          : stackCapMarks({
              series: stackedBars,
              data: input.data,
              x: input.x,
              fraction: model.fraction,
              domain: capped.axisOf('left').domain,
              edge: axes.left.domain,
              format: axes.axisOf('left').format,
              labels: capLabels,
            })
      xChipDrawn = cls !== 'micro' && input.bare !== true && labelsX(input)
      // The tick labels the chip may cover, read the first time a chip is drawn.
      let tickLabels: ReturnType<typeof xTickLabelList> | undefined
      const guide = crosshairGuide({
        input,
        pinned: cls !== 'micro' && input.bare !== true,
        formatX,
        formatY: axes.right === null ? axes.axisOf('left').format : null,
        clashOf: (v, text) => {
          tickLabels ??= xTickLabelList({
            model,
            xTicks: input.xTicks,
            format: tickFormatOf(input, formatX),
            cls,
            locale: input.locale,
            width,
            yRoom: yRoomPx(yInsideOf(input, cls, axes.right !== null)),
          })
          if (chipRepeatsTick(v, text, tickLabels)) return 'repeats'
          return chipCoversTick({
            value: v,
            readoutText: text,
            fontSize: TICK_FONT,
            plotWidth: Math.max(0, width - yRoomPx(yInsideOf(input, cls, axes.right !== null))),
            share: (value) => model.fraction(value as X),
            ticks: tickLabels,
          })
            ? 'covers'
            : null
        },
      })
      const offScale = offScaleMarks({
        labels: capLabels,
        formatOf: (s) => (v, d) =>
          s.formatValue
            ? s.formatValue(v, d)
            : axes.axisOf(axes.onRight(s) ? 'right' : 'left').format(v),
        series: stacked ? visible.filter((s) => !stackedBars.includes(s)) : visible,
        data: input.data,
        x: input.x,
        fraction: model.fraction,
        // Past the cap the page set (before the dot room grew it); the caret sits on the plot's edge.
        domainOf: (s) => {
          const axis = capped.axisOf(capped.onRight(s) ? 'right' : 'left')
          return axis.bounded ? axis.domain : null
        },
        edgeOf: (s) => axes.axisOf(axes.onRight(s) ? 'right' : 'left').domain,
        // A grouped bar's room: its slot of the group (as `barBoxes` and the value labels cut it).
        written: valueLabels.written,
        nameLines: visible.some(isBar) && visible.some((s) => !isBar(s)),
        slotOf: (s) => {
          if (!model.band || input.stack !== undefined || !isBar(s)) return undefined
          const bars = visible.filter(isBar)
          const step = (2 * barHalf) / (bars.length - GROUP_PADDING)
          const width = step * (1 - GROUP_PADDING)
          return { shift: -barHalf + bars.indexOf(s) * step + width / 2, width }
        },
        yScaleOf: (s) => axes.scaleId(axes.onRight(s) ? 'right' : 'left'),
      })
      return {
        marks: [
          ...under,
          ...kindMarks,
          ...dots,
          ...over,
          ...zoneCaptions,
          // The rules are drawn under the value labels: a label a rule crosses sits on its backing, and the rule gives way.
          ...xRefLineMarks({
            lines: xRefLines,
            fraction: (x, at) => edgeFraction(model, x, at),
            top: Math.max(...axes.left.domain),
            plotWidth: xPlotWidth,
            blocked: hasXCaption
              ? (box) => captionContext().xBlocked(box) || captionContext().lineHits(box)
              : undefined,
            plotHeight: hasXCaption ? captionContext().plotHeight : undefined,
          }),
          ...eventDots(input, axes),
          ...offScale,
          ...stackCaps,
          ...valueLabels.marks,
          ...(guide === null ? [] : [crosshair(guide)]),
        ],
        scales: buildScales({
          input,
          model,
          axes,
          formatX,
          cls,
          width,
          zoneScale:
            under.length > 0 ||
            names ||
            (input.xRefLines?.length ?? 0) > 0 ||
            offScale.length > 0 ||
            stackCaps.length > 0 ||
            valueLabels.backed ||
            visible.some((s) => s.mark === 'line'),
        }),
        theme: CHART_THEME,
        ...(input.bare === true
          ? { guides: false as const, margin: 0 }
          : input.yGutter !== undefined
            ? { margin: { left: input.yGutter } }
            : yInsideOf(input, cls, axes.right !== null) && { margin: { left: 0, right: 0 } }),
        ...(gradients.length > 0 && { gradients }),
        clip: true,
      }
    },
    // Followers resolve the leader's group, so they draw its dots; `quietWhileFollowing` mutes the
    // tooltip unless the chart opts into following tooltips.
    focus: 'group-x',
    ...(input.focusRing === false && { focusRing: false as const }),
    ...(input.keyboard === false && { keyboard: false as const }),
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: cursorBinding({
      group: input.cursorGroup,
      chartId: input.chartId,
      keys: model.values,
      extent: model.extent,
      mode: input.cursorResolution ?? 'nearest',
      pin: input.coarse === true,
      xChip: () => xChipDrawn,
    }),
    tooltip:
      input.tooltip === false
        ? false
        : tooltipSpec({ input, axes: shared, visible, keys, visibleKeys, formatX, dayOnly }),
    ...(input.controls !== undefined && { controls: input.controls }),
  }
  return input.tooltip !== false && richTooltip(input) ? markRich(definition) : definition
}

/**
 * Whether a row of the chart's tooltip can carry a change, a reference, a status or an event. Extra
 * `rows` are a function whose rows may carry a `status`, so they take the rich body too.
 */
function richTooltip<T, X extends ChartX>(input: CartesianInput<T, X>): boolean {
  const config = input.tooltip || undefined
  return (
    config?.change !== undefined ||
    config?.rows !== undefined ||
    (input.events?.length ?? 0) > 0 ||
    input.series.some(
      (s) => s.compare !== undefined || s.status !== undefined || s.colorBy !== undefined,
    )
  )
}

/** Gradient resource id for a `colorBy` line's stroke; the host's `idPrefix` scopes it. */
export const rampGradientId = (index: number): string => `basalt-ramp-${index}`

/**
 * A `colorBy` line's stroke: a horizontal gradient across the line's own box (the engine's default
 * `objectBoundingBox` units), one color per drawn point by its reading on the status ramp. The line's
 * box runs from its first drawn point to its last, so a point's offset is its share of that run on
 * the x scale (any linear rescale of the axis keeps it). A stop is written only where the ramp
 * steps, so a long series holds few. `null` for a line with fewer than two drawn points.
 */
export function rampGradient<T, X extends ChartX>(
  s: ChartSeries<T>,
  index: number,
  input: Pick<CartesianInput<T, X>, 'data' | 'x'>,
  model: Pick<XScaleModel<X>, 'fraction'>,
): ChartGradient | null {
  const by = s.colorBy
  if (by === undefined) return null
  const points = input.data.flatMap((d) => {
    const v = s.getValue(d)
    const f = model.fraction(input.x(d))
    if (v === null || !Number.isFinite(v) || f === null) return []
    const reading = by.value(d)
    const color =
      reading === null || !Number.isFinite(reading)
        ? s.color
        : rampColor(rampShare(reading, by.domain), by.ramp)
    return [{ f, color }]
  })
  const first = points[0]
  const last = points.at(-1)
  if (first === undefined || last === undefined || last.f === first.f) return null
  const span = last.f - first.f
  const stops: { offset: number; color: string }[] = []
  points.forEach((p, i) => {
    const prev = points[i - 1]
    const next = points[i + 1]
    // A run of one color needs its two ends only: the ramp steps between a run's end and the next start.
    if (prev?.color === p.color && next?.color === p.color) return
    stops.push({ offset: (p.f - first.f) / span, color: p.color })
  })
  return { id: rampGradientId(index), x1: 0, y1: 0, x2: 1, y2: 0, stops }
}

/** The color a `colorBy` series takes at a datum: its ramp step, else the series color. */
export function rampColorAt<T>(s: ChartSeries<T>, d: T): string {
  const by = s.colorBy
  const reading = by?.value(d) ?? null
  if (by === undefined || reading === null || !Number.isFinite(reading)) return s.color
  return rampColor(rampShare(reading, by.domain), by.ramp)
}

/** Radius of an event's dot on the x axis line, px. */
const EVENT_DOT_R = 3.5

/** A dot on the x axis line under each event's rule (the rule and its caption are `xRefLines`). */
function eventDots<T, X extends ChartX>(input: CartesianInput<T, X>, axes: Axes<T>): ChartMarks {
  const events = input.events ?? []
  if (events.length === 0) return []
  const floor = Math.min(...axes.left.domain)
  return [
    decorative(
      dot(
        events.map((e) => ({ x: e.at, y: floor })),
        {
          id: 'basalt-events',
          x: (p: { x: X }) => p.x,
          y: 'y',
          r: EVENT_DOT_R,
          fill: CV.axis,
          stroke: CV.surface,
          strokeWidth: 1.5,
        },
      ),
    ),
  ]
}

const timeOf = (v: ChartX): number | string => (v instanceof Date ? v.getTime() : v)

/**
 * Each event by the datum nearest its x (a string x: the datum at it): the datum the cursor rests on
 * when it names the event. An event past the data's ends names none.
 */
export function eventsByDatum<T, X extends ChartX>(
  input: Pick<CartesianInput<T, X>, 'data' | 'x' | 'events'>,
): Map<T, { label: string; note?: string | undefined; at: X }[]> {
  const out = new Map<T, { label: string; note?: string | undefined; at: X }[]>()
  const xs = input.data.map((d) => timeOf(input.x(d)))
  for (const e of input.events ?? []) {
    const at = timeOf(e.at)
    let best = -1
    if (typeof at === 'string') best = xs.indexOf(at)
    else {
      const nums = xs.filter((v): v is number => typeof v === 'number')
      if (nums.length === 0 || at < Math.min(...nums) || at > Math.max(...nums)) continue
      let gap = Infinity
      xs.forEach((v, i) => {
        if (typeof v !== 'number' || Math.abs(v - at) >= gap) return
        gap = Math.abs(v - at)
        best = i
      })
    }
    const d = input.data[best]
    if (d === undefined) continue
    out.set(d, [...(out.get(d) ?? []), e])
  }
  return out
}
