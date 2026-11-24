/**
 * Five AI wallets (two subscriptions, three API keys) and a tail of small callers folded into one
 * row: spend at API prices and fresh tokens per wallet per day, for the 30 days and the 30 before.
 * Seeded and deterministic; `?fixture=` names an extreme (`runaway`) or a flat month (`quiet`).
 */

export const DAYS = 30

/** The last day of the last window: midnight UTC, fixed so the month never moves. */
export const LAST_DAY = Date.UTC(2026, 10, 19)
export const DAY_MS = 86_400_000

export type WalletKind = 'Subscription' | 'API key' | 'Small callers'

export type Wallet = {
  id: string
  kind: WalletKind
  /** Spend over the 30 days before, US dollars at API prices. */
  prev: number
  /** Spend over the last 30 days. */
  last: number
  /** Fresh tokens over the last 30 days, in millions. */
  tokensLast: number
  /** Fresh tokens over the 30 days before, in millions. */
  tokensPrev: number
  /** Spend per day, the 30 days before first, then the last 30. */
  daily: readonly number[]
  /** Fresh tokens per day, in millions, the same days. */
  dailyTokens: readonly number[]
}

type Spec = {
  id: string
  kind: WalletKind
  prev: number
  last: number
  /** Dollars per million fresh tokens: cache reads are not fresh, so a subscription runs low. */
  price: number
  /** The weight of a day in its window, 0 to 1 in; the window total is spread by it. */
  shape: (day: number, window: 'prev' | 'last', noise: number) => number
}

/** mulberry32: the same seed draws the same month. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const weekday = (day: number): number => (day % 7 === 5 || day % 7 === 6 ? 0.25 : 1)
const steady = (day: number, _w: 'prev' | 'last', noise: number): number =>
  weekday(day) * (0.7 + noise * 0.6)

function window30(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0 || total === 0) return weights.map(() => 0)
  return weights.map((w) => Math.round((w / sum) * total * 100) / 100)
}

function specs(fixture: string | undefined): Spec[] {
  const runaway = fixture === 'runaway'
  const quiet = fixture === 'quiet'
  return [
    { id: 'max', kind: 'Subscription', prev: 540, last: 566, price: 14, shape: steady },
    { id: 'prod', kind: 'API key', prev: 318, last: 294, price: 9, shape: steady },
    {
      id: 'ci-bot',
      kind: 'API key',
      prev: 38,
      last: runaway ? 9400 : quiet ? 41 : 464,
      price: 6,
      // A CI job turned on part-way through the last 30 days.
      shape: (day, w, noise) =>
        w === 'last' && !quiet
          ? day < 9
            ? 0.04
            : 0.3 + day * 0.07 + noise * 0.5
          : steady(day, w, noise),
    },
    {
      id: 'evals',
      kind: 'API key',
      prev: quiet ? 22 : 0,
      last: quiet ? 24 : 187,
      price: 5,
      // Nothing before; then batch runs on a few days.
      shape: (day, w, noise) =>
        quiet
          ? steady(day, w, noise)
          : w === 'prev' || day < 14
            ? 0
            : noise > 0.55
              ? 0.5 + noise * 2
              : 0,
    },
    { id: 'team', kind: 'Subscription', prev: 0, last: 0, price: 14, shape: steady },
    { id: 'other', kind: 'Small callers', prev: 26, last: 31, price: 8, shape: steady },
  ]
}

/** The wallets in the order the page leads with: the answering rows first, the folded tail last. */
export function walletsNamed(fixture: string | undefined): readonly Wallet[] {
  const rand = seeded(7_411)
  const built = specs(fixture).map((s): Wallet => {
    const weights = (w: 'prev' | 'last'): number[] =>
      Array.from({ length: DAYS }, (_, day) => Math.max(0, s.shape(day, w, rand())))
    const daily = [...window30(s.prev, weights('prev')), ...window30(s.last, weights('last'))]
    const dailyTokens = daily.map((v) => Math.round((v / s.price) * 1000) / 1000)
    const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
    return {
      id: s.id,
      kind: s.kind,
      prev: s.prev,
      last: s.last,
      tokensPrev: Math.round(sum(dailyTokens.slice(0, DAYS)) * 10) / 10,
      tokensLast: Math.round(sum(dailyTokens.slice(DAYS)) * 10) / 10,
      daily,
      dailyTokens,
    }
  })
  const tail = built.filter((w) => w.kind === 'Small callers')
  const rest = built
    .filter((w) => w.kind !== 'Small callers')
    .toSorted((a, b) => b.last - b.prev - (a.last - a.prev))
  return [...rest, ...tail]
}

/** The multiple of the 30 days before; null where nothing came before. */
export function multiple(w: Wallet): number | null {
  return w.prev > 0 ? w.last / w.prev : null
}

export const isNew = (w: Wallet): boolean => w.prev === 0 && w.last > 0
export const isSilent = (w: Wallet): boolean => w.prev === 0 && w.last === 0
