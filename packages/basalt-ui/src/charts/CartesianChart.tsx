/**
 * `CartesianChart` — the one cartesian rung (`docs/V2-SPEC.md` § 9.2): a definition compiler plus
 * one host. Every cartesian kind is this component with fixed `marks`.
 *
 * Three layers, composed here and nowhere else: the width hook (`sizing.ts`), the bare engine mount
 * in its CSS-owned box (`host.tsx`, `box.tsx`: the height exists before JS runs), and the chrome —
 * the derived legend (its mode picked in CSS) and the `state` placeholders — around both.
 */
import { useCallback, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useInChartCard } from './card-context'
import { compileCartesian, refLegendSeries, zoneLegendSeries } from './compile'
import type { CartesianDefinition } from './compile'
import { samePlots } from './plot-context'
import type { PlotSizes } from './plot-context'
import { ChartEngine, idPrefixOf } from './host'
import { ChartLegend, legendEntries } from './legend'
import { INITIAL_WIDTH, useChartSize } from './sizing'
import { ChartPlaceholder, resolveChartState } from './state'
import type { CartesianChartProps, ChartSeries, ChartX } from './types'

/** Kind-only compile switches, never on the public props. */
export type RungOptions = {
  /** A band x scale (bars). */
  band?: boolean
  /** Tooltip rows bottom-up, so a stack reads top-down. */
  reverseRows?: boolean
  /** How the bar series combine for the auto domain. */
  stack?: 'stacked' | 'normalized'
  /** The tooltip opens below the chart (a strip of cells), above only when there is no room. */
  tooltipBelow?: boolean
  /** No vertical rule under the cursor (a bar kind's hover is the bar itself). */
  crosshair?: boolean
  /** No engine point marker on the focused datum (a bar kind's hover is the bar itself). */
  focusRing?: boolean
  /** The legend is dropped at every width on purpose (`Lines`' end labels name the series). */
  keepLegendDrop?: boolean
  /** The legend goes from the wide class up, where `Lines`' end labels name the series. */
  hideLegendAtWide?: boolean
}

// A size container: the legend picks none/dots/chips from this box's width in CSS, so the server
// HTML already carries the right one (`chart-legend.module.css`).
const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  // `width: 100%` because a size container cannot take its width from its content: without it
  // the root collapses to 0 in a flex row or an auto grid track.
  width: '100%',
  minWidth: 0,
  containerType: 'inline-size',
}
// A `placement: 'header'` legend inside a `ChartCard` sits where the header's legend row did: the
// header's 4px bottom inset plus the row's 6px top padding is 10px, less the body's own 2px top inset.
const headerLegendStyle: CSSProperties = { marginTop: 8 }

/** `useId` output (`«r1»`, `:r1:`) is not a safe SVG id fragment. */

/** The previous object while every field is `Object.is`-equal: a one-dependency memo key. */
function useShallowStable<V extends Record<string, unknown>>(next: V): V {
  const [kept, setKept] = useState(next)
  // Union of keys: an omitted prop and an explicit `undefined` are different inputs.
  const same = [...new Set([...Object.keys(kept), ...Object.keys(next)])].every((k) =>
    Object.is(kept[k], next[k]),
  )
  // Render-phase setState: React re-renders at once with `kept` replaced, no effect, no stale frame.
  if (!same) setKept(next)
  return same ? kept : next
}

/** What a chart's definition is compiled from, besides its own props: the chrome's live state. */
export type ShellContext = {
  /** Unique per mounted chart (React `useId`). */
  chartId: string
  /** Series keys the legend has toggled off. */
  hidden: ReadonlySet<string>
  /** The legend entry under the pointer. */
  highlighted: string | null
  /** A coarse primary pointer. */
  coarse: boolean
  /** The measured width; 0 unless the shell was asked to track it (`byWidth`). */
  width: number
  /** The plot area of each pane the engine last laid out; `null` until it has. */
  plot: PlotSizes | null
}

export type ChartShellProps<T> = Pick<
  CartesianChartProps<T, ChartX>,
  'ariaLabel' | 'legend' | 'height' | 'state' | 'className' | 'style'
> & {
  /** The legend and tooltip source. */
  series: readonly ChartSeries<T>[]
  /** Compiles the definition; memoized on its own identity and the context. Keep it stable. */
  compile: (ctx: ShellContext) => CartesianDefinition
  /** Recompile when the measured width changes (default: it is not an input). */
  byWidth?: boolean
  /** `auto` legend only: hidden from the wide class up (CSS). */
  hideLegendAtWide?: boolean
  /**
   * The consumer passed `legend: false` and nothing else names the series: a chart of two or more
   * entries still keeps its key below the 480px container, where hue alone cannot tell them apart.
   * It is gone from 480px up, as the consumer asked.
   */
  keepKeyAtCompact?: boolean
}

/**
 * The chrome around every chart: size, the `hidden`/`highlighted` legend state, the derived legend
 * (and its `ChartCard` header slot), the `state` placeholders and the engine mount. The rung and
 * the composed kinds differ only in the definition they compile.
 */
