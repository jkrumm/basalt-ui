/**
 * The rich tooltip as data: a series row may carry its change over the period, a muted reference
 * reading and a status beside its value. The rows stay the engine's (`label`, `value`, `color`), so a
 * chart without any of it keeps the engine's own body; one with any marks its definition rich and
 * the host renders the extra columns (`../tooltip-body.tsx`). Also the sequential status ramp a
 * `colorBy` line, its legend and its tooltip swatch share.
 */
import type { ChartTooltipRow as EngineTooltipRow } from '@tanstack/charts/types/core'
import type { Verdict } from '../../core/ports'
import { CV } from './theme'

/** Which way a value moved, for the arrow and the ink of its change. */
export type ChangeDirection = 'up' | 'down' | 'flat'

/** What a row reads besides its value. Every field is text or a tone: data, never markup. */
export type RowDetail = {
  change?: { text: string; direction: ChangeDirection } | undefined
  /** The muted second reading under the row (`7-day mean 81.9 kg`). */
  reference?: string | undefined
  status?: Verdict | undefined
}

/** An engine row with its detail. */
export type RichRow = EngineTooltipRow & { detail?: RowDetail }

const definitions = new WeakSet<object>()

/** Marks a compiled definition whose tooltip carries detail: its host renders the rich body. */
export function markRich<D extends object>(definition: D): D {
  definitions.add(definition)
  return definition
}

export const isRich = (definition: object): boolean => definitions.has(definition)

const PERCENT = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

const MULTIPLE = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 })

/**
 * The signed percent change from `base` to `value` (`+12.4%`, `−3.0%`, `0.0%`), a multiple past
 * tenfold (`×4,640`); `undefined` when the base is zero or not finite, where a percent says nothing.
 */
export function changeOf(value: number, base: number): RowDetail['change'] {
  if (!Number.isFinite(base) || !Number.isFinite(value) || base === 0) return undefined
  const ratio = (value - base) / Math.abs(base)
  const direction: ChangeDirection = ratio > 0.0005 ? 'up' : ratio < -0.0005 ? 'down' : 'flat'
  // Past tenfold a percent stops reading (`+464,272%`): the change is a multiple of the base.
  if (base > 0 && value / base >= 10)
    return { text: `\u00D7${MULTIPLE.format(value / base)}`, direction }
  const text = PERCENT.format(ratio * 100).replace('-', '\u2212')
  return { text: `${text}%`, direction }
}

/** Steps of the ramp: a line takes one of these per point, so its gradient holds few stops. */
export const RAMP_LEVELS = 21

/** The status ramp at `t` (0 to 1, clamped): good, warn at the middle, bad; reversed for `bad-good`. */
export function rampColor(t: number, ramp: 'good-bad' | 'bad-good' = 'good-bad'): string {
  const clamped = Number.isFinite(t) ? Math.min(Math.max(t, 0), 1) : 0
  const level = Math.round(clamped * (RAMP_LEVELS - 1)) / (RAMP_LEVELS - 1)
  const at = ramp === 'good-bad' ? level : 1 - level
  if (at <= 0) return CV.good
  if (at >= 1) return CV.bad
  if (at === 0.5) return CV.warn
  if (at < 0.5) return `color-mix(in oklab, ${CV.warn} ${Math.round(at * 200)}%, ${CV.good})`
  return `color-mix(in oklab, ${CV.bad} ${Math.round((at - 0.5) * 200)}%, ${CV.warn})`
}

/** The ramp's three anchors, low end first. */
export const rampStops = (ramp: 'good-bad' | 'bad-good' = 'good-bad'): readonly string[] =>
  ramp === 'good-bad' ? [CV.good, CV.warn, CV.bad] : [CV.bad, CV.warn, CV.good]

/** The ramp as one CSS gradient, low end first: the legend's bar. */
export function rampGradientCss(ramp: 'good-bad' | 'bad-good' = 'good-bad'): string {
  return `linear-gradient(90deg, ${rampStops(ramp).join(', ')})`
}

/** Where a reading sits on `domain`, 0 to 1 (a flat domain reads 0). */
export function rampShare(value: number, [lo, hi]: readonly [number, number]): number {
  return hi === lo ? 0 : (value - lo) / (hi - lo)
}
