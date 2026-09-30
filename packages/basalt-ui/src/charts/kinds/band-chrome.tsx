import type { ReactNode } from 'react'
import type { BandPlot, BandTooltipConfig } from '../hooks/useBandPlot'
import { AxisBottomDate } from '../primitives/Axes'
import { ChartTooltipFloat, TooltipBody, TooltipHeader } from '../primitives/ChartTooltip'
import { cursorSliderProps, HoverOverlay } from '../primitives/HoverOverlay'

/**
 * The chrome `BandStrip` and `MirroredBars` share around their own marks — the slot axis, the
 * keyboard/pointer overlay and the tooltip shell — so the two `useBandPlot` kinds cannot drift in
 * any of them. Internal; neither is exported from a barrel.
 *
 * theme-allow-file hand-rolled-plot — the slot axis and overlay of the two declared banded
 * exceptions (`BandStrip`, `MirroredBars`), which carry the same waiver for the same reason.
 */

/** A 0..1 share. Non-finite (a 0/0 fold count) reads as "nothing is absent" — the conservative
 * end, since the alternative is a band that does not render at all. */
export function clampFraction(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

/** The slot axis under a `height`-tall band row, plus the hover/keyboard overlay over it. */
export function BandAxisOverlay<T>({
  band,
  height,
  getX,
  formatX,
  ariaLabel,
}: {
  band: BandPlot<T>
  height: number
  getX: (d: T) => string
  formatX: (key: string) => string
  ariaLabel: string | undefined
}) {
  return (
    <>
      <AxisBottomDate
        top={height}
        scale={band.scale}
        tickValues={band.tickValues}
        tickFormat={(v) => formatX(String(v))}
        anchorTerminals={band.xAnchorTerminals}
        {...(band.xWrapWidth !== undefined && { wrapWidth: band.xWrapWidth })}
      />
      <HoverOverlay
        width={band.plotWidth}
        height={height}
        {...cursorSliderProps({ cursor: band.cursor, data: band.bands, getX, formatX, ariaLabel })}
      />
    </>
  )
}

/** The tooltip shell: header (+ badge), the consumer's prepended rows, the kind's own derived
 * `children` rows, the consumer's extra rows. Renders nothing off-hover or with `tooltip: false`. */
export function BandTooltip<T>({
  band,
  tooltip,
  getX,
  hidden,
  children,
}: {
  band: BandPlot<T>
  tooltip: BandTooltipConfig<T> | false | undefined
  getX: (d: T) => string
  hidden: ReadonlySet<string>
  children: ReactNode
}) {
  const { point } = band
  if (!band.showTooltip || point === null) return null
  const cfg = tooltip === false ? undefined : tooltip
  const badge = cfg?.label === undefined ? null : cfg.label(point)
  return (
    <ChartTooltipFloat anchor={band.tooltipAnchor} ariaLive={band.ariaLive}>
      <TooltipHeader
        date={getX(point)}
        {...(cfg?.formatHeader !== undefined && {
          format: (key: string) => cfg.formatHeader?.(key, point) ?? key,
        })}
        {...(badge !== null && { label: badge.text, labelColor: badge.color })}
      />
      <TooltipBody>
        {cfg?.prependRows?.(point, { hidden })}
        {children}
        {cfg?.extraRows?.(point, { hidden })}
      </TooltipBody>
    </ChartTooltipFloat>
  )
}
