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
import { MAIN_PANE, measuredPlots, readsPlot, recordPlots, watchPlotReads } from './plot-context'
import type { PlotSize, PlotSizes } from './plot-context'
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
        const sizes = measurePlots(context)
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
        style={coarse ? COARSE_STYLE : HOST_STYLE}
      />
    </ChartBox>
  )
}

/** Scopes the engine's SVG resource ids per chart instance (`useId` output carries colons). */
export const idPrefixOf = (id: string, prefix = 'chart'): string =>
  `basalt-${prefix}-${id.replaceAll(/[^\w-]/g, '')}`

type RenderContext = Parameters<NonNullable<EngineProps['onRender']>>[0]

const sizeOf = (width: number, height: number): PlotSize => ({ width, height })

/**
 * The laid-out plot area of each pane. A single chart is the scene's own `chart` bounds. A composed
 * chart's panes are laid out inside the engine's view composition and not exposed on the scene, so
 * each pane's plot is the rect of its marks clip (`<owner>:<pane>:marks:clip-defs`), which the
 * rung's `clip: true` makes the plot exactly.
 */
function measurePlots({ scene, svg }: RenderContext): PlotSizes {
  const views = svg.querySelectorAll('g.ts-chart__view')
  if (views.length === 0) return { [MAIN_PANE]: sizeOf(scene.chart.width, scene.chart.height) }
  const sizes: Record<string, PlotSize> = {}
  for (const view of views) {
    const base = view.getAttribute('data-ts-key')?.replace(/view$/, '')
    const clip = base && view.querySelector(`[data-ts-key="${base}marks:clip-defs"] rect`)
    const pane = base?.split(':').at(-2)
    if (!pane || !clip) continue
    sizes[pane] = sizeOf(Number(clip.getAttribute('width')), Number(clip.getAttribute('height')))
  }
  return sizes
}
