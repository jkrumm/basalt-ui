/** Wi-Fi samples every 5 minutes for 7 days, seeded and deterministic, and what the page derives from them. */

export type Sample = {
  at: number
  connected: boolean
  signal: number | null
  noise: number | null
  rate: number | null
  wifiRtt: number | null
  wiredRtt: number
}

export type Hour = {
  at: number
  signal: number | null
  noise: number | null
  rate: number | null
  wifiRtt: number | null
  wiredRtt: number
}

export type Stretch = { from: number; to: number; minutes: number; offline: boolean }

export type FixtureName = 'week' | 'clean' | 'down'

/** The Wi-Fi signal below which a failover would stall video and calls, in dBm. */
export const WEAK_BELOW = -72

const STEP_MS = 5 * 60_000
const HOUR_MS = 60 * 60_000
const SAMPLES = 7 * 24 * 12
const END = Date.UTC(2026, 10, 16, 9, 0)

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hour offsets from the start of the week where interference pulls the signal down, in hours. */
const DIPS: Record<FixtureName, readonly { from: number; to: number; depth: number }[]> = {
  week: [
    { from: 52.2, to: 55, depth: 22 },
    { from: 113.5, to: 116.5, depth: 26 },
  ],
  clean: [],
  down: [{ from: 70, to: 73, depth: 24 }],
}

export function buildSamples(name: FixtureName): readonly Sample[] {
  const rand = seeded(name === 'week' ? 19 : name === 'clean' ? 7 : 91)
  const start = END - (SAMPLES - 1) * STEP_MS
  const out: Sample[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const at = start + i * STEP_MS
    const hour = (i * 5) / 60
    const hourOfDay = new Date(at).getUTCHours()
    let signal = -59 - 3 * Math.sin((hourOfDay / 24) * Math.PI * 2) + (rand() - 0.5) * 4
    for (const dip of DIPS[name]) {
      if (hour >= dip.from && hour < dip.to) signal -= dip.depth * (0.8 + 0.3 * rand())
    }
    const downNow = name === 'down' && i >= SAMPLES - 72
    const dropped = name === 'week' && i >= 1100 && i < 1107
    const connected = !downNow && !dropped && signal > -93
    const wiredRtt = Math.round((1.1 + rand() * 0.6) * 10) / 10
    const weak = signal < WEAK_BELOW
    // Noise goes unread in about 6% of samples, and for a whole stretch on day 5 of the week fixture.
    const noiseGap = rand() < 0.06 || (name === 'week' && i > 1500 && i < 1640)
    out.push({
      at,
      connected,
      signal: connected ? Math.round(signal) : null,
      noise: connected && !noiseGap ? Math.round(-95 + (rand() - 0.5) * 3 + (weak ? 4 : 0)) : null,
      rate: connected ? Math.max(6, Math.round(866 + (signal + 59) * 28 - rand() * 60)) : null,
      wifiRtt: connected
        ? Math.round((3.5 + rand() * 2 + (weak ? 40 + rand() * 90 : 0)) * 10) / 10
        : null,
      wiredRtt,
    })
  }
  return out
}

const isWeak = (s: Sample): boolean => !s.connected || (s.signal ?? 0) < WEAK_BELOW

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length

const lowest = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.min(...values)

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((v): v is number => v !== null)

export function toHours(samples: readonly Sample[]): readonly Hour[] {
  const hours: Hour[] = []
  for (let i = 0; i < samples.length; i += 12) {
    const chunk = samples.slice(i, i + 12)
    const first = chunk[0]
    if (first === undefined) continue
    hours.push({
      at: Math.floor(first.at / HOUR_MS) * HOUR_MS,
      // An hour with three or more dropped samples draws as a break, so a disconnect never reads as a line.
      signal:
        chunk.filter((s) => !s.connected).length >= 3
          ? null
          : lowest(present(chunk.map((s) => s.signal))),
      noise: mean(present(chunk.map((s) => s.noise))),
      rate: mean(present(chunk.map((s) => s.rate))),
      wifiRtt: mean(present(chunk.map((s) => s.wifiRtt))),
      wiredRtt: mean(chunk.map((s) => s.wiredRtt)) ?? 0,
    })
  }
  return hours
}

/** Runs of at least three weak samples in a row (15 minutes or more). */
export function weakStretches(samples: readonly Sample[]): readonly Stretch[] {
  const out: Stretch[] = []
  let runStart = -1
  const close = (end: number) => {
    if (runStart >= 0 && end - runStart >= 3) {
      const from = samples[runStart]?.at ?? 0
      const to = (samples[end - 1]?.at ?? 0) + STEP_MS
      const run = samples.slice(runStart, end)
      out.push({
        from,
        to,
        minutes: (end - runStart) * 5,
        offline: run.filter((s) => !s.connected).length * 2 > run.length,
      })
    }
    runStart = -1
  }
  samples.forEach((s, i) => {
    if (!isWeak(s)) return close(i)
    if (runStart < 0) runStart = i
  })
  close(samples.length)
  return out
}

export type Summary = {
  carries: boolean
  latest: Sample
  todayWeakShare: number
  weakMinutes: number
  longest: Stretch | null
  stretches: number
  noiseGapShare: number
  slowestRate: number | null
  wifiMedianRtt: number
  wiredMedianRtt: number
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export function summarise(samples: readonly Sample[], stretches: readonly Stretch[]): Summary {
  const latest = samples[samples.length - 1] as Sample
  const today = samples.slice(-288)
  const weakToday = today.filter(isWeak).length / today.length
  const longest = stretches.reduce<Stretch | null>(
    (best, s) => (best === null || s.minutes > best.minutes ? s : best),
    null,
  )
  const rates = present(samples.map((s) => s.rate))
  return {
    carries: !isWeak(latest) && weakToday <= 0.1,
    latest,
    todayWeakShare: weakToday,
    weakMinutes: stretches.reduce((sum, s) => sum + s.minutes, 0),
    longest,
    stretches: stretches.length,
    noiseGapShare:
      samples.filter((s) => s.connected && s.noise === null).length /
      Math.max(1, samples.filter((s) => s.connected).length),
    slowestRate: rates.length === 0 ? null : Math.min(...rates),
    wifiMedianRtt: median(present(samples.map((s) => s.wifiRtt))),
    wiredMedianRtt: median(samples.map((s) => s.wiredRtt)),
  }
}

export function isFixtureName(value: string | undefined): value is FixtureName {
  return value === 'week' || value === 'clean' || value === 'down'
}
