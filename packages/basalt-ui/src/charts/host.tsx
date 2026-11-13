/**
 * The bare engine mount — the ONLY module that imports `@tanstack/charts/react`
 * (`basalt/chart-host-single`). It knows a compiled definition, a size and an accessible name, and
 * nothing about legends, placeholders or cards (`docs/V2-SPEC.md` § 9.2).
 *
 * The engine is never given a height: it fills a CSS-owned {@link ChartBox} and measures it, so the
 * box is final in the server HTML and hydration only redraws the svg inside it (W10).
 */
import { Chart } from '@tanstack/charts/react'
import type { ChartProps } from '@tanstack/charts/react'
import type { ChartValue } from '@tanstack/charts/types/core'
import { useEffect, useMemo } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { CartesianDefinition } from './compile'
import {
  measuredPlots,
  plotSizesOf,
  readsPlot,
  recordPlots,
  watchPlotReads,
} from './core/plot-context'
import type { PlotSizes } from './core/plot-context'
import { ChartBox } from './box'
import type { ChartBoxHeight } from './box'
import { INITIAL_WIDTH } from './sizing'

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
  /** The engine's focused point (pointer or arrow keys) as its datum; `null` when it leaves. */
  onFocusDatum?: ((datum: unknown) => void) | undefined
}

/** The engine props of a basalt definition (`CartesianDefinition`'s datum and value types). */
type EngineProps = ChartProps<unknown, ChartValue, number>

/** `currentColor` is the axis ink. The font is the proportional sans with tabular figures (Wave 35
 * law: tabular in axis ticks, mono only for captions, times and code); `--basalt-chart-font` retunes
 * the face from outside. It is inherited by the svg —
 * TanStack measures guides with the host's computed font. */
const HOST_STYLE: CSSProperties = {
  // Overrides the host's own fallback height: the box decides, the engine measures it.
  height: '100%',
  color: 'var(--vx-axis)',
  fontFamily: 'var(--basalt-chart-font, var(--basalt-font-sans))',
  fontVariantNumeric: 'tabular-nums',
}
const COARSE_STYLE: CSSProperties = { ...HOST_STYLE, touchAction: 'pan-y' }

export function ChartEngine({
  definition,
  ariaLabel,
  height,
  idPrefix,
  coarse,
  onPlot,
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
      }),
    [onPlot, definition],
  )
  return (
    <ChartBox height={height}>
      <Chart
        definition={definition}
        ariaLabel={ariaLabel}
        initialWidth={INITIAL_WIDTH}
        idPrefix={idPrefix}
        className="basalt-chart"
        {...(onRender && { onRender })}
        {...(onFocusDatum && {
          onFocusChange: (point: { datum: unknown } | null) => onFocusDatum(point?.datum ?? null),
        })}
        style={coarse ? COARSE_STYLE : HOST_STYLE}
      />
    </ChartBox>
  )
}

/** Scopes the engine's SVG resource ids per chart instance (`useId` output carries colons). */
export const idPrefixOf = (id: string, prefix = 'chart'): string =>
  `basalt-${prefix}-${id.replaceAll(/[^\w-]/g, '')}`
