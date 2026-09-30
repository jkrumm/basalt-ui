import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BasaltProps } from '../../common/props'
import {
  deprecatedProp,
  ignoredProp,
  legendSlotContention,
  plotBelowFloor,
} from '../../common/errors'
import { reportOnce, useValidateProps } from '../../common/validate'
import { SizeClassHintContext, useSizeClass } from '../../shell/use-size-class'
import { VX } from '../../tokens'
import { useChartSize } from '../hooks/useChartSize'
import { deriveLegend } from '../series'
import type { ChartLegendConfig, LegendPlacement, SeriesStyle } from '../series'
import { ChartCardContext } from './chart-card-context'
import { resolveChartLayout, resolveFrameClass } from './chart-layout'
import { resolveFrameHeight, resolveLegendRollup, resolvePlotRect } from './chart-frame-layout'
import type { ResponsiveChartHeight } from './chart-frame-layout'
import { ChartTierProvider, useCoarsePointer, useViewportHeight } from './chart-tier'
import { ChartLegend } from './ChartLegend'
import { ChartEmpty, ChartError, ChartPending, resolveChartState } from './ChartPending'
import type { ChartState } from './ChartPending'

/** Re-exported for `ChartFrame.test.tsx` and any other consumer that previously reached these
 * through `ChartFrame` — the layout math itself lives in `./chart-frame-layout` (pure, DOM-free). */
export { legendEntryCap, resolveLegendRollup, resolvePlotRect } from './chart-frame-layout'
export type { ResponsiveChartHeight } from './chart-frame-layout'

const DEFAULT_MIN_WIDTH = 200

/** Legend configuration for {@link ChartFrame}. Omit entirely (or pass `{}`) for the default
 * bottom-placed legend; pass `false` only for the sparkline exemption. */
