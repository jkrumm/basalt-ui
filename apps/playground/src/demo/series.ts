/**
 * App-side series colors — the consumer-series pattern.
 *
 * The framework ships NO `BASALT.series` tree (series colors are domain data). The pairs are authored once
 * in `../basalt.tokens`, which `tokens:css --extra` reads; a chart series takes the `{ light, dark }` pair,
 * which resolves per scheme.
 */
import tokens from '../basalt.tokens'

export const DEMO_SERIES = tokens.series.demo
export const CALENDAR_SERIES = tokens.series.calendar
export const BAR_SERIES = tokens.series.bar
export const SERVED_SERIES = tokens.series.served
export const FLEET6_SERIES = tokens.series.fleet6
