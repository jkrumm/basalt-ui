/**
 * `DualPanel` — a top line pane over a bottom signed-bar pane, ONE chart (`docs/V2-SPEC.md` § 9.2,
 * § 9.3), composed by `panel.tsx`: one host, one cursor, one tooltip, one legend. The top pane may
 * shade the band between two of its lines (`differenceY`); the bottom pane draws a signed value as
 * bars around zero. Each pane resolves its own y domain; x is a Date or number, shared by both.
 */
import { differenceY } from '@tanstack/charts/difference'
import { decorative } from '@tanstack/charts/mark/decorative'
import { ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import type { ChartTooltipRow as EngineTooltipRow, ChartValue } from '@tanstack/charts/types/core'
import { scaleUtc } from 'd3-scale'
import { useCallback, useMemo } from 'react'
import type { ReactElement } from 'react'
import { VX, alpha } from '../tokens'
import { resolveContainerClass } from '../tokens/size-classes'
import { defaultNumberFormat, engineRow, seriesRow, visibleSeries } from './compile'
import { barMark, emphasis, lineMark, markersOf, thinFill } from './marks'
import { PanelRung, chartHeightOf, paneX, paneY, rowsOf } from './panel'
import type { PaneBuilder, PanelInput, PanelPlan } from './panel'
import { plotContext } from './plot-context'
import type { SignedSeries } from './legend'
import { xScaleFor } from './scales'
import { rowX } from './types'
import type { CartesianChartProps, ChartSeries, PlotRow } from './types'

// ── DualPanel ───────────────────────────────────────────────────────────────────────────────────

/** The bar's legend/toggle key. Reserved: a line may not use it. */
const BAR_KEY = '__bar'
const DEFAULT_TOP_FRACTION = 0.62
/** Space between the panes in px. */
const PANE_GAP = 8
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
  /** The fill above zero; the legend swatch splits positive | negative (one entry, one toggle). */
  positive: string
  /** The fill below zero. */
  negative: string
  /** Tick formatter, and the tooltip's too unless `tooltipFormat` is given. */
  format: (v: number) => string
  /** The tooltip row's formatter. Default: `format`. */
  tooltipFormat?: ((v: number) => string) | undefined
  /** The tooltip row's value, for a unit or a decimal `format` cannot carry. */
  formatValue?: ((v: number, d: T) => string) | undefined
  /** Default `'auto'`: a symmetric `[-maxAbs, maxAbs]` from the data, rounded to nice ticks. A tuple
   * is used verbatim. */
  domain?: readonly [number, number] | 'auto' | undefined
  /** When `'auto'`: floors `maxAbs`, so a plateau does not amplify to fill the pane. */
  maxAbsFloor?: number | undefined
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
  top?:
    | {
        domain?: readonly [number, number] | 'auto' | undefined
        format?: ((v: number) => string) | undefined
        /** The lines' tooltip formatter. Default: `format`. */
        tooltipFormat?: ((v: number) => string) | undefined
      }
    | undefined
  /**
   * Shades the band between two top lines (by key), where both are visible. `aboveFill` colours the
   * side where `to` runs above `from`; omitted, both sides take `fill`.
   */
  fillBetween?:
    | { from: string; to: string; fill: string; aboveFill?: string | undefined }
    | undefined
  bar: DualPanelBar<T>
  /** The top pane's share of the chart height. Default 0.62. */
  topFraction?: number | undefined
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
  const {
    data,
    x,
    series,
    top,
    fillBetween,
    bar,
    topFraction = DEFAULT_TOP_FRACTION,
    ...rung
  } = props
  const { formatX } = rung

  if (series.some((s) => s.key === BAR_KEY))
    throw new Error(`[basalt] DualPanel: the series key "${BAR_KEY}" is reserved for the bar`)
  const lines = useMemo<ChartSeries<T>[]>(
    () => series.map((s) => ({ ...s, mark: 'line' as const })),
    [series],
  )
  const barSeries = useMemo<SignedSeries<T>>(
    () => ({
      key: BAR_KEY,
      label: bar.label,
      color: bar.positive,
      colorNegative: bar.negative,
      mark: 'bar',
      getValue: bar.getValue,
    }),
    [bar.label, bar.positive, bar.negative, bar.getValue],
  )
  const all = useMemo(() => [...lines, barSeries], [lines, barSeries])
  const topFormat = top?.format ?? defaultNumberFormat
  const topTooltipFormat = top?.tooltipFormat ?? topFormat
  const barTooltipFormat = bar.tooltipFormat ?? bar.format

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
      // A row's x as a fraction of the plot (the domain is padded half a step each side).
      const fillAt = (v: Date | number): number =>
        ((v instanceof Date ? v.getTime() : v) - (lo - pad)) / (hi - lo + 2 * pad)
      const format = formatX ? (v: ChartValue): string => formatX(v as X) : undefined

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
      const barDomain = fixedBar ?? ([...barScale.domain()] as [number, number])

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

      const topPane: PaneBuilder = ({ width, height: h, plot: access }) => {
        const cls = resolveContainerClass(width)
        const plot = plotContext<T, Date | number>(
          {
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
            data,
            xFraction: model.fraction,
            y2: undefined,
            yDomain: topDomain,
            y2Domain: undefined,
          },
          access,
        )
        return {
          marks: [
            ...(fill
              ? [
                  decorative(
                    differenceY(
                      thinFill(fillRows, width, (r) => fillAt(r.x)),
                      {
                        id: 'fill-between',
                        x: (r) => r.x,
                        y1: (r) => r.from,
                        y2: (r) => r.to,
                        positiveFill: fill.aboveFill ?? fill.fill,
                        negativeFill: fill.fill,
                        fillOpacity: 1,
                        stroke: 'none',
                        comparisonStroke: 'none',
                      },
                    ),
                  ),
                ]
              : []),
            ...visible.flatMap((s) => [lineMark(plot, s), ...markersOf(s, rows(s), undefined)]),
          ],
          scales: {
            x: { scale: xScale(), axis: false },
            y: paneY({
              scale: topY,
              domain: topDomain,
              format: topFormat,
              ticks: TOP_TICKS,
              cls,
              height: chartHeightOf(h, topFraction, PANE_GAP),
            }),
          },
        }
      }

      const barPane: PaneBuilder = ({ width, height: h }) => {
        const cls = resolveContainerClass(width)
        const whole = chartHeightOf(h, 1 - topFraction, PANE_GAP)
        const barRows = barOn ? rowsOf(data, x, barSeries) : []
        const dim = emphasis(highlighted, { key: BAR_KEY })
        return {
          marks: [
            ruleY([0], { id: 'zero', stroke: VX.axisStroke, strokeOpacity: 1, strokeWidth: 1 }),
            barMark(barRows, {
              id: 'bars',
              x: rowX,
              y: 'y',
              fill: (row: PlotRow<T, Date | number>) =>
                alpha((row.y ?? 0) >= 0 ? bar.positive : bar.negative, BAR_OPACITY * dim),
            }),
          ],
          scales: {
            x: paneX({ scale: xScale(), model, format, cls, height: whole }),
            y: paneY({
              scale: barScale,
              domain: barDomain,
              format: bar.format,
              ticks: BAR_TICKS,
              cls,
              height: whole,
            }),
          },
        }
      }

      return {
        keys: model.values,
        extent: [lo - pad, hi + pad],
        top: topPane,
        bottom: barPane,
        topFraction,
        gap: PANE_GAP,
        rows: (d) => {
          const out: EngineTooltipRow[] = []
          for (const s of visible) {
            const v = s.getValue(d)
            if (s.tooltip === false || v === null || !Number.isFinite(v)) continue
            out.push(
              seriesRow(
                s,
                s.formatValue ? s.formatValue(v, d) : topTooltipFormat(v),
                highlighted === s.key,
              ),
            )
          }
          const v = barOn ? bar.getValue(d) : null
          if (v !== null && Number.isFinite(v))
            out.push(
              engineRow({
                label: bar.label,
                value: bar.formatValue ? bar.formatValue(v, d) : barTooltipFormat(v),
                color: v >= 0 ? bar.positive : bar.negative,
                active: highlighted === BAR_KEY,
              }),
            )
          return out
        },
      }
    },
    [
      data,
      x,
      lines,
      barSeries,
      top,
      fillBetween,
      bar,
      topFraction,
      topFormat,
      topTooltipFormat,
      barTooltipFormat,
      formatX,
    ],
  )

  return <PanelRung {...rung} series={all} plan={plan} />
}
