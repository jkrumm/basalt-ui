/**
 * `DualPanel` — a top line pane over a bottom signed-bar pane, ONE chart (`docs/V2-SPEC.md` § 9.2,
 * § 9.3): two TanStack views composed with `composeViews` + `grid` + `alignX`, one host, one
 * cursor, one tooltip, one legend. The top pane may shade the band between two of its lines
 * (`differenceY`); the bottom pane draws a signed value as bars around zero. Each pane resolves its
 * own y domain; x is a Date or number, shared by both panes.
 *
 * This file also owns the private panel rung (`PanelRung`) that `MirroredBars` reuses. The public
 * `CartesianChart` rung compiles ONE plot; a composed chart needs its own definition, and the pieces
 * every composed kind shares — size, legend, state, cursor, tooltip — live here once.
 */
import { barY } from '@tanstack/charts/bar'
import { crosshair } from '@tanstack/charts/crosshair'
import { differenceY } from '@tanstack/charts/difference'
import { decorative } from '@tanstack/charts/mark/decorative'
import { ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip as tooltipHost } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import type {
  ChartBuildContext,
  ChartPoint,
  ChartPositionScaleOptions,
  ChartTooltipRow as EngineTooltipRow,
  ChartValue,
  StoredChartSpec,
} from '@tanstack/charts/types/core'
import { alignX, composeViews, grid } from '@tanstack/charts/view'
import type { ComposableResponsiveChartDefinition } from '@tanstack/charts/view'
import { scaleUtc } from 'd3-scale'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { VX, alpha } from '../tokens'
import { resolveContainerClass } from '../tokens/size-classes'
import type { ContainerClass } from '../tokens/size-classes'
import { useChartCard } from './card-context'
import {
  dateTicks,
  defaultNumberFormat,
  utcAxisDate,
  utcHeaderDate,
  visibleSeries,
} from './compile'
import type { CartesianDefinition } from './compile'
import { cursorBinding, sourceOnlyFocus } from './cursor'
import { ChartEngine } from './host'
import { ChartLegend, legendEntries } from './legend'
import type { LegendMode } from './legend'
import { emphasis, lineMark, markersOf } from './marks'
import { xScaleFor } from './scales'
import type { XScaleModel } from './scales'
import { useChartSize } from './sizing'
import { ChartPlaceholder, resolveChartState } from './state'
import { AXIS_LINE, CHART_THEME, CROSSHAIR, GRID_LINE } from './theme'
import { rowX } from './types'
import type {
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
  ChartTooltipRow,
  ChartX,
  PlotContext,
  PlotRow,
} from './types'

// ── the panel rung: shared by every composed kind ───────────────────────────────────────────────

/** One pane, built per container class: its marks and its scales (x, y, and the zone scale). */
export type PaneBuilder = (ctx: ChartBuildContext) => {
  marks: ChartMarks
  scales: StoredChartSpec['scales']
}

/** Everything a composed kind compiles for a given legend state. */
export type PanelPlan<T> = {
  /** Every x value the cursor can land on, for snapping a foreign cursor. */
  keys: readonly ChartX[]
  top: PaneBuilder
  bottom: PaneBuilder
  /** The top pane's share of the grid, 0..1. */
  topFraction: number
  /** Space between the panes in px. */
  gap: number
  /** The per-series tooltip rows for a hovered datum; `tooltip.rows` and the title are the rung's. */
  rows: (d: T) => readonly EngineTooltipRow[]
}

type PanelInput = {
  hidden: ReadonlySet<string>
  highlighted: string | null
  /** The measured chart width, only when the rung is asked for it (`byWidth`), otherwise 0. */
  width: number
}

type PanelRungProps<T, X extends ChartX> = Pick<
  CartesianChartProps<T, X>,
  | 'ariaLabel'
  | 'formatX'
  | 'legend'
  | 'height'
  | 'state'
  | 'cursorGroup'
  | 'cursorResolution'
  | 'tooltip'
  | 'className'
  | 'style'
> & {
  /** The legend and tooltip source: the single list of everything the panes draw. */
  series: readonly ChartSeries<T>[]
  plan: (input: PanelInput) => PanelPlan<T>
  /** Recompile on width changes: for a kind whose data depends on it (`fold`). */
  byWidth?: boolean
}

