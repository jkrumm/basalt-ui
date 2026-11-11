/**
 * `CartesianChart` — the one cartesian rung of v3 (`charts/contract.ts`): `Series` is a union by
 * `mark` (line, bar, dot), a series carries only closed vocabulary (`weight`, `dash`, a `{ light,
 * dark }` colour), and `ariaLabel` is required. `Lines` and `Bars` are this component with the series
 * narrowed.
 *
 * Three layers, composed here and nowhere else: the width hook (`../sizing`), the bare engine mount
 * in its CSS-owned box (`../host`, `../box`), and the chrome (legend, placeholders, the hidden
 * summary and data table) around both. The compiler is `../core/compile`; `seams.ts` is the registry
 * every chart passes its spec through before it compiles.
 *
 * @useWhen a metric needs a time or category chart, or a mix of lines, bars and dots
 * @neverWhen the chart is a tiny inline trend (use Sparkline) or a one-value readout (use a StatCard)
 */
import { whenSelected } from '@tanstack/charts/selection'
import { dot } from '@tanstack/charts/dot'
import { useCallback, useContext, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { VisualSlotContext } from '../../dashboard/visual-slot'
import { VX } from '../../tokens'
import { useInChartCard } from '../card-context'
import {
  compileCartesian,
  defaultNumberFormat,
  refLegendSeries,
  zoneLegendSeries,
} from '../core/compile'
import { samePlots } from '../core/plot-context'
import type { PlotSizes } from '../core/plot-context'
import { ChartEngine, idPrefixOf } from '../host'
import { ChartLegend, legendEntries } from '../legend'
import { INITIAL_WIDTH, useChartSize } from '../sizing'
import { ChartPlaceholder, resolveChartState } from '../state'
import { rowX } from '../types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext } from '../types'
import type { CartesianChartProps, CustomMarks, Series } from '../contract'
import { applySeams } from '../seams'
import { asMarks, customPlot, toChartState, toEngineSpec } from './cartesian-adapt'
import { chartSelection, indexMap } from './cartesian-selection'
import { barMarks, floorIsZero, shadeBars } from './bars-marks'
import type { BarLayout } from './bars-marks'
import { AUTO_END_LABELS, lastIsPlaceable, lineMarks } from './lines-marks'
import type { LinesNaming } from '../labels'

/** The most points a `table` renders: past it the table is a wall, not an alternative. */
export const TABLE_MAX_POINTS = 200

/** Kind-only switches the public props never carry: `Lines` and `Bars` set them, a bare chart has none. */
export type PlotOptions = {
  /** Bar stacking. Default `'stacked'`. */
  layout?: BarLayout
  /** Who names the lines: end labels or the legend. Default `'auto'`. */
  naming?: LinesNaming
}

// A size container: the legend picks none/dots/chips from this box's width in CSS, so the server
// HTML already carries the right one (`chart-legend.module.css`).
const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  // `width: 100%` because a size container cannot take its width from its content.
  width: '100%',
  minWidth: 0,
  containerType: 'inline-size',
}

// Visually hidden, still in the accessibility tree: the summary and the data table.
const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** The previous object while every field is `Object.is`-equal: a one-dependency memo key. */
function useShallowStable<V extends Record<string, unknown>>(next: V): V {
  const [kept, setKept] = useState(next)
  const same = [...new Set([...Object.keys(kept), ...Object.keys(next)])].every((k) =>
    Object.is(kept[k], next[k]),
  )
  // Render-phase setState: React re-renders at once with `kept` replaced, no effect, no stale frame.
  if (!same) setKept(next)
  return same ? kept : next
}

const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)

/**
 * The text a chart states for assistive technology when `summary` is not given: the first series'
 * range and last value. Honest about an empty series rather than inventing a number.
 */
export function autoSummary<D>(props: Pick<CartesianChartProps<D>, 'data' | 'series'>): string {
  const first = props.series.find((s) => s.failed !== true)
  if (first === undefined) return ''
  // A loop, not `Math.min(...values)`: a spread of a large series overflows the argument limit.
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let last: number | undefined
  for (const d of props.data) {
    const v = first.y(d)
    if (!finite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
    last = v
  }
  if (last === undefined) return `${first.label}: no data`
  const fmt = (v: number): string => first.format?.(v, props.data[0] as D) ?? defaultNumberFormat(v)
  return `${first.label}: min ${fmt(min)}, max ${fmt(max)}, last ${fmt(last)}`
}

const xLabel = (v: ChartX): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))

