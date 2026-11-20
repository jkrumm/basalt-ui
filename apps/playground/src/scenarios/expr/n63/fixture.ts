/** A seeded morning for one athlete: 30 days of recovery with its drivers, and the last 24 hours of stress and body battery every 3 minutes. */

export type Day = {
  at: Date
  recovery: number | null
  hrv: number | null
  sleep: number | null
  rhr: number | null
}

export type Sample = { at: Date; stress: number; battery: number }

export type Morning = {
  days: readonly Day[]
  samples: readonly Sample[]
  /** The night in the samples: its first and last slot, null when no sleep was recorded. */
  asleep: { from: Date; to: Date } | null
  /** The run of samples over the high-stress line, null when stress never passed it. */
  high: { from: Date; to: Date; samples: number } | null
  /** The days with no sleep recorded, oldest first. */
  noSleepDays: readonly Date[]
}

const FIXTURES = ['rest', 'nosleep', 'calm'] as const
export type FixtureName = (typeof FIXTURES)[number]

export const REST_BELOW = 40
export const PUSH_FROM = 70
export const ZONES = [25, 50, 75] as const
export const HIGH_ABOVE = 75

const DAY_COUNT = 30
const STEP_MIN = 3
const SAMPLE_COUNT = 480
const MISSING_DAY = 17
/** Today 07:30 UTC: the end of the 24 hours. */
const NOW = Date.UTC(2026, 10, 20, 7, 30)

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

const isFixture = (name: string | undefined): name is FixtureName =>
  FIXTURES.some((known) => known === name)

function makeDays(name: FixtureName | undefined): Day[] {
  const rand = seeded(63)
  const days = Array.from({ length: DAY_COUNT }, (_, i): Day => {
    const noise = rand() - 0.5
    const raw = 66 + 13 * Math.sin(i * 0.7) + 8 * Math.sin(i * 1.9 + 1) + noise * 10
    const recovery = Math.round(clamp(raw, 8, 97))
    return {
      at: new Date(Date.UTC(2026, 10, 20 - (DAY_COUNT - 1) + i, 12)),
      recovery,
      hrv: Math.round(38 + recovery * 0.36 + (rand() - 0.5) * 6),
      sleep: Math.round((5.6 + recovery * 0.027 + (rand() - 0.5) * 0.8) * 10) / 10,
      rhr: Math.round(60 - recovery * 0.11 + (rand() - 0.5) * 3),
    }
  })
  days[22] = { ...days[22]!, recovery: 18, hrv: 41, sleep: 5.4, rhr: 59 }
  days[25] = { ...days[25]!, recovery: 96, hrv: 74, sleep: 8.3, rhr: 49 }
  days[MISSING_DAY] = {
    at: days[MISSING_DAY]!.at,
    recovery: null,
    hrv: null,
    sleep: null,
    rhr: null,
  }
  const today = days[DAY_COUNT - 1]!
  if (name === 'rest') {
    days[DAY_COUNT - 1] = { at: today.at, recovery: 0, hrv: 29, sleep: 3.1, rhr: 66 }
  } else if (name === 'nosleep') {
    days[DAY_COUNT - 1] = { at: today.at, recovery: null, hrv: null, sleep: null, rhr: null }
  } else {
    days[DAY_COUNT - 1] = { at: today.at, recovery: 78, hrv: 66, sleep: 7.7, rhr: 51 }
  }
  return days
}

/** Minutes after the window start of a clock time that day or the next. */
const at = (hour: number, minute: number, nextDay = false): number =>
  ((nextDay ? 24 : 0) + hour) * 60 + minute - (7 * 60 + 30)

function makeSamples(name: FixtureName | undefined) {
  const rand = seeded(24)
  const slept = name !== 'nosleep'
  const short = name === 'rest'
  const sleepFrom = slept ? (short ? at(3, 50, true) : at(23, 10)) : -1
  const sleepTo = slept ? at(6, 50, true) : -1
  const highFrom = name === 'calm' ? -1 : at(15, 0)
  const highTo = name === 'calm' ? -1 : at(18, 0)
  const wakeBattery = short ? 38 : 92

  const stress = Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const t = i * STEP_MIN
    const noise = rand()
    if (t >= highFrom && t < highTo) {
      const mid = (highFrom + highTo) / 2
      const lift = 1 - Math.abs(t - mid) / ((highTo - highFrom) / 2)
      return Math.round(clamp(77 + lift * 20 + noise * 6, 77, 100))
    }
    if (slept && t >= sleepFrom && t < sleepTo) {
      return noise < 0.18 ? 0 : Math.round(noise * 22)
    }
    const wave = Math.sin(t / 95) * 11
    const base = !slept && t > at(0, 0, true) ? 38 : 33
    return Math.round(clamp(base + wave + noise * 16, 12, 70))
  })

  const lowAt = slept ? sleepFrom : at(2, 10, true)
  const drain = stress.map((s, i) => (i * STEP_MIN <= lowAt ? 0.5 + s / 50 : 0))
  const drainTotal = drain.reduce((sum, w) => sum + w, 0)
  let spent = 0
  const battery = stress.map((_, i) => {
    const t = i * STEP_MIN
    if (t <= lowAt) {
      spent += drain[i]!
      return Math.round(74 - (69 * spent) / drainTotal)
    }
    if (slept && t < sleepTo) {
      const share = (t - sleepFrom) / (sleepTo - sleepFrom)
      return Math.round(
        5 + ((wakeBattery - 5) * (1 - Math.exp(-2.4 * share))) / (1 - Math.exp(-2.4)),
      )
    }
    if (slept) return wakeBattery - Math.round((t - sleepTo) / 40)
    return 5 + Math.round(rand() * 3)
  })

  const samples: Sample[] = stress.map((s, i) => ({
    at: new Date(NOW - (SAMPLE_COUNT - i) * STEP_MIN * 60_000),
    stress: s,
    battery: battery[i]!,
  }))
  return { samples, sleepFrom, sleepTo, slept }
}

/** The morning for a `?fixture=` value: unknown or absent names give the ordinary push morning. */
export function morning(fixture: string | undefined): Morning {
  const name = isFixture(fixture) ? fixture : undefined
  const days = makeDays(name)
  const { samples, sleepFrom, sleepTo, slept } = makeSamples(name)
  const over = samples.filter((s) => s.stress > HIGH_ABOVE)
  const first = over[0]
  const last = over.at(-1)
  const slot = STEP_MIN * 60_000
  return {
    days,
    samples,
    asleep: slept
      ? {
          from: new Date(NOW - (SAMPLE_COUNT * STEP_MIN - sleepFrom) * 60_000),
          to: new Date(NOW - (SAMPLE_COUNT * STEP_MIN - sleepTo) * 60_000),
        }
      : null,
    high:
      first && last
        ? { from: first.at, to: new Date(last.at.getTime() + slot), samples: over.length }
        : null,
    noSleepDays: days.flatMap((d) => (d.recovery === null ? [d.at] : [])),
  }
}
