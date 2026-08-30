import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { useChartSize } from '../hooks/useChartSize'
import { deriveLegend } from '../series'
import type { ChartLegendConfig, LegendPlacement, SeriesStyle } from '../series'
import { ChartLegend } from './ChartLegend'
import { ChartPending } from './ChartPending'

const DEFAULT_HEIGHT = 240
const DEFAULT_MIN_WIDTH = 200

/** Legend configuration for {@link ChartFrame}. Omit entirely (or pass `{}`) for the default
 * bottom-placed legend; pass `false` only for the sparkline exemption. */
export type ChartFrameLegend = {
  /** Default 'bottom'. */
  placement?: LegendPlacement
  /** Wrap cap → "+N more" rollup at high cardinality. */
  maxRows?: number
  /** Visually separate role: series | overlay | reference. */
  groups?: boolean
  /** Hover-dim wiring lifted from the kind — optional. */
  highlighted?: string | null
  onHighlight?: (key: string | null) => void
  /**
   * Clicking a legend entry hides that series. Defaults to true whenever there is more than one
   * entry to toggle between — hiding the only series a chart draws is never useful. The hidden
   * key set reaches the marks through the `children` render prop, so a hidden series leaves the
   * plot, the tooltip, and the auto domain together (`docs/CHARTS-SPEC.md` §5).
   */
  toggle?: boolean
}

export type ChartFrameProps = {
  /** Series identity — drives the derived legend. Pass the SAME array the kind draws + tooltips from. */
  series: readonly SeriesStyle[]
  /** Fixed height in pixels. Used when neither `aspectRatio` nor `fill` is set. Default 240. */
  height?: number
  /** height = Math.round(containerWidth / aspectRatio). Ignored when `fill` is set. */
  aspectRatio?: number
  /** Fill the parent flex/grid cell's measured height instead of a fixed/derived one. */
  fill?: boolean
  /** First-frame width floor before the container is measured. Default 200. */
  minWidth?: number
  /** Namespaces `ChartLegend`'s `split` swatch clipPath ids across multiple charts on one page. */
  chartId?: string
  /** `false` only for the sparkline exemption — every other chart gets a legend by default. */
  legend?: ChartFrameLegend | false
  /**
   * The query behind this chart hasn't resolved yet. Renders `ChartPending` (see its JSDoc for the
   * three-state "nothing to draw" rationale) over the full plot rect in place of `children`,
   * suppresses the legend entirely (a legend naming a series with nothing yet to point at is its
   * own small lie), and marks the outer container `aria-busy="true"`.
   */
  isPending?: boolean
  /**
   * Accessible text alternative for the chart, applied as `aria-label` (+ `role="group"`) on the
   * outer container so screen readers announce something other than an unlabeled graphic. Every
   * kind composing `ChartFrame` should accept and forward this from its own props.
   *
   * MUST stay `role="group"`, never `role="img"`. Per the ARIA spec, every descendant of an
   * `role="img"` element is presentational, which erases the `HoverOverlay`'s `role="slider"` from
   * the accessibility tree entirely — a screen reader announces the label and then the
   * keyboard-scrubbable slider underneath it is simply unreachable, silently, with no error
   * anywhere. `role="group"` announces the same label while keeping descendants exposed. Do not
   * "simplify" this back to `img` — it looks like a no-op refactor and it is not.
   */
  ariaLabel?: string
  /** Draw the SVG marks given the plot rect that already excludes the legend band, plus the set
   * of series keys the legend has toggled off. */
  children: (plot: PlotRect) => ReactNode
}

/** What `ChartFrame` hands its child: the resolved plot rect plus legend-toggle state. */
export type PlotRect = {
  width: number
  height: number
  hidden: ReadonlySet<string>
}

const outerStyle = (fill: boolean, vertical: boolean): CSSProperties => ({
  width: '100%',
  height: fill ? '100%' : undefined,
  display: 'flex',
  flexDirection: vertical ? 'row' : 'column',
})

const legendWrapperStyle = (vertical: boolean): CSSProperties => ({
  flexShrink: 0,
  width: vertical ? undefined : '100%',
})

/** A kind's own hover-dim wiring, merged into the resolved `ChartFrameLegend`. Kinds without
 * per-series highlight state (single-series `ZonedLine`, `DualPanel`) omit this. */
export type ChartFrameLegendHover = {
  highlighted: string | null
  onHighlight: (key: string | null) => void
}