export function ChartShell<T>(props: ChartShellProps<T>): ReactElement {
  const { ariaLabel, legend, height, state, className, style, series, compile, byWidth } = props
  const { hideLegendAtWide, keepKeyAtCompact } = props
  const chartId = useId()
  const inCard = useInChartCard()
  const { ref, width: measured, coarse } = useChartSize()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [highlighted, setHighlighted] = useState<string | null>(null)

  // Unmeasured (the server, the first client frame) is the regular class, as the engine's
  // `initialWidth` is.
  const width = byWidth ? measured || INITIAL_WIDTH : 0
  // The engine lays the plot out AFTER `marks` runs, so a chart whose marks read the plot size
  // (and only that chart) takes it from the layout and recompiles once.
  const [plot, setPlot] = useState<PlotSizes | null>(null)
  const onPlot = useCallback((next: PlotSizes) => {
    setPlot((prev) => (samePlots(prev, next) ? prev : next))
  }, [])
  const definition = useMemo(
    () => compile({ chartId, hidden, highlighted, coarse, width, plot }),
    [compile, chartId, hidden, highlighted, coarse, width, plot],
  )

  // ── legend: micro has none, compact shows dots, regular and wide show chips (CSS, § 9.6) ──────
  // A single entry names nothing the title, axis and tooltip do not: no legend unless asked for.
  const entryCount = legendEntries(series, false)[0]?.length ?? 0
  const compactKey = legend === false && keepKeyAtCompact === true && entryCount > 1
  const config = compactKey
    ? {}
    : legend === false
      ? null
      : (legend ?? (entryCount > 1 ? {} : null))
  const shown = config !== null && entryCount > 0
  const toggle = config?.toggle ?? entryCount >= 2
  const onToggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])
  const resolved = resolveChartState(state)
  const legendNode: ReactNode = useMemo(
    () =>
      shown ? (
        <ChartLegend
          series={series}
          hidden={hidden}
          mode="auto"
          groups={config?.groups === true}
          toggle={toggle}
          onToggle={onToggle}
          onHighlight={setHighlighted}
          concealed={resolved !== null}
          hideAtWide={hideLegendAtWide === true}
          compactOnly={compactKey}
        />
      ) : null,
    [
      shown,
      series,
      hidden,
      config?.groups,
      toggle,
      onToggle,
      resolved,
      hideLegendAtWide,
      compactKey,
    ],
  )
  // `header` is the enclosing card's header row (`top` outside a card); either way the legend is
  // the first thing in the chart's own markup.
  const atTop = config?.placement === 'top' || config?.placement === 'header'
  const asHeaderRow = config?.placement === 'header' && inCard

  return (
    <div
      ref={ref}
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={style ? { ...rootStyle, ...style } : rootStyle}
    >
      {atTop && (asHeaderRow ? <div style={headerLegendStyle}>{legendNode}</div> : legendNode)}
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
      {!atTop && legendNode}
    </div>
  )
}

export function CartesianRung<T, X extends ChartX>(
  props: CartesianChartProps<T, X> & RungOptions,
): ReactElement {
  const {
    ariaLabel,
    legend,
    height,
    state,
    className,
    style,
    series,
    hideLegendAtWide,
    keepLegendDrop,
    ...spec
  } = props
  const stable = useShallowStable({ ...spec, series })
  const compile = useCallback(
    (ctx: ShellContext) => compileCartesian({ ...stable, ...ctx }),
    [stable],
  )
  // Reference lines that name themselves join the legend after the series (role `reference`).
  const legendSeries = useMemo(
    () => [
      ...stable.series,
      ...refLegendSeries<T>(stable.refLines),
      ...zoneLegendSeries<T>(stable.zones),
    ],
    [stable.series, stable.refLines, stable.zones],
  )
  return (
    <ChartShell
      series={legendSeries}
      compile={compile}
      ariaLabel={ariaLabel}
      {...(legend !== undefined && { legend })}
      {...(height !== undefined && { height })}
      {...(state !== undefined && { state })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
      {...(hideLegendAtWide && { hideLegendAtWide })}
      {...(legend === false && keepLegendDrop !== true && { keepKeyAtCompact: true })}
    />
  )
}

/**
 * The cartesian rung with consumer marks. Required `ariaLabel`; `marks(plot)` returns TanStack
 * marks imported from the allowed `@tanstack/charts/*` subpaths, drawn from `plot.rows(key)`.
 *
 * ```tsx
 * import { lineY } from '@tanstack/charts/line'
 * <CartesianChart
 *   ariaLabel="Load"
 *   data={rows}
 *   x={(d) => d.at}
 *   series={[{ key: 'load', label: 'Load', color: VX.line, getValue: (d) => d.load }]}
 *   marks={(plot) => [lineY(plot.rows('load'), { x: 'x', y: 'y', stroke: VX.line })]}
 * />
 * ```
 */
export function CartesianChart<T, X extends ChartX>(
  props: CartesianChartProps<T, X>,
): ReactElement {
  return <CartesianRung {...props} />
}
