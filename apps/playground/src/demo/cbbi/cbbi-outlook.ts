/**
 * The suggestion engine — what the panel's `Today` section says, and the evidence it says it on.
 *
 * Every line is a CONDITIONAL base rate: take the days in history that look like today under some
 * predicate, read the forward price return 90 / 180 / 365 days on from each of them, and state the
 * median and the positive share against the unconditional {@link baseRates}. No cycle dates, no
 * verdicts, nothing hardcoded about 2026.
 *
 * **The gate is the whole design** (`ANALYSIS.md` §"What the runtime should implement" #8). Daily
 * rows overlap almost completely, so 800 qualifying days can be four independent events; the
 * effective sample size is the EPISODE count. Under {@link MIN_EPISODES} episodes or
 * {@link MIN_OBSERVATIONS} forward observations, {@link conditionalOutlook} returns `null` and the
 * caller drops the line — "no precedent" is the honest render, and it is what kills the two
 * unsupported lines the offline study found (a Puell/composite pair with one usable observation,
 * and a Puell−MVRV spread with zero).
 */
import { CBBI_METRIC_KEYS, CBBI_METRIC_LABEL, ratio } from './cbbi-data'
import type { CbbiMetricKey, CbbiRow } from './cbbi-data'
import type { MetricHealth } from './cbbi-diagnostics'

/**
 * The forward horizons, in CALENDAR days.
 *
 * Not index offsets: `parseCbbi` keeps only the days that carry both a price and an official
 * confidence, so one dropped upstream day shifts every index past it and `rows[i + 90]` silently
 * becomes a 91-day return. Every horizon below is resolved against {@link CbbiRow.t} instead.
 */
export const OUTLOOK_HORIZONS = [90, 180, 365] as const

export type OutlookHorizon = (typeof OUTLOOK_HORIZONS)[number]

/** Fewer independent episodes than this and the statistic is one cycle wearing a sample's clothes. */
export const MIN_EPISODES = 8
/** Fewer 90-day forward observations than this and there is nothing to take a median of. */
export const MIN_OBSERVATIONS = 200

const DAY_MS = 86_400_000

export type ForwardStat = {
  /** How many qualifying days had a row `h` days later. */
  readonly n: number
  /** Median forward return, as a FRACTION (`1.384` is +138.4%). */
  readonly median: number
  /** Share of those returns above zero, as a fraction. */
  readonly positive: number
}

export type Outlook = {
  /** Qualifying days. Always ≥ `episodes`, usually far more — see the module doc. */
  readonly days: number
  /** Maximal runs of consecutive qualifying days — the effective sample size. */
  readonly episodes: number
  readonly fwd: { readonly 90: ForwardStat; readonly 180: ForwardStat; readonly 365: ForwardStat }
}

/**
 * What a predicate is handed beside the row, computed once for the whole series so a predicate
 * stays a comparison rather than a scan.
 *
 * `daysSinceAth` counts from the RUNNING all-time high — a top the series itself declares, with no
 * lookahead and no cycle table. On a day that sets a new high it is `0`.
 */
export type OutlookContext = {
  /** The row's position in the series — what a lookback predicate needs. */
  readonly index: number
  /**
   * The running ATH's own ROW INDEX, carried through the pass.
   *
   * Never `index − daysSinceAth`: that subtracts a calendar count from a position in an array the
   * parser may have left gaps in, and lands on the wrong row the first time upstream drops a day.
   */
  readonly athIndex: number
  /** Calendar days since the running all-time high — a DISPLAY figure, never an index offset. */
  readonly daysSinceAth: number
  /** `price / athPrice − 1`, so `−0.357` is 35.7% below the high. Never positive. */
  readonly drawdownFromAth: number
  /** The OFFICIAL confidence that day — the composite every threshold below is written against. */
  readonly composite: number
  /** The last row of the series, so a predicate can compare a day against today. */
  readonly latestRow: CbbiRow
}

export type OutlookPredicate = (row: CbbiRow, ctx: OutlookContext) => boolean