/**
 * Merges a kind's consumer-facing {@link ChartLegendConfig} (the `legend` prop every kind exposes)
 * with the kind's own hover-dim wiring into the `ChartFrame`-facing {@link ChartFrameLegend}. This
 * is the one merge every kind performs: consumer `placement`/`groups`/`maxRows` (or the defaults)
 * plus the kind's `highlighted`/`onHighlight`, which a consumer may not set directly.
 * `config === false` disables the legend regardless of `hover` (the sparkline escape).
 *
 * A single-entry legend is pure noise — it only ever restates the chart's own title ("— BTC
 * price" under a chart already titled "BTC price"), costs a legend row of vertical space, and its
 * one toggle can blank the whole plot. So when `seriesCount` is passed, is `<= 1`, AND the caller
 * passed no explicit config (`undefined` — NOT `{}`, which is a deliberate opt-in), the legend is
 * suppressed automatically. `config === undefined` is the load-bearing check: a kind that composes
 * `ChartFrame` directly without threading `seriesCount` through (e.g. `DualPanel`) simply omits
 * the third argument and keeps today's behaviour.
 */
export function resolveLegend(
  config: ChartLegendConfig | false | undefined,
  hover?: ChartFrameLegendHover,
  seriesCount?: number,
): ChartFrameLegend | false {
  if (config === false) return false
  if (config === undefined && seriesCount !== undefined && seriesCount <= 1) return false
  return {
    placement: config?.placement ?? 'bottom',
    ...(config?.groups !== undefined && { groups: config.groups }),
    ...(config?.maxRows !== undefined && { maxRows: config.maxRows }),
    ...(config?.toggle !== undefined && { toggle: config.toggle }),
    ...(hover !== undefined && { highlighted: hover.highlighted, onHighlight: hover.onHighlight }),
  }
}

/**
 * The measuring, legend-owning shell every non-sparkline chart composes. Supersedes
 * `ResponsiveChart`'s job and adds the two things it lacked: it observes height (via
 * `useChartSize`, which already measures it) and it reserves the legend band out of the plot
 * rect via a second, independent `useChartSize` on the legend's own wrapper div. The legend
 * `<div>` wraps (`ChartLegend`'s `flexWrap`), so its measured band grows as entries wrap and the
 * plot shrinks accordingly — the plot can never overlap the legend because the legend's measured
 * band is always subtracted first.
 *
 * Layout-only: it does not know lines from bars (that stays in the kind), so it is not a
 * Recharts god-component. Render the child only when the resolved plot rect is non-empty.
 */
export function ChartFrame({
  series,
  height,
  aspectRatio,
  fill = false,
  minWidth = DEFAULT_MIN_WIDTH,
  chartId,
  legend = {},
  ariaLabel,
  isPending = false,
  children,
}: ChartFrameProps): ReactNode {
  const { ref: containerRef, width: containerW, height: containerH } = useChartSize()
  const { ref: legendRef, width: legendW, height: legendH } = useChartSize()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())

  const toggleKey = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const placement = legend === false ? 'bottom' : (legend.placement ?? 'bottom')
  const vertical = placement === 'left' || placement === 'right'
  const legendVisible = legend !== false && !isPending

  const resolvedHeight = fill
    ? containerH
    : aspectRatio !== undefined
      ? Math.round(containerW / aspectRatio)
      : (height ?? DEFAULT_HEIGHT)

  const sideLegendWidth = legendVisible && vertical ? legendW : 0
  const topBottomLegendHeight = legendVisible && !vertical ? legendH : 0

  const plot = {
    width: Math.max(containerW - sideLegendWidth, minWidth),
    height: resolvedHeight - topBottomLegendHeight,
  }

  const legendItems = legend === false ? [] : deriveLegend(series)
  const togglable = legend !== false && (legend.toggle ?? legendItems.length > 1)

  const legendNode =
    legend === false || isPending ? null : (
      <div ref={legendRef} style={legendWrapperStyle(vertical)}>
        <ChartLegend
          items={legendItems}
          placement={placement}
          hidden={hidden}
          {...(togglable && { onToggle: toggleKey })}
          {...(chartId !== undefined && { chartId })}
          {...(legend.groups !== undefined && { groups: legend.groups })}
          {...(legend.maxRows !== undefined && { maxRows: legend.maxRows })}
          {...(legend.highlighted !== undefined && { highlighted: legend.highlighted })}
          {...(legend.onHighlight !== undefined && { onHighlight: legend.onHighlight })}
        />
      </div>
    )

  return (
    <div
      ref={containerRef}
      style={outerStyle(fill, vertical)}
      {...(ariaLabel !== undefined && { role: 'group', 'aria-label': ariaLabel })}
      {...(isPending && { 'aria-busy': 'true' })}
    >
      {legendNode !== null && (placement === 'top' || placement === 'left') && legendNode}
      {plot.width > 0 &&
        plot.height > 0 &&
        (isPending ? (
          <ChartPending width={plot.width} height={plot.height} />
        ) : (
          children({ ...plot, hidden })
        ))}
      {legendNode !== null && (placement === 'bottom' || placement === 'right') && legendNode}
    </div>
  )
}
