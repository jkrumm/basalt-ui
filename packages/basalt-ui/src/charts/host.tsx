/**
 * The bare engine mount — the ONLY module that imports `@tanstack/charts/react`
 * (`basalt/chart-host-single`). It knows a compiled definition, a size and an accessible name, and
 * nothing about legends, placeholders or cards (`docs/V2-SPEC.md` § 9.2).
 */
import { Chart } from '@tanstack/charts/react'
import type { CSSProperties, ReactElement } from 'react'
import type { CartesianDefinition } from './compile'
import { INITIAL_WIDTH } from './sizing'

export type ChartEngineProps = {
  definition: CartesianDefinition
  ariaLabel: string
  height: number
  /** Scopes the SVG resources (clip paths, gradients) — the chart's `useId`, sanitized. */
  idPrefix: string
  /** `touch-action: pan-y`: a vertical swipe across the chart still scrolls the page. */
  coarse: boolean
}

/** `currentColor` is the axis ink. The font is pinned to mono (the 1.x tick look) and inherited by
 * the svg — TanStack measures guides with the host's computed font. */
const HOST_STYLE: CSSProperties = {
  color: 'var(--vx-axis)',
  fontFamily: 'var(--basalt-font-mono)',
}
const COARSE_STYLE: CSSProperties = { ...HOST_STYLE, touchAction: 'pan-y' }

export function ChartEngine({
  definition,
  ariaLabel,
  height,
  idPrefix,
  coarse,
}: ChartEngineProps): ReactElement {
  return (
    <Chart
      definition={definition}
      ariaLabel={ariaLabel}
      height={height}
      initialWidth={INITIAL_WIDTH}
      idPrefix={idPrefix}
      className="basalt-chart"
      style={coarse ? COARSE_STYLE : HOST_STYLE}
    />
  )
}
