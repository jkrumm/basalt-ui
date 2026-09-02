import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis'
import type { AxisScale, TickFormatter } from '@visx/axis'
import { VX } from '../../tokens'
import { fmtAxisDate } from '../utils/format'
import { useChartTierMetrics } from './chart-tier'

/**
 * Tick label font — mono, per `docs/DESIGN-SPEC.md` §5 ("ticks mono 10.5px faint"). Not a `VX.*`
 * ref (the token layer is off-limits to font-family additions here) — a plain reference to the
 * `--basalt-font-mono` var that `styles.css` already defines.
 */
const TICK_FONT_FAMILY = 'var(--basalt-font-mono)'

/** Themed left numeric axis — baked-in theme colors + font size. The tick font tracks the ambient
 * chart tier (`docs/CHARTS-SPEC.md` §8); a caller measuring its own gutter must measure at the
 * SAME size (`chartTierMetrics().axisFont` into `autoMargin`'s `fontPx`), or the measured label
 * and the painted one stop being the same string's width. */
export function AxisLeftNumeric({
  scale,
  numTicks = 5,
  tickFormat,
}: {
  scale: AxisScale
  numTicks?: number
  tickFormat?: TickFormatter<number>
}) {
  const { axisFont } = useChartTierMetrics()
  return (
    <AxisLeft
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: axisFont,
        dx: -4,
      }}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}

/** Themed right numeric axis — mirrors AxisLeftNumeric for dual-axis charts. */
export function AxisRightNumeric({
  scale,
  left,
  numTicks = 5,
  tickFormat,
}: {
  scale: AxisScale
  /** Left offset inside the Group (typically xMax). Required since AxisRight needs positioning. */
  left: number
  numTicks?: number
  tickFormat?: TickFormatter<number>
}) {
  const { axisFont } = useChartTierMetrics()
  return (
    <AxisRight
      left={left}
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: axisFont,
        dx: 4,
      }}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}

/**
 * Nudge a rotated tick label back onto its tick. Both are the d3 idiom for the angle: a 45° label
 * hangs from the tick's lower-left, a 90° one is centred on the tick's vertical line.
 */
const ROTATED_OFFSET: Record<45 | 90, { dx: number; dy: number }> = {
  45: { dx: -6, dy: 2 },
  90: { dx: -4, dy: 4 },
}

/** Themed bottom date axis — baked-in smartTicks + DD.MM formatting. */
export function AxisBottomDate({
  scale,
  top,
  tickValues,
  tickFormat = fmtAxisDate,
  rotate,
}: {
  scale: AxisScale
  top: number
  tickValues: string[]
  /**
   * Defaults to `fmtAxisDate` (DD.MM). Override for a sub-day window, where DD.MM collapses every
   * tick to the same label.
   */
  tickFormat?: TickFormatter<string>
  /**
   * Tilt each tick label counter-clockwise by 45° or 90°, anchored at its right edge — the answer
   * to labels too wide to sit side by side. The caller owns the deepened bottom gutter it needs
   * (`autoMargin({ rotate })`, `docs/CHARTS-SPEC.md` §1); this only paints them.
   */
  rotate?: 45 | 90
}) {
  const { axisFont } = useChartTierMetrics()
  const rotated = rotate === undefined ? undefined : ROTATED_OFFSET[rotate]
  return (
    <AxisBottom
      top={top}
      scale={scale}
      tickValues={tickValues}
      tickFormat={tickFormat}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: axisFont,
        textAnchor: rotated === undefined ? 'middle' : 'end',
        ...(rotate !== undefined && { angle: -rotate }),
        ...(rotated !== undefined && { dx: rotated.dx, dy: rotated.dy }),
      }}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}
