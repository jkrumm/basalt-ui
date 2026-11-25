/**
 * The bare engine mount — the ONLY module that imports `@tanstack/charts/react`
 * (a `no-restricted-imports` override in `/.oxlintrc.json`). It knows a compiled definition, a size and an accessible name, and
 * nothing about legends, placeholders or cards (`docs/V2-SPEC.md` § 9.2).
 *
 * The engine fills a CSS-owned {@link ChartBox} and measures it, so the box is final in the server
 * HTML and hydration only redraws the svg inside it (W10). The server svg is drawn for the server
 * frame (`useServerFrame`: `INITIAL_WIDTH`, or what a card leaves of it), and only the server pass
 * (the server render and the hydration render that must match it) hands the engine the height the
 * box resolves to in that frame, so the picture is the box's size rather than the engine's 640 x 320
 * scaled into it; once hydrated the engine measures the box again. Text is measured from
 * basalt's label widths on both sides ({@link measureChartText}), so the gutters agree.
 */
import { Chart } from '@tanstack/charts/react/tooltip'
import type { ChartProps } from '@tanstack/charts/react/tooltip'
import type { ChartValue } from '@tanstack/charts/types/core'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { CartesianDefinition } from './core/compile'
import {
  measuredPlots,
  plotLeftOf,
  plotSizesOf,
  readsPlot,
  recordPlots,
  watchPlotReads,
} from './core/plot-context'
import type { PlotSizes } from './core/plot-context'
import { boxHeightAt, ChartBox } from './box'
import type { ChartBoxHeight } from './box'
import { useServerFrame } from './sizing'
import { measureChartText } from './text-measure'
import { isRich } from './core/rich-tooltip'
import { RichTooltipBody } from './tooltip-body'

export type ChartEngineProps = {
  definition: CartesianDefinition
  ariaLabel: string
  /** The box height: the law when omitted, a number when fixed (see {@link ChartBoxHeight}). */
  height?: ChartBoxHeight
  /** Scopes the SVG resources (clip paths, gradients) — the chart's `useId`, sanitized. */
  idPrefix: string
  /** `touch-action: pan-y`: a vertical swipe across the chart still scrolls the page. */
  coarse: boolean
  /** The laid-out plot area of every pane after each layout, in px; fires only for a definition
   * whose `marks` read it (and once more for a read that comes after the measurement). */
  onPlot?: (sizes: PlotSizes) => void
  /** Told where the plot starts from the chart's left edge (the y axis' margin), px, after every layout. */
  onPlotLeft?: ((left: number) => void) | undefined
  /** The engine's focused point (pointer or arrow keys) as its datum; `null` when it leaves. */
  onFocusDatum?: ((datum: unknown) => void) | undefined
}

/** The engine props of a basalt definition (`CartesianDefinition`'s datum and value types). */
type EngineProps = ChartProps<unknown, ChartValue, number>

/** `currentColor` is the axis ink. The font is the proportional sans with tabular figures (Wave 35
 * law: tabular in axis ticks, mono only for captions, times and code); `--basalt-chart-font` retunes
 * the face from outside. It is inherited by the svg; the engine measures text with the default
 * sans's label widths ({@link measureChartText}), not the computed face. */
const HOST_STYLE: CSSProperties = {
  // Overrides the host's own fallback height: the box decides, the engine measures it.
  height: '100%',
  color: 'var(--basalt-ink-faint)',
  fontFamily: 'var(--basalt-chart-font, var(--basalt-font-sans))',
  fontVariantNumeric: 'tabular-nums',
}
const COARSE_STYLE: CSSProperties = { ...HOST_STYLE, touchAction: 'pan-y' }

const subscribeNever = (): (() => void) => () => {}
/** `true` on the server and through the hydration pass, `false` from the first client render on. */
const useServerPass = (): boolean =>
  useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true,
  )

export function ChartEngine({
  definition,
  ariaLabel,
  height,
  idPrefix,
  coarse,
  onPlot,
  onPlotLeft,
  onFocusDatum,
}: ChartEngineProps): ReactElement {
  useEffect(() => {
    if (!onPlot) return
    watchPlotReads(definition, () => {
      // A microtask: the read happens inside the engine's build, which may sit in a React render.
      queueMicrotask(() => {
        const sizes = measuredPlots(definition)
        if (sizes) onPlot(sizes)
      })
    })
    return () => watchPlotReads(definition, undefined)
  }, [definition, onPlot])
  // Stable, so the engine does not re-register its render hook on every chart render.
  const onRender = useMemo<EngineProps['onRender']>(
    () =>
      onPlot &&
      ((context) => {
        const sizes = plotSizesOf(context.scene)
        recordPlots(definition, sizes)
        if (readsPlot(definition)) onPlot(sizes)
        const left = plotLeftOf(context.scene)
        if (left !== undefined) onPlotLeft?.(left)
      }),
    [onPlot, onPlotLeft, definition],
  )
  const frame = useServerFrame()
  const serverHeight = useServerPass()
    ? (boxHeightAt(height, frame.width) ?? frame.height)
    : undefined
  return (
    <ChartBox height={height}>
      <Chart
        definition={definition}
        ariaLabel={ariaLabel}
        initialWidth={frame.width}
        {...(serverHeight !== undefined && { height: serverHeight })}
        measureText={measureChartText}
        idPrefix={idPrefix}
        className="basalt-chart"
        {...(onRender && { onRender })}
        {...(onFocusDatum && {
          onFocusChange: (point: { datum: unknown } | null) => onFocusDatum(point?.datum ?? null),
        })}
        {...(isRich(definition) && { renderTooltipBody: richBody })}
        style={coarse ? COARSE_STYLE : HOST_STYLE}
      />
    </ChartBox>
  )
}

/** A rich definition's tooltip body (`core/rich-tooltip.ts`): its rows with their change, status and reference. */
const richBody: NonNullable<EngineProps['renderTooltipBody']> = ({ content }) => (
  <RichTooltipBody content={content} />
)

/** Scopes the engine's SVG resource ids per chart instance (`useId` output carries colons). */
export const idPrefixOf = (id: string, prefix = 'chart'): string =>
  `basalt-${prefix}-${id.replaceAll(/[^\w-]/g, '')}`