export type ChartFrameLegend = {
  /** Default 'bottom'. */
  placement?: LegendPlacement
  /**
   * @deprecated Removed in 1.32.0 — the legend now fits by measured width every time and folds
   * overflow into an `All N` disclosure (`docs/CHARTS-SPEC.md` §8); drop the prop.
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
  /**
   * Internal escape hatch for a kind that never wants its legend portalled into a `ChartCard`
   * header, whatever the placement — `Donut` sets this (`docs/waves/PLAN.md` wave 3, P1-4): its
   * side/bottom legend is the ring's only key, so it must stay under or beside the ring rather than
   * follow every other frame's default of claiming an available header slot. `false` keeps the
   * legend in its own band regardless of `placement`; omitted (default) behaves as today. Not
   * something a consumer composing a kind's own `legend` prop can reach — kinds compose `ChartFrame`
   * directly to set it.
   */
  headerSlot?: boolean
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
  /** Whether THIS frame's legend is currently portalled into a `ChartCard` header slot — a chart
   * composing `ChartFrame` (e.g. `CartesianChart`'s end labels, R2C-10) reads this to skip a
   * band-legend-only affordance once the header already names every series for free. */
  legendInHeader: boolean
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
  const {
    inCard,
    legendSlot,
    short: cardShort,
    legendOwner,
    dispatchLegendSlot,
  } = useContext(ChartCardContext)
  const frameId = useId()
  const [slotSeedW, setSlotSeedW] = useState(0)
  const placement = legend === false ? 'bottom' : (legend.placement ?? 'bottom')
  const vertical = placement === 'left' || placement === 'right'
  // `Donut` sets `headerSlot: false` (P1-4) — it never wants the slot, so it must never CLAIM it
  // either, or it would silently deny a sibling frame in the same card that does want it. A
  // vertical (left/right) legend never portals into the header either (`inHeader` below requires
  // `!vertical`), so it must not claim the slot from a sibling that could actually use it.
  const wantsHeaderSlot =
    legendSlot !== null && legend !== false && legend.headerSlot !== false && !vertical
  // Every non-null state replaces the plot, and all three suppress the legend for one reason: a
  // legend naming a series with nothing to point at is its own small lie.
  const resolvedState = resolveChartState({ ...(state !== undefined && { state }), isPending })
  const legendVisible = legend !== false && resolvedState === null
  // Ownership is DERIVED from the card's claimant queue (`legendSlotReducer`), never mirrored here:
  // the first frame to claim owns the slot, a later one is denied until everything ahead of it
  // releases, and each frame's only job is to claim while it wants the slot and release on the way
  // out (P2-9).
  const ownsSlot = wantsHeaderSlot && legendOwner === frameId
  const slotDenied = wantsHeaderSlot && legendOwner !== null && !ownsSlot
  useLayoutEffect(() => {
    if (!wantsHeaderSlot) return undefined
    dispatchLegendSlot({ type: 'claim', id: frameId })
    return () => dispatchLegendSlot({ type: 'release', id: frameId })
  }, [wantsHeaderSlot, frameId, dispatchLegendSlot])
  useLayoutEffect(() => {
    if (slotDenied && legendVisible) reportOnce('ChartFrame', legendSlotContention('ChartFrame'))
  }, [slotDenied, legendVisible])
  // Only the owner observes the slot — its width is what a header legend fits. Seeded synchronously
  // (P2-8) so the first paint already knows the slot's real width, instead of assuming 0 until the
  // ResizeObserver's first (asynchronous) callback — which is what let a header legend paint once in
  // the band before jumping to the header on every mount.
  useLayoutEffect(() => {
    if (!ownsSlot || legendSlot === null) return undefined
    setSlotSeedW(legendSlot.getBoundingClientRect().width)
    slotRef(legendSlot)
    return () => {
      slotRef(null)
      setSlotSeedW(0)
    }
  }, [ownsSlot, legendSlot, slotRef])
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
            '1.32.0',
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
  // across renders that change nothing. No slot, not the owner, or not measured yet → `slotW` 0 →
  // a band. `slotSeedW` (P2-8) covers the gap before the ResizeObserver's own first callback.
  const slotW = ownsSlot ? Math.max(slotMeasuredW, slotSeedW) : 0
  const groups = legend !== false && legend.groups === true
  // Role and note both feed the resolver (`orderEntries`'s grouping, `legendEntryWidth`'s measured
  // fit), so a change to either — a series moving `role`, a note appearing/disappearing — has to
  // invalidate this memo exactly like a key or label change does; keying on key+label alone missed
  // both and served a stale layout until something else happened to change first.
  const legendKey = legendItems
    .map((item) => `${item.key}\u0000${item.label}\u0000${item.role ?? ''}\u0000${item.note ?? ''}`)
    .join('\u0001')
  const layout = useMemo(
    () =>
      resolveChartLayout({
        frameW: containerW,
        slotW,
        viewportH,
        legendItems,
        sizeClass,
        coarse,
        cardShort,
        groups,
        ...(statedHeight !== undefined && { override: { height: statedHeight } }),
      }),
    // `legendItems` is a fresh array per render; `legendKey` is its identity.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [containerW, slotW, viewportH, legendKey, sizeClass, coarse, cardShort, groups, statedHeight],
  )

  // The resolver gates every placement: none at micro, else the card's header slot when there is
  // one AND this frame owns it (P2-9) — `slotW` is already 0 for a non-owner or a `headerSlot:
  // false` kind (P1-4), so `fit.where` already reads 'band' for both; `ownsSlot` here is only the
  // (harmless) belt to that suspenders.
  const fit = layout.legend.mode === 'dots' || layout.legend.mode === 'chips' ? layout.legend : null
  const legendMode = fit?.mode
  const showLegend = legendVisible && fit !== null
  const inHeader = showLegend && ownsSlot && fit?.where === 'header'
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
    <ChartTierProvider containerClass={layout.containerClass}>
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
            children({ ...plot, hidden, legendInHeader: inHeader })
          ))}
        {!inHeader &&
          legendNode !== null &&
          (placement === 'bottom' || placement === 'right') &&
          legendNode}
      </div>
    </ChartTierProvider>
  )
}
