/**
 * `CartesianChart` — the one cartesian rung of v3 (`charts/contract.ts`): `Series` is a union by
 * `mark` (line, bar, dot), a series carries only closed vocabulary (`weight`, `dash`, a `{ light,
 * dark }` color), and `label` is required. `Lines` and `Bars` are this component with the series
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
import { VisualSlotContext } from '../visual-slot'
import { useProviderContext } from '../../core/provider'
import { BASALT } from '../../tokens'
import { useCardHidden, useInChartCard } from '../card-context'
import {
  compileCartesian,
  defaultNumberFormat,
  refLegendSeries,
  zoneLegendSeries,
} from '../core/compile'
import type { CartesianDefinition } from '../core/compile'
import { labelTieMarks } from '../core/label-ties'
import { samePlots } from '../core/plot-context'
import type { PlotSizes } from '../core/plot-context'
import { ChartEngine, idPrefixOf } from '../host'
import { ChartLegend, isolatableKeys, isolatedKeys, legendEntries, toggledKeys } from '../legend'
import { useChartSize, useServerFrame } from '../sizing'
import { ChartPlaceholder, resolveChartState } from '../state'
import { rowX } from '../types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext } from '../types'
import type { CartesianChartProps, ChartZone, CustomMarks, Series } from '../contract'
import { takeLabelTies } from '../label-obstacles'
import { PaneGutterContext } from '../pane-gutter'
import { applySeams } from '../seams'
import { asMarks, customPlot, toChartState, toEngineSpec } from './cartesian-adapt'
import { chartSelection, indexMap } from './cartesian-selection'
import { barMarks, floorIsZero, shadeBars } from './bars-marks'
import { dimmedPaint, focusedPaint } from '../marks'
import { CV } from '../core/theme'
import { FocusWrap, useCursorFocus } from '../focus'
import type { BarLayout } from './bars-marks'
import { AUTO_END_LABELS, lastIsPlaceable, lineMarks } from './lines-marks'
import { phoneNamesFit } from '../labels'
import type { LinesNaming } from '../labels'

/** The most points a `table` renders: past it the table is a wall, not an alternative. */
export const TABLE_MAX_POINTS = 200

/** Kind-only switches the public props never carry: `Lines` and `Bars` set them, a bare chart has none. */
export type PlotOptions<D = never> = {
  /** Bar stacking. Default `'stacked'`. */
  layout?: BarLayout
  /** `Waterfall`: every bar floats from `base` and takes `fill` per datum. */
  floating?: { base: (d: D) => number; fill: (d: D) => string } | undefined
  /** `RangeNavigator`: engine controls (the brush) on a plot with no y axis. */
  controls?: CartesianDefinition['controls'] | undefined
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

// In a card the plot sits on the inset: the hover's axis labels wear its color as their halo.
const cardRootStyle = { ...rootStyle, '--bc-guide-halo': CV.inset } as CSSProperties

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
export function autoSummary<D>(
  props: Pick<CartesianChartProps<D>, 'data' | 'series'>,
  locale?: string,
): string {
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
  const fmt = (v: number): string =>
    first.format?.(v, props.data[0] as D) ?? defaultNumberFormat(v, locale)
  return `${first.label}: min ${fmt(min)}, max ${fmt(max)}, last ${fmt(last)}`
}

const xLabel = (v: ChartX): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v))