/** One pass: running ATH — its index, its date and its price — and the drawdown/age they imply. */
function buildContexts(rows: readonly CbbiRow[]): OutlookContext[] {
  const latestRow = rows[rows.length - 1]
  if (!latestRow) return []

  const out: OutlookContext[] = []
  let athPrice = -Infinity
  let athT = rows[0]?.t ?? 0
  let athIndex = 0
  rows.forEach((row, index) => {
    if (row.price >= athPrice) {
      athPrice = row.price
      athT = row.t
      athIndex = index
    }
    out.push({
      index,
      athIndex,
      daysSinceAth: Math.round((row.t - athT) / DAY_MS),
      drawdownFromAth: athPrice > 0 ? row.price / athPrice - 1 : 0,
      composite: row.confidence,
      latestRow,
    })
  })
  return out
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  values.sort((a, b) => a - b)
  const mid = values.length >> 1
  const high = values[mid] ?? 0
  if (values.length % 2 === 1) return high
  return (high + (values[mid - 1] ?? high)) / 2
}

/** The row timestamps alone, ascending — built once per pass so a horizon costs a binary search. */
function timeline(rows: readonly CbbiRow[]): number[] {
  return rows.map((row) => row.t)
}

/**
 * The row `days` CALENDAR days from `index` — the first one at or after that date — or `-1`.
 *
 * The one function that turns a day horizon into a row, in BOTH directions (a negative `days` is
 * the 90-day lookback in {@link todaySuggestions}). A date outside the series answers `-1` rather
 * than clamping to an end, so a horizon the data cannot carry is dropped instead of shortened.
 */
