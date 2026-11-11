/**
 * The v3 tooltip surface as data: rows with a swatch of four shapes, one short date form, the show
 * and hide delays, and the pin rule. The surface itself (raised, inside the card, off the first
 * point's tick labels) is the engine's tooltip placed by `core/portal.ts` and styled by
 * `chart-box.module.css`; this module is what a chart hands that tooltip.
 *
 * Every swatch is the engine row's `color`, a CSS `background` shorthand, so no shape needs markup.
 */
import type { ChartTooltipRow as EngineTooltipRow } from '@tanstack/charts/types/core'
import type { ChartSelection, SeriesColor } from '../contract'
import { cssColor } from './cartesian-adapt'

/** Milliseconds before the tooltip appears and before it starts to hide, so a pointer crossing the plot does not flash it. */
export const TOOLTIP_DELAY = { show: 150, hide: 100 } as const

/** `solid` a filled chip, `dashed` a dashed rule, `dot` a round marker, `line` a solid rule. */
export type RowSwatch = 'solid' | 'dashed' | 'dot' | 'line'

/** One row of a tooltip, as data. */
export type TooltipRow = {
  label: string
  value: string
  color?: SeriesColor
  swatch?: RowSwatch
}

/** A 2px dashed rule across the swatch's middle. */
const dashed = (color: string): string =>
  `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 4px) center / 100% 2px no-repeat`

/** A 2px solid rule across the swatch's middle. */
const line = (color: string): string =>
  `linear-gradient(${color}, ${color}) center / 100% 2px no-repeat`

/** A 6px disc centred in the swatch. */
const dot = (color: string): string =>
  `radial-gradient(circle closest-side, ${color} 0 99%, transparent 100%) center / 6px 6px no-repeat`

/** The engine row `color` for a swatch shape: a plain colour for `solid`, a `background` for the rest. */
export function swatchBackground(color: string, swatch: RowSwatch = 'solid'): string {
  if (swatch === 'dashed') return dashed(color)
  if (swatch === 'line') return line(color)
  if (swatch === 'dot') return dot(color)
  return color
}

/** Tooltip rows as the engine's: the swatch folded into the colour, a row with no colour keeps none. */
export function engineRows(rows: readonly TooltipRow[]): EngineTooltipRow[] {
  return rows.map(({ label, value, color, swatch }) => ({
    label,
    value,
    ...(color !== undefined && { color: swatchBackground(cssColor(color), swatch) }),
  }))
}

const SHORT_DATE = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** The one date form a tooltip header uses (`Sep 14, 2026`), read in UTC like the time axis. */
export function shortDate(date: Date): string {
  return Number.isFinite(date.getTime()) ? SHORT_DATE.format(date) : '–'
}

export type TooltipBehaviour = {
  showDelay: number
  hideDelay: number
  /** A click pins the tooltip. With `selection` set a click selects instead, so it never pins. */
  pinOnClick: boolean
}

/** The delays and the pin rule for a chart; `selection` makes a click a selection. */
export function tooltipBehaviour(
  opts: { selection?: ChartSelection<never> | undefined } = {},
): TooltipBehaviour {
  return {
    showDelay: TOOLTIP_DELAY.show,
    hideDelay: TOOLTIP_DELAY.hide,
    pinOnClick: opts.selection === undefined,
  }
}