/** Font size and tick counts per container class (§ 9.6). */
const LADDER = {
  micro: { font: VX.text.nano, xTicks: 2 },
  compact: { font: VX.text.nano, xTicks: 3 },
  regular: { font: VX.text.micro, xTicks: 5 },
  wide: { font: VX.text.micro, xTicks: 6 },
} as const satisfies Record<ContainerClass, { font: number; xTicks: number }>

/** A child's theme may not carry a background: the composed chart owns it. */
const { background: _background, focusRing: _focusRing, ...PANE_THEME } = CHART_THEME

/** Space between the panes of `DualPanel`; `MirroredBars` has none (one baseline). */
const PANE_GAP = 8
/** The least share of the height either pane keeps. */
const MIN_PANE_SHARE = 0.02

export function yGuide(opts: {
  format: (v: number) => string
  ticks: number
  cls: ContainerClass
}): Omit<ChartPositionScaleOptions<number>, 'scale'> {
  const { format, ticks, cls } = opts
  if (cls === 'micro') return { grid: GRID_LINE, axis: false }
  return {
    grid: GRID_LINE,
    axis: {
      line: false,
      ticks: { count: ticks, format, line: false },
      tickLabels: { fontSize: LADDER[cls].font, opacity: 1 },
    },
  }
}

/** The shared x axis: drawn on the bottom pane only. */
export function xGuide(opts: {
  ticks: { values: readonly ChartValue[] } | { count: number }
  format: (v: ChartValue) => string
  cls: ContainerClass
}): Omit<ChartPositionScaleOptions<ChartValue>, 'scale'> {
  const { ticks, format, cls } = opts
  return {
    axis: {
      line: AXIS_LINE,
      ticks: { ...ticks, format, line: false, size: 0 },
      tickLabels: { fontSize: LADDER[cls].font, opacity: 1, thin: true },
    },
  }
}

/** Continuous x ticks: whole UTC days for dates, a count otherwise. */
export function continuousTicks(
  model: XScaleModel<Date | number>,
  cls: ContainerClass,
): { values: readonly ChartValue[] } | { count: number } {
  const count = LADDER[cls].xTicks
  if (model.kind !== 'date' || !model.extent) return { count }
  return {
    values: dateTicks([new Date(model.extent[0]), new Date(model.extent[1])], count, model.step),
  }
}

export function defaultFormatX(v: ChartValue): string {
  if (v instanceof Date) return utcAxisDate(v)
  if (typeof v === 'number') return defaultNumberFormat(v)
  return String(v)
}

/** One row per datum for a series: a `null` or non-finite value is kept as a gap. */
export function rowsOf<T, X extends ChartX>(
  data: readonly T[],
  x: (d: T) => X,
  s: ChartSeries<T>,
): PlotRow<T, X>[] {
  return data.map((d) => {
    const v = s.getValue(d)
    return { x: x(d), y: v === null || !Number.isFinite(v) ? null : v, series: s.key, datum: d }
  })
}

/** A pane as a composable view. The crosshair is per pane: together they span both. */
function paneView(build: PaneBuilder): ComposableResponsiveChartDefinition {
  return {
    chart: (ctx) => {
      const { marks, scales } = build(ctx)
      return {
        marks: [...marks, crosshair({ x: CROSSHAIR, y: false })],
        scales,
        theme: PANE_THEME,
        clip: true,
      }
    },
  }
}

/** A plotted datum is a `PlotRow` (or any row carrying `datum` + `series`): its source datum. */
function sourceOf<T>(point: ChartPoint, owned: ReadonlySet<string>): { x: ChartValue; d: T } {
  const datum = point.datum
  if (typeof datum === 'object' && datum !== null && 'datum' in datum && 'series' in datum) {
    const row = datum as PlotRow<T>
    if (owned.has(row.series)) return { x: point.xValue, d: row.datum }
  }
  return { x: point.xValue, d: datum as T }
}

