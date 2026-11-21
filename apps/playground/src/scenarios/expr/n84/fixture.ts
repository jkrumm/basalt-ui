/** The key report of one team: daily spend per key and model for 60 days, seeded so every build draws the same days. */

export type KeyId = 'team' | 'gateway'
export type ModelId = 'atlas-large' | 'atlas-fast' | 'nova-code' | 'lumen-embed'
/** One report row: a day, the key it was billed through (`null` for spend with no key), the model and the spend in US dollars. */
export type Entry = { day: string; key: KeyId | null; model: ModelId; spend: number }
export type Report = {
  entries: readonly Entry[]
  /** Key and day pairs the report has no row for at all, as opposed to a day with zero spend. */
  unreported: readonly { key: KeyId; day: string }[]
}
export type Variant = 'rest' | 'idle' | 'spike'

export const CAP = 500
export const DAY_COUNT = 60
export const WINDOW_DAYS = 30
const FIRST_DAY = Date.UTC(2026, 8, 22)
/** Day index of the gateway cutover, 5 Nov: the team key should bill nothing from here on. */
export const CUTOVER_INDEX = 44
const MODELS: readonly ModelId[] = ['atlas-large', 'atlas-fast', 'nova-code', 'lumen-embed']

export const dayAt = (index: number): string =>
  new Date(FIRST_DAY + index * 86_400_000).toISOString().slice(0, 10)

/** A small seeded generator (mulberry32), so the fixture never changes between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SHARE: Record<ModelId, number> = {
  'atlas-large': 0.42,
  'atlas-fast': 0.3,
  'nova-code': 0.2,
  'lumen-embed': 0.08,
}
const MISSING_INDEX = 38
const SPIKE_INDEX = 33
const round2 = (n: number): number => Math.round(n * 100) / 100

/** Team key spend a day: a slow ramp as the CI jobs grow, until the cutover moves the traffic. */
const teamDaily = (index: number): number => 10 + (index / CUTOVER_INDEX) ** 2 * 38

/** What still bills on the team key after the cutover: a nightly job on one model, now and then a second. */
function leaks(index: number, rand: () => number): { model: ModelId; spend: number }[] {
  const out: { model: ModelId; spend: number }[] = []
  if (index % 7 !== 3) out.push({ model: 'atlas-fast', spend: 3 + rand() * 3 })
  if (index % 5 === 0) out.push({ model: 'nova-code', spend: 2 + rand() * 4 })
  if (index % 9 === 2) out.push({ model: 'lumen-embed', spend: 0.8 + rand() * 1.2 })
  if (index === 51) out.push({ model: 'atlas-large', spend: 6 + rand() * 3 })
  return out
}

export function makeReport(variant: Variant): Report {
  const rand = seeded(84)
  const entries: Entry[] = []
  const unreported: { key: KeyId; day: string }[] = []
  for (let i = 0; i < DAY_COUNT; i++) {
    const day = dayAt(i)
    const afterCutover = i >= CUTOVER_INDEX
    if (i === MISSING_INDEX) unreported.push({ key: 'team', day })
    else if (!afterCutover) {
      const jitter = 0.85 + rand() * 0.3
      const boost = variant === 'spike' && i === SPIKE_INDEX ? 1800 : 0
      for (const model of MODELS) {
        const spend = round2(
          teamDaily(i) * jitter * SHARE[model] + (model === 'atlas-large' ? boost : 0),
        )
        entries.push({ day, key: 'team', model, spend })
      }
    } else if (variant === 'idle') {
      for (const model of MODELS) {
        entries.push({
          day,
          key: 'team',
          model,
          spend: round2(teamDaily(CUTOVER_INDEX) * (0.85 + rand() * 0.3) * SHARE[model]),
        })
      }
    } else {
      for (const l of leaks(i, rand))
        entries.push({ day, key: 'team', model: l.model, spend: round2(l.spend) })
    }
    if (afterCutover && variant !== 'idle') {
      const jitter = 0.85 + rand() * 0.3
      for (const model of MODELS) {
        entries.push({ day, key: 'gateway', model, spend: round2(17 * jitter * SHARE[model]) })
      }
    }
    if (afterCutover && i % 4 === 1) {
      entries.push({
        day,
        key: null,
        model: i % 8 === 1 ? 'nova-code' : 'atlas-fast',
        spend: round2(1.5 + rand() * 2),
      })
    }
  }
  return { entries, unreported }
}
