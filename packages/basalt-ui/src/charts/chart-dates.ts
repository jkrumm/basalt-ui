/**
 * The chart layer's one date locale: the axis's day labels, the tooltip header and a sparkline's
 * readout all read the page's `defineFormat` / `BasaltProvider` locale through here (the runtime's
 * when none is set), so no card mixes two orders: `04.10` ticks under a `Sat, Oct 10, 2026` header
 * under a `3 Oct` fact. Every read is UTC, like the time scale that placed the ticks.
 */
import { dateFormat } from '../format/shared'

const utcFormat = (options: Intl.DateTimeFormatOptions, d: Date): string =>
  dateFormat(undefined, { ...options, timeZone: 'UTC' }).format(d)

/** An axis tick's day: `4 Oct` (the page locale's own order). */
export const axisDay = (d: Date): string => utcFormat({ day: 'numeric', month: 'short' }, d)

/** {@link axisDay} with a two-digit year. */
export const axisDayYear = (d: Date): string =>
  utcFormat({ day: 'numeric', month: 'short', year: '2-digit' }, d)

export const monthName = (d: Date): string => utcFormat({ month: 'short' }, d)

/** The tooltip header's date: weekday, day, month and year. */
export const headerDay = (d: Date): string =>
  utcFormat({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, d)

/** A day written out for a readout (`12 Oct`): the same format as an axis tick. */
export const readoutDay = axisDay

/** A clock time for a readout, `HH:MM` in the page locale's digits. */
export const readoutClock = (d: Date): string =>
  utcFormat({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, d)