function panelDefinition<T, X extends ChartX>(opts: {
  formatX: PanelRungProps<T, X>['formatX'] | undefined
  cursorGroup: string | undefined
  tooltip: PanelRungProps<T, X>['tooltip'] | undefined
  plan: PanelPlan<T>
  cursorResolution: NonNullable<PanelRungProps<T, X>['cursorResolution']>
  series: readonly ChartSeries<T>[]
  hidden: ReadonlySet<string>
  chartId: string
  coarse: boolean
}): CartesianDefinition {
  const { plan, series, hidden, chartId, formatX, cursorGroup, coarse } = opts
  const tooltip = opts.tooltip === false ? undefined : opts.tooltip
  // The grid needs positive, finite tracks: a share outside 0..1 (or NaN) is clamped to leave each
  // pane a sliver rather than throw.
  const topFraction = Number.isFinite(plan.topFraction)
    ? Math.min(Math.max(plan.topFraction, MIN_PANE_SHARE), 1 - MIN_PANE_SHARE)
    : 0.5
  const composed = composeViews({
    views: { top: paneView(plan.top), bottom: paneView(plan.bottom) },
    layout: grid({
      rows: [
        { id: 'top', grow: topFraction },
        { id: 'bottom', grow: 1 - topFraction },
      ],
      columns: [{ id: 'main', grow: 1 }],
      gap: plan.gap,
      cells: {
        top: { row: 'top', column: 'main' },
        bottom: { row: 'bottom', column: 'main' },
      },
    }),
    links: [alignX('top', 'bottom')],
  })
  const owned = new Set(series.map((s) => s.key))
  const visible = visibleSeries(series, hidden)
  const hiddenSeries = series.filter((s) => !visible.includes(s))
  const format = (v: ChartValue): string => (formatX ? formatX(v as X) : defaultFormatX(v))
  const header = (v: ChartValue, d: T): string => {
    if (tooltip?.formatHeader) return tooltip.formatHeader(v as X, d)
    if (v instanceof Date && !formatX) return utcHeaderDate(v)
    return format(v)
  }
  return {
    chart: () => composed,
    focus: tooltip?.onFollow ? 'group-x' : sourceOnlyFocus(cursorGroup, chartId),
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: cursorBinding({
      group: cursorGroup,
      chartId,
      keys: plan.keys,
      mode: opts.cursorResolution,
      pin: coarse,
    }),
    tooltip:
      opts.tooltip === false
        ? false
        : {
            use: tooltipHost,
            portal,
            anchor: 'group-center',
            content: (points: readonly ChartPoint[]) => {
              const primary = points[0]
              if (!primary) return { rows: [] }
              const { x, d } = sourceOf<T>(primary, owned)
              const extra: readonly ChartTooltipRow[] =
                tooltip?.rows?.(d, { visible, hidden: hiddenSeries }) ?? []
              return { title: header(x, d), rows: [...plan.rows(d), ...extra] }
            },
          },
  }
}

/** Micro has no legend, compact shows dots, regular and wide show chips (§ 9.6). */
function legendMode(shown: boolean, cls: ContainerClass): LegendMode | null {
  if (!shown || cls === 'micro') return null
  return cls === 'compact' ? 'dots' : 'chips'
}

const rootStyle = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 } as const

/** `useId` output (`«r1»`, `:r1:`) is not a safe SVG id fragment. */
const idPrefixOf = (id: string): string => `basalt-chart-${id.replaceAll(/[^\w-]/g, '')}`

