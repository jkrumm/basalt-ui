/** Ninety mornings of resting heart rate (bpm) and overnight HRV (ms), seeded so every load is the same. */

export type Morning = { date: Date; rhr: number | null; hrv: number | null }

type Shape = {
  /** Change of the signal over the last 28 days, in its own unit. */
  rhrTail: number
  hrvTail: number
  noise: boolean
  /** The last N mornings carry no HRV reading. */
  hrvGap: number
  /** A sick morning: resting rate up, HRV down. */
  sick: boolean
}

const FIXTURE_NAMES = ['improving', 'declining', 'stable', 'flat', 'sparse'] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

const SHAPES: Record<FixtureName, Shape> = {
  improving: { rhrTail: -4.6, hrvTail: 0.8, noise: true, hrvGap: 0, sick: true },
  declining: { rhrTail: 0.6, hrvTail: -8, noise: true, hrvGap: 0, sick: false },
  stable: { rhrTail: 0.2, hrvTail: -0.4, noise: true, hrvGap: 0, sick: false },
  flat: { rhrTail: 0, hrvTail: 0, noise: false, hrvGap: 0, sick: false },
  sparse: { rhrTail: -4.6, hrvTail: 0, noise: true, hrvGap: 24, sick: false },
}

export const isFixtureName = (value: string | undefined): value is FixtureName =>
  FIXTURE_NAMES.some((name) => name === value)

export const MORNINGS = 90
const LAST_MORNING = Date.UTC(2026, 10, 16)
const DAY_MS = 86_400_000
const SICK_MORNING = 40

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildMornings(name: FixtureName): readonly Morning[] {
  const shape = SHAPES[name]
  const random = mulberry32(2211)
  const gauss = (): number => (random() + random() + random() - 1.5) * 2
  const tailStart = MORNINGS - 28
  return Array.from({ length: MORNINGS }, (_, i) => {
    const tail = Math.max(0, i - tailStart + 1) / 28
    const drift = shape.noise ? Math.sin(i / 11) : 0
    const rhrMissing = random() < 0.08
    const hrvMissing = random() < 0.1 || i >= MORNINGS - shape.hrvGap
    const sick = shape.sick && i === SICK_MORNING
    const rhr = 55 + drift * 0.3 + tail * shape.rhrTail + (shape.noise ? gauss() * 0.9 : 0)
    const hrv = 62 - drift * 0.8 + tail * shape.hrvTail + (shape.noise ? gauss() * 2.2 : 0)
    return {
      date: new Date(LAST_MORNING - (MORNINGS - 1 - i) * DAY_MS),
      rhr: rhrMissing ? null : Math.round((sick ? 66 : rhr) * 10) / 10,
      hrv: hrvMissing ? null : Math.round((sick ? 44 : hrv) * 10) / 10,
    }
  })
}