function rowAtOffset(times: readonly number[], index: number, days: number): number {
  const from = times[index]
  const first = times[0]
  const last = times[times.length - 1]
  if (from === undefined || first === undefined || last === undefined) return -1

  const target = from + days * DAY_MS
  if (target < first || target > last) return -1

  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((times[mid] ?? first) < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Forward returns at one horizon over the given row indices. */
function forwardStat(
  rows: readonly CbbiRow[],
  times: readonly number[],
  indices: readonly number[],
  horizon: number,
): ForwardStat {
  const returns: number[] = []
  let positive = 0
  for (const index of indices) {
    const from = rows[index]
    const toIndex = rowAtOffset(times, index, horizon)
    const to = toIndex === -1 ? undefined : rows[toIndex]
    if (!from || !to || from.price <= 0) continue
    const change = to.price / from.price - 1
    returns.push(change)
    if (change > 0) positive += 1
  }
  if (returns.length === 0) return { n: 0, median: 0, positive: 0 }
  return { n: returns.length, median: medianOf(returns), positive: positive / returns.length }
}

function statsFor(rows: readonly CbbiRow[], indices: readonly number[]): Outlook['fwd'] {
  const times = timeline(rows)
  return {
    90: forwardStat(rows, times, indices, 90),
    180: forwardStat(rows, times, indices, 180),
    365: forwardStat(rows, times, indices, 365),
  }
}

/**
 * The days matching `predicate`, their episode count and their forward returns — or `null` when the
 * gate is not met, which the caller renders as "no precedent" rather than as a weaker statistic.
 */
export function conditionalOutlook(
  rows: readonly CbbiRow[],
  predicate: OutlookPredicate,
): Outlook | null {
  const contexts = buildContexts(rows)
  const indices: number[] = []
  let episodes = 0
  let previous = -2

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const ctx = contexts[i]
    if (!row || !ctx) continue
    if (!predicate(row, ctx)) continue
    if (i !== previous + 1) episodes += 1
    previous = i
    indices.push(i)
  }

  const fwd = statsFor(rows, indices)
  if (episodes < MIN_EPISODES || fwd[90].n < MIN_OBSERVATIONS) return null
  return { days: indices.length, episodes, fwd }
}

/** The unconditional comparison column — every day of the series, same three horizons. */
export function baseRates(rows: readonly CbbiRow[]): Outlook['fwd'] {
  return statsFor(
    rows,
    rows.map((_row, index) => index),
  )
}

// ── Suggestions ──────────────────────────────────────────────────────────────────────────────────

export type SuggestionTone = 'good' | 'warn' | 'bad' | 'neutral'

export type Suggestion = {
  readonly key: string
  /** Two or three words for the row's label — the sentence itself is `text` (`PanelRow` clips). */
  readonly lead: string
  readonly text: string
  /** The evidence behind the line, mono in the row's readout. `'No precedent'` when there is none. */
  readonly support: string
  readonly tone: SuggestionTone
  /** Present on a "this metric is flagged" line — the panel renders a Disable button. */
  readonly action?: 'disable'
  readonly metric?: CbbiMetricKey
}

export const NO_PRECEDENT = 'No precedent'

/**
 * The candidate predicates, at module scope so each is ONE function identity for the life of the
 * page rather than a fresh closure per evaluation. Each is written against `ctx` and `row` only —
 * a predicate that needed the series would have to close over it, and #4 below is the one that
 * does (a 90-day lookback), so it stays inside {@link todaySuggestions}.
 */
const pastTop: OutlookPredicate = (_row, ctx) =>
  ctx.daysSinceAth >= 300 &&
  ctx.daysSinceAth <= 400 &&
  ctx.composite >= 0.35 &&
  ctx.composite <= 0.5

const lowMvrv: OutlookPredicate = (row) => {
  const value = row.metrics.MVRV
  return value !== null && value <= 0.15
}

const lowPair: OutlookPredicate = (row) => {
  const mvrv = row.metrics.MVRV
  const reserveRisk = row.metrics.ReserveRisk
  return mvrv !== null && reserveRisk !== null && mvrv <= 0.15 && reserveRisk <= 0.25
}

/** `0.969` → `96.9%`. */
function share(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** `1.384` → `+138%`; `-0.263` → `−26%`. A forward return is never read to a decimal. */
function signed(value: number): string {
  const percent = value * 100
  return `${percent >= 0 ? '+' : '−'}${Math.abs(Math.round(percent))}%`
}

function support(outlook: Outlook): string {
  return `${outlook.days} days · ${outlook.episodes} episodes`
}

/** Positive 1-year median reads as `good`, negative as `bad` — the tone is the data's, not ours. */
function toneOf(outlook: Outlook): SuggestionTone {
  return outlook.fwd[365].median >= 0 ? 'good' : 'bad'
}

/**
 * Today's supported lines, in the order the panel renders them.
 *
 * Each conditional candidate is emitted only when TODAY satisfies its own predicate — the sentences
 * quote today's reading, so a line about a condition today is not in would be a claim about nobody.
 * Then the outlook gate applies on top: anything returning `null` is dropped rather than softened.
 */
export function todaySuggestions(
  rows: readonly CbbiRow[],
  health: Record<CbbiMetricKey, MetricHealth>,
): Suggestion[] {
  const latest = rows[rows.length - 1]
  const contexts = buildContexts(rows)
  const times = timeline(rows)
  const today = contexts[contexts.length - 1]
  if (!latest || !today) return []

  const base = baseRates(rows)
  const out: Suggestion[] = []

  // 1 — where we are relative to the last high, and what that has meant.
  if (pastTop(latest, today)) {
    const outlook = conditionalOutlook(rows, pastTop)
    if (outlook) {
      out.push({
        key: 'after-top',
        lead: 'After the top',
        text:
          `${today.daysSinceAth} days past the cycle top with the composite at ${ratio(today.composite)} — ` +
          `${outlook.episodes} prior episodes, median ${signed(outlook.fwd[365].median)} at 1y, ` +
          `${share(outlook.fwd[365].positive)} positive vs ${share(base[365].positive)} base.`,
        support: support(outlook),
        tone: toneOf(outlook),
      })
    }
  }

  // 2 — MVRV on its own floor.
  const mvrv = latest.metrics.MVRV
  if (mvrv !== null && lowMvrv(latest, today)) {
    const outlook = conditionalOutlook(rows, lowMvrv)
    if (outlook) {
      out.push({
        key: 'mvrv',
        lead: 'MVRV',
        text:
          `MVRV at ${ratio(mvrv)} has ${outlook.episodes} prior episodes: ` +
          `${signed(outlook.fwd[180].median)} median at 6mo (${share(outlook.fwd[180].positive)} positive), ` +
          `${signed(outlook.fwd[365].median)} at 1y (${share(outlook.fwd[365].positive)}).`,
        support: support(outlook),
        tone: toneOf(outlook),
      })
    }
  }

  // 3 — the pair. Only worth stating while both metrics are still trusted.
  const reserveRisk = latest.metrics.ReserveRisk
  const pairTrusted = health.MVRV.verdict !== 'broken' && health.ReserveRisk.verdict !== 'broken'
  if (mvrv !== null && reserveRisk !== null && pairTrusted && lowPair(latest, today)) {
    const outlook = conditionalOutlook(rows, lowPair)
    if (outlook) {
      out.push({
        key: 'mvrv-reserve-risk',
        lead: 'MVRV + Reserve Risk',
        text:
          `ReserveRisk ${ratio(reserveRisk)} + MVRV ${ratio(mvrv)} together: ${outlook.episodes} episodes, ` +
          `${signed(outlook.fwd[180].median)} at 6mo, ${signed(outlook.fwd[365].median)} at 1y, ` +
          `${share(outlook.fwd[365].positive)} positive.`,
        support: support(outlook),
        tone: toneOf(outlook),
      })
    }
  }

  // 4 — the bearish one. Same band as (1), but only while the composite is FALLING into it.
  // The lookback is a DATE offset like every forward horizon, not `rows[index − 90]`.
  const composite90dAgo = (ctx: OutlookContext): number | null => {
    const at = rowAtOffset(times, ctx.index, -90)
    return at === -1 ? null : (rows[at]?.confidence ?? null)
  }
  const fallingMid: OutlookPredicate = (_row, ctx) => {
    const before = composite90dAgo(ctx)
    if (before === null) return false
    return ctx.composite >= 0.35 && ctx.composite <= 0.45 && before - ctx.composite >= 0.15
  }
  if (fallingMid(latest, today)) {
    const outlook = conditionalOutlook(rows, fallingMid)
    if (outlook) {
      out.push({
        key: 'falling-mid',
        lead: 'Falling composite',
        text:
          `The composite is at ${ratio(today.composite)}, down ${ratio((composite90dAgo(today) ?? today.composite) - today.composite)} over 90 days — ` +
          `${outlook.episodes} prior episodes, median ${signed(outlook.fwd[180].median)} at 6mo, ` +
          `${share(outlook.fwd[180].positive)} positive.`,
        support: support(outlook),
        tone: 'bad',
      })
    }
  }

  // 5 — advisory, no forward claim: a metric that reads high by habit this cycle.
  const puell = latest.metrics.Puell
  const puellHealth = health.Puell
  if (puell !== null && puell >= 0.9 && puellHealth.verdict === 'noisy') {
    out.push({
      key: 'puell-inflated',
      lead: 'Puell',
      text:
        `Puell ${ratio(puell)} is in its top zone, but it has spent ${share(puellHealth.hotShareWindow)} ` +
        `of the last 4 years there (lifetime ${share(puellHealth.hotShareAll)}) — down-weight it.`,
      support: `${share(puellHealth.hotShareWindow)} vs ${share(puellHealth.hotShareAll)}`,
      tone: 'warn',
    })
  }

  // 6 — always. Two numbers, no inference past them.
  out.push(lowestSince(rows, contexts))

  // 7 — one per flagged metric, with the Disable action.
  for (const key of CBBI_METRIC_KEYS) {
    const metric = health[key]
    if (metric.verdict !== 'broken' && metric.verdict !== 'stale') continue
    out.push({
      key: `flagged-${key}`,
      lead: CBBI_METRIC_LABEL[key],
      text: `${CBBI_METRIC_LABEL[key]} flagged: ${metric.reason} — disable it?`,
      support: `J ${metric.j.toFixed(2)}`,
      tone: metric.verdict === 'broken' ? 'bad' : 'warn',
      action: 'disable',
      metric: key,
    })
  }

  return out
}

/**
 * The composite's floor since the last all-time high, and the series floor beside it. Both numbers
 * are stated and nothing is concluded from them — a reader comparing the two is the point.
 */
function lowestSince(rows: readonly CbbiRow[], contexts: readonly OutlookContext[]): Suggestion {
  const last = contexts[contexts.length - 1]
  const athIndex = last?.athIndex ?? 0
  let sinceTop: CbbiRow | undefined
  let allTime: CbbiRow | undefined

  rows.forEach((row, index) => {
    if (!allTime || row.confidence < allTime.confidence) allTime = row
    if (index < athIndex) return
    if (!sinceTop || row.confidence < sinceTop.confidence) sinceTop = row
  })

  if (!sinceTop || !allTime) {
    return {
      key: 'composite-floor',
      lead: 'Composite floor',
      text: 'The series carries no reading to compare today against.',
      support: NO_PRECEDENT,
      tone: 'neutral',
    }
  }

  return {
    key: 'composite-floor',
    lead: 'Composite floor',
    text:
      `Lowest composite since the top: ${ratio(sinceTop.confidence)} on ${sinceTop.day}; ` +
      `the lowest in the whole series is ${ratio(allTime.confidence)} on ${allTime.day}.`,
    support: `${rows.length} days`,
    tone: 'neutral',
  }
}
