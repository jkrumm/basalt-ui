import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis'
import type { AxisScale, TickFormatter, TickRendererProps } from '@visx/axis'
import { VX } from '../../tokens'
import { ROTATED_LABEL_OFFSET } from '../layout/auto-margin'
import { fmtAxisDate } from '../utils/format'
import { useChartMetrics } from './chart-tier'

/**
 * Tick label font — mono, per `docs/DESIGN-SPEC.md` §5 ("ticks mono 10.5px faint"). Not a `VX.*`
 * ref (the token layer is off-limits to font-family additions here) — a plain reference to the
 * `--basalt-font-mono` var that `styles.css` already defines. Exported so `CartesianChart`'s own
 * end-of-line labels (the same mono tick font, painted outside any `Axis*` primitive here) read it
 * rather than keeping a second, driftable copy of the literal.
 */
export const TICK_FONT_FAMILY = 'var(--basalt-font-mono)'

/** Horizontal padding between the tick's gridline and the near edge of its label's halo. */
const INSIDE_LABEL_PAD_X = 4
/** Gap kept between the tick's gridline and the near edge of an inside label. */
const INSIDE_LABEL_GAP = 3
/** Halo stroke width, px — wide enough to clear a mark drawn directly under the digits. */
const INSIDE_LABEL_HALO_WIDTH = 3
/**
 * A tick within this many line-heights of the plot's top edge (y=0) flips its label BELOW the
 * tick line instead of above it — the SVG viewBox is sized exactly to the plot height, so an
 * "above" label at the very top tick would otherwise clip against it.
 */
const TOP_CLEARANCE_LINES = 1

/** Tick label colour. Default `VX.faint`; a dual-axis chart tints it with its series' colour. */
type TickColor = { tickColor?: string }
const DEFAULT_TICK_COLOR = VX.faint

/**
 * Custom tick renderer for an inside-placed y label: a `paint-order: stroke` halo (the surface
 * colour stroked wide, under the fill) instead of an opaque background chip — the chip covered
 * whatever mark sat under it (P1-5), a halo only pushes the mark's edge outward one stroke-width.
 * Flips to sit BELOW its tick line near the plot's top edge instead of clipping against the SVG's
 * own viewBox.
 */
function InsideTickLabel({ x, y, formattedValue, fontSize, fill }: TickRendererProps) {
  if (formattedValue === undefined) return null
  const size = typeof fontSize === 'number' ? fontSize : VX.axisFont
  const lineHeight = Math.round(size * 1.3)
  const nearTop = y <= lineHeight * TOP_CLEARANCE_LINES
  const centerY = nearTop
    ? y + INSIDE_LABEL_GAP + lineHeight / 2
    : y - INSIDE_LABEL_GAP - lineHeight / 2
  return (
    <text
      x={x + INSIDE_LABEL_PAD_X}
      y={centerY}
      dominantBaseline="middle"
      textAnchor="start"
      fill={fill}
      stroke={VX.surface.panel}
      strokeWidth={INSIDE_LABEL_HALO_WIDTH}
      paintOrder="stroke"
      fontFamily={TICK_FONT_FAMILY}
      fontSize={size}
    >
      {formattedValue}
    </text>
  )
}

/** Themed left numeric axis — baked-in theme colors + font size. The tick font tracks the ambient
 * chart tier (`docs/CHARTS-SPEC.md` §8); a caller measuring its own gutter must measure at the
 * SAME size (`chartMetrics().axisFont` into `autoMargin`'s `fontPx`), or the measured label
 * and the painted one stop being the same string's width. */
