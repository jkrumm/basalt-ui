/**
 * Hourly forecast for the spot, 48 hours from Saturday 06:00 (local time of the spot, held as UTC):
 * wind at 10 m in m/s, direction in degrees with a confidence, and the peak gust over the trailing
 * 1, 3 and 6 hours. Seeded and deterministic. A sea breeze builds on Saturday, a second one on
 * Sunday morning, and a front turns the wind offshore on Sunday at 14:00.
 *
 * `?fixture=calm`: wind under 5 kt with zero hours, so no hour is in range.
 * `?fixture=storm`: the front arrives with 52 kt and an 80 kt gust, far past the rider's range.
 */
export type Hour = {
  at: Date
  ms: number
  dir: number
  conf: number
  g1: number
  g3: number
  g6: number
}

export type FixtureName = 'default' | 'calm' | 'storm'

const START = Date.UTC(2026, 10, 21, 6)
const HOUR_MS = 3_600_000
const HOURS = 48
const KT = 1.943844

export function fixtureName(raw: string | undefined): FixtureName {
  if (raw === 'calm' || raw === 'storm') return raw
  return 'default'
}

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const bump = (h: number, at: number, width: number): number => Math.exp(-(((h - at) / width) ** 2))
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const round = (v: number, digits: number): number => Math.round(v * 10 ** digits) / 10 ** digits

type Raw = { kt: number; dir: number; conf: number; gust: number }

/** Wind in knots, direction, confidence and gust factor of one hour, before noise. */
function profile({ day, h }: { day: number; h: number }, name: FixtureName): Raw {
  if (day === 0) {
    const kt = 4 + 15 * bump(h, 14, 4.2)
    return { kt, dir: 232 + 6 * Math.sin(h / 3), conf: 0.5 + 0.4 * Math.min(kt / 14, 1), gust: 0.2 }
  }
  if (day === 1 && h < 14) {
    const kt = 4 + 17 * bump(h, 12, 3.6)
    const dir = 240 + (h >= 8 ? (h - 8) * 4 : 0)
    return {
      kt,
      dir,
      conf: h === 13 ? 0.58 : 0.5 + 0.4 * Math.min(kt / 14, 1),
      gust: h < 8 ? 0.3 : 0.38,
    }
  }
  const front: Record<number, { dir: number; conf: number; gust: number }> = {
    14: { dir: 190, conf: 0.42, gust: 0.5 },
    15: { dir: 118, conf: 0.45, gust: 0.5 },
    16: { dir: 84, conf: 0.62, gust: 0.45 },
    17: { dir: 72, conf: 0.8, gust: 0.45 },
  }
  const abs = day === 1 ? h : h + 24
  const kt = 28 * Math.exp(-Math.max(0, abs - 15) / 22)
  const f = front[abs] ?? { dir: 68, conf: 0.86, gust: 0.42 }
  const storm = name === 'storm' && (abs === 15 || abs === 16)
  return {
    kt: storm ? kt * 1.8 : kt,
    dir: f.dir,
    conf: f.conf,
    gust: storm ? f.gust * 1.5 : f.gust,
  }
}

function calmProfile({ h }: { h: number }): Raw {
  const kt = 2.4 * Math.max(0, Math.sin(h / 2.6))
  return { kt, dir: 235, conf: 0.15, gust: 0.4 }
}

export function buildHours(name: FixtureName): readonly Hour[] {
  const rand = seeded(62)
  const peaks: number[] = []
  const rows = Array.from({ length: HOURS }, (_, i) => {
    const abs = 6 + i
    const slot = { day: Math.floor(abs / 24), h: abs % 24 }
    const raw = name === 'calm' ? calmProfile(slot) : profile(slot, name)
    const kt = Math.max(0, raw.kt + (rand() - 0.5) * 1.6)
    const ms = round(kt / KT, 1)
    const gustMs = name === 'calm' ? ms + 0.6 * rand() : ms * (1 + raw.gust + (rand() - 0.5) * 0.08)
    peaks.push(round(gustMs, 1))
    return {
      at: new Date(START + i * HOUR_MS),
      ms,
      dir: Math.round(raw.dir + (rand() - 0.5) * 6),
      conf: round(clamp(raw.conf + (rand() - 0.5) * 0.06, 0.1, 0.95), 2),
    }
  })
  const trailing = (i: number, n: number): number =>
    Math.max(...peaks.slice(Math.max(0, i - n + 1), i + 1))
  return rows.map((r, i) => ({
    ...r,
    g1: Math.max(r.ms, trailing(i, 1)),
    g3: Math.max(r.ms, trailing(i, 3)),
    g6: Math.max(r.ms, trailing(i, 6)),
  }))
}
