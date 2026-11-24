import type { Format } from 'basalt-ui'

const tenths = (v: number): number => Math.round(v * 10) / 10 + 0

/**
 * One decimal with a true minus and no unit; `+ 0` turns a rounded -0 into 0.
 * cycle-expression-10: the kit's `number` formatter prints an ASCII hyphen for a negative, so the minus is swapped here.
 */
export function degrees(f: Format, v: number): string {
  return f
    .number(tenths(v), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace('-', '\u2212')
}

/** A signed gap between two readings: '+3.1 °C'. */
export function gapText(f: Format, v: number): string {
  return `${tenths(v) > 0 ? '+' : ''}${degrees(f, v)} °C`
}

const clock = (f: Format, at: Date): string =>
  f.time(at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** 'Thu 05:00'. */
export const moment = (f: Format, at: Date): string => `${f.date(at, 'weekday')} ${clock(f, at)}`

/** '19 Nov', no year. */
export const dayMonth = (f: Format, at: Date): string => f.date(at, 'short', { year: undefined })