/** The data table behind the picture: every point of every series, up to {@link TABLE_MAX_POINTS}. */
function DataTable<D>(props: CartesianChartProps<D>): ReactElement | null {
  const { data, series, x, ariaLabel } = props
  if (data.length > TABLE_MAX_POINTS) return null
  const shown = series.filter((s) => s.failed !== true)
  return (
    <div data-basalt-chart-table-box="" style={srOnly}>
      <table data-basalt-chart-table="">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">x</th>
            {shown.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => {
            const at = x.value(d)
            return (
              <tr key={i}>
                <th scope="row">{x.format ? x.format(at) : xLabel(at)}</th>
                {shown.map((s) => {
                  const v = s.y(d)
                  return (
                    <td key={s.key}>
                      {v === null ? '' : (s.format?.(v, d) ?? defaultNumberFormat(v))}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** `CartesianChart.custom`: the only way to build the `marks` prop. */
function custom<D>(build: CustomMarks<D>['build']): CustomMarks<D> {
  return { kind: 'custom-marks', build }
}

/**
 * The cartesian chart. `series` is the single source of colour, legend entry and tooltip row; custom
 * engine marks come from `CartesianChart.custom` and are drawn after the series' own.
 *
 * ```tsx
 * <CartesianChart
 *   ariaLabel="Requests per day"
 *   data={rows}
 *   x={{ value: (d) => d.day }}
 *   series={[{ mark: 'line', key: 'requests', label: 'Requests', color: SERIES.requests, y: (d) => d.requests }]}
 * />
 * ```
 */
export function CartesianChart<D>(props: CartesianChartProps<D>): ReactElement {
  return <CartesianPlot {...props} />
}
CartesianChart.custom = custom

/** The rung `Lines` and `Bars` render through: the public props plus the kind-only options. */
export function CartesianPlot<D>(props: CartesianChartProps<D> & PlotOptions): ReactElement {
  const { ariaLabel, summary, table, height, phase, layout = 'stacked', naming = 'auto' } = props
  const chartId = useId()
  const inCard = useInChartCard()
  const bare = useContext(VisualSlotContext) !== null
  const { ref, width: measured, coarse } = useChartSize()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [plot, setPlot] = useState<PlotSizes | null>(null)
  const onPlot = useCallback((next: PlotSizes) => {
    setPlot((prev) => (samePlots(prev, next) ? prev : next))
  }, [])

  const { data, x, y, series, zones, refLines, cursor, tooltip, selection } = props
  const custom = props.marks
  const stable = useShallowStable({
    data,
    x,
    y,
    series,
    zones,
    refLines,
    cursor,
    tooltip,
    selection,
    custom,
    layout,
    naming,
    bare,
  })

  const hasBars = stable.series.some((s) => s.mark === 'bar')
  const base = useMemo(
    () => applySeams(toEngineSpec({ ...stable, ariaLabel } as CartesianChartProps<D>), stable),
    [stable, ariaLabel],
  )
  // Bar shades are part of the series, so the legend swatch wears what the plot draws: the shade of
  // same-coloured bars, else the per-datum `opacity` sampled on the first row, else the default.
  const opacityOf = useMemo(
    () =>
      new Map(
        stable.series.flatMap((s) =>
          s.mark === 'bar' && s.opacity ? [[s.key, s.opacity] as const] : [],
        ),
      ),
    [stable.series],
  )
  const spec = useMemo(() => {
    const bars = shadeBars(
      base.series.filter((s, i) => stable.series[i]?.mark === 'bar'),
      opacityOf.size > 0,
    )
    const sample = base.data[0]
    const shaded = new Map(
      bars.map((b) => {
        const first = sample === undefined ? undefined : opacityOf.get(b.key)?.(sample)
        return [b.key, first === undefined ? b : { ...b, fillOpacity: first }] as const
      }),
    )
    return { ...base, series: base.series.map((s) => shaded.get(s.key) ?? s) }
  }, [base, stable.series, opacityOf])

  // ── the legend gives way to end labels only when they WILL draw for every line ─────────────────
  const lineSeries = spec.series.filter((s, i) => stable.series[i]?.mark === 'line')
  const labelled = lineSeries.filter((s) => s.role !== 'reference')
  const namedByLabels =
    !hasBars &&
    stable.series.every((s) => s.mark === 'line') &&
    spec.y2 === undefined &&
    spec.series.every((s) => s.role !== 'reference')
  const effective: LinesNaming = namedByLabels ? stable.naming : 'legend'
  const placeable = labelled.every((s) => lastIsPlaceable(spec.data, spec.x, spec.xDomain, s))
  const labelsOnly = effective === 'endLabels'
  const hideAtWide =
    effective === 'auto' && placeable && labelled.length > 0 && labelled.length <= AUTO_END_LABELS

  // ── selection: the click and Enter proposal, through the engine's keyed selection ──────────────
  const indexOf = useMemo(() => indexMap(stable.data), [stable.data])
  const pick = stable.selection
  const controller = useMemo(
    () => (pick === undefined ? undefined : chartSelection(stable.data, indexOf, pick)),
    [pick, indexOf, stable.data],
  )

  const marks = useCallback(
    (ctx: PlotContext<D, ChartX>): ChartMarks => {
      const byMark = (mark: Series<D>['mark']): ReadonlySet<string> =>
        new Set(stable.series.filter((s) => s.mark === mark).map((s) => s.key))
      const out: ChartMarks[number][] = []
      const barKeys = byMark('bar')
      if (barKeys.size > 0) {
        const bars = spec.series.filter((s) => barKeys.has(s.key))
        out.push(
          ...barMarks(ctx, {
            bars,
            layout: stable.layout,
            ...(opacityOf.size > 0 && {
              opacityOf: (d: D, key: string) => opacityOf.get(key)?.(d),
            }),
            emptyTicks: stable.bare && floorIsZero(spec.y?.domain),
          }),
        )
      }
      const lineKeys = byMark('line')
      if (lineKeys.size > 0) {
        out.push(
          ...lineMarks(ctx, {
            all: spec.series,
            keys: lineKeys,
            naming: effective,
            rules: (spec.refLines ?? []).flatMap((r) => (r.axis === 'right' ? [] : [r.value])),
          }),
        )
      }
      const dots = stable.series.filter((s) => s.mark === 'dot')
      for (const s of dots) {
        if (!ctx.visible.some((v) => v.key === s.key) || s.mark !== 'dot') continue
        const r = s.r
        const rows = ctx.rows(s.key).filter((row) => row.y !== null)
        if (rows.length === 0) continue
        out.push(
          dot(rows, {
            id: s.key,
            x: rowX,
            y: 'y',
            r: r ? (row: { datum: D }) => r(row.datum) : VX.dotR,
            fill: spec.series.find((e) => e.key === s.key)?.color ?? 'currentColor',
            ...(s.axis === 'right' && ctx.y2 !== undefined && { yScale: ctx.y2 }),
          }),
        )
      }
      if (stable.custom !== undefined) {
        const byKey = new Map(stable.series.map((s) => [s.key, s]))
        out.push(...asMarks(stable.custom.build(customPlot(ctx, byKey))))
      }
      if (controller !== undefined) {
        const rows = ctx.visible.flatMap((s) => ctx.rows(s.key)).filter((row) => row.y !== null)
        out.push(
          whenSelected(
            dot(rows, {
              id: 'selection',
              x: rowX,
              y: 'y',
              r: VX.dotR + 2,
              fill: 'none',
              stroke: VX.accent,
              strokeWidth: 2,
              key: (row: { datum: D }) => indexOf.get(row.datum) ?? -1,
            }),
            controller,
          ),
        )
      }
      return out
    },
    [stable, spec, effective, controller, indexOf, opacityOf],
  )

  const width = measured || INITIAL_WIDTH
  const definition = useMemo(() => {
    const compiled = compileCartesian<D, ChartX>({
      ...spec,
      marks,
      chartId,
      hidden,
      highlighted,
      coarse,
      width,
      plot,
      ...(hasBars && {
        band: true,
        crosshair: false,
        focusRing: false,
        reverseRows: stable.layout !== 'grouped',
        stack: stable.layout === 'grouped' ? undefined : stable.layout,
      }),
      ...(stable.bare && { bare: true, tooltipBelow: true }),
    } as Parameters<typeof compileCartesian<D, ChartX>>[0])
    // Selection is part of the definition, not of any mark; the server never runs its handlers.
    return controller === undefined ? compiled : { ...compiled, selection: controller }
  }, [
    spec,
    marks,
    chartId,
    hidden,
    highlighted,
    coarse,
    width,
    plot,
    hasBars,
    stable.layout,
    stable.bare,
    controller,
  ])

  // ── legend: micro has none, compact shows dots, regular and wide show chips (CSS) ──────────────
  const legendSeries = useMemo(
    () => [
      ...spec.series,
      ...refLegendSeries<D>(spec.refLines),
      ...zoneLegendSeries<D>(spec.zones),
    ],
    [spec.series, spec.refLines, spec.zones],
  )
  const entryCount = legendEntries(legendSeries, false)[0]?.length ?? 0
  const state = toChartState(phase)
  const resolved = resolveChartState(state)
  const shown = !bare && !labelsOnly && entryCount > 1
  const toggle = entryCount >= 2
  const onToggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])
  const legendNode: ReactNode = shown ? (
    <ChartLegend
      series={legendSeries as readonly ChartSeries<D>[]}
      hidden={hidden}
      mode="auto"
      groups={false}
      toggle={toggle}
      onToggle={onToggle}
      onHighlight={setHighlighted}
      concealed={resolved !== null}
      hideAtWide={hideAtWide}
    />
  ) : null

  const text = summary ?? autoSummary(stable)
  return (
    <>
      <div ref={ref} data-basalt-chart="" data-in-card={inCard ? '' : undefined} style={rootStyle}>
        {resolved === null ? (
          <ChartEngine
            definition={definition}
            ariaLabel={ariaLabel}
            height={height}
            idPrefix={idPrefixOf(chartId)}
            coarse={coarse}
            onPlot={onPlot}
          />
        ) : (
          <ChartPlaceholder state={state} height={height} />
        )}
        {legendNode}
      </div>
      {resolved === null && text !== '' && (
        <p data-basalt-chart-summary="" style={srOnly}>
          {text}
        </p>
      )}
      {resolved === null && table === true && <DataTable {...props} />}
    </>
  )
}