/** The data table behind the picture: every point of every series, up to {@link TABLE_MAX_POINTS}. */
function DataTable<D>(props: CartesianChartProps<D>): ReactElement | null {
  const { data, series, x } = props
  const ariaLabel = props.label
  const { locale } = useProviderContext()
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
                      {v === null ? '' : (s.format?.(v, d) ?? defaultNumberFormat(v, locale))}
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
 * The cartesian chart. `series` is the single source of color, legend entry and tooltip row; custom
 * engine marks come from `CartesianChart.custom` and are drawn after the series' own. The series
 * fields, selection, custom marks, axis titles and y capping are in `cartesian-chart-guide.md`.
 *
 * @useWhen a metric needs a time or category chart, or a mix of lines, bars and dots
 * @neverWhen the chart is a tiny inline trend (use Sparkline) or a one-value readout (use a StatCard)
 *
 * @example
 * <CartesianChart
 *   label="Requests per day"
 *   data={rows}
 *   x={{ value: (d) => d.day }}
 *   series={[{ mark: 'line', key: 'requests', label: 'Requests', color: SERIES.requests, y: (d) => d.requests }]}
 * />
 */
export function CartesianChart<D>(props: CartesianChartProps<D>): ReactElement {
  return <CartesianPlot {...props} />
}
CartesianChart.custom = custom

/**
 * Where the item at `last` ends on a time axis: one typical step (the median gap between the
 * items) after it. Any other x, or items with no gap to read, end where they start.
 */
function itemEnd(last: ChartX, xs: readonly ChartX[]): ChartX {
  if (!(last instanceof Date)) return last
  const times = xs
    .flatMap((v) => (v instanceof Date ? [v.getTime()] : []))
    .toSorted((a, b) => a - b)
  const gaps = times.flatMap((t, i) =>
    i > 0 && t > (times[i - 1] as number) ? [t - (times[i - 1] as number)] : [],
  )
  if (gaps.length === 0) return last
  const step = gaps.toSorted((a, b) => a - b)[gaps.length >> 1] as number
  return new Date(last.getTime() + step)
}

/** The rung `Lines` and `Bars` render through: the public props plus the kind-only options. */
export function CartesianPlot<D>(props: CartesianChartProps<D> & PlotOptions<D>): ReactElement {
  const { summary, table, phase, layout = 'stacked', naming = 'auto', floating, controls } = props
  const ariaLabel = props.label
  const chartId = useId()
  const { locale } = useProviderContext()
  const inCard = useInChartCard()
  // A chart in a card takes the card's box, whatever the slot passed: its own height law is taller
  // than the card's at 390 and the box would clip the x axis and the legend.
  const height = props.height ?? (inCard ? 'fill' : undefined)
  const bare = useContext(VisualSlotContext) !== null
  const { ref, width: measured, coarse } = useChartSize()
  const serverFrame = useServerFrame()
  const [ownHidden, setOwnHidden] = useState<ReadonlySet<string>>(() => new Set())
  // A card's legend hides series too: the chart reads one set, its own toggles and the card's.
  const cardHidden = useCardHidden()
  const hidden = useMemo(
    () => (cardHidden.size === 0 ? ownHidden : new Set([...ownHidden, ...cardHidden])),
    [ownHidden, cardHidden],
  )
  const [ownHighlight, setOwnHighlight] = useState<string | null>(null)
  const [plot, setPlot] = useState<PlotSizes | null>(null)
  const onPlot = useCallback((next: PlotSizes) => {
    setPlot((prev) => (samePlots(prev, next) ? prev : next))
  }, [])

  const { data, x, series, refLines, cursor, tooltip, selection, focus, y2, events } = props
  // Panes of one card share the widest y gutter unless the page fixed its own (`y.gutter`).
  const pane = useContext(PaneGutterContext)
  const ownGutter = props.y?.gutter !== undefined
  const sharedGutter = ownGutter ? undefined : pane?.gutter
  const y = useMemo(
    () => (sharedGutter === undefined ? props.y : { ...props.y, gutter: sharedGutter }),
    [props.y, sharedGutter],
  )
  const reportLeft = ownGutter ? undefined : pane?.report
  const custom = props.marks
  const hostFocus = useCursorFocus(focus, { group: cursor, x: x.value, label: ariaLabel })
  const ownsKeys = hostFocus !== undefined
  // A held span (a list row that stands for a run of items) is drawn as one x band in the row
  // tint; no single datum is focused then, so no point marker or tooltip names one of them.
  const held = focus !== undefined && focus.span.length > 1 ? focus.span : undefined
  const focused = held === undefined ? (focus?.datum ?? null) : null
  const spanFirst = held?.[0]
  const spanLast = held?.at(-1)
  const ownZones = props.zones
  const xValue = x.value
  const focusItems = focus?.items
  const onBands = series.some((s) => s.mark === 'bar')
  const zones = useMemo((): readonly ChartZone[] | undefined => {
    if (spanFirst === undefined || spanLast === undefined) return ownZones
    const last = xValue(spanLast)
    const band: ChartZone = {
      axis: 'x',
      from: xValue(spanFirst),
      // On a time axis an item stands for the interval after its x: the band runs to its end.
      to: onBands || focusItems === undefined ? last : itemEnd(last, focusItems.map(xValue)),
      fill: BASALT.selected,
    }
    return [...(ownZones ?? []), band]
  }, [ownZones, spanFirst, spanLast, xValue, focusItems, onBands])
  // With a `focus` the emphasised series is the shared one: a list row of a series and the legend
  // set the same key, so either marks the other.
  const highlighted = focus === undefined ? ownHighlight : focus.series
  const setHighlighted = focus === undefined ? setOwnHighlight : focus.setSeries
  const stable = useShallowStable({
    data,
    x,
    y,
    y2,
    events,
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
    () =>
      applySeams(toEngineSpec({ ...stable, label: ariaLabel } as CartesianChartProps<D>), stable),
    [stable, ariaLabel],
  )
  // Bar shades are part of the series, so the legend swatch wears what the plot draws: the shade of
  // same-colored bars, else the per-datum `opacity` sampled on the first row, else the default.
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
    const series = base.series.map((s) => shaded.get(s.key) ?? s)
    if (floating === undefined) return { ...base, series }
    return {
      ...base,
      series: series.map((s, i) =>
        stable.series[i]?.mark === 'bar' ? { ...s, base: floating.base, fillOf: floating.fill } : s,
      ),
    }
  }, [base, stable.series, opacityOf, floating])

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
  const namedAtEnds =
    effective === 'auto' && placeable && labelled.length > 0 && labelled.length <= AUTO_END_LABELS
  const hideAtWide = namedAtEnds
  // A phone names its lines at their ends when they fit without a collision, and the legend gives way
  // (decided from the data, so the server HTML agrees); otherwise the legend names them as before.
  const hideAtNarrow = useMemo(() => {
    if (!namedAtEnds) return false
    const lines = spec.series.filter(
      (s, i) => stable.series[i]?.mark === 'line' && s.role !== 'reference',
    )
    const last = lines.flatMap((s) => {
      const value = spec.data.findLast((d) => s.getValue(d) !== null)
      const v = value === undefined ? null : s.getValue(value)
      return typeof v === 'number' && Number.isFinite(v) ? [{ label: s.label, value: v }] : []
    })
    if (last.length !== lines.length) return false
    const all = lines.flatMap((s) =>
      spec.data.flatMap((d) => {
        const v = s.getValue(d)
        return typeof v === 'number' && Number.isFinite(v) ? [v] : []
      }),
    )
    if (all.length === 0) return false
    // A loop, not `Math.min(...all)`: a long series overflows the argument limit.
    let lo = all[0] as number
    let hi = lo
    for (const v of all) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    return phoneNamesFit({ last, extent: [lo, hi] })
  }, [namedAtEnds, spec, stable.series])

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
        const color = spec.series.find((e) => e.key === s.key)?.color ?? 'currentColor'
        const focused = ctx.focused
        // A held span keeps its dots and dims the rest, as one focused datum does.
        const lit = (d: D): boolean => (held === undefined ? d === focused : held.includes(d))
        const dotsOf = (group: typeof rows, id: string, fill: string) =>
          dot(group, {
            id,
            x: rowX,
            y: 'y',
            r: r ? (row: { datum: D }) => r(row.datum) : BASALT.dotR,
            fill,
            ...(s.axis === 'right' && ctx.y2 !== undefined && { yScale: ctx.y2 }),
          })
        // A `focus` holding a datum dims every other dot; the focused one is its own mark, on top.
        if (focused === null && held === undefined) out.push(dotsOf(rows, s.key, color))
        else
          out.push(
            dotsOf(
              rows.filter((row) => !lit(row.datum)),
              s.key,
              dimmedPaint(color),
            ),
            dotsOf(
              rows.filter((row) => lit(row.datum)),
              `${s.key}:focused`,
              focusedPaint(color),
            ),
          )
      }
      if (stable.custom !== undefined) {
        const byKey = new Map(stable.series.map((s) => [s.key, s]))
        const built = asMarks(stable.custom.build(customPlot(ctx, byKey)))
        // The hairlines and plates its label pass asked for go under its text, over the series' marks.
        out.push(
          ...labelTieMarks({
            ties: takeLabelTies(),
            plot: { width: ctx.plotWidth, height: ctx.plotHeight },
            domain: ctx.yDomain,
            yScale: 'y',
          }),
          ...built,
        )
      }
      if (controller !== undefined) {
        const rows = ctx.visible.flatMap((s) => ctx.rows(s.key)).filter((row) => row.y !== null)
        out.push(
          whenSelected(
            dot(rows, {
              id: 'selection',
              x: rowX,
              y: 'y',
              r: BASALT.dotR + 2,
              fill: 'none',
              stroke: CV.brand,
              strokeWidth: 2,
              key: (row: { datum: D }) => indexOf.get(row.datum) ?? -1,
            }),
            controller,
          ),
        )
      }
      return out
    },
    [stable, spec, effective, controller, indexOf, opacityOf, held],
  )

  // The largest radius each dot series draws: the plot keeps that much room at its edge.
  const dotRadius = useMemo(() => {
    const out = new Map<string, number>()
    for (const s of stable.series) {
      if (s.mark !== 'dot' || s.r === undefined) continue
      // A loop, not `Math.max(...radii)`: a spread of a large series overflows the argument limit.
      let largest = BASALT.dotR
      for (const d of stable.data) largest = Math.max(largest, s.r(d))
      out.set(s.key, largest)
    }
    return out
  }, [stable.series, stable.data])
  // The axis each `spread` dot series moves its coincident dots along.
  const dotSpread = useMemo(() => {
    const out = new Map<string, 'x' | 'y'>()
    for (const s of stable.series)
      if (s.mark === 'dot' && s.spread !== undefined) out.set(s.key, s.spread)
    return out
  }, [stable.series])
  const width = measured || serverFrame.width
  const definition = useMemo(() => {
    const compiled = compileCartesian<D, ChartX>({
      ...spec,
      marks,
      chartId,
      locale,
      dotRadius,
      ...(dotSpread.size > 0 && { dotSpread }),
      hidden,
      highlighted,
      coarse,
      width,
      plot,
      focused,
      ...(effective !== 'legend' && { endLabels: effective }),
      ...(hideAtNarrow && { endLabelsNarrow: true }),
      // A pane of stacked charts shares one gutter, so only a chart that owns its y axis moves the labels inside.
      // A bar fills the plot from its left edge, under any label placed there: the bar kinds keep their axis column.
      ...(pane === undefined && !hasBars && { yInside: true }),
      // With `focus` the wrapper is the one tab stop and steps `focus.items` itself.
      ...(ownsKeys && { keyboard: false }),
      ...(hasBars && {
        band: true,
        crosshair: false,
        focusRing: false,
        reverseRows: stable.layout !== 'grouped',
        stack: stable.layout === 'grouped' ? undefined : stable.layout,
      }),
      ...(stable.bare && { bare: true, tooltipBelow: true }),
      ...(controls !== undefined && {
        controls,
        yAxis: false,
        keyboard: false,
        crosshair: false,
        focusRing: false,
      }),
    } as Parameters<typeof compileCartesian<D, ChartX>>[0])
    // Selection is part of the definition, not of any mark; the server never runs its handlers.
    return controller === undefined ? compiled : { ...compiled, selection: controller }
  }, [
    spec,
    marks,
    chartId,
    locale,
    dotRadius,
    dotSpread,
    hidden,
    highlighted,
    coarse,
    width,
    plot,
    focused,
    effective,
    hideAtNarrow,
    ownsKeys,
    hasBars,
    stable.layout,
    stable.bare,
    controller,
    pane,
    controls,
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
  // A `colorBy` line keeps its legend alone too: the ramp key says what its colors mean.
  const ramped = spec.series.some((s) => s.colorBy !== undefined)
  const shown = !bare && !labelsOnly && (entryCount > 1 || ramped)
  const toggle = entryCount >= 2
  const onToggle = useCallback((key: string) => setOwnHidden((prev) => toggledKeys(prev, key)), [])
  const isolatable = useMemo(() => isolatableKeys(legendSeries), [legendSeries])
  const onIsolate = useCallback(
    (key: string) => setOwnHidden((prev) => isolatedKeys(prev, key, isolatable)),
    [isolatable],
  )
  const legendNode: ReactNode = shown ? (
    <ChartLegend
      series={legendSeries as readonly ChartSeries<D>[]}
      hidden={hidden}
      mode="auto"
      groups={false}
      toggle={toggle}
      onToggle={onToggle}
      onIsolate={onIsolate}
      onHighlight={setHighlighted}
      concealed={resolved !== null}
      hideAtWide={hideAtWide}
      hideAtNarrow={hideAtNarrow}
    />
  ) : null

  const text = summary ?? autoSummary(stable, locale)
  return (
    <>
      <div
        ref={ref}
        data-basalt-chart=""
        data-chart-id={chartId}
        data-in-card={inCard ? '' : undefined}
        style={inCard ? cardRootStyle : rootStyle}
      >
        {resolved === null ? (
          <FocusWrap props={hostFocus} live={focus?.live}>
            <ChartEngine
              definition={definition}
              ariaLabel={ariaLabel}
              height={height}
              idPrefix={idPrefixOf(chartId)}
              coarse={coarse}
              onPlot={onPlot}
              onPlotLeft={reportLeft}
            />
          </FocusWrap>
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
