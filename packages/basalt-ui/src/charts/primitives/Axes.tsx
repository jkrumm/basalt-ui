import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis'
import type { AxisScale, TickFormatter } from '@visx/axis'
import { VX } from '../../tokens'
import { fmtAxisDate } from '../utils/format'

/**
 * Tick label font — mono, per `docs/DESIGN-SPEC.md` §5 ("ticks mono 10.5px faint"). Not a `VX.*`
 * ref (the token layer is off-limits to font-family additions here) — a plain reference to the
 * `--basalt-font-mono` var that `styles.css` already defines.
 */
const TICK_FONT_FAMILY = 'var(--basalt-font-mono)'

/** Themed left numeric axis — baked-in theme colors + font size. */
export function AxisLeftNumeric({
  scale,
  numTicks = 5,
  tickFormat,
}: {
  scale: AxisScale
  numTicks?: number
  tickFormat?: TickFormatter<number>
}) {
  return (
    <AxisLeft
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: VX.axisFont,
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
  return (
    <AxisRight
      left={left}
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: VX.axisFont,
        dx: 4,
      }}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}

/** Themed bottom date axis — baked-in smartTicks + DD.MM formatting. */
export function AxisBottomDate({
  scale,
  top,
  tickValues,
}: {
  scale: AxisScale
  top: number
  tickValues: string[]
}) {
  return (
    <AxisBottom
      top={top}
      scale={scale}
      tickValues={tickValues}
      tickFormat={fmtAxisDate}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: VX.axisFont,
        textAnchor: 'middle',
      }}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}
