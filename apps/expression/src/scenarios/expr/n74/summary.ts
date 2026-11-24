import { DAYS, DAY_MS, LAST_DAY, multiple, isNew, isSilent } from './fixture'
import type { Wallet } from './fixture'

export type Verdict = 'most' | 'new' | 'silent' | 'grew' | 'flat' | 'fell'

export type Row = Wallet & {
  verdict: Verdict
  /** Dollars gained or lost against the 30 days before. */
  change: number
}

export type Day = {
  at: Date
  /** The wallet that grew most; null when none did. */
  grew: number | null
  /** The wallet with no spend before; null when there is none. */
  fresh: number | null
  /** Every other wallet together, or all wallets when none answers. */
  rest: number
}

export type Summary = {
  rows: readonly Row[]
  days: readonly Day[]
  /** The first day the wallet that grew most ran at three times its usual day. */
  takeoff: Date | null
  /** The first day the new wallet spent. */
  start: Date | null
  /** The first day of the last window. */
  boundary: Date
  /** The wallet whose spend grew by the largest multiple of what it spent before. */
  grower: Row | null
  /** Wallets with spend and nothing before it. */
  fresh: readonly Row[]
  silent: readonly Row[]
  totalPrev: number
  totalLast: number
  maxTokens: number
}

/** A rise under this multiple is not growth: the month ran at the usual level. */
const GROWTH_FLOOR = 1.25

export function summarize(wallets: readonly Wallet[]): Summary {
  const named = wallets.filter((w) => w.kind !== 'Small callers')
  let top: Wallet | null = null
  for (const w of named) {
    const m = multiple(w)
    if (m === null || m < GROWTH_FLOOR) continue
    if (top === null || m > (multiple(top) ?? 0)) top = w
  }
  const rows = wallets.map((w): Row => {
    const m = multiple(w) ?? 1
    const verdict: Verdict =
      w === top
        ? 'most'
        : isNew(w)
          ? 'new'
          : isSilent(w)
            ? 'silent'
            : m >= GROWTH_FLOOR
              ? 'grew'
              : m <= 0.9
                ? 'fell'
                : 'flat'
    return { ...w, verdict, change: w.last - w.prev }
  })
  const grower = rows.find((r) => r.verdict === 'most') ?? null
  const fresh = rows.filter((r) => r.verdict === 'new')
  const dayAt = (i: number): Date => new Date(LAST_DAY - (2 * DAYS - 1 - i) * DAY_MS)
  const days = Array.from({ length: wallets.length === 0 ? 0 : 2 * DAYS }, (_, i): Day => ({
    at: dayAt(i),
    grew: grower?.daily[i] ?? null,
    fresh: fresh[0]?.daily[i] ?? null,
    rest: rows.reduce((a, r) => (r === grower || r === fresh[0] ? a : a + (r.daily[i] ?? 0)), 0),
  }))
  const usual = grower ? grower.prev / DAYS : 0
  const takeoffAt = grower?.daily.findIndex((v, i) => i >= DAYS && v >= 3 * usual) ?? -1
  const startAt = fresh[0]?.daily.findIndex((v) => v > 0) ?? -1
  return {
    rows,
    days,
    takeoff: takeoffAt >= 0 ? dayAt(takeoffAt) : null,
    start: startAt >= 0 ? dayAt(startAt) : null,
    boundary: dayAt(DAYS),
    grower,
    fresh,
    silent: rows.filter((r) => r.verdict === 'silent'),
    totalPrev: wallets.reduce((a, w) => a + w.prev, 0),
    totalLast: wallets.reduce((a, w) => a + w.last, 0),
    maxTokens: Math.max(0, ...wallets.map((w) => w.tokensLast)),
  }
}
