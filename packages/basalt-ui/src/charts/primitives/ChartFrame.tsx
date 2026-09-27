import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BasaltProps } from '../../common/props'
import { deprecatedProp, ignoredProp, plotBelowFloor } from '../../common/errors'
import { useValidateProps } from '../../common/validate'
import { SizeClassHintContext, useSizeClass } from '../../shell/use-size-class'
import { VX } from '../../tokens'
import { useChartSize } from '../hooks/useChartSize'
import { deriveLegend } from '../series'
import type { ChartLegendConfig, LegendPlacement, SeriesStyle } from '../series'
import { ChartCardContext } from './chart-card-context'
import { resolveChartLayout, resolveFrameClass } from './chart-layout'
import {
  deprecatedHeightKeys,
  resolveFrameHeight,
  resolveLegendRollup,
  resolvePlotRect,
} from './chart-frame-layout'
import type { ResponsiveChartHeight } from './chart-frame-layout'
import { ChartTierProvider, useCoarsePointer, useViewportHeight } from './chart-tier'
import { ChartLegend } from './ChartLegend'
import { ChartEmpty, ChartError, ChartPending, resolveChartState } from './ChartPending'
import type { ChartState } from './ChartPending'

/** Re-exported for `ChartFrame.test.tsx` and any other consumer that previously reached these
 * through `ChartFrame` — the layout math itself lives in `./chart-frame-layout` (pure, DOM-free). */
export {
  legendEntryCap,
  resolveLegendRollup,
  resolvePlotRect,
  resolveChartTier,
} from './chart-frame-layout'
export type { ResponsiveChartHeight } from './chart-frame-layout'

const DEFAULT_MIN_WIDTH = 200

/** Legend configuration for {@link ChartFrame}. Omit entirely (or pass `{}`) for the default
 * bottom-placed legend; pass `false` only for the sparkline exemption. */
export type ChartFrameLegend = {
  /** Default 'bottom'. */
  placement?: LegendPlacement
  /**
   * @deprecated Removed in 1.31.0 — the legend now fits by measured width every time and folds
   * overflow into an `All N` disclosure (`docs/waves/RESPONSIVE-SPEC.md` §4); drop the prop.
   *
   * Until then an explicit value still WINS OUTRIGHT over the measured fit, and it counts ENTRIES,
   * not rows: `maxRows: 3` on a 7-entry legend renders three entries. Under `fill` the PLOT yields
   * the height ({@link resolvePlotRect}'s `legendWins`).
   */
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
  /** Forces the header legend's render, overriding the resolver's own 'dots'/'chips' pick. */
  mode?: 'dots' | 'chips'
}

