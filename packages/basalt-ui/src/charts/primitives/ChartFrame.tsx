import type { CSSProperties, ReactNode } from 'react'
import { useChartSize } from '../hooks/useChartSize'
import { deriveLegend } from '../series'
import type { ChartLegendConfig, LegendPlacement, SeriesStyle } from '../series'
import { ChartLegend } from './ChartLegend'

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
  /** Draw the SVG marks given the plot rect that already excludes the legend band. */
  children: (plot: { width: number; height: number }) => ReactNode
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
 */
export function resolveLegend(
  config: ChartLegendConfig | false | undefined,
  hover?: ChartFrameLegendHover,
): ChartFrameLegend | false {
  if (config === false) return false
  return {
    placement: config?.placement ?? 'bottom',
    ...(config?.groups !== undefined && { groups: config.groups }),
    ...(config?.maxRows !== undefined && { maxRows: config.maxRows }),
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
  children,
}: ChartFrameProps): ReactNode {
  const { ref: containerRef, width: containerW, height: containerH } = useChartSize()
  const { ref: legendRef, width: legendW, height: legendH } = useChartSize()

  const placement = legend === false ? 'bottom' : (legend.placement ?? 'bottom')
  const vertical = placement === 'left' || placement === 'right'

  const resolvedHeight = fill
    ? containerH
    : aspectRatio !== undefined
      ? Math.round(containerW / aspectRatio)
      : (height ?? DEFAULT_HEIGHT)

  const sideLegendWidth = legend !== false && vertical ? legendW : 0
  const topBottomLegendHeight = legend !== false && !vertical ? legendH : 0

  const plot = {
    width: Math.max(containerW - sideLegendWidth, minWidth),
    height: resolvedHeight - topBottomLegendHeight,
  }

  const legendNode =
    legend === false ? null : (
      <div ref={legendRef} style={legendWrapperStyle(vertical)}>
        <ChartLegend
          items={deriveLegend(series)}
          placement={placement}
          {...(chartId !== undefined && { chartId })}
          {...(legend.groups !== undefined && { groups: legend.groups })}
          {...(legend.maxRows !== undefined && { maxRows: legend.maxRows })}
          {...(legend.highlighted !== undefined && { highlighted: legend.highlighted })}
          {...(legend.onHighlight !== undefined && { onHighlight: legend.onHighlight })}
        />
      </div>
    )

  return (
    <div ref={containerRef} style={outerStyle(fill, vertical)}>
      {legendNode !== null && (placement === 'top' || placement === 'left') && legendNode}
      {plot.width > 0 && plot.height > 0 ? children(plot) : null}
      {legendNode !== null && (placement === 'bottom' || placement === 'right') && legendNode}
    </div>
  )
}
