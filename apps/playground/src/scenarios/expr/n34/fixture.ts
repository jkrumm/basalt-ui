/** Harbour bar (scenario expr-n34): seeded hourly tide and swell for 48 hours, plus the two limits. */

export type Hour = {
  /** Hours from the first sample. */
  h: number
  at: Date
  /** Water over the bar, metres. */
  tide: number
  /** Significant wave height, metres. */
  swell: number
  /** Wave period, seconds. */
  period: number
  /** The bar is clear and the swell is under the crew's limit. */
  go: boolean
}

export type Window = { from: Hour; to: Hour; hours: number }

export type Harbour = {
  hours: readonly Hour[]
  /** Water the boat needs over the bar, metres. */
  barNeed: number
  /** The wave height the crew will go out in, metres. */
  swellLimit: number
  windows: readonly Window[]
  /** High waters (local maxima of the tide) and how many of them clear the bar. */
  highWaters: number
  clearingHighWaters: number
  /** Hours the bar is clear / the swell is under the limit. */
  clearHours: number
  calmHours: number
}

const FIXTURES = ['calm', 'rough'] as const
export type FixtureName = (typeof FIXTURES)[number]
const isFixtureName = (value: string | undefined): value is FixtureName =>
  FIXTURES.some((name) => name === value)

const START = Date.UTC(2026, 10, 20, 0)
const HOUR_MS = 3_600_000
const TIDAL_HOURS = 12.42
const FIRST_HIGH = 4
const BAR_NEED = 2.8
const SWELL_LIMIT = 1.5
const MEAN_LEVEL = 2
/** Half the tidal range at each high water; the third is a neap tide that never reaches the bar. */
const HIGH_RANGE = [1.25, 1.3, 0.35, 1.2]

/** A small seeded generator, so every load draws the same 48 hours. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (v: number, digits = 1) => Math.round(v * 10 ** digits) / 10 ** digits

function tideAt(h: number): number {
  const phase = (h - FIRST_HIGH) / TIDAL_HOURS
  const lo = Math.max(0, Math.min(HIGH_RANGE.length - 2, Math.floor(phase)))
  const range = HIGH_RANGE[lo]! + (HIGH_RANGE[lo + 1]! - HIGH_RANGE[lo]!) * (phase - lo)
  return MEAN_LEVEL + range * Math.cos(2 * Math.PI * phase)
}

function swellAt(h: number, fixture: FixtureName | undefined, noise: number): number {
  if (fixture === 'rough') {
    // A front that never leaves: a long swell with an extreme at hour 30.
    return (
      2.1 +
      0.5 * Math.sin((2 * Math.PI * (h - 3)) / 26) +
      2 * Math.exp(-(((h - 30) / 5) ** 2)) +
      noise
    )
  }
  if (fixture === 'calm') return 0.5 + 0.35 * Math.sin((2 * Math.PI * (h - 8)) / 24) + noise
  // A swell that builds into the second high water, a squall near hour 30, then eases.
  return (
    0.95 +
    0.65 * Math.sin((2 * Math.PI * (h - 6)) / 30) +
    2 * Math.exp(-(((h - 30) / 2.5) ** 2)) +
    noise
  )
}

export function harbour(fixture: string | undefined): Harbour {
  const name = isFixtureName(fixture) ? fixture : undefined
  const rand = mulberry32(3407)
  const hours: Hour[] = Array.from({ length: 48 }, (_, h) => {
    const tide = round(tideAt(h))
    const swell = Math.max(0.2, round(swellAt(h, name, (rand() - 0.5) * 0.24)))
    const period = round(5.5 + swell * 2.4 + (rand() - 0.5) * 1.2, 0)
    return {
      h,
      at: new Date(START + h * HOUR_MS),
      tide,
      swell,
      period,
      go: tide >= BAR_NEED && swell <= SWELL_LIMIT,
    }
  })

  const windows: Window[] = []
  for (const hour of hours) {
    const last = windows.at(-1)
    if (!hour.go) continue
    if (last !== undefined && last.to.h === hour.h - 1) {
      windows[windows.length - 1] = { ...last, to: hour, hours: last.hours + 1 }
      continue
    }
    windows.push({ from: hour, to: hour, hours: 1 })
  }

  const highs = hours.filter((d, i) => {
    const before = hours[i - 1]
    const after = hours[i + 1]
    return (
      before !== undefined && after !== undefined && d.tide > before.tide && d.tide >= after.tide
    )
  })

  return {
    hours,
    barNeed: BAR_NEED,
    swellLimit: SWELL_LIMIT,
    windows,
    highWaters: highs.length,
    clearingHighWaters: highs.filter((d) => d.tide >= BAR_NEED).length,
    clearHours: hours.filter((d) => d.tide >= BAR_NEED).length,
    calmHours: hours.filter((d) => d.swell <= SWELL_LIMIT).length,
  }
}