export function PanelRung<T, X extends ChartX>(props: PanelRungProps<T, X>): ReactElement {
  const { ariaLabel, series, legend, height, state, byWidth, plan, className, style } = props
  const { formatX, cursorGroup, cursorResolution = 'nearest', tooltip } = props
  const chartId = useId()
  const card = useChartCard()
  const { ref, size, coarse } = useChartSize(height)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const width = byWidth ? size.width : 0

  const definition = useMemo(
    () =>
      panelDefinition({
        plan: plan({ hidden, highlighted, width }),
        series,
        hidden,
        chartId,
        coarse,
        cursorResolution,
        formatX,
        cursorGroup,
        tooltip,
      }),
    [
      plan,
      hidden,
      highlighted,
      width,
      series,
      chartId,
      coarse,
      cursorResolution,
      formatX,
      cursorGroup,
      tooltip,
    ],
  )

  const config = legend === false ? null : (legend ?? {})
  const entryCount = legendEntries(series, false)[0]?.length ?? 0
  const mode = legendMode(config !== null && entryCount > 0, size.containerClass)
  const toggle = config?.toggle ?? entryCount >= 2
  const onToggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])
  const legendNode: ReactNode = useMemo(
    () =>
      mode === null ? null : (
        <ChartLegend
          series={series}
          hidden={hidden}
          mode={mode}
          groups={config?.groups === true}
          toggle={toggle}
          onToggle={onToggle}
          onHighlight={setHighlighted}
        />
      ),
    [mode, series, hidden, config?.groups, toggle, onToggle],
  )
  const inHeader = config?.placement === 'header' && card !== null
  useEffect(() => {
    if (!inHeader || !card) return
    card.setHeaderLegend(chartId, legendNode)
    return () => card.setHeaderLegend(chartId, null)
  }, [inHeader, card, chartId, legendNode])
  const atTop = config?.placement === 'top' || (config?.placement === 'header' && !card)

  return (
    <div
      ref={ref}
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={style ? { ...rootStyle, ...style } : rootStyle}
    >
      {atTop && legendNode}
      {resolveChartState(state) === null ? (
        <ChartEngine
          definition={definition}
          ariaLabel={ariaLabel}
          height={size.height}
          idPrefix={idPrefixOf(chartId)}
          coarse={coarse}
        />
      ) : (
        <ChartPlaceholder state={state} height={size.height} />
      )}
      {!atTop && !inHeader && legendNode}
    </div>
  )
}

// ── DualPanel ───────────────────────────────────────────────────────────────────────────────────

/** The bar's legend/toggle key. Reserved: a line may not use it. */
const BAR_KEY = '__bar'
const DEFAULT_TOP_FRACTION = 0.62
const BAR_OPACITY = 0.7
const TOP_PAD = 0.08
const TOP_TICKS = 4
const BAR_TICKS = 3

/** A top-pane line. */
export type DualPanelLine<T> = Pick<
  ChartSeries<T>,
  | 'key'
  | 'label'
  | 'color'
  | 'getValue'
  | 'formatValue'
  | 'tooltip'
  | 'legend'
  | 'role'
  | 'note'
  | 'dash'
  | 'curve'
  | 'strokeWidth'
  | 'strokeOpacity'
  | 'getMarker'
>

/** The bottom pane: one signed value as bars, coloured by sign. */
export type DualPanelBar<T> = {
  label: string
  getValue: (d: T) => number | null
  /** The fill above zero, and the legend swatch. */
  positive: string
  /** The fill below zero. */
  negative: string
  /** Tick and tooltip formatter. */
  format: (v: number) => string
  /** The tooltip row's value, for a unit or a decimal `format` cannot carry. */
  formatValue?: (v: number, d: T) => string
  /** Default `'auto'`: a symmetric `[-maxAbs, maxAbs]` from the data, rounded to nice ticks. A tuple
   * is used verbatim. */
  domain?: readonly [number, number] | 'auto'
  /** When `'auto'`: floors `maxAbs`, so a plateau does not amplify to fill the pane. */
  maxAbsFloor?: number
}

export type DualPanelProps<T, X extends Date | number = Date | number> = Pick<
  CartesianChartProps<T, X>,
  | 'ariaLabel'
  | 'data'
  | 'x'
  | 'formatX'
  | 'legend'
  | 'height'
  | 'state'
  | 'cursorGroup'
  | 'cursorResolution'
  | 'tooltip'
  | 'className'
  | 'style'
> & {
  /** The top pane's lines. */
  series: readonly DualPanelLine<T>[]
  /** Top pane y axis. Default domain `'auto'`: the visible lines' span plus 8%, rounded to nice
   * ticks (not zero-based: the interesting range is often a narrow band far from zero). */
  top?: { domain?: readonly [number, number] | 'auto'; format?: (v: number) => string }
  /**
   * Shades the band between two top lines (by key), where both are visible. `aboveFill` colours the
   * side where `to` runs above `from`; omitted, both sides take `fill`.
   */
  fillBetween?: { from: string; to: string; fill: string; aboveFill?: string }
  bar: DualPanelBar<T>
  /** The top pane's share of the chart height. Default 0.62. */
  topFraction?: number
}

