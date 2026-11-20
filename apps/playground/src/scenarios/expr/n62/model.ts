import { createFormat } from 'basalt-ui'
import type { Hour } from './fixture'

/** The rider's range, the usable directions, and the limits that decide a verdict. */
export const RANGE = { min: 12, max: 25 } as const
export const SECTOR = { from: 200, to: 290 } as const
export const SURE = 0.6
export const GUSTY_ABOVE = 1.3
/** The kit clamps the y axis here, so one extreme gust cannot flatten the rest. */
export const CAP_KT = 45

const KT_PER_MS = 1.943844
export const toKt = (ms: number): number => ms * KT_PER_MS
export const inSector = (dir: number): boolean => dir >= SECTOR.from && dir <= SECTOR.to

const FMT = createFormat()
const CLOCK = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const
const clock = (at: Date): string => FMT.time(at, CLOCK)
export const stamp = (at: Date): string => `${FMT.date(at, 'weekday')} ${clock(at)}`
export const whole = (n: number): string => FMT.number(n, { maximumFractionDigits: 0 })
export const tenth = (n: number): string =>
  FMT.number(n, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export type HourState = 'light' | 'ride' | 'strong' | 'offshore'
export const VERDICTS = ['Steady', 'Gusty', 'Light', 'Strong', 'Offshore'] as const
export type Verdict = (typeof VERDICTS)[number]
export const HOUR_WORD: Record<HourState, string> = {
  ride: 'Ride',
  light: 'Light',
  strong: 'Strong',
  offshore: 'Offshore',
}

/** Light wind is nothing to ride whichever way it blows; in range, direction decides; then the range. */
export function stateOf(h: Hour): HourState {
  const kt = toKt(h.ms)
  if (kt < RANGE.min) return 'light'
  if (!inSector(h.dir)) return 'offshore'
  return kt > RANGE.max ? 'strong' : 'ride'
}

export type Run = {
  id: string
  from: Date
  to: Date
  state: HourState
  hours: number
  label: string
  verdict: Verdict
  avgKt: number
  gustKt: number
  ratio: number
}

const HOUR_MS = 3_600_000
const OFF_RIDE: Record<Exclude<HourState, 'ride'>, Verdict> = {
  light: 'Light',
  strong: 'Strong',
  offshore: 'Offshore',
}

/** Consecutive hours in one state, each run closing at the next hour mark. */
export function runsOf(hours: readonly Hour[]): Run[] {
  const groups: Hour[][] = []
  for (const h of hours) {
    const last = groups.at(-1)
    if (last !== undefined && stateOf(last[0] as Hour) === stateOf(h)) last.push(h)
    else groups.push([h])
  }
  return groups.map((g) => {
    const first = g[0] as Hour
    const state = stateOf(first)
    const from = first.at
    const to = new Date((g.at(-1) as Hour).at.getTime() + HOUR_MS)
    const ratio = g.reduce((s, h) => s + h.g1 / Math.max(h.ms, 0.1), 0) / g.length
    const verdict: Verdict =
      state === 'ride' ? (ratio > GUSTY_ABOVE ? 'Gusty' : 'Steady') : OFF_RIDE[state]
    return {
      id: `run-${from.getTime()}`,
      from,
      to,
      state,
      hours: g.length,
      label: g.length < 24 ? `${stamp(from)}–${clock(to)}` : `${stamp(from)}, ${g.length} h`,
      verdict,
      avgKt: toKt(g.reduce((s, h) => s + h.ms, 0) / g.length),
      gustKt: toKt(Math.max(...g.map((h) => h.g1))),
      ratio,
    }
  })
}