export type ChartFrameProps = BasaltProps & {
  /** Series identity — drives the derived legend. Pass the SAME array the kind draws + tooltips from. */
  series: readonly SeriesStyle[]
  /**
   * Height in pixels, or one per container step. Used when neither `aspectRatio` nor `fill` is set.
   * Default: derived from the measured width and container class (`resolveChartLayout`). Inside a
   * `ChartCard` the resulting height is a MINIMUM — the frame grows into a taller card body. Passing it WITH `fill` is a wiring mistake, not a fallback — `fill` wins and
   * this is never read, which now warns once in dev (`common/errors.ts`' `ignoredProp`).
   *
   * `{ base: 180, wide: 260 }` is the declarative escape from a page of fixed-height charts: the
   * `regular`/`wide` steps are compared against the frame's own MEASURED width, not the viewport,
   * so a chart squeezed by a `PageAside` gets the short height on a desktop too. A plain number is
   * an override and stays supported ({@link resolveFrameHeight}); one that leaves the plot under
   * `VX.minPlotHeight` warns once in dev.
   */
  height?: number | ResponsiveChartHeight
  /** height = Math.round(containerWidth / aspectRatio). Ignored when `fill` is set — which warns
   * once in dev, for the same reason `height` does. */
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
   *
   * An alias for `state={{ pending: true }}` and staying that way — it predates {@link ChartState}
   * and every kind forwards it.
   */
  isPending?: boolean
  /**
   * The three "nothing to draw" states in one prop — the shape a query result already has. Wins
   * over `isPending`, which stays a supported alias for `state={{ pending: true }}`. Precedence is
   * pending → error → empty ({@link resolveChartState}); each renders its own placeholder over the
   * full plot rect in place of `children` and suppresses the legend, and only `pending` marks the
   * container `aria-busy`.
   */
  state?: ChartState
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

/** `ResponsiveChartHeight`'s deprecated keys and what replaces each. */
const DEPRECATED_HEIGHT_KEYS = {
  sm: 'height.regular',
  md: 'height.wide',
  lg: 'height.wide',
} as const

/** The thresholds moved with the keys — a straight rename would silently shift the breakpoints. */
const DEPRECATED_HEIGHT_NOTES = {
  sm: 'It applied from 768px; `regular` applies from 480px of the frame width.',
  md: 'It applied from 992px; `wide` is one step, from 800px of the frame width.',
  lg: 'It applied from 1200px; `wide` is one step, from 800px of the frame width.',
} as const

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
    ...(config?.mode !== undefined && { mode: config.mode }),
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
 * band is always subtracted first. It also can never shrink to nothing: {@link resolvePlotRect}
 * floors it at `VX.minPlotHeight` and the frame grows, or under `fill` the legend rolls up
 * ({@link legendEntryCap}).
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
  state,
  className,
  style,
  children,
}: ChartFrameProps): ReactNode {
  const { ref: containerRef, width: containerW, height: containerH } = useChartSize()
  const { ref: legendRef, width: legendW, height: legendH } = useChartSize()
  const { ref: slotRef, width: slotMeasuredW } = useChartSize()
  const { inCard, legendSlot, short: cardShort } = useContext(ChartCardContext)
  // The card's header slot is observed like the frame is: its width is what a header legend fits.
  useLayoutEffect(() => {
    slotRef(legendSlot)
    return () => slotRef(null)
  }, [legendSlot, slotRef])
  const viewportClass = useSizeClass()
  // No `BasaltProvider` (a charts-only consumer) means no viewport hint: the unmeasured first frame
  // resolves to the regular (desktop) class, not phone chrome.
  const sizeClass = useContext(SizeClassHintContext) === undefined ? 'medium' : viewportClass
  const coarse = useCoarsePointer()
  const viewportH = useViewportHeight()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())

  const toggleKey = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // The three sizing props are mutually exclusive and `fill` wins, silently — the type cannot say
  // so without a union prop, which is a bigger change than a patch carries. Warn instead: a
  // consumer passed `height` alongside `fill` for the life of a file and kept eight height
  // constants (and a whole `compact` branch) that never moved a pixel, with nothing from tsc,
  // oxlint or check-theme saying a word.
  useValidateProps(
    'ChartFrame',
    () => [
      fill && height !== undefined
        ? ignoredProp(
            'ChartFrame',
            'height',
            "`fill` is set — a fill frame takes its parent cell's measured height. Pass one or the other.",
          )
        : null,
      fill && aspectRatio !== undefined
        ? ignoredProp(
            'ChartFrame',
            'aspectRatio',
            "`fill` is set — a fill frame takes its parent cell's measured height. Pass one or the other.",
          )
        : null,
    ],
    [fill, height, aspectRatio],
  )
  useValidateProps(
    'ChartFrame',
    () =>
      height === undefined
        ? null
        : deprecatedHeightKeys(height).map((key) =>
            deprecatedProp(
              'ChartFrame',
              `height.${key}`,
              DEPRECATED_HEIGHT_KEYS[key],
              '1.31.0',
              DEPRECATED_HEIGHT_NOTES[key],
            ),
          ),
    [height],
  )

  const placement = legend === false ? 'bottom' : (legend.placement ?? 'bottom')
  const vertical = placement === 'left' || placement === 'right'
  // Every non-null state replaces the plot, and all three suppress the legend for one reason: a
  // legend naming a series with nothing to point at is its own small lie.
  const resolvedState = resolveChartState({ ...(state !== undefined && { state }), isPending })
  const legendVisible = legend !== false && resolvedState === null
  const legendItems = legend === false ? [] : deriveLegend(series)
  useValidateProps(
    'ChartFrame',
    () =>
      // A cap covering every entry rolls nothing up — it is how `Donut` states "never roll up".
      legend !== false && legend.maxRows !== undefined && legend.maxRows < legendItems.length
        ? deprecatedProp(
            'ChartFrame',
            'legend.maxRows',
            'nothing (the legend fits by measured width)',
            '1.31.0',
            'Overflow folds into an `All N` disclosure; an explicit value still wins this release.',
          )
        : null,
    [legend, legendItems.length],
  )
  const statedHeight =
    height === undefined
      ? undefined
      : resolveFrameHeight(height, resolveFrameClass({ frameW: containerW, sizeClass }))
  // Memoized on scalars (the legend by its keys+labels) so `ChartTierProvider`'s value is stable
  // across renders that change nothing. No slot (or not measured yet) → `slotW` 0 → a band.
  const slotW = legendSlot === null ? 0 : slotMeasuredW
  const legendKey = legendItems.map((item) => `${item.key}\u0000${item.label}`).join('\u0001')
  const layout = useMemo(
    () =>
      resolveChartLayout({
        frameW: containerW,
        slotW,
        viewportH,
        legendItems,
        yLabels: [],
        xLabels: [],
        categorical: false,
        sizeClass,
        coarse,
        cardShort,
        ...(statedHeight !== undefined && { override: { height: statedHeight } }),
      }),
    // `legendItems` is a fresh array per render; `legendKey` is its identity.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [containerW, slotW, viewportH, legendKey, sizeClass, coarse, cardShort, statedHeight],
  )

  // The resolver gates every placement: none at micro (a side legend included), else the card's
  // header slot when there is one, or a band. A side legend keeps its own column for the rest.
  const fit = layout.legend.mode === 'dots' || layout.legend.mode === 'chips' ? layout.legend : null
  // An explicit `legend.mode` (the escape hatch back to labels for a consumer whose chart lands in
  // a short card but still wants them) always wins over the resolver's own 'dots'/'chips' pick.
  const legendMode = legend !== false ? (legend.mode ?? fit?.mode) : fit?.mode
  const showLegend = legendVisible && fit !== null
  const inHeader = showLegend && !vertical && legendSlot !== null && fit?.where === 'header'
  const sideLegendWidth = showLegend && vertical ? legendW : 0
  const topBottomLegendHeight = showLegend && !vertical && !inHeader ? legendH : 0

  const computedHeight =
    aspectRatio !== undefined ? Math.round(containerW / aspectRatio) : layout.height
  // In a card the computed height is a floor: a stretched grid row hands the body more, and the
  // frame (flex 1 in the body) takes it. Never below what the legend band plus the plot floor need.
  const grows = inCard && !fill
  const resolvedHeight = fill
    ? containerH
    : grows
      ? Math.max(computedHeight, containerH)
      : computedHeight
  const cardMinHeight = Math.max(computedHeight, VX.minPlotHeight + topBottomLegendHeight)

  useValidateProps(
    'ChartFrame',
    () =>
      typeof height === 'number' &&
      !fill &&
      aspectRatio === undefined &&
      height - topBottomLegendHeight < VX.minPlotHeight
        ? plotBelowFloor('ChartFrame', height, VX.minPlotHeight)
        : null,
    [height, fill, aspectRatio, topBottomLegendHeight],
  )
  const togglable = legend !== false && (legend.toggle ?? legendItems.length > 1)

  // The cap, and who pays for it — one pure decision ({@link resolveLegendRollup} states the three
  // cases and why the composition, not either half, is what shipped broken). A fixed-height frame
  // grows around its legend; a `fill` one cannot, so its legend rolls up to the measured fit
  // instead of eating the plot — unless the caller stated a number, which nothing trims and the
  // plot pays for. Top/bottom only: a side legend costs width, not height.
  const { maxRows, legendWins } = resolveLegendRollup({
    ...(legend !== false && legend.maxRows !== undefined && { statedMaxRows: legend.maxRows }),
    ...(!vertical && fit !== null && fit.overflow > 0 && { fittedMaxRows: fit.visible }),
    fillBand: showLegend && fill && !inHeader && !vertical,
    items: legendItems,
    containerW,
    available: resolvedHeight - VX.minPlotHeight,
  })

  const plot = resolvePlotRect({
    containerW,
    resolvedHeight,
    minWidth,
    sideLegendWidth,
    topBottomLegendHeight,
    ...(legendWins && { legendWins }),
  })

  const legendNode =
    legend === false || resolvedState !== null || !showLegend ? null : (
      <div ref={legendRef} style={legendWrapperStyle(vertical)}>
        <ChartLegend
          items={legendItems}
          placement={placement}
          hidden={hidden}
          {...(togglable && { onToggle: toggleKey })}
          {...(chartId !== undefined && { chartId })}
          {...(legend.groups !== undefined && { groups: legend.groups })}
          {...(maxRows !== undefined && { maxRows })}
          {...(legendMode !== undefined && { mode: legendMode })}
          {...(legend.highlighted !== undefined && { highlighted: legend.highlighted })}
          {...(legend.onHighlight !== undefined && { onHighlight: legend.onHighlight })}
        />
      </div>
    )

  return (
    <ChartTierProvider containerClass={layout.containerClass} layout={layout}>
      <div
        ref={containerRef}
        {...(className !== undefined && { className })}
        style={{
          ...outerStyle(fill, vertical),
          ...(grows && { flex: '1 1 0', minHeight: cardMinHeight }),
          ...style,
        }}
        {...(ariaLabel !== undefined && { role: 'group', 'aria-label': ariaLabel })}
        {...(resolvedState === 'pending' && { 'aria-busy': 'true' })}
      >
        {inHeader &&
          legendNode !== null &&
          legendSlot !== null &&
          createPortal(legendNode, legendSlot)}
        {!inHeader &&
          legendNode !== null &&
          (placement === 'top' || placement === 'left') &&
          legendNode}
        {plot.width > 0 &&
          plot.height > 0 &&
          (resolvedState === 'pending' ? (
            <ChartPending width={plot.width} height={plot.height} />
          ) : resolvedState === 'error' ? (
            <ChartError width={plot.width} height={plot.height} error={state?.error} />
          ) : resolvedState === 'empty' ? (
            <ChartEmpty
              width={plot.width}
              height={plot.height}
              {...(typeof state?.empty === 'string' && { label: state.empty })}
            />
          ) : (
            children({ ...plot, hidden })
          ))}
        {!inHeader &&
          legendNode !== null &&
          (placement === 'bottom' || placement === 'right') &&
          legendNode}
      </div>
    </ChartTierProvider>
  )
}