export function AxisLeftNumeric({
  scale,
  numTicks = 5,
  tickFormat,
  tickValues,
  inside = false,
  tickColor = DEFAULT_TICK_COLOR,
}: TickColor & {
  scale: AxisScale
  numTicks?: number
  tickFormat?: TickFormatter<number>
  /** Exact tick positions (e.g. a compass axis at 0/90/180/270). Overrides `numTicks`. */
  tickValues?: readonly number[]
  /** Labels drawn over the grid, left-aligned on a surface-coloured background chip (above their
   * line, or below it for a tick within one line-height of the plot's top edge) — the caller
   * reserves no gutter for them (`docs/CHARTS-SPEC.md` §8). */
  inside?: boolean
}) {
  const { axisFont } = useChartMetrics()
  return (
    <AxisLeft
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      {...(tickValues !== undefined && { tickValues: [...tickValues] })}
      {...(inside && { tickLength: 0, hideTicks: true, tickComponent: InsideTickLabel })}
      tickLabelProps={
        inside
          ? { fill: tickColor, fontSize: axisFont }
          : {
              fill: tickColor,
              fontFamily: TICK_FONT_FAMILY,
              fontSize: axisFont,
              dx: -4,
            }
      }
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
  tickValues,
  tickColor = DEFAULT_TICK_COLOR,
}: TickColor & {
  scale: AxisScale
  /** Left offset inside the Group (typically xMax). Required since AxisRight needs positioning. */
  left: number
  numTicks?: number
  tickFormat?: TickFormatter<number>
  /** Exact tick positions (e.g. a compass axis at 0/90/180/270). Overrides `numTicks`. */
  tickValues?: readonly number[]
}) {
  const { axisFont } = useChartMetrics()
  return (
    <AxisRight
      left={left}
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      {...(tickValues !== undefined && { tickValues: [...tickValues] })}
      tickLabelProps={{
        fill: tickColor,
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
 * Themed bottom numeric axis — the numeric twin of {@link AxisLeftNumeric}, for a plot whose x is
 * a continuous number rather than a date/category (e.g. `sky-panorama.tsx`'s azimuth 0–360°,
 * `docs/CHARTS-SPEC.md` issue #52). Exists so a bespoke continuous-x plot — declared exempt from
 * `CartesianChart` by a `theme-allow-file hand-rolled-plot` waiver, since the point-scale x axis
 * that primitive builds cannot represent one — stops re-implementing tick text/color/font by hand.
 */
export function AxisBottomNumeric({
  scale,
  top,
  numTicks = 5,
  tickFormat,
  tickValues,
}: {
  scale: AxisScale
  top: number
  numTicks?: number
  tickFormat?: TickFormatter<number>
  /** Exact tick positions (e.g. a compass axis at 0/90/180/270). Overrides `numTicks`. */
  tickValues?: readonly number[]
}) {
  const { axisFont } = useChartMetrics()
  return (
    <AxisBottom
      top={top}
      scale={scale}
      numTicks={numTicks}
      {...(tickFormat !== undefined && { tickFormat })}
      {...(tickValues !== undefined && { tickValues: [...tickValues] })}
      tickLabelProps={{
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: axisFont,
        textAnchor: 'middle',
      }}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}

/**
 * Nudge a rotated tick label back onto its tick. Both are the d3 idiom for the angle: a 45° label
 * hangs from the tick's lower-left, a 90° one is centred on the tick's vertical line.
 *
 * Imported, never re-declared: `autoMargin` measures the gutter THROUGH this same nudge
 * (`rotatedLabelExtents`), and a second copy here is exactly how the painted label came to sit
 * 6px left of the box the measurement had reserved (`docs/CHARTS-SPEC.md` §1).
 */
const ROTATED_OFFSET = ROTATED_LABEL_OFFSET

/** `textAnchor` of one x label: inward at the two terminals when asked, centred otherwise. */
export function terminalAnchor(input: {
  anchorTerminals: boolean
  index: number
  count: number
}): 'start' | 'middle' | 'end' {
  const { anchorTerminals, index, count } = input
  if (!anchorTerminals || count < 2) return 'middle'
  if (index === 0) return 'start'
  return index === count - 1 ? 'end' : 'middle'
}

/** Themed bottom date axis — baked-in smartTicks + DD.MM formatting. */
export function AxisBottomDate({
  scale,
  top,
  tickValues,
  tickFormat = fmtAxisDate,
  rotate,
  anchorTerminals = false,
  wrapWidth,
}: {
  scale: AxisScale
  top: number
  tickValues: string[]
  /** First label anchored `start`, last `end`, so the terminals stay inside the plot instead of
   * overflowing it. Ignored when rotated. */
  anchorTerminals?: boolean
  /** Wrap each label to this many px (SVG tspans) instead of thinning or rotating it. */
  wrapWidth?: number
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
  const { axisFont } = useChartMetrics()
  const rotated = rotate === undefined ? undefined : ROTATED_OFFSET[rotate]
  return (
    <AxisBottom
      top={top}
      scale={scale}
      tickValues={tickValues}
      tickFormat={tickFormat}
      tickLabelProps={(_value, index, values) => ({
        fill: VX.faint,
        fontFamily: TICK_FONT_FAMILY,
        fontSize: axisFont,
        textAnchor:
          rotated !== undefined
            ? 'end'
            : terminalAnchor({ anchorTerminals, index, count: values.length }),
        ...(rotate !== undefined && { angle: -rotate }),
        ...(rotated !== undefined && { dx: rotated.dx, dy: rotated.dy }),
        // A wrapped label's default baseline anchors its LAST line, which stacks the earlier ones
        // UPWARD into the axis line and ticks (R2C-7) — `autoMargin`'s `bottomLines` reserves room
        // BELOW the axis, so the reservation and the paint have to agree on which line anchors.
        ...(wrapWidth !== undefined &&
          rotated === undefined && { width: wrapWidth, verticalAnchor: 'start', dy: '-0.35em' }),
      })}
      stroke={VX.surface.border}
      tickStroke={VX.surface.border}
    />
  )
}