type FillRow<T, X> = { x: X; from: number; to: number; series: string; datum: T }

/** A padded span, or the unit interval for no data. */
function spanDomain(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const span = hi - lo || Math.abs(hi) || 1
  return [lo - span * TOP_PAD, hi + span * TOP_PAD]
}

export function DualPanel<T, X extends Date | number = Date | number>(
  props: DualPanelProps<T, X>,
): ReactElement {
  const { data, x, series, top, fillBetween, bar, topFraction = DEFAULT_TOP_FRACTION } = props
  const { ariaLabel, formatX, legend, height, state, cursorGroup, cursorResolution } = props
  const { tooltip, className, style } = props

  if (series.some((s) => s.key === BAR_KEY))
    throw new Error(`[basalt] DualPanel: the series key "${BAR_KEY}" is reserved for the bar`)
  const lines = useMemo<ChartSeries<T>[]>(
    () => series.map((s) => ({ ...s, mark: 'line' as const })),
    [series],
  )
  const barSeries = useMemo<ChartSeries<T>>(
    () => ({
      key: BAR_KEY,
      label: bar.label,
      color: bar.positive,
      mark: 'bar',
      getValue: bar.getValue,
    }),
    [bar.label, bar.positive, bar.getValue],
  )
  const all = useMemo(() => [...lines, barSeries], [lines, barSeries])
  const topFormat = top?.format ?? defaultNumberFormat

  const plan = useCallback(
    ({ hidden, highlighted }: PanelInput): PanelPlan<T> => {
      const model = xScaleFor<Date | number>(data.map(x), false)
      const [lo, hi] = model.extent ?? [0, 1]
      // Half a sample step each side: the first and last bar are whole, and a line point sits where
      // the bar of its sample is centred.
      const pad = model.step / 2
      // One instance per pane: the engine sets a scale's range, and the panes' plots differ in width.
      const xScale = () =>
        model.kind === 'date'
          ? scaleUtc().domain([new Date(lo - pad), new Date(hi + pad)])
          : scaleLinear().domain([lo - pad, hi + pad])
      const format = (v: ChartValue): string => (formatX ? formatX(v as X) : defaultFormatX(v))

      const visible = visibleSeries(lines, hidden)
      const barOn = !hidden.has(BAR_KEY)
      const rows = (s: ChartSeries<T>) => (visible.includes(s) ? rowsOf(data, x, s) : [])

      const fixedTop = top?.domain && top.domain !== 'auto' ? top.domain : undefined
      const topDomain: readonly [number, number] =
        fixedTop ??
        spanDomain(
          visible.flatMap((s) =>
            data.flatMap((d) => {
              const v = s.getValue(d)
              return v !== null && Number.isFinite(v) ? [v] : []
            }),
          ),
        )
      const topY = scaleLinear().domain([...topDomain])
      if (!fixedTop) topY.nice()

      let maxAbs = 0
      for (const d of data) {
        const v = bar.getValue(d)
        if (v !== null && Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v))
      }
      maxAbs = Math.max(maxAbs, bar.maxAbsFloor ?? 0) || 1
      const fixedBar = bar.domain && bar.domain !== 'auto' ? bar.domain : undefined
      const barScale = scaleLinear().domain(fixedBar ? [...fixedBar] : [-maxAbs, maxAbs])
      if (!fixedBar) barScale.nice()

      const fromLine = fillBetween && visible.find((s) => s.key === fillBetween.from)
      const toLine = fillBetween && visible.find((s) => s.key === fillBetween.to)
      // The fill needs both lines visible: hiding either drops it.
      const fill =
        fillBetween && fromLine && toLine ? { ...fillBetween, fromLine, toLine } : undefined
      const fillRows: FillRow<T, Date | number>[] = []
      if (fill) {
        for (const d of data) {
          const a = fill.fromLine.getValue(d)
          const b = fill.toLine.getValue(d)
          if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue
          // Owned by the `to` line, so a hovered fill point resolves to its datum.
          fillRows.push({ x: x(d), from: a, to: b, series: fill.to, datum: d })
        }
      }

      const topPane: PaneBuilder = ({ width, height: h }) => {
        const cls = resolveContainerClass(width)
        const plot: PlotContext<T, Date | number> = {
          rows: (key) => {
            const s = lines.find((l) => l.key === key)
            if (!s) throw new Error(`[basalt] DualPanel: no series "${key}"`)
            return rows(s)
          },
          visible,
          highlighted,
          containerClass: cls,
          width,
          height: h,
          y2: undefined,
          yDomain: topDomain,
          y2Domain: undefined,
        }
        return {
          marks: [
            ...(fill
              ? [
                  decorative(
                    differenceY(fillRows, {
                      id: 'fill-between',
                      x: (r) => r.x,
                      y1: (r) => r.from,
                      y2: (r) => r.to,
                      positiveFill: fill.aboveFill ?? fill.fill,
                      negativeFill: fill.fill,
                      fillOpacity: 1,
                      stroke: 'none',
                      comparisonStroke: 'none',
                    }),
                  ),
                ]
              : []),
            ...visible.flatMap((s) => [lineMark(plot, s), ...markersOf(s, rows(s), undefined)]),
          ],
          scales: {
            x: { scale: xScale(), axis: false },
            y: { scale: topY, ...yGuide({ format: topFormat, ticks: TOP_TICKS, cls }) },
          },
        }
      }

      const barPane: PaneBuilder = ({ width }) => {
        const cls = resolveContainerClass(width)
        const barRows = barOn ? rowsOf(data, x, barSeries) : []
        const dim = emphasis(highlighted, { key: BAR_KEY })
        return {
          marks: [
            ruleY([0], { id: 'zero', stroke: VX.axisStroke, strokeOpacity: 1, strokeWidth: 1 }),
            barY(barRows, {
              id: 'bars',
              x: rowX,
              y: 'y',
              fill: (row: PlotRow<T, Date | number>) =>
                alpha((row.y ?? 0) >= 0 ? bar.positive : bar.negative, BAR_OPACITY * dim),
            }),
          ],
          scales: {
            x: {
              scale: xScale(),
              ...xGuide({ ticks: continuousTicks(model, cls), format, cls }),
            },
            y: { scale: barScale, ...yGuide({ format: bar.format, ticks: BAR_TICKS, cls }) },
          },
        }
      }

      return {
        keys: model.values,
        top: topPane,
        bottom: barPane,
        topFraction,
        gap: PANE_GAP,
        rows: (d) => {
          const out: EngineTooltipRow[] = []
          for (const s of visible) {
            const v = s.getValue(d)
            if (s.tooltip === false || v === null || !Number.isFinite(v)) continue
            out.push({
              label: s.note === undefined ? s.label : `${s.label} · ${s.note}`,
              value: s.formatValue ? s.formatValue(v, d) : topFormat(v),
              color: s.color,
              ...(highlighted === s.key && { active: true }),
            })
          }
          const v = barOn ? bar.getValue(d) : null
          if (v !== null && Number.isFinite(v))
            out.push({
              label: bar.label,
              value: bar.formatValue ? bar.formatValue(v, d) : bar.format(v),
              color: v >= 0 ? bar.positive : bar.negative,
              ...(highlighted === BAR_KEY && { active: true }),
            })
          return out
        },
      }
    },
    [data, x, lines, barSeries, top, fillBetween, bar, topFraction, topFormat, formatX],
  )

  return (
    <PanelRung
      ariaLabel={ariaLabel}
      series={all}
      plan={plan}
      {...(formatX !== undefined && { formatX })}
      {...(legend !== undefined && { legend })}
      {...(height !== undefined && { height })}
      {...(state !== undefined && { state })}
      {...(cursorGroup !== undefined && { cursorGroup })}
      {...(cursorResolution !== undefined && { cursorResolution })}
      {...(tooltip !== undefined && { tooltip })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}
