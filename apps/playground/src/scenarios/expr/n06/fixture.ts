/**
 * n06 fixture: cumulative quota use (percent of the cap) sampled every 10 minutes over one 5-hour
 * window, with sudden jumps. Fixed clock (2026-11-14, UTC); no `Date.now()`.
 */
import { seeded } from '../../fixture-utils'

export const FIXTURE_NAMES = ['runout', 'safe', 'exhausted', 'zero'] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

export const isFixtureName = (value: unknown): value is FixtureName =>
  FIXTURE_NAMES.some((n) => n === value)

const MIN = 60_000
const WINDOW_MIN = 300
const STEP_MIN = 10
const NOW_MIN = 200

export const WINDOW_START = new Date(Date.UTC(2026, 10, 14, 9, 0))
export const NOW = new Date(WINDOW_START.getTime() + NOW_MIN * MIN)
export const RESET = new Date(WINDOW_START.getTime() + WINDOW_MIN * MIN)

export type Sample = { at: Date; used: number }

type Shape = { trickle: number; jumps: Readonly<Record<number, number>> }

const SHAPES: Record<FixtureName, Shape> = {
  // Close call: lands at the cap about 18 minutes before the reset.
  runout: { trickle: 1.1, jumps: { 4: 14, 9: 11, 13: 16, 17: 9 } },
  // Light use with two small jumps: ends well under the cap.
  safe: { trickle: 0.9, jumps: { 4: 8, 13: 9 } },
  // Extreme: the cap is hit at step 15 and the line stays flat there.
  exhausted: { trickle: 1.1, jumps: { 4: 14, 9: 20, 13: 24, 15: 30 } },
  // Extreme: a window with no use at all.
  zero: { trickle: 0, jumps: {} },
}

export function samplesFor(name: FixtureName): readonly Sample[] {
  const { trickle, jumps } = SHAPES[name]
  const rand = seeded(1106)
  const out: Sample[] = []
  let used = 0
  for (let step = 0; step <= NOW_MIN / STEP_MIN; step++) {
    if (step > 0) used += trickle * (0.5 + rand()) + (jumps[step] ?? 0)
    used = Math.min(100, Math.round(used * 10) / 10)
    out.push({ at: new Date(WINDOW_START.getTime() + step * STEP_MIN * MIN), used })
  }
  return out
}
